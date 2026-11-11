'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnv, resolvePort } = require('../core/env.js');
const { makeProject } = require('./helpers/project.js');

test('loadEnv reads the .env file', (t) => {
    const root = makeProject(t, {
        '.env': '# settings\nPORT=4000\nADMIN_TOKEN="secret token"\nEMPTY=\n\nSITE_NAME=আধার\n',
    });
    assert.deepEqual(loadEnv(root), { PORT: '4000', ADMIN_TOKEN: 'secret token', EMPTY: '', SITE_NAME: 'আধার' });
});

test('variables from the real environment win over the file', (t) => {
    const root = makeProject(t, { '.env': 'PORT=4000\nADMIN_TOKEN=from-file\n' });
    const env = loadEnv(root, { ADMIN_TOKEN: 'from-host', HOME: '/home/a' });
    assert.deepEqual(env, { PORT: '4000', ADMIN_TOKEN: 'from-host', HOME: '/home/a' });
});

test('a project without .env just gets the real environment', (t) => {
    const root = makeProject(t, {});
    assert.deepEqual(loadEnv(root, { A: '1' }), { A: '1' });
    assert.deepEqual(loadEnv(root), {});
});

test('loadEnv does not touch process.env', (t) => {
    const root = makeProject(t, { '.env': 'ADHAR_TEST_ONLY=1\n' });
    loadEnv(root, process.env);
    assert.equal(process.env.ADHAR_TEST_ONLY, undefined);
});

test('the port comes from the flag, then PORT, then 3000', () => {
    assert.equal(resolvePort(5000, { PORT: '4000' }), 5000);
    assert.equal(resolvePort(undefined, { PORT: '4000' }), 4000);
    assert.equal(resolvePort(undefined, {}), 3000);
    assert.equal(resolvePort(undefined, { PORT: '' }), 3000);
});

test('an invalid PORT is an error', () => {
    for (const PORT of ['abc', '0', '70000', '30.5']) {
        assert.throws(() => resolvePort(undefined, { PORT }), (err) => {
            assert.equal(err.name, 'AdharError');
            assert.match(err.message, /Invalid PORT value/);
            assert.match(err.hint, /PORT=3000/);
            return true;
        }, PORT);
    }
});
