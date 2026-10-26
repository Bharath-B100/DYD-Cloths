// Start Vite before running this script. Requires Playwright and Microsoft Edge.
// PLAYWRIGHT_MODULE_PATH can point to an existing Playwright installation.
// TEST_BASE_URL defaults to http://127.0.0.1:5173. API traffic is mocked.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

async function run() {
    const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
        const products = Array.from({ length: 105 }, (_, i) => ({
            _id: String(i + 1), name: `Cotton shirt ${i}`, description: 'Soft cotton',
            price: 600 + i, sellingPrice: 400 + i * 10, mrp: 2000,
            category: i % 2 ? 'graphic' : 'plain', productTypes: [i % 2 ? 'women' : 'men'],
            catalogTypes: ['oversized'], mainImage: '/images/LOGO_DYD.png', stock: 10,
            sizes: ['M'], colors: ['Black'], images: [], createdAt: new Date(2026, 0, i + 1).toISOString()
        }));
        let fail = false;
        await page.route('**/api/**', route => {
            const url = new URL(route.request().url());
            const id = url.pathname.match(/^\/api\/products\/(\d+)$/);
            if (url.pathname === '/api/products') {
                if (fail) return route.fulfill({ status: 503, json: { success: false, error: 'Catalog temporarily unavailable' } });
                const n = Number(url.searchParams.get('page') || 1);
                const limit = Number(url.searchParams.get('limit') || 100);
                return route.fulfill({ json: { success: true, totalPages: Math.ceil(products.length / limit), data: products.slice((n - 1) * limit, n * limit) } });
            }
            return route.fulfill({ json: { success: true, data: id ? products[Number(id[1]) - 1] : [] } });
        });
        for (const width of [320, 390, 768, 1024, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            await page.goto(`${base}/shop`);
            await page.locator('.count-badge').filter({ hasText: '105' }).waitFor();
            await page.waitForTimeout(3000); // Initial splash animation.
            assert.equal(await page.locator('.product-card').count(), 12);
            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await page.waitForFunction(() => document.querySelector('.pagination')?.textContent.includes('Page 2 of 9'));
            await page.locator('#sortSelect').selectOption('low');
            await page.waitForFunction(() => document.querySelector('.product-title')?.textContent === 'Cotton shirt 0');
            assert.ok(!new URL(page.url()).searchParams.has('page'));
            if (width <= 1024) assert.equal(await page.locator('.filters-sidebar').evaluate(el => getComputedStyle(el).position), 'static');
            await page.getByLabel('Under ₹500', { exact: true }).click();
            await page.waitForFunction(() => document.querySelectorAll('.product-card').length === 10);
            await page.getByRole('button', { name: 'Clear All Filters' }).click();
            await page.waitForFunction(() => document.querySelectorAll('.product-card').length === 12);
            const priceSize = await page.locator('.price-sell').first().evaluate(el => getComputedStyle(el).fontSize);
            await page.locator('.product-card a').first().click();
            await page.locator('.product-details').waitFor();
            assert.equal(await page.evaluate(() => scrollY), 0);
            if (width <= 1280) await page.getByRole('button', { name: 'Toggle navigation' }).click();
            await page.locator('#storefront-navigation').getByRole('link', { name: 'Shop', exact: true }).click();
            await page.locator('.product-card').first().waitFor();
            assert.equal(await page.locator('.price-sell').first().evaluate(el => getComputedStyle(el).fontSize), priceSize);
            await page.goto(`${base}/shop?search=${'z'.repeat(150)}`);
            await page.locator('.no-results').waitFor();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            console.log(`PASS catalog interactions and layout at ${width}px`);
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior), 'auto');
        fail = true;
        await page.goto(`${base}/shop`);
        await page.getByRole('alert').waitFor();
        fail = false;
        await page.getByRole('button', { name: 'Try again' }).click();
        await page.locator('.product-card').first().waitFor();
        assert.deepEqual(errors, []);
        console.log('PASS retry, reduced motion, and no uncaught browser errors');
    } finally {
        await browser.close();
    }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
