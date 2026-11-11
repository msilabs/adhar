'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdharError, suggest } = require('./errors.js');
const { loadModule } = require('./load.js');

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const EXAMPLE = 'export default ({ db }) => ({ all() { return db.all("SELECT ..."); } })';

// Properties that tools read on any object (await, JSON.stringify, console.log); they must not throw.
const PASS_THROUGH = ['then', 'toJSON', 'constructor', 'toString', 'valueOf', 'inspect'];

function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// `services` and each folder inside it is a namespace. Reading a name that does not exist throws
// with a suggestion, instead of giving `undefined` and a confusing error one line later.
function createNamespace(dir, state) {
    const target = {};
    const proxy = new Proxy(target, {
        get(_, name) {
            if (typeof name === 'symbol' || PASS_THROUGH.includes(name)) return target[name];

            if (!state.ready) {
                throw new AdharError({
                    file: state.loading,
                    message: `\`${name}\` was read from \`services\` while the services were still being created.`,
                    hint: 'Use `services` inside a method of the returned object, not at the top of the factory.',
                });
            }
            if (Object.hasOwn(target, name)) return target[name];

            const close = suggest(name, Object.keys(target));
            throw new Error(
                `No service \`${name}\` in ${dir}/. ` +
                    (close ? `Did you mean \`${close}\`?` : `Create it at ${dir}/${name}.js.`),
            );
        },
    });
    return { target, proxy };
}

function checkName(name, file) {
    if (IDENTIFIER.test(name)) return;
    throw new AdharError({
        file,
        message: `Invalid service name \`${name}\`.`,
        hint: 'The name becomes `ctx.services.<name>`, so use letters and numbers only, like `blogPosts`.',
    });
}

function createService(root, file, state, input) {
    const exported = loadModule(root, file);

    for (const key of Object.keys(exported)) {
        if (key === 'default' || key === '__esModule') continue;
        throw new AdharError({
            file,
            message: `Unknown export \`${key}\`.`,
            hint: `A service file has a single export, like \`${EXAMPLE}\`. Put \`${key}\` inside the returned object.`,
        });
    }
    if (typeof exported.default !== 'function') {
        throw new AdharError({
            file,
            message: 'A service file must export one default function.',
            hint: `Write it as \`${EXAMPLE}\`.`,
        });
    }

    let service;
    state.loading = file;
    try {
        service = exported.default(input);
    } catch (err) {
        if (err instanceof AdharError) throw err;
        throw new AdharError({ file, message: `The service could not be created: ${err?.message ?? err}` });
    }

    if (!isPlainObject(service) || typeof service.then === 'function') {
        throw new AdharError({
            file,
            message: 'The default function must return an object with the service\'s functions.',
            hint:
                service && typeof service.then === 'function'
                    ? 'The function cannot be `async`. Do the waiting inside the service\'s own functions.'
                    : `Write it as \`${EXAMPLE}\`.`,
        });
    }
    return service;
}

function loadFolder(root, dir, state, input) {
    const namespace = createNamespace(dir, state);
    const entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
        const file = `${dir}/${entry.name}`;
        let name;
        let value;

        if (entry.isDirectory()) {
            if (entry.name.startsWith('.')) continue;
            name = entry.name;
            checkName(name, file);
            value = loadFolder(root, file, state, input);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            name = entry.name.slice(0, -'.js'.length);
            checkName(name, file);
            value = createService(root, file, state, input);
        } else {
            continue;
        }

        if (Object.hasOwn(namespace.target, name)) {
            throw new AdharError({
                file,
                message: `Both ${dir}/${name}.js and the folder ${dir}/${name}/ want the name \`${name}\`.`,
                hint: 'Rename one of them.',
            });
        }
        namespace.target[name] = value;
    }

    Object.freeze(namespace.target);
    return namespace.proxy;
}

// Builds `ctx.services` from the services/ folder: services/blog/posts.js becomes services.blog.posts.
// Every factory runs once and receives { db, env, services }.
function loadServices(root, { db, env } = {}) {
    const state = { ready: false, loading: undefined };

    if (!fs.existsSync(path.join(root, 'services'))) {
        state.ready = true;
        return createNamespace('services', state).proxy;
    }

    // Factories get a stand-in, because the real tree only exists once all of them have run.
    let services;
    const standIn = new Proxy({}, { get: (_, name) => services[name] });
    const early = createNamespace('services', state).proxy;
    services = early;

    const loaded = loadFolder(root, 'services', state, { db, env, services: standIn });
    services = loaded;
    state.ready = true;
    return loaded;
}

module.exports = { loadServices };
