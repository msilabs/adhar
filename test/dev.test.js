'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { freePort, startAdhar, eventually } = require('./helpers/cli.js');
const { makeProject } = require('./helpers/project.js');

const HELLO = 'export function GET() { return { version: 1 }; }';

async function startDev(t, files, env) {
    const root = makeProject(t, files);
    const port = await freePort();
    const adhar = startAdhar(t, root, ['dev', '--port', String(port)], env);
    const base = `http://127.0.0.1:${port}`;
    const write = (file, content) => fs.writeFileSync(path.join(root, ...file.split('/')), content);
    // The dev server may be between two workers for a moment, so a refused connection is tried again.
    const getJson = async (urlPath) => {
        let res;
        try {
            res = await eventually(() => fetch(base + urlPath), 5000);
        } catch (err) {
            throw new Error(`GET ${urlPath} got no answer. Output:\n${adhar.output()}`, { cause: err });
        }
        return { status: res.status, body: await res.json() };
    };
    return { root, port, adhar, base, write, getJson };
}

test('adhar dev serves the project in dev mode and runs migrations', async (t) => {
    const { adhar, getJson, port, root } = await startDev(t, {
        'migrations/001-create-notes.sql': 'CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT);',
        'routes/route.js': 'export function GET(ctx) { return { mode: ctx.env.NODE_ENV }; }',
        'routes/notes/route.js': 'export function GET(ctx) { return ctx.db.all("SELECT * FROM notes"); }',
        'routes/boom/route.js': 'export function GET() { throw new Error("visible detail"); }',
    });
    await adhar.waitFor(new RegExp(`Adhar is running at http://localhost:${port} \\(dev\\)`));

    assert.deepEqual(await getJson('/'), { status: 200, body: { mode: 'development' } });
    assert.deepEqual(await getJson('/notes'), { status: 200, body: [] });
    assert.equal(fs.existsSync(path.join(root, 'storage', 'app.db')), true);

    const failed = await getJson('/boom');
    assert.equal(failed.status, 500);
    assert.equal(failed.body.error.message, 'visible detail');
    assert.match(failed.body.error.stack, /Error: visible detail/);

    await adhar.waitFor(/GET \/boom 500 \d+ms/);
    assert.match(adhar.output(), /GET \/ 200 \d+ms/);
});

test('changing a route file restarts the server with the new code', async (t) => {
    const { adhar, getJson, write } = await startDev(t, { 'routes/route.js': HELLO });
    await adhar.waitFor(/Adhar is running/);
    assert.deepEqual((await getJson('/')).body, { version: 1 });

    write('routes/route.js', 'export function GET() { return { version: 2 }; }');
    await eventually(async () => assert.deepEqual((await getJson('/')).body, { version: 2 }));
    assert.match(adhar.output(), /routes\/route\.js changed, restarting\.\.\./);
});

test('a new route, service and migration are picked up', async (t) => {
    const { adhar, getJson, write, root } = await startDev(t, { 'routes/route.js': HELLO });
    await adhar.waitFor(/Adhar is running/);

    fs.mkdirSync(path.join(root, 'migrations'));
    write('migrations/001-create-notes.sql', "CREATE TABLE notes (title TEXT);\nINSERT INTO notes (title) VALUES ('first');");
    fs.mkdirSync(path.join(root, 'services'));
    write('services/notes.js', 'export default ({ db }) => ({ all: () => db.all("SELECT title FROM notes") });');
    fs.mkdirSync(path.join(root, 'routes', 'notes'));
    write('routes/notes/route.js', 'export function GET(ctx) { return ctx.services.notes.all(); }');

    await eventually(async () => assert.deepEqual(await getJson('/notes'), { status: 200, body: [{ title: 'first' }] }));

    // The folders did not exist at the start; a later change inside one must still be seen.
    write('services/notes.js', 'export default () => ({ all: () => ["changed"] });');
    await eventually(async () => assert.deepEqual((await getJson('/notes')).body, ['changed']));
});

test('a mistake is shown, and fixing it brings the server back', async (t) => {
    const { adhar, getJson, write } = await startDev(t, { 'routes/route.js': HELLO });
    await adhar.waitFor(/Adhar is running/);

    write('routes/route.js', 'export function get() { return {}; }');
    await adhar.waitFor(/Unknown export `get`[\s\S]*Did you mean `GET`\?[\s\S]*Waiting for a file to change/);
    assert.equal(adhar.child.exitCode, null);

    write('routes/route.js', 'export function GET() { return { fixed: true }; }');
    await eventually(async () => assert.deepEqual((await getJson('/')).body, { fixed: true }));
});

test('a mistake at the first start does not end adhar dev', async (t) => {
    const { adhar, getJson, write } = await startDev(t, { 'routes/route.js': 'export const schema = {};' });
    await adhar.waitFor(/exports no handlers[\s\S]*Waiting for a file to change/);
    assert.equal(adhar.child.exitCode, null);

    write('routes/route.js', HELLO);
    await eventually(async () => assert.deepEqual((await getJson('/')).body, { version: 1 }));
});

test('changing .env restarts the server', async (t) => {
    const { adhar, getJson, write } = await startDev(t, {
        'routes/route.js': 'export function GET(ctx) { return { greeting: ctx.env.GREETING ?? null }; }',
        '.env': 'GREETING=hello\n',
    });
    await adhar.waitFor(/Adhar is running/);
    assert.deepEqual((await getJson('/')).body, { greeting: 'hello' });

    write('.env', 'GREETING=salam\n');
    await eventually(async () => assert.deepEqual((await getJson('/')).body, { greeting: 'salam' }));
});

test('adhar dev outside a project fails at once', async (t) => {
    const root = makeProject(t, {});
    const adhar = startAdhar(t, root, ['dev']);
    const { code } = await adhar.exited;
    assert.equal(code, 1);
    assert.match(adhar.output(), /No `routes\/` folder/);
});

// Windows has no signals: the process there is ended at once, so there is nothing to observe.
test('stopping adhar dev also stops the worker', { skip: process.platform === 'win32' }, async (t) => {
    const { adhar, base } = await startDev(t, { 'routes/route.js': HELLO });
    await adhar.waitFor(/Adhar is running/);

    adhar.child.kill('SIGTERM');
    const { code } = await adhar.exited;
    assert.equal(code, 0);
    await eventually(() => assert.rejects(fetch(base + '/')), 5000);
});

test('the worker does not outlive a killed adhar dev', async (t) => {
    const { adhar, base } = await startDev(t, { 'routes/route.js': HELLO });
    await adhar.waitFor(/Adhar is running/);
    assert.equal((await fetch(base + '/')).status, 200);

    adhar.child.kill('SIGKILL');
    await adhar.exited;
    await eventually(() => assert.rejects(fetch(base + '/')), 10_000);
});
