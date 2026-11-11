export const schema = {
    GET: { params: { id: 'integer' } },
    PATCH: { params: { id: 'integer' }, body: { title: 'string?', done: 'boolean?' } },
    DELETE: { params: { id: 'integer' } },
};

export function GET(ctx) {
    const note = ctx.services.notes.find(ctx.params.id);
    if (!note) throw ctx.error(404, 'Note not found');
    return note;
}

export function PATCH(ctx) {
    const note = ctx.services.notes.update(ctx.params.id, ctx.body);
    if (!note) throw ctx.error(404, 'Note not found');
    return note;
}

export function DELETE(ctx) {
    const removed = ctx.services.notes.remove(ctx.params.id);
    if (!removed) throw ctx.error(404, 'Note not found');
}
