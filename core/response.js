'use strict';

const { HttpError } = require('./errors.js');

const JSON_TYPE = 'application/json; charset=utf-8';
const TEXT_TYPE = 'text/plain; charset=utf-8';

function hasNoBody(status) {
    return status === 204 || status === 304;
}

function build(status, headers, type, text) {
    if (hasNoBody(status)) return { status, headers: { ...headers }, body: null };
    return {
        status,
        headers: {
            ...headers,
            'content-type': headers['content-type'] ?? type,
            'content-length': String(Buffer.byteLength(text)),
        },
        body: text,
    };
}

// Turns what a handler returned into { status, headers, body }.
function toResponse(value, response) {
    if (value === undefined) {
        return { status: response.status ?? 204, headers: { ...response.headers }, body: null };
    }

    const status = response.status ?? 200;
    if (typeof value === 'string') return build(status, response.headers, TEXT_TYPE, value);

    const json = JSON.stringify(value);
    if (json === undefined) {
        throw new TypeError(`A handler returned a ${typeof value}, which cannot be sent as JSON.`);
    }
    return build(status, response.headers, JSON_TYPE, json);
}

function errorResponse(err, { dev = false, headers = {} } = {}) {
    let error;
    let extraHeaders;

    if (err instanceof HttpError) {
        error = { status: err.status, message: err.message };
        if (err.fields) error.fields = err.fields;
        extraHeaders = err.headers;
    } else if (dev) {
        error = { status: 500, message: String(err?.message ?? err), stack: err?.stack };
    } else {
        error = { status: 500, message: 'Internal server error' };
    }

    const merged = { ...headers, ...extraHeaders };
    delete merged['content-type'];
    return build(error.status, merged, JSON_TYPE, JSON.stringify({ error }));
}

module.exports = { toResponse, errorResponse };
