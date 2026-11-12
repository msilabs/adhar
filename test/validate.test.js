'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app.js');
const { compileSchema, applySchema } = require('../core/validate.js');
const { makeProject } = require('./helpers/project.js');

// Builds the route shape that compileSchema expects.
function route(schema, { methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], params = [] } = {}) {
    return {
        file: 'api/users/route.js',
        schema,
        handlers: Object.fromEntries(methods.map((method) => [method, () => {}])),
        segments: params.map((name) => ({ type: 'param', name })),
    };
}

function run(schema, method, input, options) {
    const ctx = { body: undefined, query: {}, params: {}, ...input };
    applySchema(compileSchema(route(schema, options))[method], ctx);
    return ctx;
}

function fieldsOf(schema, method, input, options) {
    try {
        run(schema, method, input, options);
    } catch (err) {
        assert.equal(err.name, 'HttpError');
        assert.equal(err.status, 422);
        assert.equal(err.message, 'Validation failed');
        return err.fields;
    }
    return null;
}

function schemaError(message, hint) {
    return (err) => {
        assert.equal(err.name, 'AdharError');
        assert.equal(err.file, 'api/users/route.js');
        assert.match(err.message, message);
        if (hint) assert.match(err.hint, hint);
        return true;
    };
}

const USER = { POST: { body: { name: 'string', email: 'email', age: 'number?', tags: 'array?' } } };

test('a route without a schema has no checks', () => {
    assert.deepEqual(compileSchema(route(undefined)), {});
    applySchema(undefined, {});
});

test('a valid body passes unchanged', () => {
    const body = { name: 'A', email: 'a@b.co', age: 30, tags: ['x'] };
    assert.deepEqual(run(USER, 'POST', { body }).body, body);
});

test('optional fields may be left out', () => {
    assert.deepEqual(run(USER, 'POST', { body: { name: 'A', email: 'a@b.co' } }).body, { name: 'A', email: 'a@b.co' });
});

test('fields outside the schema are dropped from the body', () => {
    const ctx = run(USER, 'POST', { body: { name: 'A', email: 'a@b.co', role: 'admin', id: 99 } });
    assert.deepEqual(ctx.body, { name: 'A', email: 'a@b.co' });
});

test('missing required fields are reported together', () => {
    assert.deepEqual(fieldsOf(USER, 'POST', { body: {} }), { name: 'is required', email: 'is required' });
    assert.deepEqual(fieldsOf(USER, 'POST', { body: undefined }), { name: 'is required', email: 'is required' });
    assert.deepEqual(fieldsOf(USER, 'POST', { body: { name: null, email: 'a@b.co' } }), { name: 'is required' });
});

test('a body that is not an object is rejected', () => {
    assert.deepEqual(fieldsOf(USER, 'POST', { body: [1, 2] }), { body: 'must be an object' });
    assert.deepEqual(fieldsOf(USER, 'POST', { body: 'text' }), { body: 'must be an object' });
});

test('each body type is checked without conversion', () => {
    const schema = {
        POST: {
            body: { s: 'string?', n: 'number?', i: 'integer?', b: 'boolean?', e: 'email?', a: 'array?', o: 'object?' },
        },
    };
    const good = { s: 'x', n: 1.5, i: -3, b: false, e: 'a@b.co', a: [], o: {} };
    assert.deepEqual(run(schema, 'POST', { body: good }).body, good);

    const bad = { s: 1, n: '1', i: 1.5, b: 'true', e: 'not-an-email', a: {}, o: [] };
    assert.deepEqual(fieldsOf(schema, 'POST', { body: bad }), {
        s: 'must be a string',
        n: 'must be a number',
        i: 'must be a whole number',
        b: 'must be true or false',
        e: 'must be a valid email',
        a: 'must be a list',
        o: 'must be an object',
    });
});

