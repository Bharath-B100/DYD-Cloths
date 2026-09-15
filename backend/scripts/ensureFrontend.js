// Existing hosts may still install only backend dependencies during their build.
// Generate the storefront before listening so they never serve a missing SPA.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const frontend = path.resolve(__dirname, '../../frontend');
if (!fs.existsSync(path.join(frontend, 'dist/index.html'))) {
    const npmCli = process.env.npm_execpath;
    for (const args of [['ci', '--include=dev'], ['run', 'build']]) {
        const command = npmCli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
        const result = spawnSync(command, npmCli ? [npmCli, ...args] : args, {
            cwd: frontend,
            stdio: 'inherit',
            shell: !npmCli && process.platform === 'win32',
            env: process.env
        });
        if (result.error) throw result.error;
        if (result.status !== 0) process.exit(result.status || 1);
    }
}
