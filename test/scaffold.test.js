'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createApp } = require('../core/app.js');
const { plan, packageName } = require('../cli/scaffold.js');
const { BIN, freePort, startAdhar, eventually } = require('./helpers/cli.js');
const { makeProject } = require('./helpers/project.js');
const { version } = require('../package.json');

const REPO = path.join(__dirname, '..');

function adhar(cwd, args) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', DATABASE_PATH: '', PORT: '', CORS_ORIGIN: '', NODE_ENV: '' },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

// An empty folder to run `adhar init` in.
function emptyFolder(t) {
    const root = makeProject(t, {});
    fs.rmSync(path.join(root, 'package.json'));
    return root;
}

function initProject(t) {
    const parent = emptyFolder(t);
    const result = adhar(parent, ['init', 'my-api']);
    assert.equal(result.code, 0, result.stderr);
    return { root: path.join(parent, 'my-api'), result };
}

function listFiles(dir, prefix = '') {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix + entry.name;
        return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative + '/') : [relative];
    });
}

test('adhar init creates the whole project', (t) => {
    const { root, result } = initProject(t);

    assert.deepEqual(listFiles(root).sort(), [
        '.env',
        '.env.example',
        '.gitignore',
        'AGENTS.md',
        'adhar',
        'migrations/001-create-notes.sql',
        'package.json',
        'routes/(admin)/middleware.js',
        'routes/(admin)/stats/route.js',
        'routes/middleware.js',
        'routes/notes/[id]/route.js',
        'routes/notes/route.js',
        'routes/route.js',
        'services/notes.js',
    ]);
    assert.match(result.stdout, /✔ Created a new Adhar project: my-api/);
    assert.match(result.stdout, /Next steps:\n  cd my-api\n  npm install\n  node adhar dev\n/);
});

