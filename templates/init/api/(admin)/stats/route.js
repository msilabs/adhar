export function GET(ctx) {
    return ctx.services.notes.stats();
}
