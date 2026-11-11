'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { AdharError } = require('./errors.js');

// Reads the project's .env file. Variables that are already set in the real environment win,
// so a host's settings are never overridden by a file that was deployed by accident.
function loadEnv(root, processEnv = {}) {
    const file = path.join(root, '.env');
    const fromFile = fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {};
    return { ...fromFile, ...processEnv };
}

// `--port` wins over PORT, and PORT over 3000.
function resolvePort(flag, env) {
    if (flag !== undefined) return flag;
    if (env.PORT === undefined || env.PORT === '') return 3000;

    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AdharError({
            message: `Invalid PORT value \`${env.PORT}\`.`,
            hint: 'Use a whole number from 1 to 65535, e.g. `PORT=3000` in `.env`.',
        });
    }
    return port;
}

module.exports = { loadEnv, resolvePort };
