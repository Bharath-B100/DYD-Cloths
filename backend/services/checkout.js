const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Settings = require('../models/Settings');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const money = value => Math.round((value + Number.EPSILON) * 100) / 100;
const isProductId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const isCustomId = value => typeof value === 'string' && /^(studio|custom)-[\w-]+$/.test(value);
const requiredText = (value, label, maximum = 200) => {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
        throw fail(`${label} is required and must be at most ${maximum} characters.`);
    }
    return value.trim();
};
const settingNumber = (settings, key, fallback) => {
    const value = settings[key];
    if (value === undefined || value === null || value === '') return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw fail(`Store setting ${key} is invalid. Please contact support.`, 503);
    return number;
};
const fabricSettings = {
    '100% Cotton': ['price_fabric_cotton', 299],
    'Poly Cotton': ['price_fabric_polycotton', 349],
    'Dry Fit': ['price_fabric_dryfit', 379],
    'Premium Cotton': ['price_fabric_premium', 449],
    'Organic Cotton': ['price_fabric_organic', 499]
};

const validArtwork = value => typeof value === 'string' && value.length <= 8_000_000 && /^(data:image\/(png|jpeg|webp);base64,[a-z\d+/=]+$|https?:\/\/[^\s]+$)/i.test(value);

function normalizedDesign(design) {
    // Persist only the current studio format, never arbitrary legacy HTML/URL fields.
    const layers = side => design[side].map(layer => ({
        ...Object.fromEntries(['id', 'type', 'rawSrc', 'text', 'textStyle', 'textSettings', 'name', 'x', 'y', 'scale', 'rotation'].filter(key => layer[key] !== undefined).map(key => [key, layer[key]]))
    }));
    for (const key of ['frontImage', 'backImage']) if (design[key] && !validArtwork(design[key])) throw fail('Invalid design preview.');
    return { isCustom: true, shirtColor: design.shirtColor, fabric: design.fabric, size: design.size,
        frontImage: design.frontImage, backImage: design.backImage, frontLayers: layers('frontLayers'), backLayers: layers('backLayers') };
}

function customPrice(design, settings) {
    if (!design || typeof design !== 'object' || Array.isArray(design) || !Object.hasOwn(fabricSettings, design.fabric)) {
        throw fail('A custom item must include a supported fabric and its saved design.');
    }
    const sides = [design.frontLayers, design.backLayers];
    if (sides.some(layers => !Array.isArray(layers) || layers.length > 50 || layers.some(layer =>
        !layer || !['text', 'image'].includes(layer.type) || !validArtwork(layer.rawSrc)))) {
        throw fail('Custom design layers are invalid. Please reopen the design studio and save the design again.');
    }
    const [key, fallback] = fabricSettings[design.fabric];
    // Studio charges print costs only for image-bearing sides; text has its own per-layer charge.
    const printedSides = sides.filter(layers => layers.some(layer => layer.type !== 'text')).length;
    const textCount = sides.flat().filter(layer => layer.type === 'text').length;
    return money(settingNumber(settings, key, fallback)
        + printedSides * settingNumber(settings, 'price_print_per_side', 150)
        + textCount * settingNumber(settings, 'price_text_per_unit', 50));
}

async function quoteCheckout({ items, couponCode }, userId) {
    if (!Array.isArray(items) || !items.length || items.length > 100) throw fail('Order must contain between 1 and 100 items.');
    const rows = await Settings.find({ key: { $in: ['shipping_fee', 'free_shipping_threshold', 'enable_cod',
        ...Object.values(fabricSettings).map(([key]) => key), 'price_print_per_side', 'price_text_per_unit'] } }).lean();
    const settings = Object.fromEntries(rows.map(row => [row.key, row.value]));
    const normalized = [];
    const quantities = new Map();
    const products = new Map();
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw fail('Invalid order item.');
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) throw fail('Each item quantity must be an integer between 1 and 999.');
        const productId = isProductId(item.productId) ? item.productId.toLowerCase() : item.productId;
        const size = requiredText(item.size, 'Item size', 20);
        const color = requiredText(item.color, 'Item color', 80);
        if (isCustomId(productId)) {
            if (!['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].includes(size)) throw fail('Unsupported custom T-shirt size.');
            const price = customPrice(item.customDesign, settings);
            if (!validArtwork(item.image)) throw fail('Invalid design preview.');
            normalized.push({ productId, name: 'Custom T-Shirt Design', size, color, quantity,
                price, image: item.image,
                customDesign: normalizedDesign(item.customDesign), category: 'custom' });
            continue;
        }
        if (!isProductId(productId)) throw fail('Invalid product ID. Please refresh your cart.');
        let product = products.get(productId);
        if (!product) {
            product = await Product.findOne({ _id: productId, isActive: true }).lean();
            if (!product) throw fail('A product in your cart is no longer available.', 404);
            products.set(productId, product);
        }
        for (const [options, selected, label] of [[product.sizes, size, 'size'], [product.colors, color, 'color']]) {
            if (options?.length && !options.some(option => String(option).toLowerCase() === selected.toLowerCase())) {
                throw fail(`${product.name} is unavailable in the selected ${label}.`);
            }
        }
        const requested = (quantities.get(productId) || 0) + quantity;
        if (requested > product.stock) throw fail(`${product.name} does not have enough stock.`);
        quantities.set(productId, requested);
        const price = product.sellingPrice ?? product.price;
        if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) throw fail(`${product.name} has invalid pricing. Please contact support.`, 503);
        normalized.push({ productId, name: product.name, size, color, quantity, price: money(price), image: product.mainImage,
            customDesign: null, category: product.category });
    }
    const subtotal = money(normalized.reduce((sum, item) => sum + item.price * item.quantity, 0));
    let discountAmount = 0;
    let coupon = null;
    let normalizedCode = null;
    if (couponCode !== undefined && couponCode !== null && couponCode !== '') {
        normalizedCode = requiredText(couponCode, 'Coupon code', 80).toUpperCase();
        coupon = await Coupon.findOne({ code: normalizedCode, isActive: true });
        if (!coupon) throw fail('Invalid coupon code.');
        const result = await coupon.isValid(subtotal, userId, normalized);
        if (!result.valid) throw fail(result.message);
        discountAmount = result.discount;
    }
    const afterDiscount = money(Math.max(0, subtotal - discountAmount));
    const shippingFee = afterDiscount >= settingNumber(settings, 'free_shipping_threshold', 499) || afterDiscount === 0
        ? 0 : money(settingNumber(settings, 'shipping_fee', 99));
    return {
        items: normalized.map(({ category, ...item }) => item), subtotal, discountAmount, shippingFee, tax: 0,
        totalAmount: money(afterDiscount + shippingFee), couponCode: normalizedCode,
        // Only used server-side; callers must omit these when sending the quote to clients.
        coupon, codEnabled: ![false, 'false', 0, '0'].includes(settings.enable_cod)
    };
}

module.exports = { quoteCheckout, customPrice, money, fail, isProductId, isCustomId, requiredText };
