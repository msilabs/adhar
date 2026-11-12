'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createApp } = require('../core/app.js');
const { createDb, databasePath } = require('../core/db.js');
const { listMigrations, pendingMigrations, runMigrations } = require('../core/migrations.js');
const { makeProject } = require('./helpers/project.js');

const BIN = path.join(__dirname, '..', 'bin', 'adhar.js');
const CREATE_NOTES = 'CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL);';
const ADD_DONE = 'ALTER TABLE notes ADD COLUMN done INTEGER NOT NULL DEFAULT 0;\nCREATE INDEX notes_done ON notes (done);';

function memoryDb(t) {
    const db = createDb(':memory:');
    t.after(() => db.close());
    return db;
}

function adharError(file, message, hint) {
    return (err) => {
        assert.equal(err.name, 'AdharError');
        if (file) assert.equal(err.file, file);
        assert.match(err.message, message);
        if (hint) assert.match(err.hint, hint);
        return true;
    };
}

function adharMigrate(cwd, env = {}) {
    const result = spawnSync(process.execPath, [BIN, 'migrate'], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1', DATABASE_PATH: '', ...env },
    });
    return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('migrations are listed in number order', (t) => {
    const root = makeProject(t, {
        'migrations/002-add-done.sql': ADD_DONE,
        'migrations/001-create-notes.sql': CREATE_NOTES,
        'migrations/010-later.sql': 'SELECT 1;',
        'migrations/README.md': 'notes',
    });
    assert.deepEqual(listMigrations(root), ['001-create-notes.sql', '002-add-done.sql', '010-later.sql']);
});

test('a project without migrations/ has none and does not open the database', (t) => {
    const root = makeProject(t, {});
    const db = createDb(databasePath(root));
    assert.deepEqual(listMigrations(root), []);
    assert.deepEqual(runMigrations(root, db), []);
    assert.equal(fs.existsSync(path.join(root, 'storage')), false);
});

test('runMigrations runs each file once', (t) => {
    const root = makeProject(t, {
        'migrations/001-create-notes.sql': CREATE_NOTES,
        'migrations/002-add-done.sql': ADD_DONE,
    });
    const db = memoryDb(t);

    assert.deepEqual(pendingMigrations(root, db), ['001-create-notes.sql', '002-add-done.sql']);
    assert.deepEqual(runMigrations(root, db), ['001-create-notes.sql', '002-add-done.sql']);
    assert.deepEqual(runMigrations(root, db), []);
    assert.deepEqual(pendingMigrations(root, db), []);

    db.run('INSERT INTO notes (title) VALUES (?)', 'a');
    assert.deepEqual(db.get('SELECT title, done FROM notes'), { title: 'a', done: 0 });
});

test('a migration added later is the only one that runs', (t) => {
    const root = makeProject(t, { 'migrations/001-create-notes.sql': CREATE_NOTES });
    const db = memoryDb(t);
    runMigrations(root, db);

    fs.writeFileSync(path.join(root, 'migrations', '002-add-done.sql'), ADD_DONE);
    assert.deepEqual(runMigrations(root, db), ['002-add-done.sql']);
});

test('a failing migration saves nothing from that file and stops', (t) => {
    const root = makeProject(t, {
        'migrations/001-create-notes.sql': CREATE_NOTES,
        'migrations/002-broken.sql': 'CREATE TABLE tags (id INTEGER);\nCREATE TABLE notes (id INTEGER);',
        'migrations/003-never.sql': 'CREATE TABLE never (id INTEGER);',
    });
    const db = memoryDb(t);

    assert.throws(
        () => runMigrations(root, db),
        adharError('migrations/002-broken.sql', /This migration failed: table notes already exists/, /Nothing from this file was saved/),
    );
    const tables = db.all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((row) => row.name);
    assert.deepEqual(tables, ['_migrations', 'notes']);
    assert.deepEqual(pendingMigrations(root, db), ['002-broken.sql', '003-never.sql']);
});

test('a wrong migration name is an error', (t) => {
    for (const name of ['1-create.sql', 'create-notes.sql', '001_create.sql', '001-Create.sql', '0001-create.sql']) {
        const root = makeProject(t, { [`migrations/${name}`]: 'SELECT 1;' });
        assert.throws(
            () => listMigrations(root),
            adharError(`migrations/${name}`, /Invalid migration name/, /001-create-users\.sql/),
            name,
        );
    }
});

test('two migrations with the same number is an error', (t) => {
    const root = makeProject(t, {
        'migrations/001-create-notes.sql': CREATE_NOTES,
        'migrations/001-create-users.sql': 'SELECT 1;',
    });
    assert.throws(
        () => listMigrations(root),
        adharError('migrations/001-create-users.sql', /Two migrations have the number 001.*migrations\/001-create-notes\.sql/),
    );
});

const NOTES_PROJECT = {
    'migrations/001-create-notes.sql': CREATE_NOTES,
    'services/notes.js': `
export default ({ db }) => ({
    all: () => db.all('SELECT * FROM notes ORDER BY id'),
    create: (title) => db.get('INSERT INTO notes (title) VALUES (?) RETURNING *', title),
});
`,
    'api/notes/route.js': `
export const schema = { POST: { body: { title: 'string' } } };
export function GET(ctx) { return ctx.services.notes.all(); }
export function POST(ctx) { ctx.status(201); return ctx.services.notes.create(ctx.body.title); }
`,
    'api/count/route.js': 'export function GET(ctx) { return ctx.db.get("SELECT COUNT(*) AS n FROM notes"); }',
};