test('the new project has the right package.json, ignores and env files', (t) => {
    const { root } = initProject(t);
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

    assert.deepEqual(JSON.parse(read('package.json')), {
        name: 'my-api',
        private: true,
        type: 'module',
        engines: { node: '>=22.13' },
        scripts: { dev: 'adhar dev', start: 'adhar start', migrate: 'adhar migrate' },
        dependencies: { '@msilabs/adhar': `^${version}` },
    });
    assert.equal(read('.gitignore'), 'node_modules/\nstorage/\n.env\n');
    assert.match(read('.env.example'), /^# Copy this file to \.env/);
    assert.match(read('.env'), /^PORT=8134\n/);
    assert.match(read('.env'), /ADMIN_TOKEN=change-me/);
    assert.match(read('adhar'), /^#!\/usr\/bin\/env node\n/);
    assert.match(read('adhar'), /require\('@msilabs\/adhar\/cli'\)/);
});

test('the package name comes from the folder name', () => {
    assert.equal(packageName('/home/a/My API'), 'my-api');
    assert.equal(packageName('/home/a/notes_api.v2'), 'notes-api-v2');
    assert.equal(packageName('/home/a/আধার'), 'my-api');
});

test('adhar init works in the current folder, even with a .git folder in it', (t) => {
    const root = emptyFolder(t);
    fs.mkdirSync(path.join(root, '.git'));
    const result = adhar(root, ['init']);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /Next steps:\n  npm install\n  node adhar dev\n/);
    assert.equal(fs.existsSync(path.join(root, 'routes', 'route.js')), true);
});

test('adhar init refuses a folder that is not empty, and a file', (t) => {
    const root = emptyFolder(t);
    fs.mkdirSync(path.join(root, 'busy'));
    fs.writeFileSync(path.join(root, 'busy', 'notes.txt'), 'x');
    fs.writeFileSync(path.join(root, 'a-file'), 'x');

    const busy = adhar(root, ['init', 'busy']);
    assert.equal(busy.code, 1);
    assert.match(busy.stderr, /The folder `busy` is not empty, so no project was created/);
    assert.deepEqual(fs.readdirSync(path.join(root, 'busy')), ['notes.txt']);

    const file = adhar(root, ['init', 'a-file']);
    assert.equal(file.code, 1);
    assert.match(file.stderr, /`a-file` is a file, not a folder/);
});

test('the launcher explains that Adhar is not installed yet', (t) => {
    const { root } = initProject(t);
    const result = spawnSync(process.execPath, ['adhar', 'routes'], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Adhar is not installed\. Run `npm install` first\./);
});

test('the launcher runs the installed Adhar', (t) => {
    const { root } = initProject(t);
    fs.mkdirSync(path.join(root, 'node_modules', '@msilabs'), { recursive: true });
    // A junction needs no special rights on Windows; elsewhere it is an ordinary symlink.
    fs.symlinkSync(REPO, path.join(root, 'node_modules', '@msilabs', 'adhar'), 'junction');

    const result = spawnSync(process.execPath, ['adhar', 'routes'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trimEnd().split('\n'), [
        'GET     /           routes/route.js',
        'GET     /notes      routes/notes/route.js',
        'POST    /notes      routes/notes/route.js',
        'GET     /notes/:id  routes/notes/[id]/route.js',
        'PATCH   /notes/:id  routes/notes/[id]/route.js',
        'DELETE  /notes/:id  routes/notes/[id]/route.js',
        'GET     /stats      routes/(admin)/stats/route.js',
    ]);
});

test('the new project works end to end', async (t) => {
    const { root } = initProject(t);
    const app = await createApp(root, { env: { DATABASE_PATH: ':memory:', ADMIN_TOKEN: 'secret' } });
    t.after(() => app.close());
    assert.deepEqual(app.warnings, []);

    const home = await app.inject({ path: '/' });
    assert.equal(home.status, 200);
    assert.equal(home.body.message, 'আধার চলছে');
    assert.match(home.headers['x-response-time'], /^\d+ms$/);

    assert.deepEqual((await app.inject({ path: '/notes' })).body, []);

    const created = await app.inject({ method: 'POST', path: '/notes', body: { title: 'Buy milk', done: true } });
    assert.equal(created.status, 201);
    assert.equal(created.body.id, 1);
    assert.equal(created.body.title, 'Buy milk');
    assert.equal(created.body.done, false);
    assert.match(created.body.created_at, /^\d{4}-\d{2}-\d{2} /);

    const invalid = await app.inject({ method: 'POST', path: '/notes', body: {} });
    assert.equal(invalid.status, 422);
    assert.deepEqual(invalid.body.error.fields, { title: 'is required' });

    await app.inject({ method: 'POST', path: '/notes', body: { title: 'Second' } });
    assert.deepEqual((await app.inject({ path: '/notes' })).body.map((note) => note.title), ['Second', 'Buy milk']);

    assert.equal((await app.inject({ path: '/notes/1' })).body.title, 'Buy milk');
    assert.deepEqual((await app.inject({ path: '/notes/9' })).body, { error: { status: 404, message: 'Note not found' } });
    assert.equal((await app.inject({ path: '/notes/abc' })).status, 422);

    const patched = await app.inject({ method: 'PATCH', path: '/notes/1', body: { done: true } });
    assert.equal(patched.body.done, true);
    assert.equal(patched.body.title, 'Buy milk');
    const renamed = await app.inject({ method: 'PATCH', path: '/notes/1', body: { title: 'Buy bread' } });
    assert.deepEqual([renamed.body.title, renamed.body.done], ['Buy bread', true]);
    assert.equal((await app.inject({ method: 'PATCH', path: '/notes/9', body: { done: true } })).status, 404);

    assert.equal((await app.inject({ path: '/stats' })).status, 401);
    const stats = await app.inject({ path: '/stats', headers: { authorization: 'Bearer secret' } });
    assert.deepEqual(stats.body, { notes: 2, done: 1 });

    assert.equal((await app.inject({ method: 'DELETE', path: '/notes/2' })).status, 204);
    assert.equal((await app.inject({ method: 'DELETE', path: '/notes/2' })).status, 404);
    assert.equal((await app.inject({ method: 'PUT', path: '/notes/1' })).status, 405);
    assert.equal((await app.inject({ path: '/nope' })).status, 404);
});

test('the new project runs under adhar dev with its own .env', async (t) => {
    const { root } = initProject(t);
    const port = await freePort();
    const dev = startAdhar(t, root, ['dev', '--port', String(port)]);
    await dev.waitFor(/Adhar is running/);
    const base = `http://127.0.0.1:${port}`;

    await eventually(async () => assert.equal((await fetch(`${base}/notes`)).status, 200));
    assert.equal((await fetch(`${base}/stats`)).status, 401);
    const stats = await fetch(`${base}/stats`, { headers: { authorization: 'Bearer change-me' } });
    assert.deepEqual(await stats.json(), { notes: 0, done: 0 });
    assert.equal(fs.existsSync(path.join(root, 'storage', 'app.db')), true);
});

function newProject(t, files = {}) {
    return makeProject(t, { 'routes/route.js': 'export function GET() { return {}; }', ...files });
}

test('adhar new route creates a working route', async (t) => {
    const root = newProject(t);

    const plain = adhar(root, ['new', 'route', 'users']);
    assert.equal(plain.code, 0, plain.stderr);
    assert.match(plain.stdout, /✔ Created routes\/users\/route\.js\n\s+URL: \/users/);

    const dynamic = adhar(root, ['new', 'route', '(shop)/users/[id]/posts/[postId]']);
    assert.equal(dynamic.code, 0, dynamic.stderr);
    assert.match(dynamic.stdout, /Created routes\/\(shop\)\/users\/\[id\]\/posts\/\[postId\]\/route\.js\n\s+URL: \/users\/:id\/posts\/:postId/);

    const app = await createApp(root);
    assert.deepEqual((await app.inject({ path: '/users' })).body, { message: 'Hello from /users' });
    assert.deepEqual((await app.inject({ path: '/users/7/posts/9' })).body, { id: '7', postId: '9' });
    await app.close();
});

test('adhar new middleware, service and migration create working files', async (t) => {
    const root = newProject(t, { 'migrations/001-create-notes.sql': 'CREATE TABLE notes (id INTEGER);' });

    const middleware = adhar(root, ['new', 'middleware', '(admin)']);
    assert.match(middleware.stdout, /Created routes\/\(admin\)\/middleware\.js\n\s+Runs for every route in routes\/\(admin\)\//);

    const service = adhar(root, ['new', 'service', 'blog/posts']);
    assert.match(service.stdout, /Created services\/blog\/posts\.js\n\s+Use it as ctx\.services\.blog\.posts/);

    const migration = adhar(root, ['new', 'migration', 'add-tags']);
    assert.match(migration.stdout, /Created migrations\/002-add-tags\.sql/);

    for (const result of [middleware, service, migration]) assert.equal(result.code, 0, result.stderr);

    fs.writeFileSync(
        path.join(root, 'routes', 'route.js'),
        'export function GET(ctx) { return ctx.services.blog.posts.all(); }',
    );
    const app = await createApp(root, { env: { DATABASE_PATH: ':memory:' } });
    assert.deepEqual((await app.inject({ path: '/' })).body, []);
    await app.close();
});

test('adhar new route . and middleware . mean the top of routes/', (t) => {
    const root = makeProject(t, { 'routes/README.md': '' });
    assert.equal(plan('route', '.', root).file, 'routes/route.js');
    assert.equal(plan('route', '.', root).note, 'URL: /');
    assert.equal(plan('middleware', '.', root).file, 'routes/middleware.js');
    assert.equal(plan('middleware', '.', root).note, 'Runs for every request');
    assert.equal(adhar(root, ['new', 'middleware', '.']).code, 0);
});

test('the first migration gets 001, and numbers continue after the highest', (t) => {
    const root = newProject(t);
    assert.equal(plan('migration', 'create-users', root).file, 'migrations/001-create-users.sql');

    fs.mkdirSync(path.join(root, 'migrations'));
    fs.writeFileSync(path.join(root, 'migrations', '001-a.sql'), '');
    fs.writeFileSync(path.join(root, 'migrations', '007-b.sql'), '');
    assert.equal(plan('migration', 'add-tags', root).file, 'migrations/008-add-tags.sql');
});

test('adhar new never overwrites a file', (t) => {
    const root = newProject(t);
    const result = adhar(root, ['new', 'route', '.']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /`routes\/route\.js` already exists, so nothing was created/);
    assert.equal(fs.readFileSync(path.join(root, 'routes', 'route.js'), 'utf8'), 'export function GET() { return {}; }');
});

test('adhar new explains what is missing or wrong', (t) => {
    const root = newProject(t);
    const cases = [
        [['new'], /Tell Adhar what to create/],
        [['new', 'rout', 'users'], /There is no `adhar new rout`[\s\S]*Did you mean `adhar new route`\?/],
        [['new', 'controller', 'users'], /You can create: `route`, `middleware`, `service`, `migration`/],
        [['new', 'route'], /`adhar new route` needs a name/],
        [['new', 'service', '.'], /`adhar new service` needs a name/],
        [['new', 'route', 'Users'], /Folder name `Users` is not allowed/],
        [['new', 'route', 'files/[...path]'], /Folder name `\[\.\.\.path\]` is not allowed/],
        [['new', 'service', 'blog-posts'], /Service name `blog-posts` is not allowed[\s\S]*write it as `blogPosts`/],
        [['new', 'migration', 'Create Posts'], /Migration name `Create Posts` is not allowed/],
        [['new', 'migration', '002-add-tags.sql'], /Migration name .* is not allowed[\s\S]*The number is added for you/],
    ];
    for (const [args, pattern] of cases) {
        const result = adhar(root, args);
        assert.equal(result.code, 1, args.join(' '));
        assert.match(result.stderr, pattern);
    }
});

test('adhar new outside a project fails with a hint', (t) => {
    const root = makeProject(t, {});
    const result = adhar(root, ['new', 'route', 'users']);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /No `routes\/` folder/);
});
