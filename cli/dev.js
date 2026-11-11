'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const { assertProject } = require('../core/router.js');
const log = require('./log.js');

const WORKER = path.join(__dirname, 'worker.js');
const WATCHED_FOLDERS = ['routes', 'services', 'migrations'];
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

// The dev server is two processes: this one watches files, and a worker serves the project.
// ES modules cannot be unloaded, so a change means a fresh worker.
function runDev({ root, port }) {
    assertProject(root);

    let child = null;
    let timer = null;
    let busy = false;
    let again = null;
    let stopping = false;

    function startWorker() {
        const worker = fork(WORKER, port === undefined ? [] : [String(port)], { cwd: root, stdio: 'inherit' });
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
        stopWorker().then(() => process.exit(0));
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);

    watcher.refresh();
    startWorker();
}

module.exports = { runDev };
