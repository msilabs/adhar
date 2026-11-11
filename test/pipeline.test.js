'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createPipeline } = require('../core/pipeline.js');
const { BODY_LIMIT } = require('../core/body.js');

function appWith(handler, options = {}) {
    return createPipeline({ handler, ...options });
}

test('a returned object is sent as JSON', async () => {
    const app = appWith(() => ({ hello: 'world' }));
    const res = await app.inject({ path: '/' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.deepEqual(res.body, { hello: 'world' });
});

test('an async handler works the same way', async () => {
    const app = appWith(async () => {
        await new Promise((resolve) => setImmediate(resolve));
        return [1, 2, 3];
    });
    assert.deepEqual((await app.inject()).body, [1, 2, 3]);
});

test('returning nothing gives 204', async () => {
    const res = await appWith(() => {}).inject({ method: 'DELETE', path: '/users/1' });
    assert.equal(res.status, 204);
    assert.equal(res.body, undefined);
});

test('a returned string is plain text', async () => {
    const res = await appWith(() => 'pong').inject({ path: '/ping' });
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(res.body, 'pong');
});

test('ctx has the method, path, query and headers', async () => {
    const app = appWith((ctx) => ({ method: ctx.method, path: ctx.path, query: ctx.query, agent: ctx.headers['user-agent'] }));
    const res = await app.inject({
        method: 'get',
        path: '/users/?page=2&tag=a&tag=b',
        headers: { 'User-Agent': 'test' },
    });
    assert.deepEqual(res.body, {
        method: 'GET',
        path: '/users',
        query: { page: '2', tag: ['a', 'b'] },
        agent: 'test',
    });
});

test('the root path stays "/"', async () => {
    const app = appWith((ctx) => ctx.path);
    assert.equal((await app.inject({ path: '/' })).body, '/');
    assert.equal((await app.inject({ path: '/?a=1' })).body, '/');
});

test('ctx.body is the parsed JSON body', async () => {
    const app = appWith((ctx) => ({ got: ctx.body }));
    const res = await app.inject({ method: 'POST', path: '/users', body: { name: 'আধার' } });
    assert.deepEqual(res.body, { got: { name: 'আধার' } });
});

test('ctx.body is undefined without a body', async () => {
    const app = appWith((ctx) => ({ missing: ctx.body === undefined }));
    assert.deepEqual((await app.inject()).body, { missing: true });
});

test('a urlencoded body is parsed', async () => {
    const app = appWith((ctx) => ctx.body);
    const res = await app.inject({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'name=A&age=3',
    });
    assert.deepEqual(res.body, { name: 'A', age: '3' });
});

test('broken JSON gives 400 and the handler does not run', async () => {
    let ran = false;
    const app = appWith(() => {
        ran = true;
    });
    const res = await app.inject({ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: { status: 400, message: 'Invalid JSON body' } });
    assert.equal(ran, false);
});

test('an unsupported content type gives 415', async () => {
    const res = await appWith(() => 'ok').inject({ method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'hi' });
    assert.equal(res.status, 415);
});

test('a body over 1 MB gives 413', async () => {
    const res = await appWith(() => 'ok').inject({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: Buffer.alloc(BODY_LIMIT + 1, 0x20),
    });
    assert.equal(res.status, 413);
});

test('ctx.status() and ctx.header() change the response and can be chained', async () => {
    const app = appWith((ctx) => {
        ctx.status(201).header('X-Total', 42);
        return { id: 1 };
    });
    const res = await app.inject({ method: 'POST' });
    assert.equal(res.status, 201);
    assert.equal(res.headers['x-total'], '42');
    assert.deepEqual(res.body, { id: 1 });
});

test('throwing ctx.error() gives the error shape', async () => {
    const app = appWith((ctx) => {
        throw ctx.error(404, 'User not found');
    });
    const res = await app.inject({ path: '/users/9' });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: { status: 404, message: 'User not found' } });
});

test('ctx.error() without a message uses the standard status text', async () => {
    const app = appWith((ctx) => {
        throw ctx.error(403);
    });
    assert.deepEqual((await app.inject()).body, { error: { status: 403, message: 'Forbidden' } });
});

test('a rejected async handler is handled like a throw', async () => {
    const app = appWith(async (ctx) => {
        throw ctx.error(409, 'Email already used');
    });
    assert.equal((await app.inject()).status, 409);
});

test('the ctx methods work when destructured', async () => {
    const app = appWith(({ query, status, header, error }) => {
        if (query.fail) throw error(400, 'Asked to fail');
        status(202);
        header('x-mode', 'destructured');
        return { ok: true };
    });

    const ok = await app.inject({ path: '/' });
    assert.equal(ok.status, 202);
    assert.equal(ok.headers['x-mode'], 'destructured');

    const failed = await app.inject({ path: '/?fail=1' });
    assert.deepEqual(failed.body, { error: { status: 400, message: 'Asked to fail' } });
});

