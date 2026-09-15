export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400';

export const productPrice = product => Number(product.sellingPrice ?? product.price ?? 0);

const stableValue = value => {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
    return value;
};

// Custom artwork is part of a variant: two different designs must never overwrite each other.
export const cartItemKey = item => JSON.stringify([
    String(item.id), item.size || 'M', item.color || 'Default',
    item.customDesign ? stableValue(item.customDesign) : null
]);

export const normalizeCart = value => {
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
        if (!item || !item.id || !item.name || !Number.isFinite(Number(item.price)) || Number(item.price) < 0 || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) return [];
        const maxStock = Number.isFinite(Number(item.maxStock)) && item.maxStock != null
            ? Math.max(0, Math.floor(Number(item.maxStock))) : (item.customDesign ? 99 : 999);
        return [{ ...item, id: String(item.id), price: Number(item.price), quantity: Math.min(Number(item.quantity), 999), maxStock, size: item.size || 'M', color: item.color || 'Default', image: item.image || FALLBACK_IMAGE }];
    });
};

// Prefer the latest local quantity while recovering variants saved on another device.
export const mergeCarts = (localCart, serverCart) => Array.from(new Map(
    [...normalizeCart(serverCart), ...normalizeCart(localCart)].map(item => [cartItemKey(item), item])
).values());

export const addCartItem = (items, product) => {
    const quantity = Number(product?.quantity ?? 1);
    const normalized = normalizeCart([{ ...product, quantity }])[0];
    if (!normalized) return { items, error: 'Please choose a valid product and quantity.' };
    const stock = normalized.maxStock;
    const quantityInCart = items.filter(item => String(item.id) === normalized.id).reduce((total, item) => total + item.quantity, 0);
    if (!stock || quantityInCart + quantity > stock) return { items, error: stock ? `Only ${stock} items available in stock (including your cart).` : 'Sorry, this item is out of stock.' };
    const key = cartItemKey(normalized);
    const existing = items.find(item => cartItemKey(item) === key);
    return { items: existing
        ? items.map(item => cartItemKey(item) === key ? { ...normalized, quantity: item.quantity + quantity } : item)
        : [...items, normalized] };
};

export const orderItems = items => items.map(item => ({
    productId: item.id, quantity: item.quantity, size: item.size, color: item.color,
    image: item.image, customDesign: item.customDesign || null
}));
