'use strict';

const { loadRoutes } = require('../core/router.js');
const log = require('./log.js');

function listRoutes(root) {
    const { routes } = loadRoutes(root);

    if (routes.length === 0) {
        log.info('No routes yet. Add one at api/route.js.');
        return;
    }

    const sorted = [...routes].sort((a, b) => (a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0));
    const width = Math.max(...sorted.map((route) => route.pattern.length));

    for (const route of sorted) {
        for (const method of route.methods) {
            log.info(`${method.padEnd(7)} ${route.pattern.padEnd(width)}  ${route.file}`);
        }
    }
}

module.exports = { listRoutes };
