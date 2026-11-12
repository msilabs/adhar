'use strict';

const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { fork } = require('node:child_process');
const { assertProject } = require('../core/router.js');
const { assertNoApiClash, hasWeb } = require('../core/web.js');
const log = require('./log.js');

const WORKER = path.join(__dirname, 'worker.js');
const WATCHED_FOLDERS = ['api', 'services', 'migrations'];
const DEBOUNCE = 100;
const KILL_AFTER = 2000;

// Watches the folders Adhar reads, plus the project root for `.env` and for a watched folder appearing.
function watchProject(root, onChange) {
    let watchers = [];

    function stop() {
        for (const watcher of watchers) watcher.close();
        watchers = [];
    }

    // Called again after every restart, so a folder created since then gets watched too.
    function refresh() {
        stop();

        watchers.push(
            fs.watch(root, (event, name) => {
                if (name === '.env' || WATCHED_FOLDERS.includes(name)) onChange(name);
            }),
        );
        for (const folder of WATCHED_FOLDERS) {
            const full = path.join(root, folder);
            if (!fs.existsSync(full)) continue;
            watchers.push(
                fs.watch(full, { recursive: true }, (event, name) => {
                    onChange(name ? `${folder}/${String(name).replace(/\\/g, '/')}` : folder);
                }),
            );
        }
        // A watched folder can be deleted while we watch it; the next refresh sorts that out.
        for (const watcher of watchers) watcher.on('error', () => {});
    }

    return { refresh, stop };
}

// Asks the OS for a free port on localhost, for Alo's dev server.
function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, 'localhost', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

// The dev server is two processes: this one watches files, and a worker serves the project.
// ES modules cannot be unloaded, so a change means a fresh worker.
// A full stack project adds a third: Alo's dev server, started once; the worker passes the site's requests to it.
async function runDev({ root, port }) {
    assertProject(root);

    let alo = null;
    let webPort;
    if (hasWeb(root)) {
        assertNoApiClash(root);
        const { startAloDev } = require('./web.js');
        webPort = await freePort();
        alo = startAloDev(root, webPort);
        alo.once('exit', () => {
            alo = null;
            if (stopping) return;
            log.warn({
                message: 'The Alo dev server stopped, so the site is down. The API keeps running.',
                hint: 'Fix what Alo reported above, then restart `adhar dev`.',
            });
        });
    }

    function stopAlo() {
        return new Promise((resolve) => {
            if (!alo) return resolve();
            const running = alo;
            const force = setTimeout(() => running.kill('SIGKILL'), KILL_AFTER);
            running.once('exit', () => {
                clearTimeout(force);
                resolve();
            });
            running.kill('SIGTERM');
        });
    }

    let child = null;
    let timer = null;
    let busy = false;
    let again = null;
    let stopping = false;

    function startWorker() {
        const worker = fork(WORKER, port === undefined ? [] : [String(port)], {
            cwd: root,
            stdio: 'inherit',
            env: webPort === undefined ? process.env : { ...process.env, ADHAR_WEB_PORT: String(webPort) },
        });
        child = worker;
        worker.once('exit', (code) => {
            if (child === worker) child = null;
            if (code && !busy && !stopping) log.dim('Waiting for a file to change...');
        });
    }

    function stopWorker() {
        return new Promise((resolve) => {
            if (!child) return resolve();
            const worker = child;
            const force = setTimeout(() => worker.kill('SIGKILL'), KILL_AFTER);
            worker.once('exit', () => {
                clearTimeout(force);
                resolve();
            });
            worker.kill('SIGTERM');
        });
    }

    async function restart(changed) {
        if (busy) {
            again = changed;
            return;
        }
        busy = true;
        log.dim(`\n${changed} changed, restarting...`);
        await stopWorker();
        watcher.refresh();
        if (!stopping) startWorker();
        busy = false;

        if (again && !stopping) {
            const next = again;
            again = null;
            restart(next);
        }
    }

    const watcher = watchProject(root, (changed) => {
        clearTimeout(timer);
        timer = setTimeout(() => restart(changed), DEBOUNCE);
    });

    const stop = () => {
        if (stopping) return;
        stopping = true;
        clearTimeout(timer);
        watcher.stop();
        Promise.all([stopWorker(), stopAlo()]).then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    watcher.refresh();
    startWorker();
}

module.exports = { runDev };
