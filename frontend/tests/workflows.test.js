import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCartItem, cartItemKey, mergeCarts, normalizeCart, orderItems, productPrice } from '../src/utils/cart.js';
import { cloneDesigns, serializeDesigns, studioPriceSetting, validateDraft } from '../src/utils/studioDesign.js';
import { escapeInvoiceData, orderStatusChoices, fetchAdminProducts } from '../src/utils/adminWorkflow.js';
import { safeReturnPath } from '../src/utils/navigation.js';
const product = { id: 'a', name: 'Shirt', price: 300, quantity: 1, size: 'M', color: 'Black', maxStock: 2 };
test('zero stock and aggregate variant stock cannot be purchased', () => {
    assert.match(addCartItem([], { ...product, maxStock: 0 }).error, /out of stock/);
    assert.ok(addCartItem([{ ...product, quantity: 2 }], { ...product, size: 'L' }).error);
});
test('adding a cart item is immutable and increases only its matching variant', () => {
    const old = Object.freeze({ ...product });
    const result = addCartItem(Object.freeze([old]), product);
    assert.equal(result.items[0].quantity, 2);
    assert.equal(old.quantity, 1);
});
test('different artwork is preserved and equivalent key ordering identifies the same design', () => {
    const first = { ...product, customDesign: { text: 'Hello', fabric: 'Cotton' } };
    const second = { ...product, customDesign: { text: 'World', fabric: 'Cotton' } };
    assert.equal(addCartItem([first], second).items.length, 2);
    assert.equal(cartItemKey(first), cartItemKey({ ...first, customDesign: { fabric: 'Cotton', text: 'Hello' } }));
});
test('cart hydration retains local quantity and recovers distinct server variants', () => {
    const result = mergeCarts([product], [{ ...product, quantity: 2 }, { ...product, size: 'L' }]);
    assert.equal(result.length, 2);
    assert.equal(result.find(item => item.size === 'M').quantity, 1);
    assert.deepEqual(normalizeCart([null, { ...product, quantity: -1 }, { ...product, price: NaN }]), []);
});
test('checkout sends product identity without trusting local prices', () => {
    assert.equal(orderItems([product])[0].productId, 'a');
    assert.equal('price' in orderItems([product])[0], false);
    assert.equal(productPrice({ price: 100, sellingPrice: 0 }), 0);
});
test('undo keeps decoded images while exported drafts omit runtime image objects', () => {
    const image = { width: 100, height: 100 };
    const original = { front: [{ img: image, type: 'text', textStyle: { size: 12 } }], back: [] };
    const copy = cloneDesigns(original);
    assert.equal(copy.front[0].img, image);
    copy.front[0].textStyle.size = 24;
    assert.equal(original.front[0].textStyle.size, 12);
    assert.equal('img' in serializeDesigns(original).front[0], false);
});
test('draft validation rejects malformed uploads and supports zero studio charges', () => {
    const draft = { version: 1, shirtColor: '#ffffff', fabric: '100% Cotton', size: 'M', quantity: 1, designs: { front: [], back: [] } };
    assert.equal(validateDraft(draft), draft);
    assert.throws(() => validateDraft({ ...draft, quantity: -1 }));
    assert.throws(() => validateDraft({ ...draft, designs: { front: [{ rawSrc: 'javascript:invalid' }], back: [] } }));
    assert.equal(studioPriceSetting(0, 50), 0);
});
test('printed customer text cannot create executable HTML', () => {
    const result = escapeInvoiceData({ customer: { name: '<img src=x onerror=bad()>' }, total: 99 });
    assert.match(result.customer.name, /^&lt;/);
    assert.equal(result.total, 99);
});
test('terminal order stages cannot be reverted', () => {
    assert.deepEqual(orderStatusChoices('delivered'), ['delivered']);
    assert.deepEqual(orderStatusChoices('cancelled'), ['cancelled']);
    assert.equal(orderStatusChoices('shipped').includes('cancelled'), false);
});
test('administrator catalog traverses all pages including inactive products', async () => {
    let calls = 0;
    const result = await fetchAdminProducts({ get: async () => ({ success: true, data: [{ id: ++calls, isActive: false }], pagination: { totalPages: 2 } }) });
    assert.equal(result.data.length, 2);
    assert.equal(calls, 2);
});
test('login return destination cannot leave the site or loop through login', () => {
    assert.equal(safeReturnPath('/checkout'), '/checkout');
    for (const path of ['//evil.example', '/\\evil.example', 'https://evil.example', '/login']) assert.equal(safeReturnPath(path), '/profile');
});
