export const schema = {
    POST: { body: { title: 'string' } },
};

export function GET(ctx) {
    return ctx.services.notes.all();
}

export function POST(ctx) {
    ctx.status(201);
    return ctx.services.notes.create(ctx.body);
}
