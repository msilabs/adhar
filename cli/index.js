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

const COMMANDS = ['init', 'dev', 'build', 'start', 'routes', 'migrate', 'new', 'web'];
const PORT_COMMANDS = ['dev', 'start'];

const HELP = `Adhar — a lightweight backend API framework (v${version})

Usage:
  adhar init [folder] [--web]        create a new project (--web adds an Alo site in web/)
  adhar dev [--port 8134]            dev server, restarts on change
  adhar build                        build the site in web/ into web/dist/
  adhar start [--port 8134]          production server
  adhar routes                       list all routes
  adhar migrate                      run pending migrations
  adhar new route "users/[id]"       api/users/[id]/route.js
  adhar new middleware "(admin)"     api/(admin)/middleware.js
  adhar new service blog/posts       services/blog/posts.js
  adhar new migration create-posts   migrations/<next number>-create-posts.sql
  adhar web new component Card       web/components/Card.alo (Alo's \`new\`, inside web/)
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
        if (arg === '--web') {
            flags.web = true;
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
            const close = suggest(name, ['port', 'web', 'help', 'version']);
            throw new AdharError({
                message: `Unknown flag \`${arg}\`.`,
                hint: close
                    ? `Did you mean \`--${close}\`?`
                    : 'Adhar only has `--port` and `--web`. Run `adhar --help` for everything.',
            });
        }

        if (value === undefined) {
            value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new AdharError({
                    message: '`--port` needs a value.',
                    hint: 'For example: `--port 8134`',
                });
            }
            i++;
        }
        flags.port = value;
    }

    return { positionals, flags };
}

function validateFlags(command, flags) {
    if (flags.web && command !== 'init') {
        throw new AdharError({
            message: `\`--web\` does not work with \`adhar ${command}\`.`,
            hint: '`--web` only works with `adhar init`, e.g. `adhar init my-app --web`.',
        });
    }
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
            hint: 'Use a whole number from 1 to 65535, e.g. `--port 8134`.',
        });
    }
    flags.port = port;
}

async function runCommand(command, args, flags) {
    const root = process.cwd();

    if (command === 'init') {
        require('./scaffold.js').init(root, args[0], { web: Boolean(flags.web) });
    } else if (command === 'new') {
        require('./scaffold.js').create(root, args);
    } else if (command === 'build') {
        process.exitCode = require('./web.js').build(root);
    } else if (command === 'web') {
        process.exitCode = require('./web.js').web(root, args);
    } else if (command === 'routes') {
        require('./routes.js').listRoutes(root);
    } else if (command === 'migrate') {
        const { loadEnv } = require('../core/env.js');
        require('./migrate.js').migrate(root, loadEnv(root, process.env));
    } else if (command === 'dev') {
        await require('./dev.js').runDev({ root, port: flags.port });
    } else {
        await require('./serve.js').run({ root, port: flags.port, dev: false });
    }
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
