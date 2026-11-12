// Runs for every request. The code after `next()` runs once the handler has answered.
export default async function (ctx, next) {
    const started = performance.now();
    const result = await next();
    ctx.header('X-Response-Time', `${Math.round(performance.now() - started)}ms`);
    return result;
}
