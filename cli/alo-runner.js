'use strict';

// Runs Alo for `adhar dev`: `node alo-runner.js <path to alo's bin> dev --port <N>`.
// Alo itself does not notice when `adhar dev` dies without a goodbye (a crash, a closed terminal),
// so this wrapper watches the channel to the parent and takes Alo down with it.
process.on('disconnect', () => process.exit(0));

const [bin, ...args] = process.argv.slice(2);
process.argv = [process.argv[0], bin, ...args];
require(bin);
