'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdharError } = require('./errors.js');

// The same list as Alo's dev server; Adhar cannot import Alo, so this is its own copy.
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.pdf': 'application/pdf',
};

const TEXT_TYPE = 'text/plain; charset=utf-8';
const HASHED = 'public, max-age=31536000, immutable';

// A project is full stack when it has web/pages/: an Alo site that lives next to the API.
function hasWeb(root) {
    return fs.existsSync(path.join(root, 'web', 'pages'));
}

// `/api` and everything below it belongs to the API; `/apix` does not.
function isApiPath(url) {
    const queryStart = url.indexOf('?');
    const urlPath = queryStart === -1 ? url : url.slice(0, queryStart);
    return urlPath === '/api' || urlPath.startsWith('/api/');
}

function assertNoApiClash(root) {
    for (const folder of ['web/pages/api', 'web/public/api']) {
        if (!fs.existsSync(path.join(root, ...folder.split('/')))) continue;
        throw new AdharError({
            file: folder + '/',
            message: '`/api` belongs to the API, so the site cannot have it too.',
            hint: `Rename \`${folder}/\`, or move what it does into \`api/\`.`,
        });
    }
}

function text(status, body, headers = {}) {
    return {
        status,
        headers: {
            'content-type': TEXT_TYPE,
            'content-length': String(Buffer.byteLength(body)),
            'cache-control': 'no-cache',
            'x-content-type-options': 'nosniff',
            ...headers,
        },
        body,
    };
}

function isFile(target) {
    try {
        return fs.statSync(target).isFile();
    } catch {
        return false;
    }
}

// Answers requests with the files in web/dist/. Every request looks at the disk,
// so a new `adhar build` shows up without a restart.
function createSite(root) {
    const dist = path.join(root, 'web', 'dist');

    function fileResponse(file, status, relative, requestHeaders) {
        const stat = fs.statSync(file);
        const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
        const headers = {
            'content-type': MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
            'content-length': String(stat.size),
            'cache-control': status === 200 && relative.startsWith('assets/') ? HASHED : 'no-cache',
            etag,
            'x-content-type-options': 'nosniff',
        };

        if (status === 200 && requestHeaders['if-none-match'] === etag) {
            delete headers['content-type'];
            delete headers['content-length'];
            return { status: 304, headers, body: null };
        }
        return { status, headers, body: null, file };
    }

    function notFound(requestHeaders) {
        const page = path.join(dist, '404.html');
        if (isFile(page)) return fileResponse(page, 404, '404.html', requestHeaders);
        return text(404, 'Not found (404)');
    }

    // request: { method, url, headers (lower-case names) }
    function respond(request) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return text(405, 'Method not allowed', { allow: 'GET, HEAD' });
        }

        const queryStart = request.url.indexOf('?');
        const rawPath = queryStart === -1 ? request.url : request.url.slice(0, queryStart);
        const search = queryStart === -1 ? '' : request.url.slice(queryStart);

        let pathname;
        try {
            pathname = decodeURIComponent(rawPath);
        } catch {
            return text(400, 'Bad URL');
        }
        if (pathname.includes('\0')) return notFound(request.headers);

        const parts = pathname.split('/').filter(Boolean);
        const target = path.resolve(dist, ...parts);
        if (target !== dist && !target.startsWith(dist + path.sep)) return notFound(request.headers);

        if (parts.length === 0 || pathname.endsWith('/')) {
            const index = path.join(target, 'index.html');
            const relative = [...parts, 'index.html'].join('/');
            return isFile(index) ? fileResponse(index, 200, relative, request.headers) : notFound(request.headers);
        }
        if (isFile(target)) return fileResponse(target, 200, parts.join('/'), request.headers);
        if (isFile(path.join(target, 'index.html'))) {
            // Built from the cleaned parts, so `//evil.example` can never become the target.
            const location = '/' + rawPath.split('/').filter(Boolean).join('/') + '/' + search;
            return text(301, 'Moved', { location });
        }
        return notFound(request.headers);
    }

    return { respond };
}

// Checks a full stack project and returns what answers the requests outside /api.
// `mode` is 'dist' (serve web/dist/) or 'external' (someone else answers, like the dev proxy).
function loadWeb(root, mode = 'dist') {
    if (!hasWeb(root)) return null;
    assertNoApiClash(root);
    if (mode === 'external') return { respond: null };

    if (!isFile(path.join(root, 'web', 'dist', 'index.html'))) {
        throw new AdharError({
            file: 'web/',
            message: 'The site has not been built yet: `web/dist/index.html` is missing.',
            hint: 'Run `node adhar build` first.',
        });
    }
    return createSite(root);
}

module.exports = { MIME_TYPES, hasWeb, isApiPath, assertNoApiClash, loadWeb };