test('odd numbers are rejected', () => {
    const schema = { POST: { body: { n: 'number?', i: 'integer?' } } };
    assert.deepEqual(fieldsOf(schema, 'POST', { body: { n: NaN } }), { n: 'must be a number' });
    assert.deepEqual(fieldsOf(schema, 'POST', { body: { n: Infinity } }), { n: 'must be a number' });
    assert.deepEqual(fieldsOf(schema, 'POST', { body: { i: 2 ** 60 } }), { i: 'must be a whole number' });
});

test('a required string must not be empty, an optional one may be', () => {
    const schema = { POST: { body: { name: 'string', bio: 'string?' } } };
    assert.deepEqual(fieldsOf(schema, 'POST', { body: { name: '' } }), { name: 'must not be empty' });
    assert.deepEqual(run(schema, 'POST', { body: { name: 'A', bio: '' } }).body, { name: 'A', bio: '' });
});

test('email needs a name, an @ and a dotted domain', () => {
    const schema = { POST: { body: { email: 'email' } } };
    for (const email of ['a@b.co', 'first.last+tag@example.com.bd']) {
        assert.equal(fieldsOf(schema, 'POST', { body: { email } }), null, email);
    }
    for (const email of ['', 'a', 'a@b', '@b.co', 'a b@c.co', 'a@b .co', 42]) {
        assert.ok(fieldsOf(schema, 'POST', { body: { email } }), String(email));
    }
});

test('query values are converted from text', () => {
    const schema = { GET: { query: { page: 'integer?', min: 'number?', draft: 'boolean?', search: 'string?', tag: 'array?' } } };
    const ctx = run(schema, 'GET', { query: { page: '2', min: '1.5', draft: 'true', search: 'alo', tag: ['a', 'b'] } });
    assert.deepEqual(ctx.query, { page: 2, min: 1.5, draft: true, search: 'alo', tag: ['a', 'b'] });

    assert.deepEqual(run(schema, 'GET', { query: { draft: 'false', tag: 'solo', min: '-3' } }).query, {
        draft: false,
        tag: ['solo'],
        min: -3,
    });
});

test('query values that cannot be converted are reported', () => {
    const schema = { GET: { query: { page: 'integer?', min: 'number?', draft: 'boolean?', search: 'string?' } } };
    assert.deepEqual(fieldsOf(schema, 'GET', { query: { page: '2.5', min: 'abc', draft: 'yes', search: ['a', 'b'] } }), {
        page: 'must be a whole number',
        min: 'must be a number',
        draft: 'must be true or false',
        search: 'must be a string',
    });
    assert.deepEqual(fieldsOf(schema, 'GET', { query: { page: '1e3' } }), { page: 'must be a whole number' });
});

test('an empty query value counts as missing', () => {
    const schema = { GET: { query: { page: 'integer?', search: 'string' } } };
    assert.deepEqual(fieldsOf(schema, 'GET', { query: { page: '', search: '' } }), { search: 'is required' });
    assert.deepEqual(run(schema, 'GET', { query: { page: '', search: 'x' } }).query, { search: 'x' });
});

test('query fields outside the schema are dropped, and an unlisted query is left alone', () => {
    const schema = { GET: { query: { page: 'integer?' } }, POST: { body: { name: 'string' } } };
    assert.deepEqual(run(schema, 'GET', { query: { page: '1', debug: '1' } }).query, { page: 1 });
    assert.deepEqual(run(schema, 'POST', { body: { name: 'A' }, query: { debug: '1' } }).query, { debug: '1' });
});

test('params are converted and the others are kept', () => {
    const schema = { GET: { params: { id: 'integer' } } };
    const options = { params: ['id', 'slug'] };
    assert.deepEqual(run(schema, 'GET', { params: { id: '42', slug: 'hello' } }, options).params, { id: 42, slug: 'hello' });
    assert.deepEqual(fieldsOf(schema, 'GET', { params: { id: 'abc', slug: 'hello' } }, options), {
        id: 'must be a whole number',
    });
});

