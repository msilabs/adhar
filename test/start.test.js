'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { freePort, startAdhar } = require('./helpers/cli.js');
const { makeProject } = require('./helpers/project.js');

const PROJECT = {
    'migrations/001-create-notes.sql': 'CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL);',
    'services/notes.js': `
export default ({ db }) => ({
    all: () => db.all('SELECT * FROM notes ORDER BY id'),
    create: (title) => db.get('INSERT INTO notes (title) VALUES (?) RETURNING *', title),
});
`,
    'api/route.js': 'export function GET(ctx) { return { mode: ctx.env.NODE_ENV, greeting: ctx.env.GREETING }; }',
    'api/notes/route.js': `
export const schema = { POST: { body: { title: 'string' } } };
export function GET(ctx) { return ctx.services.notes.all(); }
export function POST(ctx) { ctx.status(201); return ctx.services.notes.create(ctx.body.title); }
`,
    'api/boom/route.js': 'export function GET() { throw new Error("secret detail"); }',
    'api/slow/route.js': 'export async function GET() { await new Promise((r) => setTimeout(r, 400)); return { slow: true }; }',
};

async function startProject(t, files, { env, migrate = true } = {}) {
    const root = makeProject(t, files);
    if (migrate) {
        const { createDb, databasePath } = require('../core/db.js');
        const { runMigrations } = require('../core/migrations.js');
        const db = createDb(databasePath(root));
        runMigrations(root, db);
        db.close();
    }
    const port = await freePort();
    const adhar = startAdhar(t, root, ['start', '--port', String(port)], env);
    return { root, port, adhar, base: `http://127.0.0.1:${port}` };
}

test('adhar start serves the project in production mode', async (t) => {
    const { adhar, base, port } = await startProject(t, { ...PROJECT, '.env': 'GREETING=hello\n' });
    await adhar.waitFor(new RegExp(`Adhar is running at http://localhost:${port} \\(production\\)`));

    assert.deepEqual(await (await fetch(`${base}/api`)).json(), { mode: 'production', greeting: 'hello' });

    const created = await fetch(`${base}/api/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Buy milk' }),
    });
    assert.equal(created.status, 201);
    assert.deepEqual(await created.json(), { id: 1, title: 'Buy milk' });
    assert.deepEqual(await (await fetch(`${base}/api/notes`)).json(), [{ id: 1, title: 'Buy milk' }]);
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);

    await adhar.waitFor(/GET \/api\/nope 404 \d+ms/);
    assert.match(adhar.output(), /GET \/api 200 \d+ms/);
    assert.match(adhar.output(), /POST \/api\/notes 201 \d+ms/);
});

test('a 500 hides the details from the client and prints them in the terminal', async (t) => {
    const { adhar, base } = await startProject(t, PROJECT);
    await adhar.waitFor(/Adhar is running/);

    const res = await fetch(`${base}/api/boom`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: { status: 500, message: 'Internal server error' } });

    await adhar.waitFor(/GET \/api\/boom 500/);
    assert.match(adhar.output(), /✖ GET \/api\/boom\n.*Error: secret detail/);
});

test('adhar start refuses to run while migrations are pending', async (t) => {
    const { adhar } = await startProject(t, PROJECT, { migrate: false });
    const { code } = await adhar.exited;
    assert.equal(code, 1);
    assert.match(adhar.output(), /1 migration has not run yet: 001-create-notes\.sql/);
    assert.match(adhar.output(), /Hint: Run `node adhar migrate` first/);
});

test('adhar start takes the port from .env when there is no flag', async (t) => {
    const port = await freePort();
    const root = makeProject(t, { 'api/route.js': 'export function GET() { return { ok: true }; }', '.env': `PORT=${port}\n` });
    const adhar = startAdhar(t, root, ['start'], { PORT: undefined });
    await adhar.waitFor(new RegExp(`running at http://localhost:${port} `));
    assert.deepEqual(await (await fetch(`http://127.0.0.1:${port}/api`)).json(), { ok: true });
});

test('a busy port is a clear error', async (t) => {
    const blocker = http.createServer();
    await new Promise((resolve) => blocker.listen(0, resolve));
    t.after(() => new Promise((resolve) => blocker.close(resolve)));
    const { port } = blocker.address();

    const root = makeProject(t, { 'api/route.js': 'export function GET() { return {}; }' });
    const adhar = startAdhar(t, root, ['start', '--port', String(port)]);
    const { code } = await adhar.exited;
    assert.equal(code, 1);
    assert.match(adhar.output(), new RegExp(`Port ${port} is already in use`));
    assert.match(adhar.output(), new RegExp(`--port ${port + 1}`));
});

test('a mistake in the project stops the start with the file and a hint', async (t) => {
    const root = makeProject(t, { 'api/users/route.js': 'export function get() {}' });
    const adhar = startAdhar(t, root, ['start', '--port', String(await freePort())]);
    const { code } = await adhar.exited;
    assert.equal(code, 1);
    assert.match(adhar.output(), /✖ Error: api\/users\/route\.js/);
    assert.match(adhar.output(), /Did you mean `GET`\?/);
});

test('warnings are printed but do not stop the server', async (t) => {
    const { adhar, base } = await startProject(t, PROJECT, { env: { CORS_ORIGIN: '*' } });
    await adhar.waitFor(/Adhar is running/);
    assert.match(adhar.output(), /⚠ Warning:\n\s+`CORS_ORIGIN=\*` lets any website call this API/);
    assert.equal((await fetch(`${base}/api`)).headers.get('access-control-allow-origin'), '*');
});

// Windows has no signals: a process there is ended at once, so there is nothing graceful to test.
test('SIGTERM lets a running request finish, then exits with 0', { skip: process.platform === 'win32' }, async (t) => {
    const { adhar, base, root } = await startProject(t, PROJECT);
    await adhar.waitFor(/Adhar is running/);

    const slow = fetch(`${base}/api/slow`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    adhar.child.kill('SIGTERM');

    const res = await slow;
    assert.deepEqual(await res.json(), { slow: true });

    const { code } = await adhar.exited;
    assert.equal(code, 0);
    await assert.rejects(fetch(`${base}/api`));
    assert.equal(fs.existsSync(path.join(root, 'storage', 'app.db-wal')), false);
});

test('adhar start in a project that still has routes/ explains the rename', async (t) => {
    const root = makeProject(t, { 'routes/notes/route.js': 'export function GET() { return []; }' });
    const adhar = startAdhar(t, root, ['start', '--port', String(await freePort())]);
    const { code } = await adhar.exited;
    assert.equal(code, 1);
    assert.match(adhar.output(), /✖ Error: routes\/\n  The `routes\/` folder is now `api\/`\./);
    assert.match(adhar.output(), /`\/notes` becomes `\/api\/notes`/);
});
