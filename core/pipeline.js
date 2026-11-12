'use strict';

const fs = require('node:fs');
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
// `baseHeaders(requestHeaders)` gives headers that belong on every response, such as CORS.
// `outside(request)` may answer a request before the handler sees it (the site of a full stack project);
// its response can name a `file` to send instead of a `body`.
function createPipeline({
    handler,
    dev = false,
    env = {},
    services,
    db,
    baseHeaders = () => ({}),
    onError = () => {},
    outside = () => null,
}) {
    const frozenEnv = Object.freeze({ ...env });

    function withoutBodyForHead(request, response) {
        if (request.method === 'HEAD') {
            response.body = null;
            delete response.file;
        }
        return response;
    }

    // request: { method, url, headers (lower-case names), body (Buffer or undefined) }
    async function handle(request) {
        const response = outside(request) ?? (await respond(request));
        return withoutBodyForHead(request, response);
    }

    async function respond(request) {
        const response = { status: undefined, headers: baseHeaders(request.headers) };
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
        const type = String(response.headers['content-type']);
        let content = response.body;
        if (response.file) {
            content = fs.readFileSync(response.file);
            if (/^text\/|json|xml/.test(type)) content = content.toString('utf8');
        }
        return {
            status: response.status,
            headers: response.headers,
            body: content === null ? undefined : type.startsWith('application/json') ? JSON.parse(content) : content,
        };
    }

    function send(res, response) {
        if (res.destroyed) return;
        res.writeHead(response.status, response.headers);
        if (!response.file) {
            res.end(response.body ?? undefined);
            return;
        }
        const stream = fs.createReadStream(response.file);
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
    }

    async function listener(req, res) {
        // A request for the site is answered without reading its body.
        const early = outside({ method: req.method, url: req.url, headers: req.headers });
        if (early) {
            if (req.method !== 'GET' && req.method !== 'HEAD') early.headers.connection = 'close';
            send(res, withoutBodyForHead(req, early));
            return;
        }

        let response;
        try {
            const body = await readBody(req);
            response = await handle({ method: req.method, url: req.url, headers: req.headers, body });
        } catch (err) {
            // The body could not be read, so the rest of it may still be on the wire.
            response = errorResponse(err, { dev, headers: baseHeaders(req.headers) });
            response.headers.connection = 'close';
        }
        send(res, response);
    }

    return { handle, inject, listener };
}

module.exports = { createPipeline };
