'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createApp } = require('../core/app.js');
const { hasWeb, isApiPath } = require('../core/web.js');
const { makeProject } = require('./helpers/project.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);

const SITE = {
    'api/middleware.js': 'export default function (ctx, next) { ctx.header("X-Api", "yes"); return next(); }',
    'api/notes/route.js': 'export function GET() { return [{ title: "first" }]; }',
    'web/pages/page.alo': '<template><h1>Home</h1></template>',
    'web/dist/index.html': '<h1>Home</h1>',
    'web/dist/about/index.html': '<h1>About</h1>',
    'web/dist/404.html': '<h1>Missing</h1>',
    'web/dist/robots.txt': 'User-agent: *\n',
    'web/dist/data.json': '{ "ok": true }',
    'web/dist/assets/style.1a2b3c4d.css': 'body { margin: 0; }',
    'web/dist/logo.png': PNG,
    'web/dist/apix/index.html': '<h1>Not the API</h1>',
    '.env': 'SECRET=1\n',
};

async function siteApp(t, files = SITE, options) {
    const app = await createApp(makeProject(t, files), options);
    t.after(() => app.close());
    return app;
}

test('a project is full stack when it has web/pages/', (t) => {
    assert.equal(hasWeb(makeProject(t, { 'api/route.js': '', 'web/pages/page.alo': '' })), true);
    assert.equal(hasWeb(makeProject(t, { 'api/route.js': '', 'web/README.md': '' })), false);
    assert.equal(hasWeb(makeProject(t, { 'api/route.js': '' })), false);
});

test('/api and what is below it belong to the API, nothing else', () => {
    for (const url of ['/api', '/api/', '/api/notes', '/api?page=2', '/api/notes?x=/']) assert.equal(isApiPath(url), true, url);
    for (const url of ['/', '/apix', '/apix/notes', '/about/api', '/API', '/?next=/api/']) assert.equal(isApiPath(url), false, url);
});

test('the site answers outside /api, the API inside it', async (t) => {
    const app = await siteApp(t);
    assert.equal(app.fullStack, true);

    const home = await app.inject({ path: '/' });
    assert.equal(home.status, 200);
    assert.equal(home.body, '<h1>Home</h1>');
    assert.equal(home.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(home.headers['content-length'], '13');
    assert.equal(home.headers['x-api'], undefined);

    const notes = await app.inject({ path: '/api/notes' });
    assert.deepEqual(notes.body, [{ title: 'first' }]);
    assert.equal(notes.headers['x-api'], 'yes');

    const missing = await app.inject({ path: '/api/nope' });
    assert.equal(missing.status, 404);
    assert.deepEqual(missing.body, { error: { status: 404, message: 'Not found' } });

    assert.equal((await app.inject({ path: '/apix/' })).body, '<h1>Not the API</h1>');
});

test('folders, files and the 404 page follow the rules of a static site', async (t) => {
    const app = await siteApp(t);

    assert.equal((await app.inject({ path: '/about/' })).body, '<h1>About</h1>');
    assert.equal((await app.inject({ path: '/about/index.html' })).body, '<h1>About</h1>');
    assert.equal((await app.inject({ path: '/robots.txt' })).body, 'User-agent: *\n');
    assert.deepEqual((await app.inject({ path: '/data.json' })).body, { ok: true });

    const redirect = await app.inject({ path: '/about?tab=1' });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.location, '/about/?tab=1');
    assert.equal((await app.inject({ path: '//about' })).headers.location, '/about/');

    for (const urlPath of ['/nope', '/nope/', '/about/nope.html', '/assets/']) {
        const missing = await app.inject({ path: urlPath });
        assert.equal(missing.status, 404, urlPath);
        assert.equal(missing.body, '<h1>Missing</h1>');
        assert.equal(missing.headers['content-type'], 'text/html; charset=utf-8');
    }
});

test('without a 404.html the site answers a missing page in plain text', async (t) => {
    const files = { ...SITE };
    delete files['web/dist/404.html'];
    const res = await (await siteApp(t, files)).inject({ path: '/nope' });
    assert.equal(res.status, 404);
    assert.equal(res.body, 'Not found (404)');
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
});

test('a file that is not text comes back as bytes', async (t) => {
    const res = await (await siteApp(t)).inject({ path: '/logo.png' });
    assert.equal(res.headers['content-type'], 'image/png');
    assert.deepEqual(res.body, PNG);
});

test('the site only answers GET and HEAD', async (t) => {
    const app = await siteApp(t);

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
        const res = await app.inject({ method, path: '/', body: { a: 1 } });
        assert.equal(res.status, 405, method);
        assert.equal(res.headers.allow, 'GET, HEAD');
    }

    const head = await app.inject({ method: 'HEAD', path: '/about/' });
    assert.equal(head.status, 200);
    assert.equal(head.body, undefined);
    assert.equal(head.headers['content-length'], '14');
});

test('a URL cannot leave web/dist/', async (t) => {
    const app = await siteApp(t);
    for (const urlPath of ['/../.env', '/..%2f.env', '/%2e%2e/%2e%2e/.env', '/about/../../.env', '/..%5c.env', '/%00']) {
        const res = await app.inject({ path: urlPath });
        assert.equal(res.status, 404, urlPath);
        assert.equal(res.body, '<h1>Missing</h1>');
    }
    assert.equal((await app.inject({ path: '/%E0%A4%A' })).status, 400);
});

