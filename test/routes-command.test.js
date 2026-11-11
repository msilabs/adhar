'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeProject } = require('./helpers/project.js');

const BIN = path.join(__dirname, '..', 'bin', 'adhar.js');

function adharRoutes(cwd) {
    const result = spawnSync(process.execPath, [BIN, 'routes'], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('adhar routes lists method, path and file, sorted by path', (t) => {
    const root = makeProject(t, {
        'routes/users/[id]/route.js': 'export function DELETE() {}\nexport function GET() {}',
        'routes/users/route.js': 'export function POST() {}\nexport function GET() {}',
        'routes/route.js': 'export function GET() {}',
        'routes/(admin)/stats/route.js': 'export function GET() {}',
    });
    const result = adharRoutes(root);
    assert.equal(result.code, 0);
    assert.deepEqual(result.stdout.trimEnd().split('\n'), [
        'GET     /           routes/route.js',
        'GET     /stats      routes/(admin)/stats/route.js',
        'GET     /users      routes/users/route.js',
        'POST    /users      routes/users/route.js',
        'GET     /users/:id  routes/users/[id]/route.js',
        'DELETE  /users/:id  routes/users/[id]/route.js',
    ]);
});

test('adhar routes says so when there are no routes', (t) => {
    const root = makeProject(t, { 'routes/README.md': '' });
    const result = adharRoutes(root);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /No routes yet/);
});

test('adhar routes outside a project fails with a hint', (t) => {
    const root = makeProject(t, {});
    const result = adharRoutes(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No `routes\/` folder/);
    assert.match(result.stderr, /Hint: Run this inside an Adhar project/);
});

test('adhar routes shows a mistake in a route file', (t) => {
    const root = makeProject(t, { 'routes/users/route.js': 'export function get() {}' });
    const result = adharRoutes(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: routes\/users\/route\.js/);
    assert.match(result.stderr, /Unknown export `get`/);
    assert.match(result.stderr, /Did you mean `GET`\?/);
});