test('an app migrates on start and gives db to routes and services', async (t) => {
    const root = makeProject(t, NOTES_PROJECT);
    const app = await createApp(root, { env: { DATABASE_PATH: ':memory:' } });

    const created = await app.inject({ method: 'POST', path: '/api/notes', body: { title: 'Buy milk' } });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { id: 1, title: 'Buy milk' });
    assert.deepEqual((await app.inject({ path: '/api/notes' })).body, [{ id: 1, title: 'Buy milk' }]);
    assert.deepEqual((await app.inject({ path: '/api/count' })).body, { n: 1 });
    await app.close();
});

test('an SQL error in a handler is a 500, hidden in production', async (t) => {
    const root = makeProject(t, {
        'api/route.js': 'export function GET(ctx) { return ctx.db.all("SELECT * FROM missing"); }',
    });
    const reported = [];
    const app = await createApp(root, {
        env: { DATABASE_PATH: ':memory:' },
        onError: (err) => reported.push(err.message),
    });
    const res = await app.inject({ path: '/api' });
    assert.deepEqual(res.body, { error: { status: 500, message: 'Internal server error' } });
    assert.match(reported[0], /no such table: missing \(SQL: SELECT \* FROM missing\)/);
    await app.close();
});

test('the default database is storage/app.db and keeps its data', async (t) => {
    const root = makeProject(t, NOTES_PROJECT);

    const first = await createApp(root);
    await first.inject({ method: 'POST', path: '/api/notes', body: { title: 'kept' } });
    await first.close();
    assert.equal(fs.existsSync(path.join(root, 'storage', 'app.db')), true);

    const second = await createApp(root);
    assert.deepEqual((await second.inject({ path: '/api/notes' })).body, [{ id: 1, title: 'kept' }]);
    await second.close();
});

test('a project that never uses the database gets no storage folder', async (t) => {
    const root = makeProject(t, { 'api/route.js': 'export function GET() { return {}; }' });
    const app = await createApp(root);
    await app.inject({ path: '/api' });
    await app.close();
    assert.equal(fs.existsSync(path.join(root, 'storage')), false);
});

test('in check mode the app refuses to start while migrations are pending', async (t) => {
    const root = makeProject(t, { ...NOTES_PROJECT, 'migrations/002-add-done.sql': ADD_DONE });

    await assert.rejects(
        createApp(root, { migrations: 'check' }),
        adharError(undefined, /2 migrations have not run yet: 001-create-notes\.sql, 002-add-done\.sql/, /node adhar migrate/),
    );

    const db = createDb(databasePath(root));
    runMigrations(root, db);
    db.close();

    const app = await createApp(root, { migrations: 'check' });
    assert.equal((await app.inject({ path: '/api/notes' })).status, 200);
    await app.close();
});

test('check mode names a single pending migration', async (t) => {
    const root = makeProject(t, NOTES_PROJECT);
    await assert.rejects(createApp(root, { migrations: 'check' }), adharError(undefined, /^1 migration has not run yet: 001-create-notes\.sql\.$/));
});

test('a failing migration stops the app from starting', async (t) => {
    const root = makeProject(t, {
        'migrations/001-broken.sql': 'CREATE TABLE (;',
        'api/route.js': 'export function GET() { return {}; }',
    });
    await assert.rejects(
        createApp(root, { env: { DATABASE_PATH: ':memory:' } }),
        adharError('migrations/001-broken.sql', /This migration failed/),
    );
});

test('adhar migrate runs what is pending and says what it ran', (t) => {
    const root = makeProject(t, {
        'migrations/001-create-notes.sql': CREATE_NOTES,
        'migrations/002-add-done.sql': ADD_DONE,
    });

    const first = adharMigrate(root);
    assert.equal(first.code, 0, first.stderr);
    // Node 22 would print "SQLite is an experimental feature" here.
    assert.equal(first.stderr, '');
    assert.deepEqual(first.stdout.trimEnd().split('\n'), ['✔ migrations/001-create-notes.sql', '✔ migrations/002-add-done.sql']);
    assert.equal(fs.existsSync(path.join(root, 'storage', 'app.db')), true);

    const second = adharMigrate(root);
    assert.equal(second.code, 0);
    assert.match(second.stdout, /Nothing to migrate\./);
});

test('adhar migrate shows a failing migration and exits with 1', (t) => {
    const root = makeProject(t, { 'migrations/001-broken.sql': 'CREATE TABLE (;' });
    const result = adharMigrate(root);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /✖ Error: migrations\/001-broken\.sql/);
    assert.match(result.stderr, /This migration failed/);
});

test('adhar migrate follows DATABASE_PATH', (t) => {
    const root = makeProject(t, { 'migrations/001-create-notes.sql': CREATE_NOTES });
    const result = adharMigrate(root, { DATABASE_PATH: 'data/custom.db' });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, 'data', 'custom.db')), true);
    assert.equal(fs.existsSync(path.join(root, 'storage')), false);
});
