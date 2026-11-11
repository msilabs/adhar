'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDb, databasePath } = require('../core/db.js');
const { makeProject } = require('./helpers/project.js');

function memoryDb(t) {
    const db = createDb(':memory:');
    t.after(() => db.close());
    db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER, extra TEXT)');
    return db;
}

test('run reports the changes and the new id', (t) => {
    const db = memoryDb(t);
    assert.deepEqual(db.run('INSERT INTO notes (title) VALUES (?)', 'first'), { changes: 1, lastId: 1 });
    assert.deepEqual(db.run('INSERT INTO notes (title) VALUES (?)', 'second'), { changes: 1, lastId: 2 });
    assert.equal(db.run('UPDATE notes SET done = ?', 1).changes, 2);
    assert.equal(db.run('DELETE FROM notes WHERE id = ?', 99).changes, 0);
});

test('all returns plain rows and get returns the first row or undefined', (t) => {
    const db = memoryDb(t);
    db.run('INSERT INTO notes (title) VALUES (?), (?)', 'a', 'b');

    assert.deepEqual(db.all('SELECT id, title FROM notes ORDER BY id'), [
        { id: 1, title: 'a' },
        { id: 2, title: 'b' },
    ]);
    assert.deepEqual(db.all('SELECT * FROM notes WHERE id > ?', 10), []);
    assert.deepEqual(db.get('SELECT id, title FROM notes WHERE id = ?', 2), { id: 2, title: 'b' });
    assert.equal(db.get('SELECT * FROM notes WHERE id = ?', 10), undefined);
    assert.equal(Object.getPrototypeOf(db.get('SELECT * FROM notes')), Object.prototype);
});

test('get works with RETURNING', (t) => {
    const db = memoryDb(t);
    assert.deepEqual(db.get('INSERT INTO notes (title) VALUES (?) RETURNING id, title', 'আধার'), { id: 1, title: 'আধার' });
});

test('booleans become 1 and 0, and undefined becomes NULL', (t) => {
    const db = memoryDb(t);
    db.run('INSERT INTO notes (title, done, extra) VALUES (?, ?, ?)', 'a', true, undefined);
    db.run('INSERT INTO notes (title, done, extra) VALUES (?, ?, ?)', 'b', false, null);
    assert.deepEqual(db.all('SELECT done, extra FROM notes ORDER BY id'), [
        { done: 1, extra: null },
        { done: 0, extra: null },
    ]);
});

test('objects, arrays and dates are refused with advice', (t) => {
    const db = memoryDb(t);
    const insert = (value) => db.run('INSERT INTO notes (title, extra) VALUES (?, ?)', 'a', value);

    assert.throws(() => insert({ a: 1 }), /Value 2 of the SQL parameters is an object\..*JSON\.stringify/);
    assert.throws(() => insert([1, 2]), /Value 2 of the SQL parameters is an array/);
    assert.throws(() => insert(new Date()), /is a Date\..*toISOString/);
    assert.equal(db.get('SELECT COUNT(*) AS n FROM notes').n, 0);
});

test('an SQL mistake keeps SQLite\'s message and shows the statement', (t) => {
    const db = memoryDb(t);
    assert.throws(() => db.all('SELEC * FROM notes'), /near "SELEC": syntax error \(SQL: SELEC \* FROM notes\)/);
    assert.throws(() => db.run('INSERT INTO notes (title) VALUES (?)', null), /NOT NULL constraint failed: notes\.title/);
    assert.throws(() => db.get('SELECT * FROM missing'), /no such table: missing/);
});

test('a long statement is shortened in the error', (t) => {
    const db = memoryDb(t);
    const sql = `SELECT ${'title, '.repeat(40)} nope FROM notes`;
    assert.throws(() => db.all(sql), (err) => err.message.endsWith('...)') && err.message.length < 220);
});

