const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { customPrice, quoteCheckout } = require('../services/checkout');
const { inventoryItems, transitionOrder, reserveInventory, releaseInventory } = require('../services/orderLifecycle');
const { createPaymentHandlers } = require('../controllers/paymentController');
const { dateRange, escapeRegex } = require('../utils/validation');
const Settings = require('../models/Settings');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const admin = require('../controllers/adminController');
const auth = require('../controllers/authController');
const emailService = require('../services/email');
const id = '1234567890abcdef12345678';
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('custom pricing counts image sides and individual text elements', () => {
    assert.equal(customPrice({ fabric: '100% Cotton', frontLayers: [{ type: 'image', rawSrc: 'https://example.com/art.png' }, { type: 'text', rawSrc: 'data:image/png;base64,YQ==' }], backLayers: [{ type: 'text', rawSrc: 'data:image/png;base64,YQ==' }] }, {}), 549);
    assert.throws(() => customPrice({ fabric: 'unknown' }, {}));
    assert.throws(() => customPrice({ fabric: '100% Cotton', frontLayers: [{ type: 'image', rawSrc: 'javascript:bad()' }], backLayers: [] }, {}));
});
test('quote ignores client price and refuses aggregate quantities above stock', async t => {
    t.mock.method(Settings, 'find', () => ({ lean: async () => [] }));
    t.mock.method(Product, 'findOne', () => ({ lean: async () => ({ name: 'Shirt', price: 500, sellingPrice: 300, stock: 2, sizes: ['M', 'L'], colors: ['Black'], mainImage: 'image' }) }));
    const item = { productId: id, size: 'M', color: 'Black', quantity: 1, price: 1 };
    const quote = await quoteCheckout({ items: [item] }, id);
    assert.equal(quote.subtotal, 300);
    assert.equal(quote.totalAmount, 399);
    await assert.rejects(quoteCheckout({ items: [{ ...item, quantity: 2 }, { ...item, size: 'L' }] }, id), /enough stock/);
});
test('inventory aggregates product variants before reserving', () => {
    assert.deepEqual(inventoryItems([{ productId: id, quantity: 1 }, { productId: id, quantity: 2 }, { productId: 'studio-design', quantity: 5 }]), [{ productId: id, quantity: 3 }]);
});
test('inventory uses conditional reservation and retry-safe release', async t => {
    let stock = 3;
    let reserved = false;
    t.mock.method(Product, 'findOneAndUpdate', async (filter, update) => {
        assert.equal(filter.stock.$gte, 2);
        stock += update.$inc.stock; reserved = true; return {};
    });
    t.mock.method(Product, 'updateOne', async (filter, update) => {
        assert.equal(filter['stockReservations.orderId'], id);
        if (reserved) { stock += update.$inc.stock; reserved = false; }
    });
    const order = { _id: id, inventoryManaged: true, items: [{ productId: id, quantity: 2 }] };
    await reserveInventory(order);
    assert.equal(stock, 1);
    await releaseInventory(order); await releaseInventory(order);
    assert.equal(stock, 3);
});
test('order lifecycle rejects backwards moves and unpaid online fulfillment', async t => {
    const order = { _id: id, status: 'delivered', paymentMethod: 'cash_on_delivery', paymentStatus: 'paid' };
    t.mock.method(Order, 'findById', async () => order);
    await assert.rejects(transitionOrder(id, 'processing'), /cannot move/);
    order.status = 'pending'; order.paymentMethod = 'razorpay'; order.paymentStatus = 'pending';
    await assert.rejects(transitionOrder(id, 'confirmed'), /Online payment/);
});
test('paid cancellation requests a refund without falsely marking it refunded', async t => {
    let order = { _id: id, status: 'pending', paymentMethod: 'razorpay', paymentStatus: 'paid', items: [], inventoryManaged: true };
    t.mock.method(Order, 'findById', async () => order);
    t.mock.method(Order, 'findOneAndUpdate', async (_query, update) => (order = { ...order, ...update.$set }));
    t.mock.method(Order, 'findByIdAndUpdate', async (_id, update) => (order = { ...order, ...update.$set }));
    const result = await transitionOrder(id, 'cancelled');
    assert.equal(result.paymentStatus, 'paid');
    assert.equal(result.refundRequired, true);
});
test('payment verification refuses a valid signature for another internal order', async () => {
    let contacted = false;
    const handlers = createPaymentHandlers({ OrderModel: { findById: async () => ({ user: id, paymentMethod: 'razorpay', razorpayOrderId: 'bound' }) }, gateway: () => { contacted = true; } });
    const res = response();
    await handlers.verifyPayment({ user: { id }, body: { orderId: id, razorpay_order_id: 'other', razorpay_payment_id: 'pay', razorpay_signature: 'a'.repeat(64) } }, res);
    assert.equal(res.statusCode, 400); assert.equal(contacted, false);
});
test('authorized but uncaptured payments never mark orders paid', async () => {
    let wrote = false;
    const handlers = createPaymentHandlers({ keySecret: () => 'test-secret', OrderModel: { findById: async () => ({ user: id, paymentMethod: 'razorpay', razorpayOrderId: 'bound', totalAmount: 10 }), findOneAndUpdate: async () => { wrote = true; } }, gateway: () => ({ payments: { fetch: async () => ({ order_id: 'bound', currency: 'INR', amount: 1000, status: 'authorized' }) } }) });
    const signature = crypto.createHmac('sha256', 'test-secret').update('bound|pay').digest('hex');
    const res = response();
    await handlers.verifyPayment({ user: { id }, body: { orderId: id, razorpay_order_id: 'bound', razorpay_payment_id: 'pay', razorpay_signature: signature } }, res);
    assert.equal(res.statusCode, 409); assert.equal(wrote, false);
});
test('bulk stock changes reject negatives and return a completion response', async t => {
    let writes = 0;
    t.mock.method(Product, 'bulkWrite', async () => { writes++; return { modifiedCount: 1 }; });
    const invalid = response();
    await admin.bulkUpdateStock({ body: { updates: [{ productId: id, stock: -1 }] } }, invalid);
    assert.equal(invalid.statusCode, 400); assert.equal(writes, 0);
    const valid = response();
    await admin.bulkUpdateStock({ body: { updates: [{ productId: id, stock: 4 }] } }, valid);
    assert.equal(valid.body.success, true); assert.equal(writes, 1);
});
test('administrator deactivation is rejected before saving', async t => {
    let saved = false;
    t.mock.method(User, 'findById', async () => ({ _id: id, role: 'admin', save: async () => { saved = true; } }));
    const res = response();
    await admin.updateCustomerStatus({ params: { id }, body: { isActive: false }, user: { _id: 'other' } }, res);
    assert.equal(res.statusCode, 403); assert.equal(saved, false);
});
test('missing email configuration reports unavailable without claiming delivery', async t => {
    t.mock.method(emailService, 'isConfigured', () => false);
    const res = response();
    await auth.forgotPassword({ body: { email: 'test@example.com' } }, res);
    assert.equal(res.statusCode, 503); assert.equal(res.body.success, false);
});
test('date filters cover the end day without self-referential objects; searches are literal', () => {
    const filter = dateRange('2026-09-01', '2026-09-15');
    assert.equal(filter.createdAt.$lte.toISOString(), '2026-09-15T23:59:59.999Z');
    assert.doesNotThrow(() => JSON.stringify(filter));
    assert.throws(() => dateRange('2026-09-15', '2026-09-01'));
    assert.equal(new RegExp(escapeRegex('a.b')).test('axb'), false);
});
