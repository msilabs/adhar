'use strict';

const { HttpError } = require('./errors.js');

const BODY_LIMIT = 1024 * 1024;

function tooLarge() {
    return new HttpError(413, 'Request body is too large. The limit is 1 MB.');
}

// Parses a query string or a urlencoded body. A name that appears more than once becomes an array.
function parseForm(text) {
    const result = {};
    for (const [name, value] of new URLSearchParams(text)) {
        // Assigning to `__proto__` would not create a normal property.
        if (name === '__proto__') continue;
        if (!Object.hasOwn(result, name)) {
            result[name] = value;
        } else if (Array.isArray(result[name])) {
            result[name].push(value);
        } else {
            result[name] = [result[name], value];
        }
    }
    return result;
}

function mediaType(contentType) {
    return String(contentType ?? '').split(';')[0].trim().toLowerCase();
}

function parseBody(contentType, buffer) {
    if (buffer === undefined || buffer.length === 0) return undefined;
    if (buffer.length > BODY_LIMIT) throw tooLarge();

    const type = mediaType(contentType);

    if (type === 'application/json' || type.endsWith('+json')) {
        try {
            return JSON.parse(buffer.toString('utf8'));
        } catch {
            throw new HttpError(400, 'Invalid JSON body');
        }
    }
    if (type === 'application/x-www-form-urlencoded') {
        return parseForm(buffer.toString('utf8'));
    }

    throw new HttpError(
        415,
        type
            ? `Unsupported Content-Type \`${type}\`. Send JSON with \`Content-Type: application/json\`.`
            : 'Missing Content-Type. Send JSON with `Content-Type: application/json`.',
    );
}

// Collects the request stream into one Buffer, and gives up as soon as it grows past the limit.
function readBody(req, limit = BODY_LIMIT) {
    return new Promise((resolve, reject) => {
        if (Number(req.headers['content-length']) > limit) {
            req.resume();
            reject(tooLarge());
            return;
        }

        const chunks = [];
        let size = 0;
        let failed = false;

        req.on('data', (chunk) => {
            if (failed) return;
            size += chunk.length;
            if (size > limit) {
                failed = true;
                chunks.length = 0;
                reject(tooLarge());
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (!failed) resolve(size === 0 ? undefined : Buffer.concat(chunks));
        });
        req.on('error', reject);
    });
}

module.exports = { BODY_LIMIT, parseForm, parseBody, readBody };