test('hashed assets are cached for a year, pages are checked every time', async (t) => {
    const app = await siteApp(t);
    const asset = await app.inject({ path: '/assets/style.1a2b3c4d.css' });
    assert.equal(asset.headers['cache-control'], 'public, max-age=31536000, immutable');
    assert.equal(asset.headers['content-type'], 'text/css; charset=utf-8');

    for (const urlPath of ['/', '/robots.txt', '/nope']) {
        const res = await app.inject({ path: urlPath });
        assert.equal(res.headers['cache-control'], 'no-cache', urlPath);
        assert.equal(res.headers['x-content-type-options'], 'nosniff', urlPath);
    }
});

test('If-None-Match with the current ETag gives 304', async (t) => {
    const app = await siteApp(t);
    const first = await app.inject({ path: '/' });
    assert.match(first.headers.etag, /^W\/"[0-9a-f]+-[0-9a-f]+"$/);

    const again = await app.inject({ path: '/', headers: { 'If-None-Match': first.headers.etag } });
    assert.equal(again.status, 304);
    assert.equal(again.body, undefined);
    assert.equal(again.headers.etag, first.headers.etag);

    const other = await app.inject({ path: '/', headers: { 'If-None-Match': 'W/"0-0"' } });
    assert.equal(other.status, 200);
});

test('a file that changes while the app runs is served in its new form', async (t) => {
    const root = makeProject(t, SITE);
    const app = await createApp(root);
    t.after(() => app.close());
    const before = await app.inject({ path: '/' });

    fs.writeFileSync(path.join(root, 'web', 'dist', 'index.html'), '<h1>Home, rebuilt</h1>');
    fs.writeFileSync(path.join(root, 'web', 'dist', 'new.txt'), 'new');
    const after = await app.inject({ path: '/' });
    assert.equal(after.body, '<h1>Home, rebuilt</h1>');
    assert.notEqual(after.headers.etag, before.headers.etag);
    assert.equal((await app.inject({ path: '/new.txt' })).body, 'new');
});

test('CORS headers stay on the API and off the site', async (t) => {
    const app = await siteApp(t, SITE, { env: { CORS_ORIGIN: 'https://app.example.com' } });
    const headers = { origin: 'https://app.example.com' };
    assert.equal((await app.inject({ path: '/api/notes', headers })).headers['access-control-allow-origin'], 'https://app.example.com');
    assert.equal((await app.inject({ path: '/', headers })).headers['access-control-allow-origin'], undefined);
});

test('a project without web/pages/ stays API only', async (t) => {
    const app = await siteApp(t, {
        'api/notes/route.js': 'export function GET() { return []; }',
        'web/dist/index.html': '<h1>Home</h1>',
    }, { dev: true });
    assert.equal(app.fullStack, false);

    const res = await app.inject({ path: '/' });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: { status: 404, message: 'Not found' } });
    assert.equal((await app.inject({ path: '/notes' })).body.error.message, 'Not found. Did you mean `/api/notes`?');
});

test('a full stack project that is not built yet does not start', async (t) => {
    const root = makeProject(t, { 'api/route.js': 'export function GET() { return {}; }', 'web/pages/page.alo': '' });
    await assert.rejects(createApp(root), (err) => {
        assert.equal(err.name, 'AdharError');
        assert.equal(err.file, 'web/');
        assert.match(err.message, /`web\/dist\/index\.html` is missing/);
        assert.equal(err.hint, 'Run `node adhar build` first.');
        return true;
    });
});

test('when something else serves the site, the app starts without web/dist/', async (t) => {
    const root = makeProject(t, { 'api/notes/route.js': 'export function GET() { return []; }', 'web/pages/page.alo': '' });
    const app = await createApp(root, { web: 'external', dev: true });
    t.after(() => app.close());
    assert.equal(app.fullStack, true);
    assert.deepEqual((await app.inject({ path: '/api/notes' })).body, []);
    // No "/api" hint here: outside /api is the site's ground.
    assert.equal((await app.inject({ path: '/notes' })).body.error.message, 'Not found');
});

test('the site cannot have an /api of its own', async (t) => {
    for (const folder of ['web/pages/api', 'web/public/api']) {
        const root = makeProject(t, {
            'api/route.js': 'export function GET() { return {}; }',
            'web/pages/page.alo': '',
            'web/dist/index.html': '',
            [`${folder}/notes.txt`]: '',
        });
        await assert.rejects(createApp(root), (err) => {
            assert.equal(err.name, 'AdharError');
            assert.equal(err.file, folder + '/');
            assert.match(err.message, /`\/api` belongs to the API/);
            return true;
        });
    }
});

test('over http a file is streamed, HEAD has no body and a POST to the site is refused', async (t) => {
    const app = await siteApp(t);
    const server = http.createServer(app.listener);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;

    const image = await fetch(`${base}/logo.png`);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG);

    const head = await fetch(`${base}/`, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '13');
    assert.equal(await head.text(), '');

    const cached = await fetch(`${base}/`, { headers: { 'If-None-Match': head.headers.get('etag') } });
    assert.equal(cached.status, 304);

    const post = await fetch(`${base}/about/`, { method: 'POST', body: 'x'.repeat(1000) });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');

    const api = await fetch(`${base}/api/notes`);
    assert.deepEqual(await api.json(), [{ title: 'first' }]);
});
