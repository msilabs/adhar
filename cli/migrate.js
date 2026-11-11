'use strict';

const { createDb, databasePath } = require('../core/db.js');
const { runMigrations } = require('../core/migrations.js');
const log = require('./log.js');

function migrate(root, env) {
    const db = createDb(databasePath(root, env));
    try {
        const ran = runMigrations(root, db);
        if (ran.length === 0) {
            log.info('Nothing to migrate.');
            return;
        }
        for (const name of ran) log.success(`migrations/${name}`);
    } finally {
        db.close();
    }
}

module.exports = { migrate };
