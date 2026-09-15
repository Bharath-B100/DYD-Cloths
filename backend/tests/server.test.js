const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'development';
process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
const { app } = require('../server');
test('SPA routes render; offline API and disallowed origins fail promptly', async t => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/shop', '/studio', '/profile', '/admin', '/forgot-password']) {
        const response = await fetch(base + route);
        assert.equal(response.status, 200, route);
        assert.match(await response.text(), /id="root"/);
    }
    const health = await fetch(base + '/api/health');
    assert.equal(health.status, 503);
    assert.equal((await health.json()).status, 'degraded');
    assert.equal((await fetch(base + '/api/settings')).status, 503);
    assert.equal((await fetch(base + '/api/health', { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    const allowed = await fetch(base + '/api/health', { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});