test('a wrong status is a clear 500 in dev', async () => {
    const statusApp = appWith((ctx) => ctx.status('201'), { dev: true });
    assert.match((await statusApp.inject()).body.error.message, /ctx\.status\(\) needs a number from 100 to 599, got "201"/);

    const errorApp = appWith((ctx) => {
        throw ctx.error(200, 'fine');
    }, { dev: true });
    assert.match((await errorApp.inject()).body.error.message, /ctx\.error\(\) needs a status from 400 to 599, got 200/);
});

test('an unexpected error is a hidden 500 in production and is reported once', async () => {
    const reported = [];
    const app = appWith(() => {
        throw new Error('secret detail');
    }, { onError: (err, request) => reported.push([err.message, request.method, request.url]) });

    const res = await app.inject({ method: 'POST', path: '/users' });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: { status: 500, message: 'Internal server error' } });
    assert.deepEqual(reported, [['secret detail', 'POST', '/users']]);
});

test('an unexpected error shows the message and stack in dev', async () => {
    const app = appWith(() => {
        throw new Error('boom');
    }, { dev: true });
    const res = await app.inject();
    assert.equal(res.status, 500);
    assert.equal(res.body.error.message, 'boom');
    assert.match(res.body.error.stack, /Error: boom/);
});

test('an expected HTTP error is not reported', async () => {
    let reports = 0;
    const app = appWith((ctx) => {
        throw ctx.error(404);
    }, { onError: () => reports++ });
    await app.inject();
    assert.equal(reports, 0);
});

test('a return value that is not JSON is a 500', async () => {
    const app = appWith(() => () => {}, { dev: true });
    const res = await app.inject();
    assert.equal(res.status, 500);
    assert.match(res.body.error.message, /returned a function/);
});

test('headers set before a throw stay on the error response', async () => {
    const app = appWith((ctx) => {
        ctx.header('x-request-id', 'abc');
        throw ctx.error(401, 'Login required');
    });
    const res = await app.inject();
    assert.equal(res.status, 401);
    assert.equal(res.headers['x-request-id'], 'abc');
});

test('ctx.env is a frozen copy and ctx.state starts empty per request', async () => {
    const env = { ADMIN_TOKEN: 'secret' };
    const app = appWith((ctx) => {
        const seen = { ...ctx.state };
        ctx.state.user = 'a';
        return { token: ctx.env.ADMIN_TOKEN, frozen: Object.isFrozen(ctx.env), seen };
    }, { env });

    await app.inject();
    const res = await app.inject();
    assert.deepEqual(res.body, { token: 'secret', frozen: true, seen: {} });
    assert.equal(Object.isFrozen(env), false);
});

test('HEAD gets the headers of the response but no body', async () => {
    const res = await appWith(() => ({ hello: 'world' })).inject({ method: 'HEAD' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-length'], '17');
    assert.equal(res.body, undefined);
});

test('the listener serves real HTTP requests', async (t) => {
    const app = appWith((ctx) => {
        if (ctx.method === 'DELETE') return undefined;
        if (ctx.path === '/fail') throw ctx.error(418, 'I am a teapot');
        ctx.status(201);
        return { method: ctx.method, path: ctx.path, query: ctx.query, body: ctx.body };
    });
    const server = http.createServer(app.listener);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;

    const created = await fetch(`${base}/users?notify=1`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'আধার' }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.deepEqual(await created.json(), {
        method: 'POST',
        path: '/users',
        query: { notify: '1' },
        body: { name: 'আধার' },
    });

    const deleted = await fetch(`${base}/users/1`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    assert.equal(await deleted.text(), '');

    const failed = await fetch(`${base}/fail`);
    assert.equal(failed.status, 418);
    assert.deepEqual(await failed.json(), { error: { status: 418, message: 'I am a teapot' } });

    const broken = await fetch(`${base}/users`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"name":',
    });
    assert.equal(broken.status, 400);
});

test('the listener refuses a declared body over the limit with 413', async (t) => {
    const app = appWith(() => 'ok');
    const server = http.createServer(app.listener);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    // Only the headers are sent, so the test does not depend on how the socket closes mid-upload.
    const status = await new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1',
            port: server.address().port,
            method: 'POST',
            path: '/upload',
            headers: { 'content-type': 'application/json', 'content-length': String(BODY_LIMIT + 1) },
        });
        req.on('response', (res) => {
            res.resume();
            resolve(res.statusCode);
            req.destroy();
        });
        req.on('error', reject);
        req.flushHeaders();
    });
    assert.equal(status, 413);
});
