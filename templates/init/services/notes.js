export default ({ db }) => {
    // SQLite has no true/false, so `done` is stored as 1 or 0.
    const toNote = (row) => row && { ...row, done: Boolean(row.done) };

    const find = (id) => toNote(db.get('SELECT * FROM notes WHERE id = ?', id));

    return {
        all() {
            return db.all('SELECT * FROM notes ORDER BY id DESC').map(toNote);
        },

        find,

        create({ title }) {
            return toNote(db.get('INSERT INTO notes (title) VALUES (?) RETURNING *', title));
        },

        update(id, { title, done }) {
            const note = find(id);
            if (!note) return undefined;
            return toNote(
                db.get(
                    'UPDATE notes SET title = ?, done = ? WHERE id = ? RETURNING *',
                    title ?? note.title,
                    done ?? note.done,
                    id,
                ),
            );
        },

        remove(id) {
            return db.run('DELETE FROM notes WHERE id = ?', id).changes > 0;
        },

        stats() {
            return db.get('SELECT COUNT(*) AS notes, COALESCE(SUM(done), 0) AS done FROM notes');
        },
    };
};
