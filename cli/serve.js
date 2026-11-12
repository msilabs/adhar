'use strict';

const http = require('node:http');
const { createApp } = require('../core/app.js');
const { loadEnv, resolvePort } = require('../core/env.js');
const { AdharError } = require('../core/errors.js');
const { isApiPath } = require('../core/web.js');
const log = require('./log.js');

const SHUTDOWN_LIMIT = 10_000;

function listen(server, port) {
    return new Promise((resolve, reject) => {
        server.once('error', (err) => {
            if (err.code !== 'EADDRINUSE') return reject(err);
            reject(
                new AdharError({
                    message: `Port ${port} is already in use.`,
                    hint: `Stop the other program, or pick another port: \`--port ${port + 1}\`.`,
                }),
            );
        });
        server.listen(port, resolve);
    });
}

const NO_ALO = 'The Alo dev server is not running. Restart `adhar dev`.\n';

// Hands a request for the site to Alo's dev server, which `adhar dev` runs on a port of its own.
function proxy(req, res, webPort) {
    const upstream = http.request(
        { host: 'localhost', port: webPort, method: req.method, path: req.url, headers: req.headers },
        (answer) => {
            res.writeHead(answer.statusCode, answer.headers);
            answer.pipe(res);
        },
    );
    upstream.on('error', () => {
        if (res.headersSent) {
            res.destroy();
            return;
        }
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'content-length': Buffer.byteLength(NO_ALO) });
        res.end(NO_ALO);
    });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
}

// Loads the project and serves it. `dev` picks the mode: dev runs pending migrations and shows
// error details in responses; production refuses to start while migrations are pending.
// `webPort` is where Alo's dev server listens, in a full stack project under `adhar dev`.
async function serve({ root, port, dev, webPort }) {
    const env = loadEnv(root, process.env);
    if (!env.NODE_ENV) env.NODE_ENV = dev ? 'development' : 'production';
    const finalPort = resolvePort(port, env);

    const app = await createApp(root, {
        dev,
        env,
        migrations: dev ? 'run' : 'check',
        web: dev ? 'external' : 'dist',
        onError: (err, request) => log.requestError(request, err),
    });
    for (const warning of app.warnings) log.warn(warning);

    const proxied = dev && app.fullStack;

    const server = http.createServer((req, res) => {
        const started = performance.now();
        const forSite = proxied && !isApiPath(req.url);
        res.on('finish', () => {
            // A page pulls in many files, so in dev only the site's failures are worth a line.
            if (forSite && res.statusCode !== 404 && res.statusCode < 500) return;
            const took = Math.round(performance.now() - started);
            log.request(req.method, req.url, res.statusCode, took);
        });
        if (forSite) proxy(req, res, webPort);
        else app.listener(req, res);
    });

    try {
        await listen(server, finalPort);
    } catch (err) {
        await app.close();
        throw err;
    }

    log.success(`Adhar is running at http://localhost:${finalPort} (${dev ? 'dev' : 'production'})`);

    // Stops taking new connections, lets running requests finish, then closes the database.
    // In dev nothing waits: a browser tab keeps Alo's live reload connection open for ever.
    async function close() {
        const closed = new Promise((resolve) => server.close(resolve));
        if (dev) server.closeAllConnections();
        else server.closeIdleConnections();
        const timer = setTimeout(() => server.closeAllConnections(), SHUTDOWN_LIMIT);
        await closed;
        clearTimeout(timer);
        await app.close();
    }

    return { port: finalPort, close };
}

// Runs `serve` as the whole program: stays up until the process is asked to stop.
async function run(options) {
    process.on('unhandledRejection', (err) => log.unhandled(err));

    const server = await serve(options);
    let stopping = false;
    const stop = () => {
        if (stopping) return;
        stopping = true;
        server.close().then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
}

module.exports = { serve, run };
