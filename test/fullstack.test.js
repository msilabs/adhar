'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createApp } = require('../core/app.js');
const { createLineFilter, findAlo } = require('../cli/web.js');
const { BIN, freePort, startAdhar, eventually } = require('./helpers/cli.js');
const { makeProject } = require('./helpers/project.js');

const REPO = path.join(__dirname, '..');
const REAL_ALO = path.join(REPO, 'node_modules', '@msilabs', 'alo');

const PROJECT = {
    'api/notes/route.js': 'export function GET() { return [{ title: "first" }]; }',
    'web/pages/page.alo': '<head><title>Home</title></head>\n<template><h1>Hello from Alo</h1></template>\n',
    'web/pages/not-found.alo': '<head><title>Missing</title></head>\n<template><h1>No such page</h1></template>\n',
};

function adhar(cwd, args, env = {}) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', DATABASE_PATH: '', PORT: '', CORS_ORIGIN: '', NODE_ENV: '', ...env },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

// Puts the Alo that Adhar's own tests depend on into the project, the way `npm install` would.
function linkRealAlo(root) {
    assert.equal(fs.existsSync(REAL_ALO), true, 'Run `npm install` first: these tests use the real @msilabs/alo.');
    fs.mkdirSync(path.join(root, 'node_modules', '@msilabs'), { recursive: true });
    // A junction needs no special rights on Windows; elsewhere it is an ordinary symlink.
    fs.symlinkSync(REAL_ALO, path.join(root, 'node_modules', '@msilabs', 'alo'), 'junction');
}

// A stand-in for the cases the real Alo cannot show: an old version, a failing build, a dev server that dies.
function fakeAlo(version, script) {
    return {
        'node_modules/@msilabs/alo/package.json': JSON.stringify({ name: '@msilabs/alo', version }),
        'node_modules/@msilabs/alo/bin/alo.js': script,
    };
}

function fullStackProject(t, files = {}) {
    const root = makeProject(t, { ...PROJECT, ...files });
    linkRealAlo(root);
    return root;
}

async function startDev(t, root) {
    const port = await freePort();
    const dev = startAdhar(t, root, ['dev', '--port', String(port)]);
    const base = `http://127.0.0.1:${port}`;
    // The dev server may be between two workers, and Alo may still be starting, so a request is tried again.
    const get = (urlPath, expected = 200) =>
        eventually(async () => {
            const res = await fetch(base + urlPath);
            assert.equal(res.status, expected, urlPath);
            return res;
        });
    return { dev, base, get };
}

// ---------------------------------------------------------------- build and web

test('Alo is found in node_modules, also above the project', (t) => {
    const root = makeProject(t, { ...fakeAlo('1.4.2', ''), 'apps/blog/api/route.js': '' });
    const found = findAlo(path.join(root, 'apps', 'blog'));
    assert.equal(found.version, '1.4.2');
    assert.equal(found.bin, path.join(root, 'node_modules', '@msilabs', 'alo', 'bin', 'alo.js'));
    assert.equal(findAlo(makeProject(t, {})), null);
});

test('adhar build builds the site into web/dist/, and the app then serves it', async (t) => {
    const root = fullStackProject(t);
    const result = adhar(root, ['build']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /✔ Built 2 pages/);
    assert.equal(fs.existsSync(path.join(root, 'web', 'dist', 'index.html')), true);

    const app = await createApp(root);
    t.after(() => app.close());
    const home = await app.inject({ path: '/' });
    assert.equal(home.status, 200);
    assert.match(home.body, /<h1[^>]*>Hello from Alo<\/h1>/);
    const missing = await app.inject({ path: '/nope/' });
    assert.equal(missing.status, 404);
    assert.match(missing.body, /No such page/);
    assert.deepEqual((await app.inject({ path: '/api/notes' })).body, [{ title: 'first' }]);
});

test('a mistake in a page fails the build with exit code 1', (t) => {
    const root = fullStackProject(t, { 'web/pages/page.alo': '<template><Missing /></template>' });
    const result = adhar(root, ['build']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: pages\/page\.alo/);
    assert.equal(fs.existsSync(path.join(root, 'web', 'dist')), false);
});

