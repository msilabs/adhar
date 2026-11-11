'use strict';

const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const BIN = path.join(__dirname, '..', '..', 'bin', 'adhar.js');

// Asks the OS for a port that is free right now.
function freePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

// Starts `adhar <args>` as a long-running process. The process is killed when the test ends.
function startAdhar(t, cwd, args, env = {}) {
    const child = spawn(process.execPath, [BIN, ...args], {
        cwd,
        env: { ...process.env, NO_COLOR: '1', DATABASE_PATH: '', PORT: '', CORS_ORIGIN: '', NODE_ENV: '', ...env },
    });

    let output = '';
    const waiters = [];
    const check = () => {
        for (const waiter of [...waiters]) {
            if (!waiter.pattern.test(output)) continue;
            waiters.splice(waiters.indexOf(waiter), 1);
            waiter.resolve(output);
        }
    };
    const collect = (chunk) => {
        output += chunk;
        check();
    };
    child.stdout.setEncoding('utf8').on('data', collect);
    child.stderr.setEncoding('utf8').on('data', collect);

    const exited = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })));
    exited.then(() => {
        for (const waiter of waiters.splice(0)) {
            waiter.reject(new Error(`adhar exited before printing ${waiter.pattern}. Output:\n${output}`));
        }
    });

    t.after(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
        return exited;
    });

    return {
        child,
        exited,
        output: () => output,
        // Resolves once the combined stdout and stderr match the pattern.
        waitFor(pattern, timeout = 15_000) {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(
                    () => reject(new Error(`Timed out waiting for ${pattern}. Output:\n${output}`)),
                    timeout,
                );
                waiters.push({
                    pattern,
                    resolve: (value) => {
                        clearTimeout(timer);
                        resolve(value);
                    },
                    reject: (err) => {
                        clearTimeout(timer);
                        reject(err);
                    },
                });
                check();
            });
        },
    };
}

module.exports = { BIN, freePort, startAdhar };
