'use strict';

const http = require('node:http');
const { createApp } = require('../core/app.js');
const { loadEnv, resolvePort } = require('../core/env.js');
const { AdharError } = require('../core/errors.js');
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

// Loads the project and serves it. `dev` picks the mode: dev runs pending migrations and shows
// error details in responses; production refuses to start while migrations are pending.
async function serve({ root, port, dev }) {
    const env = loadEnv(root, process.env);
    if (!env.NODE_ENV) env.NODE_ENV = dev ? 'development' : 'production';
    const finalPort = resolvePort(port, env);

    const app = await createApp(root, {
        dev,
        env,
        migrations: dev ? 'run' : 'check',
        onError: (err, request) => log.requestError(request, err),
    });
    for (const warning of app.warnings) log.warn(warning);

    const server = http.createServer((req, res) => {
        const started = performance.now();
        res.on('finish', () => {
            const took = Math.round(performance.now() - started);
            log.request(req.method, req.url, res.statusCode, took);
        });
        app.listener(req, res);
    });

    try {
        await listen(server, finalPort);
    } catch (err) {
        await app.close();
        throw err;
    }

    log.success(`Adhar is running at http://localhost:${finalPort} (${dev ? 'dev' : 'production'})`);

    // Stops taking new connections, lets running requests finish, then closes the database.
    async function close() {
        const closed = new Promise((resolve) => server.close(resolve));
        server.closeIdleConnections();
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