test('errors from body, query and params come back in one list', () => {
    const schema = { PUT: { params: { id: 'integer' }, query: { notify: 'boolean?' }, body: { name: 'string' } } };
    const fields = fieldsOf(schema, 'PUT', { params: { id: 'x' }, query: { notify: 'maybe' }, body: {} }, { params: ['id'] });
    assert.deepEqual(fields, { id: 'must be a whole number', notify: 'must be true or false', name: 'is required' });
});

test('nothing on ctx changes when validation fails', () => {
    const ctx = { body: { name: 'A', extra: 1 }, query: { page: 'x' }, params: {} };
    const checks = compileSchema(route({ POST: { body: { name: 'string' }, query: { page: 'integer' } } })).POST;
    assert.throws(() => applySchema(checks, ctx));
    assert.deepEqual(ctx.body, { name: 'A', extra: 1 });
});

test('a field named like an Object method is not found on the prototype', () => {
    const schema = { POST: { body: { toString: 'string', constructor: 'string?' } } };
    assert.deepEqual(fieldsOf(schema, 'POST', { body: {} }), { toString: 'is required' });
});

test('a schema that is not an object is an error', () => {
    for (const schema of [null, 'string', [], 5]) {
        assert.throws(() => compileSchema(route(schema)), schemaError(/`schema` must be an object/, /export const schema/));
    }
    assert.throws(() => compileSchema(route({ POST: 'string' })), schemaError(/`schema\.POST` must be an object/));
    assert.throws(() => compileSchema(route({ POST: { body: [] } })), schemaError(/`schema\.POST\.body` must be an object/));
});

test('an unknown method in the schema is an error', () => {
    assert.throws(() => compileSchema(route({ post: {} })), schemaError(/Unknown method `post`/, /Did you mean `POST`\?/));
    assert.throws(() => compileSchema(route({ body: {} })), schemaError(/Unknown method `body`/, /method names/));
});

test('a schema for a method the file does not export is an error', () => {
    assert.throws(
        () => compileSchema(route({ POST: { body: { name: 'string' } } }, { methods: ['GET'] })),
        schemaError(/rules for `POST`, but this file does not export `POST`/, /export function POST/),
    );
});

test('an unknown part is an error', () => {
    assert.throws(() => compileSchema(route({ POST: { bdy: {} } })), schemaError(/Unknown key `bdy`/, /Did you mean `body`\?/));
    assert.throws(() => compileSchema(route({ POST: { headers: {} } })), schemaError(/Unknown key `headers`/, /`body`, `query` or `params`/));
});

test('a body schema on GET or DELETE is an error', () => {
    for (const method of ['GET', 'DELETE']) {
        assert.throws(
            () => compileSchema(route({ [method]: { body: { name: 'string' } } })),
            schemaError(new RegExp(`schema\\.${method}\\.body\` is not allowed`), /Use `query`/),
        );
    }
});

test('an unknown type is an error', () => {
    assert.throws(
        () => compileSchema(route({ POST: { body: { name: 'strng' } } })),
        schemaError(/Unknown type "strng" for `schema\.POST\.body\.name`/, /Did you mean `string`\?/),
    );
    assert.throws(
        () => compileSchema(route({ POST: { body: { age: 'int?' } } })),
        schemaError(/Unknown type "int\?"/, /Did you mean `integer`\?/),
    );
    assert.throws(
        () => compileSchema(route({ POST: { body: { when: 'timestamp' } } })),
        schemaError(/Unknown type "timestamp"/, /The types are: string, number/),
    );
    assert.throws(() => compileSchema(route({ POST: { body: { name: String } } })), schemaError(/Unknown type/, /The types are/));
    assert.throws(() => compileSchema(route({ POST: { body: { name: { type: 'string' } } } })), schemaError(/Unknown type/));
});

