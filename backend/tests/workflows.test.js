const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const Order = require('../models/Order');
const User = require('../models/User');
const { createOrder } = require('../controllers/orderController');
const { getProducts } = require('../controllers/productController');
const { getWishlist, getSharedWishlist } = require('../controllers/authController');
let mongod;
let processError;
const userId = new mongoose.Types.ObjectId();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const productData = { name: 'Cotton shirt', description: 'Test cotton', price: 600, sellingPrice: 500, mrp: 900,
    mainImage: 'https://example.test/shirt.png', stock: 10, category: 'plain', productTypes: ['men'], sizes: ['M'], colors: ['Black'] };
const request = (product, extra = {}) => ({ user: { id: userId.toString() }, body: {
    requestId: 'checkout-test-001', customer: { name: 'Test', email: 'test@example.test', phone: '9876543210' },
    shippingAddress: { street: 'Test street', city: 'Chennai', state: 'Tamil Nadu', zipCode: '600001', country: 'India' },
    items: [{ productId: String(product._id), quantity: 1, size: 'M', color: 'Black' }],
    paymentMethod: 'cash_on_delivery', totalAmount: 500, ...extra
} });

before(async () => {
    // Never use MONGODB_URI: spawn a private replica set with a new temporary directory.
    const socket = net.createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const directory = await mkdtemp(path.join(tmpdir(), 'dyd-tests-'));
    mongod = spawn(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', directory, '--port', String(port),
        '--bind_ip', '127.0.0.1', '--replSet', 'dyd-test', '--logpath', path.join(directory, 'mongo.log')],
    { stdio: 'ignore', windowsHide: true });
    mongod.on('error', error => { processError = error; });
    const direct = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 300 });
    try {
        for (let i = 0; ; i++) {
            if (processError) throw processError;
            try { await direct.connect(); break; } catch (error) { if (i === 60) throw error; await sleep(100); }
        }
        await direct.db('admin').command({ replSetInitiate: { _id: 'dyd-test', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
    } finally { await direct.close(); }
    await mongoose.connect(`mongodb://127.0.0.1:${port}/dyd_isolated_tests?replicaSet=dyd-test`, { serverSelectionTimeoutMS: 20000 });
    await Promise.all([Product.init(), Coupon.init(), Order.init(), User.init()]);
});
after(async () => { await mongoose.disconnect(); if (mongod && !mongod.killed) mongod.kill(); });
beforeEach(async () => {
    assert.equal(mongoose.connection.name, 'dyd_isolated_tests');
    await Promise.all([Product.deleteMany({}), Coupon.deleteMany({}), Order.deleteMany({}), User.deleteMany({})]);
});

test('save failure rolls back both stock and coupon reservations', async t => {
    const product = await Product.create(productData);
    const coupon = await Coupon.create({ code: 'TEST', discountType: 'fixed', discountValue: 1, endDate: new Date(Date.now() + 86400000) });
    const save = t.mock.method(Order.prototype, 'save', async () => { throw new Error('Simulated write failure'); });
    const res = response();
    await createOrder(request(product, { couponCode: 'TEST', totalAmount: 499 }), res);
    save.mock.restore();
    assert.equal(res.statusCode, 500);
    const restored = await Product.findById(product._id).select('+stockReservations');
    assert.equal(restored.stock, 10);
    assert.equal(restored.stockReservations.length, 0);
    const restoredCoupon = await Coupon.findById(coupon._id).select('+redemptions');
    assert.equal(restoredCoupon.usedCount, 0);
    assert.equal(restoredCoupon.redemptions.length, 0);
    assert.equal(await Order.countDocuments(), 0);
});
test('changed total is rejected before inventory changes', async () => {
    const product = await Product.create(productData);
    const res = response();
    await createOrder(request(product, { totalAmount: 400 }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(await Order.countDocuments(), 0);
    assert.equal((await Product.findById(product._id)).stock, 10);
});
test('successful checkout commits once and retry returns the same order', async () => {
    const product = await Product.create(productData);
    const first = response(); const retry = response();
    await createOrder(request(product), first);
    await createOrder(request(product), retry);
    assert.equal(first.statusCode, 201);
    assert.equal(String(first.body.data._id), String(retry.body.data._id));
    assert.equal(await Order.countDocuments(), 1);
    assert.equal((await Product.findById(product._id)).stock, 9);
});
test('concurrent checkouts cannot oversell the last item', async () => {
    const product = await Product.create({ ...productData, stock: 1 });
    const a = response(); const b = response();
    await Promise.all([createOrder(request(product), a), createOrder(request(product, { requestId: 'checkout-test-002' }), b)]);
    assert.equal([a, b].filter(res => res.statusCode === 201).length, 1);
    assert.equal(await Order.countDocuments(), 1);
    assert.equal((await Product.findById(product._id)).stock, 0);
});
test('catalog filters and sorts across all products but returns only one page', async () => {
    await Product.insertMany(Array.from({ length: 30 }, (_, i) => ({ ...productData, name: `Cotton ${i}`, sellingPrice: 400 + i * 10 })));
    const res = response();
    await getProducts({ query: { limit: '12', page: '2', sort: 'low', type: 'men,women' } }, res);
    assert.equal(res.body.total, 30); assert.equal(res.body.data.length, 12);
    assert.equal(res.body.data[0].sellingPrice, 520);
    assert.equal(res.body.data[0].stockReservations, undefined);
    const cheap = response();
    await getProducts({ query: { price: 'under-500', limit: '12' } }, cheap);
    assert.equal(cheap.body.total, 10);
    const literal = response(); await getProducts({ query: { search: '.*' } }, literal);
    assert.equal(literal.body.total, 0);
});
test('both wishlist APIs omit inactive products and return selling prices', async () => {
    const active = await Product.create(productData);
    const inactive = await Product.create({ ...productData, isActive: false });
    const user = await User.create({ name: 'Test', email: 'wishlist@example.test', password: 'TestPassword123!', passwordConfirm: 'TestPassword123!', wishlist: [active._id, inactive._id] });
    for (const [handler, req] of [[getWishlist, { user: { id: user.id } }], [getSharedWishlist, { params: { userId: user.id } }]]) {
        const res = response(); await handler(req, res);
        assert.equal(res.body.data.wishlist.length, 1);
        assert.equal(res.body.data.wishlist[0].sellingPrice, 500);
        assert.equal(res.body.data.wishlist[0].isActive, true);
    }
});
