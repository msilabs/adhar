'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MEMORY = ':memory:';

// Turns JS values into something SQLite can store, and refuses the ones that have no obvious form.
function toSqlValue(value, index) {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value;
    if (value instanceof Uint8Array) return value;

    const position = `Value ${index + 1} of the SQL parameters`;
    if (value instanceof Date) {
        throw new TypeError(`${position} is a Date. Pass text instead, for example \`date.toISOString()\`.`);
    }
    throw new TypeError(
        `${position} is ${Array.isArray(value) ? 'an array' : typeof value === 'object' ? 'an object' : `a ${typeof value}`}. ` +
            'SQLite stores text and numbers; pass `JSON.stringify(value)` to keep it as text.',
    );
}

// On Node 22, loading node:sqlite prints "SQLite is an experimental feature" on every start.
// Adhar chose it on purpose, so that one warning is kept out of the user's terminal.
function loadSqlite() {
    const emitWarning = process.emitWarning;
    process.emitWarning = function (warning, ...rest) {
        if (String(warning?.message ?? warning).includes('SQLite is an experimental feature')) return;
        emitWarning.call(process, warning, ...rest);
    };
    try {
        return require('node:sqlite');
    } finally {
        process.emitWarning = emitWarning;
    }
}

function shorten(sql) {
    const oneLine = String(sql).replace(/\s+/g, ' ').trim();
    return oneLine.length > 120 ? oneLine.slice(0, 117) + '...' : oneLine;
}

// A thin layer over node:sqlite. The file is opened on first use,
// so a project that never touches the database gets no storage/ folder.
function createDb(filename) {
    let database = null;
    let depth = 0;

    function open() {
        if (database) return database;

        const { DatabaseSync } = loadSqlite();
        if (filename !== MEMORY) fs.mkdirSync(path.dirname(filename), { recursive: true });

        database = new DatabaseSync(filename);
        if (filename !== MEMORY) database.exec('PRAGMA journal_mode = WAL');
        database.exec('PRAGMA foreign_keys = ON');
        return database;
    }

    // SQLite's own message stays; the statement is added so the mistake is easy to find.
    function attempt(sql, action) {
        try {
            return action();
        } catch (err) {
            if (err instanceof TypeError && !err.code) throw err;
            throw new Error(`${err.message} (SQL: ${shorten(sql)})`, { cause: err });
        }
    }

    function statement(sql, params, action) {
        return attempt(sql, () => {
            const values = params.map(toSqlValue);
            return action(open().prepare(sql), values);
        });
    }

    const db = {
        all(sql, ...params) {
            return statement(sql, params, (prepared, values) => prepared.all(...values).map((row) => ({ ...row })));
        },

        get(sql, ...params) {
            return statement(sql, params, (prepared, values) => {
                const row = prepared.get(...values);
                return row === undefined ? undefined : { ...row };
            });
        },

        run(sql, ...params) {
            return statement(sql, params, (prepared, values) => {
                const { changes, lastInsertRowid } = prepared.run(...values);
                return { changes: Number(changes), lastId: Number(lastInsertRowid) };
            });
        },

        // Several statements at once, without parameters. Migrations use it.
        exec(sql) {
            attempt(sql, () => open().exec(sql));
        },

        transaction(fn) {
            const name = `adhar_${depth}`;
            // An inner transaction is a savepoint, so it can fail without undoing the outer one.
            const [begin, commit, rollback] =
                depth === 0
                    ? ['BEGIN', 'COMMIT', 'ROLLBACK']
                    : [`SAVEPOINT ${name}`, `RELEASE ${name}`, `ROLLBACK TO ${name}; RELEASE ${name}`];

            open().exec(begin);
            depth++;
            try {
                const result = fn();
                if (result && typeof result.then === 'function') {
                    throw new TypeError(
                        'db.transaction() needs a function that is not `async`: the database works without waiting.',
                    );
                }
                depth--;
                database.exec(commit);
                return result;
            } catch (err) {
                depth--;
                database.exec(rollback);
                throw err;
            }
        },

        close() {
            if (!database) return;
            database.close();
            database = null;
        },
    };
    return db;
}

// DATABASE_PATH may be `:memory:`, an absolute path, or a path relative to the project.
function databasePath(root, env = {}) {
    const configured = env.DATABASE_PATH;
    if (!configured) return path.join(root, 'storage', 'app.db');
    if (configured === MEMORY) return MEMORY;
    return path.resolve(root, configured);
}

module.exports = { createDb, databasePath };
