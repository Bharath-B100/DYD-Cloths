const { spawn } = require('node:child_process');
const path = require('node:path');
async function run() {
    try { require.resolve(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright'); }
    catch { throw new Error('Browser tests require Playwright. Install it or set PLAYWRIGHT_MODULE_PATH to an existing installation. Tests were not skipped.'); }
    const { createServer } = await import('vite');
    const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
    try {
        await server.listen();
        for (const file of ['catalog.browser.cjs', 'recovery.browser.cjs', 'ux.browser.cjs', 'verification.browser.cjs']) {
            const child = spawn(process.execPath, [path.join(__dirname, file)], {
                stdio: 'inherit', windowsHide: true,
                env: { ...process.env, TEST_BASE_URL: server.resolvedUrls.local[0].replace(/\/$/, '') }
            });
            const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
            if (code !== 0) throw new Error(`${file} failed (${code})`);
        }
    } finally { await server.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
