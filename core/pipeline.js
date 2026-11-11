'use strict';

const { HttpError } = require('./errors.js');
const { parseForm, parseBody, readBody } = require('./body.js');
const { createContext } = require('./context.js');
const { toResponse, errorResponse } = require('./response.js');

function parseUrl(url) {
    const queryStart = url.indexOf('?');
    let path = queryStart === -1 ? url : url.slice(0, queryStart);
    const search = queryStart === -1 ? '' : url.slice(queryStart + 1);

    path = path.replace(/\/+$/, '');
    if (path === '') path = '/';

    return { path, query: parseForm(search) };
}

function lowerCaseKeys(headers) {
    const result = {};
    for (const [name, value] of Object.entries(headers)) result[name.toLowerCase()] = String(value);
    return result;
}

// The core never opens a port or prints: `handle` maps a plain request to a plain response,
// `inject` wraps it for tests, and `listener` adapts it to node:http.
// `services` and `db` are handed to every ctx as they are.
function createPipeline({ handler, dev = false, env = {}, services, db, onError = () => {} }) {
    const frozenEnv = Object.freeze({ ...env });

    // request: { method, url, headers (lower-case names), body (Buffer or undefined) }
    async function handle(request) {
        const response = await respond(request);
        if (request.method === 'HEAD') response.body = null;
        return response;
    }

    async function respond(request) {
        const response = { status: undefined, headers: {} };
        try {
            const { path, query } = parseUrl(request.url);
            const body = parseBody(request.headers['content-type'], request.body);
            const ctx = createContext(
                { method: request.method, path, query, body, headers: request.headers, env: frozenEnv, services, db },
                response,
            );
            return toResponse(await handler(ctx), response);
        } catch (err) {
            if (!(err instanceof HttpError)) onError(err, request);
            return errorResponse(err, { dev, headers: response.headers });
        }
    }

    async function inject({ method = 'GET', path = '/', headers = {}, body } = {}) {
        const requestHeaders = lowerCaseKeys(headers);
        let buffer;

        if (typeof body === 'string' || Buffer.isBuffer(body)) {
            buffer = Buffer.from(body);
        } else if (body !== undefined) {
            buffer = Buffer.from(JSON.stringify(body));
            requestHeaders['content-type'] ??= 'application/json';
        }

        const response = await handle({ method: method.toUpperCase(), url: path, headers: requestHeaders, body: buffer });
        const isJson = String(response.headers['content-type']).startsWith('application/json');
        return {
            status: response.status,
            headers: response.headers,
            body: response.body === null ? undefined : isJson ? JSON.parse(response.body) : response.body,
        };
    }

    async function listener(req, res) {
        let response;
        try {
            const body = await readBody(req);
            response = await handle({ method: req.method, url: req.url, headers: req.headers, body });
        } catch (err) {
            // The body could not be read, so the rest of it may still be on the wire.
            response = errorResponse(err, { dev });
            response.headers.connection = 'close';
        }
        if (res.destroyed) return;
        res.writeHead(response.status, response.headers);
        res.end(response.body ?? undefined);
    }

    return { handle, inject, listener };
}

module.exports = { createPipeline };
