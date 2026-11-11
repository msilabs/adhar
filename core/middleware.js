'use strict';

// Runs the middleware from the outermost folder inwards, then `final` (the handler).
// `chain` is a list of { file, run }.
function runChain(chain, ctx, final) {
    if (chain.length === 0) return final(ctx);

    async function step(index) {
        if (index === chain.length) return final(ctx);

        const { file, run } = chain[index];
        let downstream;

        const next = () => {
            if (downstream) throw new Error(`next() was called twice in ${file}.`);
            downstream = step(index + 1);
            return downstream;
        };

        const result = await run(ctx, next);

        // `await next();` without a `return` should not throw the handler's answer away.
        if (result === undefined && downstream) return downstream;
        return result;
    }

    return step(0);
}

module.exports = { runChain };
