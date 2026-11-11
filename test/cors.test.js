'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app.js');
const { createCors } = require('../core/cors.js');
const { makeProject } = require('./helpers/project.js');

const PROJECT = {
    'routes/middleware.js': 'export default function (ctx, next) { if (!ctx.headers.authorization) throw ctx.error(401); return next(); }',
    'routes/notes/route.js': 'export function GET() { return []; }\nexport function POST(ctx) { return ctx.body; }',
};

function appWith(t, env) {
    return createApp(makeProject(t, PROJECT), { env });
}

test('CORS is off without CORS_ORIGIN', () => {
    assert.equal(createCors(undefined), null);
    assert.equal(createCors(''), null);
    assert.equal(createCors(' , '), null);
});

test('a listed origin is echoed back with Vary', () => {
    const cors = createCors('https://app.example.com, http://localhost:5173/');
    assert.equal(cors.any, false);
    assert.deepEqual(cors.headersFor({ origin: 'https://app.example.com' }), {
        vary: 'Origin',
        'access-control-allow-origin': 'https://app.example.com',
    });
    assert.deepEqual(cors.headersFor({ origin: 'http://localhost:5173' }), {
        vary: 'Origin',
        'access-control-allow-origin': 'http://localhost:5173',
    });
});

test('an origin that is not listed gets no allow header', () => {
    const cors = createCors('https://app.example.com');
    assert.deepEqual(cors.headersFor({ origin: 'https://evil.example' }), { vary: 'Origin' });
    assert.deepEqual(cors.headersFor({}), { vary: 'Origin' });
});

test('* allows any origin', () => {
    const cors = createCors('*');
    assert.equal(cors.any, true);
    assert.deepEqual(cors.headersFor({ origin: 'https://anything.example' }), { 'access-control-allow-origin': '*' });
});

test('a value that is not an origin is an error', () => {
    for (const value of ['example.com', 'https://example.com/app', 'localhost:3000', 'https://a.com, b.com']) {
        assert.throws(() => createCors(value), (err) => {
            assert.equal(err.name, 'AdharError');
            assert.match(err.message, /Invalid CORS_ORIGIN value/);
            assert.match(err.hint, /https:\/\/example\.com/);
            return true;
        }, value);
    }
});

test('without CORS_ORIGIN no response has CORS headers', async (t) => {
    const app = await appWith(t, {});
    const res = await app.inject({ path: '/notes', headers: { origin: 'https://app.example.com', authorization: 'x' } });
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.equal(res.headers.vary, undefined);
});

test('with CORS_ORIGIN every response to a listed origin is allowed, errors too', async (t) => {
    const app = await appWith(t, { CORS_ORIGIN: 'https://app.example.com' });
    const headers = { origin: 'https://app.example.com', authorization: 'x' };

    const requests = [
        { path: '/notes', headers },
        { path: '/nope', headers },
        { path: '/notes', headers: { origin: headers.origin } },
        { method: 'DELETE', path: '/notes', headers },
        { method: 'POST', path: '/notes', headers: { ...headers, 'content-type': 'application/json' }, body: '{"a":' },
    ];
    const statuses = [];
    for (const request of requests) {
        const res = await app.inject(request);
        statuses.push(res.status);
        assert.equal(res.headers['access-control-allow-origin'], 'https://app.example.com');
        assert.equal(res.headers.vary, 'Origin');
    }
    assert.deepEqual(statuses, [200, 404, 401, 405, 400]);
});

test('another origin still gets its answer, but no allow header', async (t) => {
    const app = await appWith(t, { CORS_ORIGIN: 'https://app.example.com' });
    const res = await app.inject({ path: '/notes', headers: { origin: 'https://evil.example', authorization: 'x' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.equal(res.headers.vary, 'Origin');
});

test('a preflight is answered without running middleware', async (t) => {
    const app = await appWith(t, { CORS_ORIGIN: 'https://app.example.com' });
    const res = await app.inject({
        method: 'OPTIONS',
        path: '/notes',
        headers: {
            origin: 'https://app.example.com',
            'access-control-request-method': 'POST',
            'access-control-request-headers': 'content-type, authorization',
        },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], 'https://app.example.com');
    assert.equal(res.headers['access-control-allow-methods'], 'GET, POST');
    assert.equal(res.headers['access-control-allow-headers'], 'content-type, authorization');
    assert.equal(res.headers['access-control-max-age'], '600');
});

test('a preflight for an unknown path is a 404', async (t) => {
    const app = await appWith(t, { CORS_ORIGIN: '*' });
    const res = await app.inject({
        method: 'OPTIONS',
        path: '/nope',
        headers: { origin: 'https://a.example', 'access-control-request-method': 'GET', authorization: 'x' },
    });
    assert.equal(res.status, 404);
    assert.equal(res.headers['access-control-allow-origin'], '*');
});

test('a plain OPTIONS request is not a preflight', async (t) => {
    const app = await appWith(t, { CORS_ORIGIN: '*' });
    const res = await app.inject({ method: 'OPTIONS', path: '/notes', headers: { authorization: 'x' } });
    assert.equal(res.status, 204);
    assert.equal(res.headers.allow, 'GET, POST, HEAD, OPTIONS');
    assert.equal(res.headers['access-control-allow-methods'], undefined);
});

test('an invalid CORS_ORIGIN stops the app from starting', async (t) => {
    await assert.rejects(appWith(t, { CORS_ORIGIN: 'example.com' }), /Invalid CORS_ORIGIN value `example\.com`/);
});

test('the app warns about * in production and about a project without routes', async (t) => {
    const open = await appWith(t, { CORS_ORIGIN: '*', NODE_ENV: 'production' });
    assert.equal(open.warnings.length, 1);
    assert.match(open.warnings[0].message, /lets any website call this API/);

    assert.deepEqual((await appWith(t, { CORS_ORIGIN: '*', NODE_ENV: 'development' })).warnings, []);
    assert.deepEqual((await appWith(t, { CORS_ORIGIN: 'https://a.example', NODE_ENV: 'production' })).warnings, []);

    const empty = await createApp(makeProject(t, { 'routes/README.md': '' }));
    assert.match(empty.warnings[0].message, /no routes yet/);
});
