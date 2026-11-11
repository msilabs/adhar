'use strict';

const path = require('node:path');
const { AdharError } = require('./errors.js');

// Loads one of the user's files. `file` is relative to the project root, with forward slashes.
// User files are ES modules; `require()` loads them synchronously on Node 22.13+.
function loadModule(root, file) {
    try {
        return require(path.join(root, file));
    } catch (err) {
        if (err instanceof AdharError) throw err;
        if (err?.code === 'ERR_REQUIRE_ASYNC_MODULE') {
            throw new AdharError({
                file,
                message: 'This file uses top-level `await`, which Adhar cannot load.',
                hint: 'Move the `await` inside a function.',
            });
        }
        throw new AdharError({
            file,
            message: `Could not load this file: ${err?.message ?? err}`,
            // Node does not say where a syntax error in an ES module is; `node --check` does.
            hint: err instanceof SyntaxError ? `Run \`node --check ${file}\` to see the exact line.` : undefined,
        });
    }
}

module.exports = { loadModule };
