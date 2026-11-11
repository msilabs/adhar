'use strict';

const { AdharError } = require('./errors.js');

const ORIGIN = /^https?:\/\/[^/\s]+$/;

// CORS is off until CORS_ORIGIN is set to `*` or to a comma-separated list of origins.
// Returns null when it is off.
function createCors(setting) {
    const entries = String(setting ?? '')
        .split(',')
        .map((entry) => entry.trim().replace(/\/+$/, ''))
        .filter((entry) => entry !== '');

    if (entries.length === 0) return null;

    const any = entries.includes('*');
    for (const entry of entries) {
        if (entry === '*' || ORIGIN.test(entry)) continue;
        throw new AdharError({
            message: `Invalid CORS_ORIGIN value \`${entry}\`.`,
            hint: 'Write the full origin, like `https://example.com`, or `*` for any website.',
        });
    }
    const allowed = new Set(entries);

    return {
        any,

        // Headers that go on every response, including errors.
        headersFor(requestHeaders) {
            if (any) return { 'access-control-allow-origin': '*' };

            const origin = requestHeaders.origin;
            const headers = { vary: 'Origin' };
            if (origin && allowed.has(origin)) headers['access-control-allow-origin'] = origin;
            return headers;
        },

        isPreflight(ctx) {
            return ctx.method === 'OPTIONS' && ctx.headers['access-control-request-method'] !== undefined;
        },

        // Tells the browser which methods and headers the real request may use.
        answerPreflight(ctx, route) {
            ctx.status(204);
            ctx.header('access-control-allow-methods', route.methods.join(', '));
            ctx.header('access-control-max-age', '600');

            const asked = ctx.headers['access-control-request-headers'];
            if (asked) ctx.header('access-control-allow-headers', asked);
        },
    };
}

module.exports = { createCors };
