'use strict';

// Must run before anything else is required, using syntax old Node versions can parse.
var MIN_NODE = [22, 13];
var nodeParts = process.versions.node.split('.').map(Number);
if (nodeParts[0] < MIN_NODE[0] || (nodeParts[0] === MIN_NODE[0] && nodeParts[1] < MIN_NODE[1])) {
    process.stderr.write(
        '✖ Error: Adhar needs Node.js ' + MIN_NODE.join('.') + ' or newer. ' +
            'You have v' + process.versions.node + '.\n\n' +
            '  Hint: install a current LTS version from https://nodejs.org\n',
    );
    process.exit(1);
}

const { AdharError, suggest } = require('../core/errors.js');
const log = require('./log.js');
const { version } = require('../package.json');

const COMMANDS = ['init', 'dev', 'start', 'routes', 'migrate', 'new'];
const PORT_COMMANDS = ['dev', 'start'];

const HELP = `Adhar — a lightweight backend API framework (v${version})

Usage:
  adhar init [folder]                create a new project
  adhar dev [--port 3000]            dev server, restarts on change
  adhar start [--port 3000]          production server
  adhar routes                       list all routes
  adhar migrate                      run pending migrations
  adhar new route users/[id]         routes/users/[id]/route.js
  adhar new middleware (admin)       routes/(admin)/middleware.js
  adhar new service blog/posts       services/blog/posts.js
  adhar new migration create-posts   migrations/<next number>-create-posts.sql
  adhar --help                       show this help
  adhar --version                    show the version

Inside a project, run: node adhar <command>`;

function parseArgs(argv) {
    const positionals = [];
    const flags = {};

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--help') {
            flags.help = true;
            continue;
        }
        if (arg === '--version') {
            flags.version = true;
            continue;
        }
        if (!arg.startsWith('-')) {
            positionals.push(arg);
            continue;
        }

        let name = arg.replace(/^-+/, '');
        let value;
        const equals = name.indexOf('=');
        if (equals !== -1) {
            value = name.slice(equals + 1);
            name = name.slice(0, equals);
        }

        if (name !== 'port') {
            const close = suggest(name, ['port', 'help', 'version']);
            throw new AdharError({
                message: `Unknown flag \`${arg}\`.`,
                hint: close
                    ? `Did you mean \`--${close}\`?`
                    : 'Adhar only has `--port`. Run `adhar --help` for everything.',
            });
        }

        if (value === undefined) {
            value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new AdharError({
                    message: '`--port` needs a value.',
                    hint: 'For example: `--port 3000`',
                });
            }
            i++;
        }
        flags.port = value;
    }

    return { positionals, flags };
}

function validateFlags(command, flags) {
    if (flags.port === undefined) return;

    if (!PORT_COMMANDS.includes(command)) {
        throw new AdharError({
            message: `\`--port\` does not work with \`adhar ${command}\`.`,
            hint: '`--port` only works with `adhar dev` and `adhar start`.',
        });
    }

    const port = Number(flags.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new AdharError({
            message: `Invalid \`--port\` value \`${flags.port}\`.`,
            hint: 'Use a whole number from 1 to 65535, e.g. `--port 3000`.',
        });
    }
    flags.port = port;
}

async function runCommand(command, args, flags) {
    if (command === 'routes') {
        require('./routes.js').listRoutes(process.cwd());
        return;
    }
    if (command === 'migrate') {
        const { loadEnv } = require('../core/env.js');
        require('./migrate.js').migrate(process.cwd(), loadEnv(process.cwd(), process.env));
        return;
    }
    if (command === 'dev') {
        require('./dev.js').runDev({ root: process.cwd(), port: flags.port });
        return;
    }
    if (command === 'start') {
        await require('./serve.js').run({ root: process.cwd(), port: flags.port, dev: false });
        return;
    }
    throw new AdharError({
        message: `\`adhar ${command}\` is not built yet.`,
        hint: 'Adhar is still under construction. See docs/SPEC.md for the plan.',
    });
}

async function main(argv) {
    const { positionals, flags } = parseArgs(argv);

    if (flags.version) {
        log.info(version);
        return;
    }

    const [command] = positionals;
    if (flags.help || command === undefined) {
        log.info(HELP);
        return;
    }

    if (!COMMANDS.includes(command)) {
        const close = suggest(command, COMMANDS);
        throw new AdharError({
            message: `Unknown command \`${command}\`.`,
            hint: close
                ? `Did you mean \`adhar ${close}\`? Run \`adhar --help\` for all commands.`
                : 'Run `adhar --help` for all commands.',
        });
    }

    validateFlags(command, flags);
    await runCommand(command, positionals.slice(1), flags);
}

main(process.argv.slice(2)).catch((err) => {
    if (err instanceof AdharError) {
        log.error(err);
    } else {
        log.bug(err);
    }
    process.exitCode = 1;
});
