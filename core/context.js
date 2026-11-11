'use strict';

const { STATUS_CODES } = require('node:http');
const { HttpError } = require('./errors.js');

function isStatus(code, min, max) {
    return Number.isInteger(code) && code >= min && code <= max;
}

// `response` collects what the handler sets through ctx.status() and ctx.header().
// The methods are closures, not `this`-based, so `({ params, error })` destructuring works.
function createContext(request, response) {
    const ctx = {
        method: request.method,
        path: request.path,
        params: request.params ?? {},
        query: request.query,
        body: request.body,
        headers: request.headers,
        env: request.env,
        services: request.services,
        db: request.db,
        state: {},

        status(code) {
            if (!isStatus(code, 100, 599)) {
                throw new TypeError(`ctx.status() needs a number from 100 to 599, got ${JSON.stringify(code)}.`);
            }
            response.status = code;
            return ctx;
        },

        header(name, value) {
            response.headers[String(name).toLowerCase()] = String(value);
            return ctx;
        },

        error(status, message) {
            if (!isStatus(status, 400, 599)) {
                throw new TypeError(`ctx.error() needs a status from 400 to 599, got ${JSON.stringify(status)}.`);
            }
            return new HttpError(status, message ?? STATUS_CODES[status] ?? 'Error');
        },
    };
    return ctx;
}

module.exports = { createContext };
