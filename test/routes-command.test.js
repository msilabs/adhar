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
        'api/users/[id]/route.js': 'export function DELETE() {}\nexport function GET() {}',
        'api/users/route.js': 'export function POST() {}\nexport function GET() {}',
        'api/route.js': 'export function GET() {}',
        'api/(admin)/stats/route.js': 'export function GET() {}',
    });
    const result = adharRoutes(root);
    assert.equal(result.code, 0);
    assert.deepEqual(result.stdout.trimEnd().split('\n'), [
        'GET     /api            api/route.js',
        'GET     /api/stats      api/(admin)/stats/route.js',
        'GET     /api/users      api/users/route.js',
        'POST    /api/users      api/users/route.js',
        'GET     /api/users/:id  api/users/[id]/route.js',
        'DELETE  /api/users/:id  api/users/[id]/route.js',
    ]);
});

test('adhar routes says so when there are no routes', (t) => {
    const root = makeProject(t, { 'api/README.md': '' });
    const result = adharRoutes(root);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /No routes yet/);
});

test('adhar routes outside a project fails with a hint', (t) => {
    const root = makeProject(t, {});
    const result = adharRoutes(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No `api\/` folder/);
    assert.match(result.stderr, /Hint: Run this inside an Adhar project/);
});

test('adhar routes shows a mistake in a route file', (t) => {
    const root = makeProject(t, { 'api/users/route.js': 'export function get() {}' });
    const result = adharRoutes(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: api\/users\/route\.js/);
    assert.match(result.stderr, /Unknown export `get`/);
    assert.match(result.stderr, /Did you mean `GET`\?/);
});

test('adhar routes in a project that still has routes/ explains the rename', (t) => {
    const root = makeProject(t, { 'routes/notes/route.js': 'export function GET() { return []; }' });
    const result = adharRoutes(root);
    assert.equal(result.code, 1);
    assert.equal(
        result.stderr,
        '✖ Error: routes/\n' +
            '  The `routes/` folder is now `api/`.\n' +
            '\n' +
            '  Hint: Rename `routes/` to `api/`. Every URL then starts with `/api`:\n' +
            '        `/notes` becomes `/api/notes`. Update the clients that call this API.\n' +
            '\n',
    );
});

test('adhar routes with both routes/ and api/ says so', (t) => {
    const root = makeProject(t, { 'routes/route.js': '', 'api/route.js': 'export function GET() { return {}; }' });
    const result = adharRoutes(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: routes\/\n  Both `routes\/` and `api\/` exist\.\n\n  Hint: Move what is left in `routes\/` into `api\/`, then delete `routes\/`\./);
});
