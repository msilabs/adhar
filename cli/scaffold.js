'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { AdharError, suggest } = require('../core/errors.js');
const { listMigrations } = require('../core/migrations.js');
const { assertProject } = require('../core/router.js');
const log = require('./log.js');
const { version } = require('../package.json');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates', 'init');
// A folder holding only these still counts as empty, so `git init` before `adhar init` is fine.
const IGNORABLE = new Set(['.git', '.DS_Store', 'Thumbs.db']);

// The project is `"type": "module"`, so this extension-less file is an ES module too.
const ROOT_SCRIPT = `#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
try {
    require('@msilabs/adhar/cli');
} catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && String(e.message).includes('@msilabs/adhar')) {
        console.error('Adhar is not installed. Run \`npm install\` first.');
        process.exit(1);
    }
    throw e;
}
`;

// These are written from here because npm leaves dot-files like .gitignore out of a published package.
const GITIGNORE = 'node_modules/\nstorage/\n.env\n';
const ENV_EXAMPLE = `# Copy this file to .env and change the values.
PORT=3000

# The token for the routes inside routes/(admin)/.
ADMIN_TOKEN=change-me

# Websites that may call this API from a browser, separated by commas.
# CORS_ORIGIN=http://localhost:5173
`;

function packageName(folder) {
    const name = path
        .basename(folder)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return name || 'my-api';
}

function packageJson(name) {
    const data = {
        name,
        private: true,
        type: 'module',
        engines: { node: '>=22.13' },
        scripts: { dev: 'adhar dev', start: 'adhar start', migrate: 'adhar migrate' },
        dependencies: { '@msilabs/adhar': `^${version}` },
    };
    return JSON.stringify(data, null, 4) + '\n';
}

function writeNew(file, contents) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
}

function init(cwd, folder = '.') {
    const target = path.resolve(cwd, folder);
    if (fs.existsSync(target)) {
        if (!fs.statSync(target).isDirectory()) {
            throw new AdharError({
                message: `\`${folder}\` is a file, not a folder.`,
                hint: 'Choose another name for the new project.',
            });
        }
        const contents = fs.readdirSync(target).filter((name) => !IGNORABLE.has(name));
        if (contents.length > 0) {
            throw new AdharError({
                message: `The folder \`${folder}\` is not empty, so no project was created.`,
                hint: 'Use a new name, e.g. `npx @msilabs/adhar init my-api`, or run it in an empty folder.',
            });
        }
    }

    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(TEMPLATE_DIR, target, { recursive: true });
    writeNew(path.join(target, 'adhar'), ROOT_SCRIPT);
    fs.chmodSync(path.join(target, 'adhar'), 0o755);
    writeNew(path.join(target, 'package.json'), packageJson(packageName(target)));
    writeNew(path.join(target, '.gitignore'), GITIGNORE);
    writeNew(path.join(target, '.env.example'), ENV_EXAMPLE);
    writeNew(path.join(target, '.env'), ENV_EXAMPLE.split('\n').slice(1).join('\n'));

    const relative = path.relative(cwd, target);
    const steps = [];
    if (relative) steps.push(`cd ${relative.includes(' ') ? JSON.stringify(relative) : relative}`);
    steps.push('npm install', 'node adhar dev');
    log.success(`Created a new Adhar project: ${relative || '.'}`);
    log.info(`\nNext steps:\n${steps.map((step) => '  ' + step).join('\n')}\n`);
}

// ---------------------------------------------------------------- adhar new

const PLAIN = /^[a-z0-9-]+$/;
const GROUP = /^\([a-z0-9-]+\)$/;
const PARAM = /^\[([A-Za-z_$][\w$]*)\]$/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const KINDS = ['route', 'middleware', 'service', 'migration'];

const USAGE = {
    route: '`adhar new route users` or `adhar new route "users/[id]"`',
    middleware: '`adhar new middleware users` or `adhar new middleware "(admin)"`',
    service: '`adhar new service users` or `adhar new service blog/posts`',
    migration: '`adhar new migration create-posts`',
};

function splitName(name) {
    return String(name)
        .replace(/\\/g, '/')
        .split('/')
        .filter((part) => part !== '' && part !== '.');
}

function checkRouteFolders(segments) {
    for (const segment of segments) {
        if (PLAIN.test(segment) || GROUP.test(segment) || PARAM.test(segment)) continue;
        throw new AdharError({
            message: `Folder name \`${segment}\` is not allowed.`,
            hint: 'Use lower-case letters, numbers and `-` for a fixed part, `[id]` for a dynamic part, `(name)` for a group.',
        });
    }
}

function urlOf(segments) {
    const visible = segments.filter((segment) => !GROUP.test(segment));
    return '/' + visible.map((segment) => segment.replace(PARAM, ':$1')).join('/');
}

