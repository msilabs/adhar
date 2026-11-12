'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');
const { AdharError } = require('../core/errors.js');
const { assertProject } = require('../core/router.js');
const { assertNoApiClash, hasWeb } = require('../core/web.js');
const log = require('./log.js');

const MIN_ALO = [1, 1, 0];
const ALO_RUNNER = path.join(__dirname, 'alo-runner.js');

function isOlder(version, minimum) {
    const parts = version.split('-')[0].split('.').map(Number);
    for (let i = 0; i < minimum.length; i++) {
        if ((parts[i] ?? 0) !== minimum[i]) return (parts[i] ?? 0) < minimum[i];
    }
    return false;
}

// Looks for Alo in node_modules, from the project upwards. Alo's package only exports `./cli`,
// so its bin file cannot be found with require.resolve.
function findAlo(root) {
    let dir = root;
    for (;;) {
        const home = path.join(dir, 'node_modules', '@msilabs', 'alo');
        const bin = path.join(home, 'bin', 'alo.js');
        if (fs.existsSync(bin)) {
            const { version } = JSON.parse(fs.readFileSync(path.join(home, 'package.json'), 'utf8'));
            return { bin, version };
        }
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
    }
}

function requireAlo(root, env = process.env) {
    const alo = findAlo(root);
    if (!alo) {
        throw new AdharError({
            message: '`web/` needs Alo, and it is not installed.',
            hint:
                'Run `npm i -D @msilabs/alo`.' +
                (env.NODE_ENV === 'production'
                    ? '\nAlo is a dev dependency: the build step needs `npm install` without `--omit=dev`.'
                    : ''),
        });
    }
    if (isOlder(alo.version, MIN_ALO)) {
        throw new AdharError({
            message: `Alo ${alo.version} is too old for a full stack project.`,
            hint: `Adhar needs Alo ${MIN_ALO.join('.')} or newer. Run \`npm i -D @msilabs/alo@latest\`.`,
        });
    }
    return alo;
}

function assertFullStack(root, message) {
    assertProject(root);
    if (hasWeb(root)) return;
    throw new AdharError({
        message,
        hint: 'A full stack project has a `web/pages/` folder. Start one with `npx @msilabs/adhar init my-app --web`.',
    });
}

// Runs one Alo command inside web/ and waits for it. Returns Alo's exit code.
function runAlo(root, args) {
    const alo = requireAlo(root);
    const result = spawnSync(process.execPath, [alo.bin, ...args], { cwd: path.join(root, 'web'), stdio: 'inherit' });
    if (result.error) throw result.error;
    return result.status === 0 ? 0 : 1;
}

function build(root) {
    assertFullStack(root, 'Nothing to build: no `web/` folder.');
    assertNoApiClash(root);
    return runAlo(root, ['build']);
}

const INSTEAD = {
    dev: 'Use `node adhar dev`: it runs the API and the site on one port.',
    build: 'Use `node adhar build`.',
    init: 'Use `npx @msilabs/adhar init my-app --web` for a new full stack project.',
};

// `adhar web new ...` is Alo's `new`, run inside web/. Nothing else of Alo is passed through.
function web(root, args) {
    const [command, ...rest] = args;
    if (command !== 'new') {
        throw new AdharError({
            message: command ? `There is no \`adhar web ${command}\`.` : 'Tell Adhar what to do in `web/`.',
            hint: INSTEAD[command] ?? 'Only `new` works here, e.g. `node adhar web new component Card` or `node adhar web new page about`.',
        });
    }
    assertFullStack(root, '`adhar web` needs a `web/` folder.');
    return runAlo(root, ['new', ...rest]);
}

const HIDDEN_LINES = [/^Alo dev server running at /, /^Press Ctrl\+C to stop$/];

// Passes Alo's output on, minus the lines that name its own port: the browser should only know Adhar's.
function createLineFilter(write) {
    let rest = '';
    let heldBlank = false;
    let afterHidden = false;

    function line(text) {
        if (HIDDEN_LINES.some((pattern) => pattern.test(text))) {
            heldBlank = false;
            afterHidden = true;
            return;
        }
        if (text === '') {
            if (!afterHidden) heldBlank = true;
            afterHidden = false;
            return;
        }
        if (heldBlank) write('\n');
        heldBlank = false;
        afterHidden = false;
        write(text + '\n');
    }

    return (chunk) => {
        const lines = (rest + chunk).split(/\r?\n/);
        rest = lines.pop();
        for (const text of lines) line(text);
    };
}

// Starts Alo's dev server inside web/ for `adhar dev`. Returns the child process.
function startAloDev(root, port) {
    const alo = requireAlo(root);
    const child = fork(ALO_RUNNER, [alo.bin, 'dev', '--port', String(port)], {
        cwd: path.join(root, 'web'),
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout.setEncoding('utf8').on('data', createLineFilter((text) => process.stdout.write(text)));
    child.stderr.setEncoding('utf8').on('data', (text) => process.stderr.write(text));
    child.on('error', (err) => log.warn({ message: `Could not start Alo: ${err.message}` }));
    return child;
}

module.exports = { findAlo, requireAlo, build, web, startAloDev, createLineFilter };
