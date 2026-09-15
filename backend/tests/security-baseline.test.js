const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const readProjectFile = (...segments) => fs.readFileSync(
    path.join(__dirname, '..', ...segments),
    'utf8'
);

test('sensitive order and product routes require authorization middleware', () => {
    const orderRoutes = readProjectFile('routes', 'orderRoutes.js');
    const productRoutes = readProjectFile('routes', 'productRoutes.js');

    assert.match(orderRoutes, /router\.get\('\/', adminProtect, getOrders\)/);
    assert.match(orderRoutes, /router\.put\('\/:id\/status', adminProtect, updateOrderStatus\)/);
    assert.match(productRoutes, /router\.post\('\/', adminProtect, createProduct\)/);
    assert.match(productRoutes, /router\.delete\('\/:id', adminProtect, deleteProduct\)/);
});

test('the storefront contains no native alert, confirm, or prompt calls', () => {
    const frontendRoot = path.join(__dirname, '..', '..', 'frontend');
    const sourceRoot = path.join(frontendRoot, 'src');
    const files = fs.readdirSync(sourceRoot, { recursive: true })
        .filter(file => /\.(?:js|jsx)$/.test(file));

    for (const file of files) {
        const source = fs.readFileSync(path.join(sourceRoot, file), 'utf8');
        assert.doesNotMatch(source, /\b(?:alert|confirm|prompt)\s*\(/,
            `native dialog found in src/${file}`);
    }
});
