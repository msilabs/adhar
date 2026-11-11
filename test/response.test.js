'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpError } = require('../core/errors.js');
const { toResponse, errorResponse } = require('../core/response.js');

const JSON_TYPE = 'application/json; charset=utf-8';

function fresh(overrides = {}) {
    return { status: undefined, headers: {}, ...overrides };
}

test('an object or array becomes JSON with 200', () => {
    assert.deepEqual(toResponse({ a: 1 }, fresh()), {
        status: 200,
        headers: { 'content-type': JSON_TYPE, 'content-length': '7' },
        body: '{"a":1}',
    });
    assert.equal(toResponse([1, 2], fresh()).body, '[1,2]');
});

test('number, boolean and null become JSON', () => {
    assert.equal(toResponse(42, fresh()).body, '42');
    assert.equal(toResponse(false, fresh()).body, 'false');
    assert.equal(toResponse(null, fresh()).body, 'null');
    assert.equal(toResponse(null, fresh()).headers['content-type'], JSON_TYPE);
});

test('undefined becomes 204 without a body', () => {
    assert.deepEqual(toResponse(undefined, fresh()), { status: 204, headers: {}, body: null });
});

test('a string becomes plain text', () => {
    const response = toResponse('হ্যালো', fresh());
    assert.equal(response.status, 200);
    assert.equal(response.headers['content-type'], 'text/plain; charset=utf-8');
    assert.equal(response.headers['content-length'], String(Buffer.byteLength('হ্যালো')));
    assert.equal(response.body, 'হ্যালো');
});

test('a status set through ctx.status() wins', () => {
    assert.equal(toResponse({ id: 1 }, fresh({ status: 201 })).status, 201);
    assert.equal(toResponse(undefined, fresh({ status: 202 })).status, 202);
});

test('204 and 304 never carry a body', () => {
    for (const status of [204, 304]) {
        const response = toResponse({ a: 1 }, fresh({ status }));
        assert.equal(response.body, null);
        assert.equal(response.headers['content-type'], undefined);
    }
});

test('headers set through ctx.header() are kept, and can replace the content type', () => {
    const response = toResponse('a,b', fresh({ headers: { 'x-total': '2', 'content-type': 'text/csv' } }));
    assert.equal(response.headers['x-total'], '2');
    assert.equal(response.headers['content-type'], 'text/csv');
});

test('a value that is not JSON throws', () => {
    assert.throws(() => toResponse(() => {}, fresh()), /returned a function/);
    assert.throws(() => toResponse(Symbol('x'), fresh()), /returned a symbol/);
    assert.throws(() => toResponse(10n, fresh()), TypeError);
});

test('an HttpError becomes the error shape', () => {
    const response = errorResponse(new HttpError(404, 'User not found'));
    assert.equal(response.status, 404);
    assert.equal(response.headers['content-type'], JSON_TYPE);
    assert.deepEqual(JSON.parse(response.body), { error: { status: 404, message: 'User not found' } });
});

test('an HttpError can carry fields and headers', () => {
    const invalid = errorResponse(new HttpError(422, 'Validation failed', { fields: { name: 'is required' } }));
    assert.deepEqual(JSON.parse(invalid.body), {
        error: { status: 422, message: 'Validation failed', fields: { name: 'is required' } },
    });

    const notAllowed = errorResponse(new HttpError(405, 'Method not allowed', { headers: { allow: 'GET, POST' } }));
    assert.equal(notAllowed.headers.allow, 'GET, POST');
});

test('any other error is a 500 that hides the details in production', () => {
    const response = errorResponse(new Error('db password is hunter2'));
    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(response.body), { error: { status: 500, message: 'Internal server error' } });
});

test('in dev a 500 shows the message and the stack', () => {
    const { error } = JSON.parse(errorResponse(new Error('boom'), { dev: true }).body);
    assert.equal(error.status, 500);
    assert.equal(error.message, 'boom');
    assert.match(error.stack, /Error: boom/);
});

test('a thrown value that is not an Error is still a 500', () => {
    assert.equal(errorResponse('just a string').status, 500);
    assert.equal(JSON.parse(errorResponse('just a string', { dev: true }).body).error.message, 'just a string');
    assert.equal(errorResponse(undefined, { dev: true }).status, 500);
});

test('an error response keeps earlier headers but always answers in JSON', () => {
    const response = errorResponse(new HttpError(401, 'Login required'), {
        headers: { 'x-request-id': 'abc', 'content-type': 'text/csv' },
    });
    assert.equal(response.headers['x-request-id'], 'abc');
    assert.equal(response.headers['content-type'], JSON_TYPE);
});