function routeTemplate(segments) {
    const params = segments.filter((segment) => PARAM.test(segment)).map((segment) => segment.match(PARAM)[1]);
    const body =
        params.length > 0
            ? `return { ${params.map((name) => `${name}: ctx.params.${name}`).join(', ')} };`
            : `return { message: 'Hello from ${urlOf(segments)}' };`;
    return `export function GET(ctx) {\n    ${body}\n}\n`;
}

const MIDDLEWARE_TEMPLATE = `export default function (ctx, next) {
    return next();
}
`;

const SERVICE_TEMPLATE = `export default ({ db }) => ({
    all() {
        return [];
    },
});
`;

function nextMigrationNumber(root) {
    const numbers = listMigrations(root).map((name) => Number(name.slice(0, 3)));
    const next = Math.max(0, ...numbers) + 1;
    if (next > 999) {
        throw new AdharError({ message: 'There are already 999 migrations.', hint: 'Migration numbers have three digits.' });
    }
    return String(next).padStart(3, '0');
}

// Returns { file, contents, note } for one `adhar new` request.
function plan(kind, name, root) {
    const segments = splitName(name);

    if (kind === 'route') {
        checkRouteFolders(segments);
        return {
            file: ['routes', ...segments, 'route.js'].join('/'),
            contents: routeTemplate(segments),
            note: `URL: ${urlOf(segments)}`,
        };
    }

    if (kind === 'middleware') {
        checkRouteFolders(segments);
        const url = urlOf(segments);
        return {
            file: ['routes', ...segments, 'middleware.js'].join('/'),
            contents: MIDDLEWARE_TEMPLATE,
            note: url === '/' && segments.length === 0 ? 'Runs for every request' : `Runs for every route in routes/${segments.join('/')}/`,
        };
    }

    if (kind === 'service') {
        for (const part of segments) {
            if (IDENTIFIER.test(part)) continue;
            const fixed = part.replace(/[-_ ]+([a-zA-Z0-9])/g, (_, ch) => ch.toUpperCase());
            throw new AdharError({
                message: `Service name \`${part}\` is not allowed.`,
                hint: IDENTIFIER.test(fixed)
                    ? `The name becomes \`ctx.services.<name>\`, so write it as \`${fixed}\`.`
                    : 'The name becomes `ctx.services.<name>`, so use letters and numbers only, like `blogPosts`.',
            });
        }
        return {
            file: ['services', ...segments].join('/') + '.js',
            contents: SERVICE_TEMPLATE,
            note: `Use it as ctx.services.${segments.join('.')}`,
        };
    }

    // migration
    if (segments.length !== 1 || !PLAIN.test(segments[0])) {
        throw new AdharError({
            message: `Migration name \`${name}\` is not allowed.`,
            hint: 'Use lower-case letters, numbers and `-`, e.g. `create-posts`. The number is added for you.',
        });
    }
    return {
        file: `migrations/${nextMigrationNumber(root)}-${segments[0]}.sql`,
        contents: '-- Write the SQL for this change here, for example:\n-- CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL);\n',
        note: 'Runs on the next `node adhar dev`, or with `node adhar migrate`',
    };
}

function create(cwd, args) {
    const [kind, name] = args;
    if (!kind) {
        throw new AdharError({ message: 'Tell Adhar what to create.', hint: KINDS.map((k) => USAGE[k]).join('\n') });
    }
    if (!KINDS.includes(kind)) {
        const close = suggest(kind, KINDS);
        throw new AdharError({
            message: `There is no \`adhar new ${kind}\`.`,
            hint:
                (close ? `Did you mean \`adhar new ${close}\`?\n` : '') +
                `You can create: ${KINDS.map((k) => `\`${k}\``).join(', ')}.`,
        });
    }
    // `adhar new route .` and `adhar new middleware .` mean the top of routes/; the others need a real name.
    const atTop = kind === 'route' || kind === 'middleware';
    if (name === undefined || (!atTop && splitName(name).length === 0)) {
        throw new AdharError({ message: `\`adhar new ${kind}\` needs a name.`, hint: `For example: ${USAGE[kind]}` });
    }
    assertProject(cwd);

    const { file, contents, note } = plan(kind, name, cwd);
    const target = path.join(cwd, ...file.split('/'));

    if (fs.existsSync(target)) {
        throw new AdharError({
            message: `\`${file}\` already exists, so nothing was created.`,
            hint: 'Choose another name, or open the file and edit it.',
        });
    }
    writeNew(target, contents);
    log.success(`Created ${file}`);
    log.dim(`  ${note}`);
}

module.exports = { init, create, plan, packageName };