test('object and array are not allowed where values are text', () => {
    assert.throws(
        () => compileSchema(route({ GET: { query: { filter: 'object' } } })),
        schemaError(/`schema\.GET\.query\.filter` cannot be `object`/),
    );
    assert.throws(
        () => compileSchema(route({ GET: { params: { id: 'array' } } }, { params: ['id'] })),
        schemaError(/cannot be `array`/),
    );
});

test('a params rule must name a part of the path', () => {
    assert.throws(
        () => compileSchema(route({ GET: { params: { userId: 'integer' } } }, { params: ['id'] })),
        schemaError(/`schema\.GET\.params\.userId` is not part of this route's path/, /This route has: `id`/),
    );
    assert.throws(
        () => compileSchema(route({ GET: { params: { id: 'integer' } } })),
        schemaError(/not part of this route's path/, /no `\[name\]` folder/),
    );
});

const NOTES_ROUTE = `
export const schema = {
    GET: { query: { page: 'integer?' } },
    POST: { body: { title: 'string', done: 'boolean?' } },
};

export function GET(ctx) {
    return { page: ctx.query.page ?? 1 };
}

export function POST(ctx) {
    ctx.status(201);
    return ctx.body;
}
`;

test('a route with a schema answers 422 before the handler runs', async (t) => {
    const root = makeProject(t, {
        'api/notes/route.js': NOTES_ROUTE,
        'api/notes/[id]/route.js': `
export const schema = { GET: { params: { id: 'integer' } } };
export function GET(ctx) { return { id: ctx.params.id, type: typeof ctx.params.id }; }
`,
    });
    const app = await createApp(root);

    const created = await app.inject({ method: 'POST', path: '/api/notes', body: { title: 'Buy milk', owner: 'me' } });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { title: 'Buy milk' });

    const invalid = await app.inject({ method: 'POST', path: '/api/notes', body: { done: 'yes' } });
    assert.equal(invalid.status, 422);
    assert.deepEqual(invalid.body, {
        error: {
            status: 422,
            message: 'Validation failed',
            fields: { title: 'is required', done: 'must be true or false' },
        },
    });

    assert.deepEqual((await app.inject({ path: '/api/notes?page=3' })).body, { page: 3 });
    assert.equal((await app.inject({ path: '/api/notes?page=three' })).status, 422);
    assert.deepEqual((await app.inject({ path: '/api/notes/7' })).body, { id: 7, type: 'number' });
    assert.equal((await app.inject({ path: '/api/notes/seven' })).status, 422);
});

test('HEAD uses the GET schema', async (t) => {
    const root = makeProject(t, { 'api/notes/route.js': NOTES_ROUTE });
    const app = await createApp(root);
    assert.equal((await app.inject({ method: 'HEAD', path: '/api/notes?page=x' })).status, 422);
    assert.equal((await app.inject({ method: 'HEAD', path: '/api/notes?page=1' })).status, 200);
});

test('validation runs after the middleware', async (t) => {
    const root = makeProject(t, {
        'api/middleware.js': 'export default function (ctx, next) { if (!ctx.headers.authorization) throw ctx.error(401); return next(); }',
        'api/notes/route.js': NOTES_ROUTE,
    });
    const app = await createApp(root);

    assert.equal((await app.inject({ method: 'POST', path: '/api/notes', body: {} })).status, 401);
    const res = await app.inject({ method: 'POST', path: '/api/notes', body: {}, headers: { authorization: 'x' } });
    assert.equal(res.status, 422);
});

test('a broken schema fails when the app is created', async (t) => {
    const root = makeProject(t, {
        'api/notes/route.js': "export const schema = { POST: { body: { title: 'text' } } };\nexport function POST() {}",
    });
    await assert.rejects(createApp(root), (err) => {
        assert.equal(err.name, 'AdharError');
        assert.equal(err.file, 'api/notes/route.js');
        assert.match(err.message, /Unknown type "text"/);
        return true;
    });
});
