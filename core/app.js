'use strict';

const { HttpError } = require('./errors.js');
const { createPipeline } = require('./pipeline.js');
const { loadRoutes } = require('./router.js');

// Loads and checks the whole project up front, so mistakes show at startup, not on the first request.
async function createApp(root, options = {}) {
    const router = loadRoutes(root);

    function handler(ctx) {
        const found = router.match(ctx.path);
        if (!found) throw new HttpError(404, 'Not found');

        const { route, params } = found;
        if (ctx.method === 'OPTIONS') {
            ctx.status(204).header('allow', route.allow);
            return undefined;
        }

        const handle = route.handlers[ctx.method === 'HEAD' ? 'GET' : ctx.method];
        if (!handle) {
            throw new HttpError(405, `Method ${ctx.method} is not allowed for ${ctx.path}`, {
                headers: { allow: route.allow },
            });
        }

        ctx.params = params;
        return handle(ctx);
    }

    const pipeline = createPipeline({ ...options, handler });

    async function close() {}

    return { ...pipeline, routes: router.routes, close };
}

module.exports = { createApp };