test('adhar web new runs Alo\'s `new` inside web/', (t) => {
    const root = fullStackProject(t);
    const result = adhar(root, ['web', 'new', 'component', 'blog/PostCard']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Created components\/blog\/PostCard\.alo/);
    assert.equal(fs.existsSync(path.join(root, 'web', 'components', 'blog', 'PostCard.alo')), true);

    assert.equal(adhar(root, ['web', 'new', 'page', 'about']).code, 0);
    assert.equal(fs.existsSync(path.join(root, 'web', 'pages', 'about', 'page.alo')), true);
});

test('adhar web only knows `new`', (t) => {
    const root = fullStackProject(t);
    const cases = [
        [['web'], /Tell Adhar what to do in `web\/`[\s\S]*Only `new` works here/],
        [['web', 'dev'], /There is no `adhar web dev`[\s\S]*Use `node adhar dev`/],
        [['web', 'build'], /There is no `adhar web build`[\s\S]*Use `node adhar build`/],
        [['web', 'init'], /There is no `adhar web init`[\s\S]*init my-app --web/],
        [['web', 'serve'], /There is no `adhar web serve`[\s\S]*Only `new` works here/],
    ];
    for (const [args, pattern] of cases) {
        const result = adhar(root, args);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, pattern);
    }
});

test('build and web need Alo, and say how to install it', (t) => {
    const root = makeProject(t, PROJECT);
    for (const args of [['build'], ['web', 'new', 'page', 'about']]) {
        const result = adhar(root, args);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, /`web\/` needs Alo, and it is not installed\.\n\n  Hint: Run `npm i -D @msilabs\/alo`\.\n/);
    }

    const production = adhar(root, ['build'], { NODE_ENV: 'production' });
    assert.match(production.stderr, /Alo is a dev dependency: the build step needs `npm install` without `--omit=dev`/);

    const dev = adhar(root, ['dev']);
    assert.equal(dev.code, 1);
    assert.match(dev.stderr, /`web\/` needs Alo/);
});

test('an Alo that is too old is refused', (t) => {
    const root = makeProject(t, { ...PROJECT, ...fakeAlo('1.0.3', 'process.exit(0);') });
    for (const args of [['build'], ['dev']]) {
        const result = adhar(root, args);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, /Alo 1\.0\.3 is too old for a full stack project/);
        assert.match(result.stderr, /Adhar needs Alo 1\.1\.0 or newer\. Run `npm i -D @msilabs\/alo@latest`/);
    }
});

test('in an API-only project build and web fail with a hint, and everything else is as before', (t) => {
    const root = makeProject(t, { 'api/notes/route.js': PROJECT['api/notes/route.js'] });

    const build = adhar(root, ['build']);
    assert.equal(build.code, 1);
    assert.match(build.stderr, /Nothing to build: no `web\/` folder\./);
    assert.match(build.stderr, /init my-app --web/);

    const web = adhar(root, ['web', 'new', 'page', 'about']);
    assert.equal(web.code, 1);
    assert.match(web.stderr, /`adhar web` needs a `web\/` folder/);

    assert.equal(adhar(root, ['routes']).stdout, 'GET     /api/notes  api/notes/route.js\n');
    assert.match(adhar(makeProject(t, {}), ['build']).stderr, /No `api\/` folder/);
});

test('build refuses a site that has its own /api', (t) => {
    const root = fullStackProject(t, { 'web/pages/api/page.alo': '<template><h1>API docs</h1></template>' });
    const result = adhar(root, ['build']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: web\/pages\/api\/\n  `\/api` belongs to the API/);
});

