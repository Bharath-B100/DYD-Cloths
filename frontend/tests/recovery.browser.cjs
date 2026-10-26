const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173';
const user = { _id: '012345678901234567890123', name: 'Test Customer', email: 'test@example.test', role: 'user' };
const item = { id: '123456789012345678901234', name: 'Test Shirt', price: 500, quantity: 1, maxStock: 10, size: 'M', color: 'Black', image: '/images/LOGO_DYD.png' };

async function run() {
    const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
    try {
        const startup = await browser.newPage();
        await startup.route('**/src/main.jsx*', route => route.abort());
        await startup.goto(base);
        await startup.getByRole('button', { name: 'Reload page' }).waitFor();
        assert.equal(await startup.locator('#pre-splash').count(), 0);
        assert.equal(await startup.getByRole('button', { name: 'Reload page' }).isVisible(), true);
        await startup.close();
        console.log('PASS startup error and recovery button are uncovered');

        const guest = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await guest.addInitScript(item => localStorage.setItem('dyd_cart', JSON.stringify([item])), item);
        await guest.route('**/api/**', route => {
            const url = new URL(route.request().url());
            let data = {};
            if (url.pathname === '/api/auth/login') return route.fulfill({ json: { success: true, token: 'test-token', data: { user } } });
            if (url.pathname === '/api/auth/me') data = { user };
            if (url.pathname === '/api/user/cart') data = { cart: [] };
            if (url.pathname === '/api/auth/wishlist') data = { wishlist: [] };
            if (url.pathname === '/api/products') return route.fulfill({ json: { success: true, data: [], total: 0, totalPages: 0, currentPage: 1 } });
            if (url.pathname === '/api/orders/quote') data = { totalAmount: 500, subtotal: 500, shippingFee: 0, tax: 0, discountAmount: 0, items: [item] };
            return route.fulfill({ json: { success: true, data } });
        });
        await guest.goto(base);
        await guest.getByRole('button', { name: 'Toggle navigation' }).click();
        await guest.getByRole('button', { name: 'Open cart', exact: true }).click();
        await guest.getByRole('button', { name: 'Proceed to checkout' }).click();
        await guest.waitForURL('**/login?redirect=%2Fcheckout');
        await guest.locator('#email').fill(user.email);
        await guest.locator('#password').fill('TestPassword123!');
        await guest.locator('form button[type="submit"]').click();
        await guest.waitForURL('**/checkout');
        await guest.getByText('Shipping Information', { exact: false }).waitFor();
        await guest.goto(base);
        await guest.getByRole('link', { name: 'Returns Information' }).click();
        await guest.waitForURL('**/returns-exchanges');
        assert.equal(await guest.getByText('Page not found', { exact: true }).count(), 0);
        await guest.close();
        console.log('PASS guest checkout resumes after login and returns link works');

        const account = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const key = `dyd_cart_${user._id}`;
        await account.addInitScript(({ user, item, key }) => {
            localStorage.setItem('token', 'test-token');
            localStorage.setItem('user', JSON.stringify(user));
            if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify([item]));
        }, { user, item, key });
        let failSync = false;
        let synced = null;
        await account.route('**/api/**', route => {
            const url = new URL(route.request().url());
            let data = {};
            if (url.pathname === '/api/auth/me') data = { user };
            if (url.pathname === '/api/auth/wishlist') data = { wishlist: [] };
            if (url.pathname === '/api/user/cart') data = { cart: [item] }; // Stale server snapshot.
            if (url.pathname === '/api/user/cart/sync') {
                if (failSync) return route.fulfill({ status: 503, json: { success: false, error: 'Temporary outage' } });
                synced = route.request().postDataJSON().cart;
            }
            if (url.pathname === '/api/products') return route.fulfill({ json: { success: true, data: [], total: 0, totalPages: 0, currentPage: 1 } });
            return route.fulfill({ json: { success: true, data } });
        });
        await account.goto(base);
        await account.getByRole('button', { name: 'Open cart', exact: true }).click();
        await account.getByRole('button', { name: 'Clear cart', exact: true }).waitFor();
        failSync = true;
        await account.getByRole('button', { name: 'Clear cart', exact: true }).click();
        await account.getByRole('button', { name: 'Retry sync', exact: true }).waitFor();
        await account.reload();
        await account.getByRole('button', { name: 'Open cart', exact: true }).click();
        await account.getByRole('button', { name: 'Retry sync', exact: true }).waitFor();
        assert.equal(await account.locator('.cart-drawer-item').count(), 0);
        failSync = false;
        await account.getByRole('button', { name: 'Retry sync', exact: true }).click();
        await account.waitForFunction(key => localStorage.getItem(`${key}:pending`) === null, key);
        assert.deepEqual(synced, []);
        assert.equal(await account.locator('.cart-drawer-item').count(), 0);
        console.log('PASS failed deletion sync stays deleted after reload and retry');
        await account.close();
    } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
