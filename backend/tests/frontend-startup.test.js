const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../scripts/ensureFrontend.js'), 'utf8');

function run({ exists = false, status = 0, npmCli = '/npm-cli.js' } = {}) {
    const calls = [];
    const context = {
        __dirname: path.join(__dirname, '../scripts'),
        process: { env: { npm_execpath: npmCli }, execPath: '/node', platform: 'linux', exit(code) { throw new Error(`exit ${code}`); } },
        require(name) {
            if (name === 'node:fs') return { existsSync: () => exists };
            if (name === 'node:child_process') return { spawnSync(command, args) { calls.push([command, ...args]); return { status }; } };
            return require(name);
        }
    };
    vm.runInNewContext(source, context);
    return calls;
}

test('prebuilt deployments skip installation and build', () => {
    assert.deepEqual(run({ exists: true }), []);
});
test('missing frontend installs build dependencies before building', () => {
    assert.deepEqual(run(), [['/node', '/npm-cli.js', 'ci', '--include=dev'], ['/node', '/npm-cli.js', 'run', 'build']]);
    assert.deepEqual(run({ npmCli: '' }), [['npm', 'ci', '--include=dev'], ['npm', 'run', 'build']]);
});
test('a failed installation stops startup', () => {
    assert.throws(() => run({ status: 1 }), /exit 1/);
});
