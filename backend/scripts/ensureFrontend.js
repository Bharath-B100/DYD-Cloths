// Existing hosts may still install only backend dependencies during their build.
// Generate the storefront before listening so they never serve a missing SPA.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const frontend = path.resolve(__dirname, '../../frontend');
if (!fs.existsSync(path.join(frontend, 'dist/index.html'))) {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('Start through npm start so the frontend can be built.');
    for (const args of [['ci', '--include=dev'], ['run', 'build']]) {
        const result = spawnSync(process.execPath, [npmCli, ...args], {
            cwd: frontend,
            stdio: 'inherit',
            env: process.env
        });
        if (result.error) throw result.error;
        if (result.status !== 0) process.exit(result.status || 1);
    }
}
