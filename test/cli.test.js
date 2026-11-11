'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { version } = require('../package.json');

const BIN = path.join(__dirname, '..', 'bin', 'adhar.js');
const FAKE_NODE = path.join(__dirname, 'helpers', 'fake-node.js');

function adhar(args, { nodeArgs = [], env = {} } = {}) {
    const result = spawnSync(process.execPath, [...nodeArgs, BIN, ...args], {
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', ...env },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

function adharOnNode(nodeVersion) {
    return adhar(['--version'], {
        nodeArgs: ['--require', FAKE_NODE],
        env: { FAKE_NODE_VERSION: nodeVersion },
    });
}

test('--version prints the version', () => {
    const result = adhar(['--version']);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), version);
});

test('--help and a bare adhar print the help', () => {
    for (const args of [['--help'], []]) {
        const result = adhar(args);
        assert.equal(result.code, 0);
        assert.match(result.stdout, /Usage:/);
        assert.match(result.stdout, /adhar dev \[--port 3000\]/);
    }
});

test('an unknown command suggests a close one', () => {
    const result = adhar(['strat']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error:/);
    assert.match(result.stderr, /Unknown command `strat`/);
    assert.match(result.stderr, /Did you mean `adhar start`/);
});

test('a distant unknown command only points to help', () => {
    const result = adhar(['xyzzy']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /adhar --help/);
    assert.doesNotMatch(result.stderr, /Did you mean/);
});

test('an unknown flag fails with a suggestion', () => {
    const result = adhar(['dev', '--prot', '3000']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown flag `--prot`/);
    assert.match(result.stderr, /Did you mean `--port`/);
});

test('a distant unknown flag names the only flag', () => {
    const result = adhar(['dev', '--base', '/']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Adhar only has `--port`/);
});

test('a flag on the wrong command fails', () => {
    const result = adhar(['routes', '--port', '3000']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`--port` does not work with `adhar routes`/);
});

test('a flag without a value fails', () => {
    const result = adhar(['dev', '--port']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`--port` needs a value/);
});

test('an invalid port fails', () => {
    for (const port of ['abc', '0', '70000', '30.5']) {
        const result = adhar(['dev', `--port=${port}`]);
        assert.equal(result.code, 1, port);
        assert.match(result.stderr, /Invalid `--port` value/);
    }
});

test('a valid port passes flag validation', () => {
    for (const args of [['dev', '--port', '4000'], ['start', '--port=4000']]) {
        const result = adhar(args);
        assert.doesNotMatch(result.stderr, /--port/);
    }
});

test('an old Node version gets a clear error', () => {
    for (const nodeVersion of ['20.1.0', '22.12.0']) {
        const result = adharOnNode(nodeVersion);
        assert.equal(result.code, 1, nodeVersion);
        assert.match(result.stderr, /Adhar needs Node\.js 22\.13 or newer/);
        assert.ok(result.stderr.includes('v' + nodeVersion));
        assert.equal(result.stdout, '');
    }
});

test('the minimum Node version and newer ones are accepted', () => {
    for (const nodeVersion of ['22.13.0', '24.0.0', '26.1.0']) {
        const result = adharOnNode(nodeVersion);
        assert.equal(result.code, 0, nodeVersion);
        assert.equal(result.stdout.trim(), version);
    }
});

test('NO_COLOR turns off ANSI codes', () => {
    const result = adhar(['strat']);
    assert.doesNotMatch(result.stderr, /\x1b\[/);
});