test('--web only works with init', (t) => {
    const root = makeProject(t, PROJECT);
    const result = adhar(root, ['start', '--web']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`--web` does not work with `adhar start`/);
    assert.match(adhar(root, ['--help']).stdout, /adhar build +build the site in web\/ into web\/dist\//);
});

test('adhar start serves the built site and logs every request', async (t) => {
    const root = fullStackProject(t);
    assert.equal(adhar(root, ['build']).code, 0);

    const port = await freePort();
    const server = startAdhar(t, root, ['start', '--port', String(port)]);
    await server.waitFor(/Adhar is running at .* \(production\)/);
    const base = `http://127.0.0.1:${port}`;

    assert.match(await (await fetch(`${base}/`)).text(), /Hello from Alo/);
    assert.deepEqual(await (await fetch(`${base}/api/notes`)).json(), [{ title: 'first' }]);
    assert.equal((await fetch(`${base}/nope/`)).status, 404);
    await server.waitFor(/GET \/nope\/ 404 \d+ms/);
    assert.match(server.output(), /GET \/ 200 \d+ms/);
    assert.match(server.output(), /GET \/api\/notes 200 \d+ms/);
});

test('adhar start in a full stack project that is not built says to build first', async (t) => {
    const root = fullStackProject(t);
    const server = startAdhar(t, root, ['start', '--port', String(await freePort())]);
    const { code } = await server.exited;
    assert.equal(code, 1);
    assert.match(server.output(), /✖ Error: web\/\n.*`web\/dist\/index\.html` is missing\.\n\n  Hint: Run `node adhar build` first\./);
});

// ---------------------------------------------------------------- adhar dev

test('the line filter drops the lines that name Alo\'s own address', () => {
    let seen = '';
    const feed = createLineFilter((text) => (seen += text));
    feed('✔ Built 2 pages in 12ms\n\nAlo dev server run');
    feed('ning at http://localhost:51234/\nPress Ctrl+C to stop\n\n');
    feed('✔ Rebuilt 2 pages in 3ms\r\n\n⚠ Warning: pages/page.alo\n  Something.\n');
    assert.equal(seen, '✔ Built 2 pages in 12ms\n✔ Rebuilt 2 pages in 3ms\n\n⚠ Warning: pages/page.alo\n  Something.\n');
});

test('adhar dev serves the site and the API on one port, with live reload', async (t) => {
    const root = fullStackProject(t);
    const { dev, base, get } = await startDev(t, root);
    await dev.waitFor(/Adhar is running at .* \(dev\)/);

    const home = await (await get('/')).text();
    assert.match(home, /<h1[^>]*>Hello from Alo<\/h1>/);
    assert.match(home, /__alo\/reload/);
    assert.deepEqual(await (await get('/api/notes')).json(), [{ title: 'first' }]);
    assert.match(await (await get('/nope/', 404)).text(), /No such page/);
    assert.equal((await fetch(`${base}/`, { method: 'POST', body: 'x' })).status, 405);

    // The live reload stream comes through the proxy and stays open.
    const stream = await get('/__alo/reload');
    assert.equal(stream.headers.get('content-type'), 'text/event-stream');
    const reader = stream.body.getReader();
    assert.match(Buffer.from((await reader.read()).value).toString(), /retry: 1000/);

    // A page that changes is rebuilt by Alo, and the open stream is told to reload.
    fs.writeFileSync(path.join(root, 'web', 'pages', 'page.alo'), '<template><h1>Changed page</h1></template>\n');
    await eventually(async () => assert.match(await (await fetch(`${base}/`)).text(), /Changed page/));
    assert.match(Buffer.from((await reader.read()).value).toString(), /data: reload/);
    await reader.cancel();

    // The terminal shows one address, Adhar's; only the API and the site's failures get a request line.
    await dev.waitFor(/GET \/nope\/ 404 \d+ms/);
    const output = dev.output();
    assert.doesNotMatch(output, /Alo dev server running|Press Ctrl\+C/);
    assert.match(output, /✔ Built 2 pages/);
    assert.match(output, /GET \/api\/notes 200 \d+ms/);
    assert.doesNotMatch(output, /GET \/ 200|GET \/__alo/);
});

test('a change in api/ restarts the worker but not Alo', async (t) => {
    const root = fullStackProject(t);
    const { dev, get } = await startDev(t, root);
    await dev.waitFor(/Adhar is running/);
    await get('/');

    fs.writeFileSync(path.join(root, 'api', 'notes', 'route.js'), 'export function GET() { return ["changed"]; }');
    await eventually(async () => assert.deepEqual(await (await get('/api/notes')).json(), ['changed']));
    assert.match(dev.output(), /api\/notes\/route\.js changed, restarting\.\.\./);
    assert.match(await (await get('/')).text(), /Hello from Alo/);
    // Alo prints "Built" once, when it starts; a second one would mean it was started again.
    assert.equal(dev.output().match(/✔ Built \d+ page/g).length, 1);
});

const FAKE_DEV = `
const fs = require('node:fs');
const http = require('node:http');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]);
fs.writeFileSync('alo.pid', String(process.pid));
http.createServer((req, res) => res.end('fake site')).listen(port, 'localhost');
`;

test('when Alo dies the API keeps running and the site answers 502', async (t) => {
    const root = makeProject(t, { ...PROJECT, ...fakeAlo('1.1.0', 'console.error("alo: cannot start"); process.exit(1);') });
    const { dev, get } = await startDev(t, root);
    await dev.waitFor(/Adhar is running/);
    await dev.waitFor(/⚠ Warning:\n  The Alo dev server stopped, so the site is down\. The API keeps running\./);
    assert.match(dev.output(), /alo: cannot start/);

    assert.deepEqual(await (await get('/api/notes')).json(), [{ title: 'first' }]);
    const site = await get('/', 502);
    assert.equal(await site.text(), 'The Alo dev server is not running. Restart `adhar dev`.\n');
    await dev.waitFor(/GET \/ 502 \d+ms/);
});

async function startFakeDev(t) {
    const root = makeProject(t, { ...PROJECT, ...fakeAlo('1.1.0', FAKE_DEV) });
    const { dev, get } = await startDev(t, root);
    await dev.waitFor(/Adhar is running/);
    assert.equal(await (await get('/about/')).text(), 'fake site');
    const aloPid = Number(fs.readFileSync(path.join(root, 'web', 'alo.pid'), 'utf8'));
    return { dev, aloPid };
}

// Windows has no signals: the process there is ended at once, so there is nothing to observe.
test('stopping adhar dev also stops Alo', { skip: process.platform === 'win32' }, async (t) => {
    const { dev, aloPid } = await startFakeDev(t);
    dev.child.kill('SIGTERM');
    const { code } = await dev.exited;
    assert.equal(code, 0);
    await eventually(() => assert.throws(() => process.kill(aloPid, 0)), 5000);
});

test('Alo does not outlive a killed adhar dev', async (t) => {
    const { dev, aloPid } = await startFakeDev(t);
    dev.child.kill('SIGKILL');
    await dev.exited;
    await eventually(() => assert.throws(() => process.kill(aloPid, 0)), 10_000);
});

test('in dev an open connection does not hold up the shutdown', async (t) => {
    const { serve } = require('../cli/serve.js');
    const root = makeProject(t, PROJECT);

    // Stands in for Alo's live reload stream: it answers and never ends.
    const upstream = http.createServer((req, res) => res.writeHead(200, { 'content-type': 'text/event-stream' }).write('retry: 1000\n\n'));
    await new Promise((resolve) => upstream.listen(0, 'localhost', resolve));
    t.after(() => {
        upstream.closeAllConnections();
        upstream.close();
    });

    const port = await freePort();
    const write = process.stdout.write;
    process.stdout.write = () => true;
    t.after(() => (process.stdout.write = write));
    const server = await serve({ root, port, dev: true, webPort: upstream.address().port });

    const stream = await fetch(`http://127.0.0.1:${port}/__alo/reload`);
    const reader = stream.body.getReader();
    await reader.read();

    const started = performance.now();
    await server.close();
    assert.ok(performance.now() - started < 1500, 'close() waited for the open stream');
    await reader.cancel().catch(() => {});
});

// ---------------------------------------------------------------- adhar init --web

function listFiles(dir, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix + entry.name;
        return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative + '/') : [relative];
    });
}

