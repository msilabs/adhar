'use strict';

const { createDb, databasePath } = require('./db.js');
const { AdharError, HttpError } = require('./errors.js');
const { runChain } = require('./middleware.js');
const { pendingMigrations, runMigrations } = require('./migrations.js');
const { createPipeline } = require('./pipeline.js');
const { loadRoutes } = require('./router.js');
const { loadServices } = require('./services.js');
const { applySchema } = require('./validate.js');

// `mode` is 'run' (apply what is pending), 'check' (refuse to start while something is pending) or 'skip'.
function prepareDatabase(root, db, mode) {
    if (mode === 'skip') return;
    if (mode === 'run') {
        runMigrations(root, db);
        return;
    }

    const pending = pendingMigrations(root, db);
    if (pending.length > 0) {
        throw new AdharError({
            message:
                pending.length === 1
                    ? `1 migration has not run yet: ${pending[0]}.`
                    : `${pending.length} migrations have not run yet: ${pending.join(', ')}.`,
            hint: 'Run `node adhar migrate` first.',
        });
    }
}

// Loads and checks the whole project up front, so mistakes show at startup, not on the first request.
async function createApp(root, options = {}) {
    const env = Object.freeze({ ...options.env });
    const router = loadRoutes(root);
    const db = createDb(databasePath(root, env));
    const services = loadServices(root, { db, env });

    try {
        prepareDatabase(root, db, options.migrations ?? 'run');
    } catch (err) {
        db.close();
        throw err;
    }

    function answerNotFound(ctx) {
        if (!router.notFound) throw new HttpError(404, 'Not found');
        ctx.status(404);
        return router.notFound(ctx);
    }

    // Requests without a matching handler (404, 405, OPTIONS) still pass through routes/middleware.js.
    function handler(ctx) {
        const found = router.match(ctx.path);
        if (!found) return runChain(router.rootChain, ctx, answerNotFound);

        const { route, params } = found;
        if (ctx.method === 'OPTIONS') {
            return runChain(router.rootChain, ctx, () => {
                ctx.status(204).header('allow', route.allow);
            });
        }

        const method = ctx.method === 'HEAD' ? 'GET' : ctx.method;
        const handle = route.handlers[method];
        if (!handle) {
            return runChain(router.rootChain, ctx, () => {
                throw new HttpError(405, `Method ${ctx.method} is not allowed for ${ctx.path}`, {
                    headers: { allow: route.allow },
                });
            });
        }

        ctx.params = params;
        return runChain(route.chain, ctx, () => {
            applySchema(route.checks[method], ctx);
            return handle(ctx);
        });
    }

    const pipeline = createPipeline({ ...options, env, services, db, handler });

    async function close() {
        db.close();
    }

    return { ...pipeline, routes: router.routes, close };
}

module.exports = { createApp };
