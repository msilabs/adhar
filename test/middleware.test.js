'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app.js');
const { runChain } = require('../core/middleware.js');
const { makeProject } = require('./helpers/project.js');

function tracer(name) {
    return `
export default async function (ctx, next) {
    ctx.state.trace = [...(ctx.state.trace ?? []), '${name} in'];
    const result = await next();
    result.trace.push('${name} out');
    return result;
}
`;
}

const TRACE_ROUTE = `
export function GET(ctx) {
    return { trace: [...(ctx.state.trace ?? []), 'handler'] };
}
`;

function adharError(file, message, hint) {
    return (err) => {
        assert.equal(err.name, 'AdharError');
        assert.equal(err.file, file);
        assert.match(err.message, message);
        if (hint) assert.match(err.hint, hint);
        return true;
    };
}

test('runChain without middleware just calls the handler', () => {
    assert.equal(runChain([], { n: 1 }, (ctx) => ctx.n + 1), 2);
});

test('middleware runs from the outer folder inwards, then back out', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': tracer('root'),
        'api/(admin)/middleware.js': tracer('admin'),
        'api/(admin)/stats/middleware.js': tracer('stats'),
        'api/(admin)/stats/route.js': TRACE_ROUTE,
        'api/users/route.js': TRACE_ROUTE,
    });
    const app = await createApp(root);

    assert.deepEqual((await app.inject({ path: '/api/stats' })).body.trace, [
        'root in',
        'admin in',
        'stats in',
        'handler',
        'stats out',
        'admin out',
        'root out',
    ]);
    assert.deepEqual((await app.inject({ path: '/api/users' })).body.trace, ['root in', 'handler', 'root out']);
});

test('a sibling folder\'s middleware does not run', async (t) => {
    const root = makeProject(t, {
        'api/(admin)/middleware.js': tracer('admin'),
        'api/(admin)/stats/route.js': TRACE_ROUTE,
        'api/public/route.js': TRACE_ROUTE,
    });
    const app = await createApp(root);
    assert.deepEqual((await app.inject({ path: '/api/public' })).body.trace, ['handler']);
});

test('a middleware that throws stops the request before the handler', async (t) => {
    const root = makeProject(t, {
        'api/(admin)/middleware.js': `
export default function (ctx, next) {
    if (ctx.headers.authorization !== 'Bearer ' + ctx.env.ADMIN_TOKEN) throw ctx.error(401, 'Login required');
    ctx.state.admin = true;
    return next();
}
`,
        'api/(admin)/stats/route.js': 'export function GET(ctx) { return { admin: ctx.state.admin }; }',
    });
    const app = await createApp(root, { env: { ADMIN_TOKEN: 'secret' } });

    const refused = await app.inject({ path: '/api/stats' });
    assert.deepEqual(refused.body, { error: { status: 401, message: 'Login required' } });

    const allowed = await app.inject({ path: '/api/stats', headers: { Authorization: 'Bearer secret' } });
    assert.deepEqual(allowed.body, { admin: true });
});

