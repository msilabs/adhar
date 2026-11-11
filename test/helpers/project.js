'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Writes a throwaway project to a temp folder and removes it when the test ends.
// `files` maps forward-slash paths to contents. Every project gets its own folder,
// so Node's module cache never mixes two tests.
function makeProject(t, files) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adhar-test-')));
    const all = { 'package.json': '{ "type": "module" }', ...files };

    for (const [file, content] of Object.entries(all)) {
        const target = path.join(root, ...file.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    }

    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return root;
}

module.exports = { makeProject };
