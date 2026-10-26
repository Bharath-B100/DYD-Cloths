const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
const { app } = require('../server');
let server;
let base;
before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
test('valid SPA and legacy routes return HTML with 200', async () => {
    for (const route of ['/shop', '/returns-exchanges', '/product/example', '/shop.html']) {
        const response = await fetch(base + route);
        assert.equal(response.status, 200, route);
        assert.match(response.headers.get('content-type'), /html/);
    }
});
test('unknown routes render the SPA with a real 404 status', async () => {
    const response = await fetch(base + '/missing-page');
    assert.equal(response.status, 404);
    assert.match(await response.text(), /id="root"/);
});
test('missing assets do not return successful HTML', async () => {
    const response = await fetch(base + '/assets/missing.js');
    assert.equal(response.status, 404);
    assert.doesNotMatch(response.headers.get('content-type'), /html/);
});
