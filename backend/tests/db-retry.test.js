const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
test('an initial database failure retries automatically and stops after success', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let attempts = 0;
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'log', () => {});
    t.mock.method(mongoose, 'connect', async () => {
        attempts++;
        if (attempts === 1) throw new Error('temporary outage');
        return { connection: { host: 'isolated-test', name: 'test' } };
    });
    try {
        assert.equal(await connectDB(), null);
        assert.equal(attempts, 1);
        t.mock.timers.tick(1000);
        await Promise.resolve(); await Promise.resolve();
        assert.equal(attempts, 2);
        assert.equal(connectDB.getLastError(), null);
        t.mock.timers.tick(60000);
        assert.equal(attempts, 2);
    } finally { connectDB.stopRetries(); }
});