test('a middleware that returns without calling next() answers the request itself', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': `
export default function (ctx, next) {
    if (ctx.query.cached) return { from: 'cache' };
    return next();
}
`,
        'api/route.js': 'export function GET() { return { from: "handler" }; }',
    });
    const app = await createApp(root);
    assert.deepEqual((await app.inject({ path: '/api?cached=1' })).body, { from: 'cache' });
    assert.deepEqual((await app.inject({ path: '/api' })).body, { from: 'handler' });
});

test('work after next() can change the response', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': `
export default async function (ctx, next) {
    const result = await next();
    ctx.header('X-Wrapped', 'yes');
    return { data: result };
}
`,
        'api/route.js': 'export function GET() { return [1, 2]; }',
    });
    const res = await (await createApp(root)).inject({ path: '/api' });
    assert.equal(res.headers['x-wrapped'], 'yes');
    assert.deepEqual(res.body, { data: [1, 2] });
});

test('`await next()` without a return still sends the handler\'s answer', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': `
export default async function (ctx, next) {
    await next();
    ctx.header('X-After', 'yes');
}
`,
        'api/users/middleware.js': 'export default function (ctx, next) { next(); }',
        'api/users/route.js': 'export async function GET() { return { ok: true }; }',
    });
    const res = await (await createApp(root)).inject({ path: '/api/users' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-after'], 'yes');
    assert.deepEqual(res.body, { ok: true });
});

test('calling next() twice is a 500 that names the file', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': 'export default async function (ctx, next) { await next(); return next(); }',
        'api/route.js': 'export function GET() { return {}; }',
    });
    const app = await createApp(root, { dev: true });
    const res = await app.inject({ path: '/api' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error.message, 'next() was called twice in api/middleware.js.');
});

test('a handler error passes through the middleware and can be caught there', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': `
export default async function (ctx, next) {
    try {
        return await next();
    } catch (err) {
        if (err.status !== 404) throw err;
        ctx.status(404);
        return { missing: ctx.path };
    }
}
`,
        'api/users/[id]/route.js': 'export function GET(ctx) { throw ctx.error(ctx.params.id === "0" ? 404 : 403); }',
    });
    const app = await createApp(root);
    assert.deepEqual((await app.inject({ path: '/api/users/0' })).body, { missing: '/api/users/0' });
    assert.equal((await app.inject({ path: '/api/users/1' })).status, 403);
});

test('404, 405 and OPTIONS run only the root middleware', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': 'export default function (ctx, next) { ctx.header("X-Root", "yes"); return next(); }',
        'api/users/middleware.js': 'export default function (ctx, next) { ctx.header("X-Users", "yes"); return next(); }',
        'api/users/route.js': 'export function GET() { return []; }',
    });
    const app = await createApp(root);

    const ok = await app.inject({ path: '/api/users' });
    assert.equal(ok.headers['x-root'], 'yes');
    assert.equal(ok.headers['x-users'], 'yes');

    const missing = await app.inject({ path: '/api/nope' });
    assert.equal(missing.status, 404);
    assert.equal(missing.headers['x-root'], 'yes');

    const notAllowed = await app.inject({ method: 'POST', path: '/api/users' });
    assert.equal(notAllowed.status, 405);
    assert.equal(notAllowed.headers.allow, 'GET, HEAD, OPTIONS');
    assert.equal(notAllowed.headers['x-root'], 'yes');
    assert.equal(notAllowed.headers['x-users'], undefined);

    const options = await app.inject({ method: 'OPTIONS', path: '/api/users' });
    assert.equal(options.status, 204);
    assert.equal(options.headers['x-root'], 'yes');
    assert.equal(options.headers['x-users'], undefined);
});

test('not-found.js replaces the built-in 404', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': 'export default function (ctx, next) { ctx.header("X-Root", "yes"); return next(); }',
        'api/not-found.js': 'export default function (ctx) { return { error: { status: 404, message: `No route for ${ctx.path}` } }; }',
        'api/route.js': 'export function GET() { return {}; }',
    });
    const app = await createApp(root);

    const res = await app.inject({ path: '/api/nope' });
    assert.equal(res.status, 404);
    assert.equal(res.headers['x-root'], 'yes');
    assert.deepEqual(res.body, { error: { status: 404, message: 'No route for /api/nope' } });
    assert.equal((await app.inject({ path: '/api' })).status, 200);
});

test('not-found.js may pick another status', async (t) => {
    const root = makeProject(t, {
        'api/not-found.js': 'export default function (ctx) { ctx.status(410); return { gone: true }; }',
    });
    const res = await (await createApp(root)).inject({ path: '/api/old' });
    assert.equal(res.status, 410);
    assert.deepEqual(res.body, { gone: true });
});

test('a middleware file must export one default function', async (t) => {
    const cases = [
        ['export function middleware(ctx, next) { return next(); }', /Unknown export `middleware`/, /single export/],
        ['export default { run() {} };', /must export one default function/, /export default function \(ctx, next\)/],
        ['', /must export one default function/],
        ['export default (ctx, next) => next();\nexport const extra = 1;', /Unknown export `extra`/],
    ];
    for (const [source, message, hint] of cases) {
        const root = makeProject(t, {
            'api/users/middleware.js': source,
            'api/users/route.js': 'export function GET() { return {}; }',
        });
        await assert.rejects(createApp(root), adharError('api/users/middleware.js', message, hint));
    }
});

test('not-found.js must export one default function', async (t) => {
    const root = makeProject(t, { 'api/not-found.js': 'export function GET() {}' });
    await assert.rejects(createApp(root), adharError('api/not-found.js', /Unknown export `GET`/, /export default function \(ctx\)/));
});

test('a middleware file is checked even when no route uses it', async (t) => {
    const root = makeProject(t, { 'api/empty/middleware.js': 'export default 5;' });
    await assert.rejects(createApp(root), adharError('api/empty/middleware.js', /must export one default function/));
});

test('a URL outside /api still runs api/middleware.js and api/not-found.js', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': 'export default function (ctx, next) { ctx.header("X-Root", "yes"); return next(); }',
        'api/notes/middleware.js': 'export default function (ctx, next) { ctx.header("X-Notes", "yes"); return next(); }',
        'api/notes/route.js': 'export function GET() { return []; }',
    });
    const app = await createApp(root);
    for (const path of ['/', '/notes']) {
        const res = await app.inject({ path });
        assert.equal(res.status, 404, path);
        assert.equal(res.headers['x-root'], 'yes');
        assert.equal(res.headers['x-notes'], undefined);
        assert.deepEqual(res.body, { error: { status: 404, message: 'Not found' } });
    }

    const custom = makeProject(t, {
        'api/not-found.js': 'export default function (ctx) { return { missing: ctx.path }; }',
        'api/notes/route.js': 'export function GET() { return []; }',
    });
    const res = await (await createApp(custom)).inject({ path: '/notes' });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { missing: '/notes' });
});
