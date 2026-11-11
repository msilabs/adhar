'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdharError, HttpError, suggest } = require('./errors.js');
const { loadModule } = require('./load.js');
const { compileSchema } = require('./validate.js');

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const ROUTE_EXPORTS = [...METHODS, 'schema'];

const STATIC_NAME = /^[a-z0-9-]+$/;
const GROUP_NAME = /^\([a-z0-9-]+\)$/;
const PARAM_NAME = /^\[([A-Za-z_$][\w$]*)\]$/;

function parseFolder(name, file) {
    if (STATIC_NAME.test(name)) return { type: 'static', value: name };
    if (GROUP_NAME.test(name)) return { type: 'group' };

    const param = name.match(PARAM_NAME);
    if (param) return { type: 'param', name: param[1] };

    throw new AdharError({
        file,
        message: `Invalid folder name \`${name}\`.`,
        hint: name.startsWith('[...')
            ? 'Catch-all folders like `[...path]` are not supported. A `[name]` folder matches one part of the URL.'
            : 'Use lower-case letters, numbers and `-` for a fixed part, `[id]` for a dynamic part, `(name)` for a group.',
    });
}

// Walks routes/ and lists every route.js with the URL segments its folders stand for.
function scanFolder(root, dir, segments, found) {
    const entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

    for (const entry of entries) {
        const file = `${dir}/${entry.name}`;

        if (entry.isDirectory()) {
            if (entry.name.startsWith('.')) continue;
            const segment = parseFolder(entry.name, file);
            scanFolder(root, file, segment.type === 'group' ? segments : [...segments, segment], found);
            continue;
        }

        if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

        if (entry.name === 'route.js') {
            found.routes.push({ file, dir, segments });
        } else if (entry.name === 'middleware.js') {
            found.middleware.set(dir, file);
        } else if (entry.name === 'not-found.js') {
            if (dir !== 'routes') {
                throw new AdharError({
                    file,
                    message: '`not-found.js` only works directly inside `routes/`.',
                    hint: 'Move it to `routes/not-found.js`.',
                });
            }
            found.notFound = file;
        } else {
            throw new AdharError({
                file,
                message: `Unexpected file \`${entry.name}\` inside \`routes/\`.`,
                hint: 'Only `route.js`, `middleware.js` and `not-found.js` belong here. Put shared code in `services/`.',
            });
        }
    }
}

function toPattern(segments) {
    return '/' + segments.map((segment) => (segment.type === 'param' ? ':' + segment.name : segment.value)).join('/');
}

function readHandlers(root, file) {
    const exported = loadModule(root, file);
    const handlers = {};

    for (const name of Object.keys(exported)) {
        if (name === '__esModule') continue;

        if (!ROUTE_EXPORTS.includes(name)) {
            const close = suggest(name, ROUTE_EXPORTS);
            let hint = 'A route file can export `GET`, `POST`, `PUT`, `PATCH`, `DELETE` and `schema`.';
            if (name === 'default') {
                hint = 'Export a named function per method, like `export function GET(ctx) { ... }`.';
            } else if (close && close !== 'schema') {
                hint = `Did you mean \`${close}\`? Method names are upper-case.`;
            } else if (close) {
                hint = `Did you mean \`${close}\`?`;
            }
            throw new AdharError({ file, message: `Unknown export \`${name}\`.`, hint });
        }

        if (name === 'schema') continue;

        if (typeof exported[name] !== 'function') {
            throw new AdharError({
                file,
                message: `\`${name}\` must be a function.`,
                hint: `Write it as \`export function ${name}(ctx) { ... }\`.`,
            });
        }
        handlers[name] = exported[name];
    }

    if (Object.keys(handlers).length === 0) {
        throw new AdharError({
            file,
            message: 'This route file exports no handlers.',
            hint: 'Add one, like `export function GET(ctx) { return { hello: "world" }; }`.',
        });
    }
    return { handlers, schema: exported.schema };
}

// For middleware.js and not-found.js: the file's only export is one default function.
function readDefaultFunction(root, file, example) {
    const exported = loadModule(root, file);
    const name = file.split('/').pop();

    for (const key of Object.keys(exported)) {
        if (key === 'default' || key === '__esModule') continue;
        throw new AdharError({
            file,
            message: `Unknown export \`${key}\`.`,
            hint: `\`${name}\` has a single export: \`${example}\`.`,
        });
    }
    if (typeof exported.default !== 'function') {
        throw new AdharError({
            file,
            message: `\`${name}\` must export one default function.`,
            hint: `Write it as \`${example}\`.`,
        });
    }
    return exported.default;
}