function initWeb(t) {
    const parent = makeProject(t, {});
    fs.rmSync(path.join(parent, 'package.json'));
    const result = adhar(parent, ['init', 'my-app', '--web']);
    assert.equal(result.code, 0, result.stderr);
    return { root: path.join(parent, 'my-app'), result };
}

test('adhar init --web creates a full stack project', (t) => {
    const { root, result } = initWeb(t);
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

    assert.deepEqual(listFiles(root).sort(), [
        '.env',
        '.env.example',
        '.gitattributes',
        '.gitignore',
        '.vscode/extensions.json',
        '.vscode/settings.json',
        'AGENTS.md',
        'adhar',
        'api/(admin)/middleware.js',
        'api/(admin)/stats/route.js',
        'api/middleware.js',
        'api/notes/[id]/route.js',
        'api/notes/route.js',
        'api/route.js',
        'migrations/001-create-notes.sql',
        'package.json',
        'services/notes.js',
        'web/components/Notes.alo',
        'web/data/site.json',
        'web/global/theme.css',
        'web/pages/layout.alo',
        'web/pages/not-found.alo',
        'web/pages/page.alo',
        'web/public/favicon.svg',
    ]);
    assert.match(result.stdout, /✔ Created a new full stack Adhar project: my-app/);
    assert.match(result.stdout, /Next steps:\n  cd my-app\n  npm install\n  node adhar dev\n/);

    const pkg = JSON.parse(read('package.json'));
    assert.deepEqual(pkg.scripts, { dev: 'adhar dev', build: 'adhar build', start: 'adhar start', migrate: 'adhar migrate' });
    assert.deepEqual(Object.keys(pkg.dependencies), ['@msilabs/adhar']);
    assert.deepEqual(pkg.devDependencies, { '@msilabs/alo': '^1.1.0' });

    assert.equal(read('.gitignore'), 'node_modules/\nstorage/\n.env\nweb/dist/\nweb/.alo/\n');
    assert.doesNotMatch(read('.env.example'), /CORS/);
    assert.doesNotMatch(read('.env'), /CORS/);
    assert.match(read('.env'), /^PORT=8134\n/);
    assert.match(read('AGENTS.md'), /^# Adhar project: instructions for AI assistants/);
    assert.match(read('AGENTS.md'), /\n## The site in `web\/` \(Alo\)\r?\n/);
    assert.match(read('web/components/Notes.alo'), /fetch\('\/api\/notes'\)/);
    assert.deepEqual(JSON.parse(read('.vscode/extensions.json')), { recommendations: ['msilabs.alo-vscode'] });
});

test('adhar init without --web stays API only', (t) => {
    const parent = makeProject(t, {});
    fs.rmSync(path.join(parent, 'package.json'));
    assert.equal(adhar(parent, ['init', 'my-api']).code, 0);
    const root = path.join(parent, 'my-api');

    assert.equal(fs.existsSync(path.join(root, 'web')), false);
    assert.equal(fs.existsSync(path.join(root, '.vscode')), false);
    assert.match(fs.readFileSync(path.join(root, '.env.example'), 'utf8'), /# CORS_ORIGIN=http:\/\/localhost:3000/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /The site in `web\/`/);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.equal(pkg.devDependencies, undefined);
    assert.equal(pkg.scripts.build, undefined);
});

test('the full stack starter builds and runs', async (t) => {
    const { root } = initWeb(t);
    linkRealAlo(root);

    const build = adhar(root, ['build']);
    assert.equal(build.code, 0, build.stderr);
    assert.equal(build.stderr, '');

    const app = await createApp(root, { env: { DATABASE_PATH: ':memory:' } });
    t.after(() => app.close());
    assert.deepEqual(app.warnings, []);

    const home = await app.inject({ path: '/' });
    assert.equal(home.status, 200);
    assert.match(home.body, /আমার অ্যাপ/);
    assert.match(home.body, /<form/);
    assert.equal((await app.inject({ path: '/favicon.svg' })).headers['content-type'], 'image/svg+xml');
    assert.equal((await app.inject({ path: '/nope/' })).status, 404);

    const created = await app.inject({ method: 'POST', path: '/api/notes', body: { title: 'Buy milk' } });
    assert.equal(created.status, 201);
    assert.deepEqual((await app.inject({ path: '/api/notes' })).body.map((note) => note.title), ['Buy milk']);
});
