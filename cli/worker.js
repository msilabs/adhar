'use strict';

// The process that `adhar dev` starts, and starts again after every change.
const { AdharError } = require('../core/errors.js');
const log = require('./log.js');
const { run } = require('./serve.js');

const port = process.argv[2] === undefined ? undefined : Number(process.argv[2]);
const webPort = process.env.ADHAR_WEB_PORT ? Number(process.env.ADHAR_WEB_PORT) : undefined;

// If the watching process dies without a goodbye (a crash, a closed terminal), do not live on alone.
process.on('disconnect', () => process.exit(0));

run({ root: process.cwd(), port, dev: true, webPort }).catch((err) => {
    if (err instanceof AdharError) {
        log.error(err);
    } else {
        log.bug(err);
    }
    process.exit(1);
});