// The middleware of every folder from routes/ down to `dir`, outermost first.
function chainFor(dir, middleware) {
    const chain = [];
    const parts = dir.split('/');
    for (let depth = 1; depth <= parts.length; depth++) {
        const found = middleware.get(parts.slice(0, depth).join('/'));
        if (found) chain.push(found);
    }
    return chain;
}

function createNode() {
    return { fixed: new Map(), param: null, route: null };
}

function insert(tree, route) {
    let node = tree;
    const names = new Set();

    for (const segment of route.segments) {
        if (segment.type === 'static') {
            if (!node.fixed.has(segment.value)) node.fixed.set(segment.value, createNode());
            node = node.fixed.get(segment.value);
            continue;
        }

        if (names.has(segment.name)) {
            throw new AdharError({
                file: route.file,
                message: `The parameter \`${segment.name}\` appears twice in this path.`,
                hint: 'Rename one of the folders, for example `[postId]`.',
            });
        }
        names.add(segment.name);

        if (node.param && node.param.name !== segment.name) {
            throw new AdharError({
                file: route.file,
                message:
                    `The same dynamic part is named \`[${segment.name}]\` here ` +
                    `and \`[${node.param.name}]\` in ${node.param.file}.`,
                hint: 'Rename one folder so both use the same name.',
            });
        }
        node.param ??= { name: segment.name, file: route.file, node: createNode() };
        node = node.param.node;
    }

    if (node.route) {
        throw new AdharError({
            file: route.file,
            message: `Two route files answer \`${route.pattern}\`: this one and ${node.route.file}.`,
            hint: 'Keep one of them.',
        });
    }
    node.route = route;
}

// Fixed folders win over dynamic ones; if the fixed branch leads nowhere, the dynamic one is tried.
function matchNode(node, parts, index, params) {
    if (index === parts.length) return node.route ? { route: node.route, params } : null;

    const part = parts[index];
    const fixed = node.fixed.get(part);
    if (fixed) {
        const found = matchNode(fixed, parts, index + 1, params);
        if (found) return found;
    }
    if (node.param && part !== '') {
        return matchNode(node.param.node, parts, index + 1, { ...params, [node.param.name]: part });
    }
    return null;
}

function allowHeader(methods) {
    const allowed = [...methods];
    if (methods.includes('GET')) allowed.push('HEAD');
    allowed.push('OPTIONS');
    return allowed.join(', ');
}

function loadRoutes(root) {
    if (!fs.existsSync(path.join(root, 'routes'))) {
        throw new AdharError({
            message: `No \`routes/\` folder in ${root}.`,
            hint: 'Run this inside an Adhar project, or create one with `npx @msilabs/adhar init my-api`.',
        });
    }

    const found = { routes: [], middleware: new Map(), notFound: null };
    scanFolder(root, 'routes', [], found);
    const { routes } = found;

    const middleware = new Map();
    for (const [dir, file] of found.middleware) {
        const run = readDefaultFunction(root, file, 'export default function (ctx, next) { return next(); }');
        middleware.set(dir, { file, run });
    }

    const notFound = found.notFound
        ? readDefaultFunction(root, found.notFound, 'export default function (ctx) { return { error: "Not found" }; }')
        : null;

    const tree = createNode();
    for (const route of routes) {
        route.pattern = toPattern(route.segments);
        insert(tree, route);

        const { handlers, schema } = readHandlers(root, route.file);
        route.handlers = handlers;
        route.schema = schema;
        route.methods = METHODS.filter((method) => handlers[method]);
        route.allow = allowHeader(route.methods);
        route.checks = compileSchema(route);
        route.chain = chainFor(route.dir, middleware);
    }

    function match(urlPath) {
        let parts;
        try {
            parts = urlPath === '/' ? [] : urlPath.slice(1).split('/').map(decodeURIComponent);
        } catch {
            throw new HttpError(400, 'Invalid URL');
        }
        return matchNode(tree, parts, 0, {});
    }

    return { routes, match, rootChain: chainFor('routes', middleware), notFound };
}

module.exports = { METHODS, loadRoutes };