test('a transaction commits when the function returns', (t) => {
    const db = memoryDb(t);
    const result = db.transaction(() => {
        db.run('INSERT INTO notes (title) VALUES (?)', 'a');
        db.run('INSERT INTO notes (title) VALUES (?)', 'b');
        return 'done';
    });
    assert.equal(result, 'done');
    assert.equal(db.get('SELECT COUNT(*) AS n FROM notes').n, 2);
});

test('a transaction rolls back when the function throws', (t) => {
    const db = memoryDb(t);
    assert.throws(() => {
        db.transaction(() => {
            db.run('INSERT INTO notes (title) VALUES (?)', 'a');
            throw new Error('stop');
        });
    }, /stop/);
    assert.equal(db.get('SELECT COUNT(*) AS n FROM notes').n, 0);
    db.run('INSERT INTO notes (title) VALUES (?)', 'after');
});

test('an async function is refused and rolled back', (t) => {
    const db = memoryDb(t);
    assert.throws(() => {
        db.transaction(async () => {
            db.run('INSERT INTO notes (title) VALUES (?)', 'a');
        });
    }, /needs a function that is not `async`/);
    assert.equal(db.get('SELECT COUNT(*) AS n FROM notes').n, 0);
});

test('an inner transaction can fail without undoing the outer one', (t) => {
    const db = memoryDb(t);
    db.transaction(() => {
        db.run('INSERT INTO notes (title) VALUES (?)', 'outer');
        assert.throws(() => {
            db.transaction(() => {
                db.run('INSERT INTO notes (title) VALUES (?)', 'inner');
                throw new Error('inner failed');
            });
        }, /inner failed/);
        db.transaction(() => {
            db.run('INSERT INTO notes (title) VALUES (?)', 'second inner');
        });
    });
    assert.deepEqual(db.all('SELECT title FROM notes ORDER BY id').map((row) => row.title), ['outer', 'second inner']);
});

test('foreign keys are enforced', (t) => {
    const db = memoryDb(t);
    db.exec('CREATE TABLE tags (id INTEGER PRIMARY KEY, note_id INTEGER NOT NULL REFERENCES notes(id))');
    assert.throws(() => db.run('INSERT INTO tags (note_id) VALUES (?)', 5), /FOREIGN KEY constraint failed/);
});

test('the file and its folder are created on first use, not before', (t) => {
    const root = makeProject(t, {});
    const file = databasePath(root);
    const db = createDb(file);

    assert.equal(file, path.join(root, 'storage', 'app.db'));
    assert.equal(fs.existsSync(path.join(root, 'storage')), false);

    db.exec('CREATE TABLE a (id INTEGER)');
    assert.equal(fs.existsSync(file), true);
    assert.equal(db.get('PRAGMA journal_mode').journal_mode, 'wal');
    db.close();
});

test('data stays in the file after closing', (t) => {
    const root = makeProject(t, {});
    const first = createDb(databasePath(root));
    first.exec('CREATE TABLE a (n INTEGER)');
    first.run('INSERT INTO a (n) VALUES (?)', 7);
    first.close();

    const second = createDb(databasePath(root));
    assert.deepEqual(second.all('SELECT n FROM a'), [{ n: 7 }]);
    second.close();
});

test('close is safe to call twice or before any use', () => {
    const db = createDb(':memory:');
    db.close();
    db.exec('CREATE TABLE a (id INTEGER)');
    db.close();
    db.close();
});

test('DATABASE_PATH picks the file', () => {
    const root = path.resolve('/projects/api');
    assert.equal(databasePath(root, {}), path.join(root, 'storage', 'app.db'));
    assert.equal(databasePath(root, { DATABASE_PATH: ':memory:' }), ':memory:');
    assert.equal(databasePath(root, { DATABASE_PATH: 'data/dev.db' }), path.join(root, 'data', 'dev.db'));
    assert.equal(databasePath(root, { DATABASE_PATH: path.resolve('/var/db/app.db') }), path.resolve('/var/db/app.db'));
});
