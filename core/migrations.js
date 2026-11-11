'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdharError } = require('./errors.js');

const MIGRATION_NAME = /^(\d{3})-[a-z0-9-]+\.sql$/;

// Lists migrations/NNN-name.sql in order. A project without the folder simply has none.
function listMigrations(root) {
    const dir = path.join(root, 'migrations');
    if (!fs.existsSync(dir)) return [];

    const names = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => entry.name)
        .sort();

    const byNumber = new Map();
    for (const name of names) {
        const file = `migrations/${name}`;
        const found = name.match(MIGRATION_NAME);
        if (!found) {
            throw new AdharError({
                file,
                message: `Invalid migration name \`${name}\`.`,
                hint: 'Name it with three digits, a dash and a lower-case name, like `001-create-users.sql`.',
            });
        }
        if (byNumber.has(found[1])) {
            throw new AdharError({
                file,
                message: `Two migrations have the number ${found[1]}: this one and migrations/${byNumber.get(found[1])}.`,
                hint: 'Give the newer one the next free number.',
            });
        }
        byNumber.set(found[1], name);
    }
    return names;
}

function pendingMigrations(root, db) {
    const names = listMigrations(root);
    if (names.length === 0) return [];

    db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, ran_at TEXT NOT NULL)');
    const done = new Set(db.all('SELECT name FROM _migrations').map((row) => row.name));
    return names.filter((name) => !done.has(name));
}

// Runs what has not run yet, each file in its own transaction. Returns the names it ran.
function runMigrations(root, db) {
    const pending = pendingMigrations(root, db);

    for (const name of pending) {
        const file = `migrations/${name}`;
        const sql = fs.readFileSync(path.join(root, 'migrations', name), 'utf8');
        try {
            db.transaction(() => {
                db.exec(sql);
                db.run('INSERT INTO _migrations (name, ran_at) VALUES (?, ?)', name, new Date().toISOString());
            });
        } catch (err) {
            throw new AdharError({
                file,
                message: `This migration failed: ${err.cause?.message ?? err.message}`,
                hint: 'Nothing from this file was saved. Fix the SQL and run it again.',
            });
        }
    }
    return pending;
}

module.exports = { listMigrations, pendingMigrations, runMigrations };
