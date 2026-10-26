import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileCart, cartItemKey, addCartItem, productPrice } from '../src/utils/cart.js';
import { safeReturnPath } from '../src/utils/navigation.js';
const item = { id: 'shirt', name: 'Cotton', price: 500, quantity: 1, size: 'M', color: 'Black', maxStock: 2 };
test('sync retry keeps a deliberately empty local cart empty', () => {
    assert.deepEqual(reconcileCart([], [item], true), []);
});
test('sync retry retains local quantity and excludes removed variants', () => {
    const result = reconcileCart([{ ...item, quantity: 2 }], [item, { ...item, size: 'L' }], true);
    assert.equal(result.length, 1); assert.equal(result[0].quantity, 2);
});
test('first hydration still recovers an account cart', () => {
    assert.equal(reconcileCart([], [item], false).length, 1);
});
test('different custom designs remain separate cart lines', () => {
    assert.notEqual(cartItemKey({ ...item, customDesign: { text: 'A' } }), cartItemKey({ ...item, customDesign: { text: 'B' } }));
});
test('stock limits apply across sizes', () => {
    assert.ok(addCartItem([{ ...item, quantity: 2 }], { ...item, size: 'L' }).error);
});
test('wishlist prices use selling price including a valid zero price', () => {
    assert.equal(productPrice({ price: 600, sellingPrice: 400 }), 400);
    assert.equal(productPrice({ price: 600, sellingPrice: 0 }), 0);
});
test('checkout return path is allowed but external redirects are not', () => {
    assert.equal(safeReturnPath('/checkout'), '/checkout');
    assert.equal(safeReturnPath('//example.test'), '/profile');
});
