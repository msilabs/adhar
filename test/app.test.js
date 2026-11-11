'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app.js');
const { makeProject } = require('./helpers/project.js');

const USERS = `
const users = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }];

export function GET() {
    return users;
}

export function POST(ctx) {
    ctx.status(201);
    return { id: '3', ...ctx.body };
}
`;

const USER = `
export function GET(ctx) {
    if (ctx.params.id === '404') throw ctx.error(404, 'User not found');
    return { id: ctx.params.id };
}

export async function DELETE() {}
`;

async function exampleApp(t, options) {
    const root = makeProject(t, {
        'routes/route.js': 'export function GET() { return { name: "example" }; }',
        'routes/users/route.js': USERS,
        'routes/users/[id]/route.js': USER,
        'routes/users/[id]/posts/[postId]/route.js': 'export function GET({ params }) { return params; }',
        'routes/(admin)/stats/route.js': 'export function GET() { return { users: 2 }; }',
    });
    return createApp(root, options);
}

test('routes answer by folder and method', async (t) => {
    const app = await exampleApp(t);

    assert.deepEqual((await app.inject({ path: '/' })).body, { name: 'example' });
    assert.equal((await app.inject({ path: '/users' })).body.length, 2);

    const created = await app.inject({ method: 'POST', path: '/users', body: { name: 'C' } });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { id: '3', name: 'C' });

    assert.equal((await app.inject({ method: 'DELETE', path: '/users/1' })).status, 204);
    assert.deepEqual((await app.inject({ path: '/stats' })).body, { users: 2 });
});

test('ctx.params holds the dynamic parts', async (t) => {
    const app = await exampleApp(t);
    assert.deepEqual((await app.inject({ path: '/users/42' })).body, { id: '42' });
    assert.deepEqual((await app.inject({ path: '/users/42/posts/7' })).body, { id: '42', postId: '7' });
    assert.deepEqual((await app.inject({ path: '/users/a%20b/' })).body, { id: 'a b' });
});

test('a trailing slash and a query string do not change the route', async (t) => {
    const app = await exampleApp(t);
    assert.equal((await app.inject({ path: '/users/' })).status, 200);
    assert.equal((await app.inject({ path: '/users?page=2' })).status, 200);
});

test('an unknown path is a 404', async (t) => {
    const app = await exampleApp(t);
    for (const path of ['/nope', '/users/1/2', '/admin/stats']) {
        const res = await app.inject({ path });
        assert.equal(res.status, 404, path);
        assert.deepEqual(res.body, { error: { status: 404, message: 'Not found' } });
    }
});

test('a handler can still throw its own 404', async (t) => {
    const app = await exampleApp(t);
    const res = await app.inject({ path: '/users/404' });
    assert.deepEqual(res.body, { error: { status: 404, message: 'User not found' } });
});

test('a method the route does not export is a 405 with an Allow header', async (t) => {
    const app = await exampleApp(t);

    const res = await app.inject({ method: 'PUT', path: '/users' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'GET, POST, HEAD, OPTIONS');
    assert.deepEqual(res.body, { error: { status: 405, message: 'Method PUT is not allowed for /users' } });

    assert.equal((await app.inject({ method: 'TRACE', path: '/users' })).status, 405);
});

test('HEAD runs GET and drops the body', async (t) => {
    const app = await exampleApp(t);
    const res = await app.inject({ method: 'HEAD', path: '/users/42' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-length'], String(JSON.stringify({ id: '42' }).length));
    assert.equal(res.body, undefined);
});

test('HEAD on a route without GET is a 405', async (t) => {
    const root = makeProject(t, { 'routes/login/route.js': 'export function POST() { return {}; }' });
    const app = await createApp(root);
    const res = await app.inject({ method: 'HEAD', path: '/login' });
    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'POST, OPTIONS');
});

test('OPTIONS answers 204 with the Allow header', async (t) => {
    const app = await exampleApp(t);
    const res = await app.inject({ method: 'OPTIONS', path: '/users/1' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.allow, 'GET, DELETE, HEAD, OPTIONS');
    assert.equal((await app.inject({ method: 'OPTIONS', path: '/nope' })).status, 404);
});

test('a broken percent-encoding in the path is a 400', async (t) => {
    const app = await exampleApp(t);
    const res = await app.inject({ path: '/users/%E0%A6' });
    assert.deepEqual(res.body, { error: { status: 400, message: 'Invalid URL' } });
});

test('options reach the pipeline', async (t) => {
    const root = makeProject(t, { 'routes/route.js': 'export function GET() { throw new Error("boom"); }' });
    const reported = [];
    const app = await createApp(root, { dev: true, onError: (err) => reported.push(err.message) });

    const res = await app.inject({ path: '/' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error.message, 'boom');
    assert.deepEqual(reported, ['boom']);
});

test('the app lists its routes and can be closed', async (t) => {
    const app = await exampleApp(t);
    assert.equal(app.routes.length, 5);
    await app.close();
});

test('a broken project fails when the app is created', async (t) => {
    const root = makeProject(t, { 'routes/users/route.js': 'export function get() {}' });
    await assert.rejects(createApp(root), (err) => err.name === 'AdharError' && /Unknown export `get`/.test(err.message));
});
