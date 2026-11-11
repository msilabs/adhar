'use strict';

const { HttpError } = require('./errors.js');
const { runChain } = require('./middleware.js');
const { createPipeline } = require('./pipeline.js');
const { loadRoutes } = require('./router.js');

// Loads and checks the whole project up front, so mistakes show at startup, not on the first request.
async function createApp(root, options = {}) {
    const router = loadRoutes(root);

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

        const handle = route.handlers[ctx.method === 'HEAD' ? 'GET' : ctx.method];
        if (!handle) {
            return runChain(router.rootChain, ctx, () => {
                throw new HttpError(405, `Method ${ctx.method} is not allowed for ${ctx.path}`, {
                    headers: { allow: route.allow },
                });
            });
        }

        ctx.params = params;
        return runChain(route.chain, ctx, handle);
    }

    const pipeline = createPipeline({ ...options, handler });

    async function close() {}

    return { ...pipeline, routes: router.routes, close };
}

module.exports = { createApp };
