'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { BODY_LIMIT, parseForm, parseBody, readBody } = require('../core/body.js');

function fakeRequest(chunks, headers = {}) {
    const req = Readable.from(chunks, { objectMode: false });
    req.headers = headers;
    return req;
}

function httpError(status, message) {
    return (err) => {
        assert.equal(err.name, 'HttpError');
        assert.equal(err.status, status);
        if (message) assert.match(err.message, message);
        return true;
    };
}

test('parseForm reads names and values', () => {
    assert.deepEqual(parseForm('page=2&search=hello+world&empty='), { page: '2', search: 'hello world', empty: '' });
    assert.deepEqual(parseForm(''), {});
});

test('parseForm decodes percent-encoding, including Bengali', () => {
    assert.deepEqual(parseForm('name=%E0%A6%86%E0%A6%A7%E0%A6%BE%E0%A6%B0'), { name: 'আধার' });
});

test('parseForm turns a repeated name into an array', () => {
    assert.deepEqual(parseForm('tag=a&tag=b&tag=c&one=1'), { tag: ['a', 'b', 'c'], one: '1' });
});

test('parseForm ignores __proto__ and keeps other odd names as plain properties', () => {
    const result = parseForm('__proto__=x&constructor=y&toString=z');
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.deepEqual(result, { constructor: 'y', toString: 'z' });
});

test('parseBody gives undefined when there is no body', () => {
    assert.equal(parseBody('application/json', undefined), undefined);
    assert.equal(parseBody('application/json', Buffer.alloc(0)), undefined);
    assert.equal(parseBody(undefined, undefined), undefined);
});

test('parseBody parses JSON', () => {
    assert.deepEqual(parseBody('application/json', Buffer.from('{"name":"আধার","n":1}')), { name: 'আধার', n: 1 });
    assert.deepEqual(parseBody('application/json; charset=utf-8', Buffer.from('[1,2]')), [1, 2]);
    assert.deepEqual(parseBody('Application/Problem+JSON', Buffer.from('{"a":true}')), { a: true });
});

test('parseBody rejects broken JSON with 400', () => {
    assert.throws(() => parseBody('application/json', Buffer.from('{"name":')), httpError(400, /Invalid JSON body/));
});

test('parseBody parses a urlencoded form', () => {
    assert.deepEqual(parseBody('application/x-www-form-urlencoded', Buffer.from('name=A&tag=x&tag=y')), {
        name: 'A',
        tag: ['x', 'y'],
    });
});

test('parseBody rejects other content types with 415', () => {
    assert.throws(() => parseBody('text/plain', Buffer.from('hi')), httpError(415, /Unsupported Content-Type `text\/plain`/));
    assert.throws(() => parseBody('multipart/form-data; boundary=x', Buffer.from('hi')), httpError(415));
    assert.throws(() => parseBody(undefined, Buffer.from('hi')), httpError(415, /Missing Content-Type/));
});

test('parseBody rejects a body over the limit with 413', () => {
    assert.throws(() => parseBody('application/json', Buffer.alloc(BODY_LIMIT + 1, 0x20)), httpError(413));
});

test('readBody joins the chunks', async () => {
    const body = await readBody(fakeRequest([Buffer.from('{"a":'), Buffer.from('1}')]));
    assert.equal(body.toString(), '{"a":1}');
});

test('readBody gives undefined for an empty stream', async () => {
    assert.equal(await readBody(fakeRequest([])), undefined);
});

test('readBody rejects by Content-Length before reading anything', async () => {
    const req = fakeRequest([Buffer.from('x')], { 'content-length': String(BODY_LIMIT + 1) });
    await assert.rejects(readBody(req), httpError(413, /too large/));
});

test('readBody rejects once the stream grows past the limit', async () => {
    const req = fakeRequest([Buffer.alloc(6), Buffer.alloc(6)]);
    await assert.rejects(readBody(req, 10), httpError(413));
});

test('readBody accepts a body exactly at the limit', async () => {
    const body = await readBody(fakeRequest([Buffer.alloc(5), Buffer.alloc(5)]), 10);
    assert.equal(body.length, 10);
});
