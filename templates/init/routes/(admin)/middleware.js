// Protects every route in this folder. Send the token as `Authorization: Bearer <ADMIN_TOKEN>`.
export default function (ctx, next) {
    if (ctx.headers.authorization !== `Bearer ${ctx.env.ADMIN_TOKEN}`) {
        throw ctx.error(401, 'Login required');
    }
    return next();
}
