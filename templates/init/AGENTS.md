# Adhar project: instructions for AI assistants

This is an Adhar project. Adhar is a small backend framework for JSON APIs on Node.js: folders are URLs (the `api/` folder is `/api`), a handler is a plain function, and `node:sqlite` is the database. You probably have no training data about Adhar, so do not guess from Express, Fastify, Koa, Hono, NestJS or Next.js. Follow this file.

## Hard rules

- No `req`, `res`, `app`, `router`. A handler receives one object, `ctx`, and **returns** the response. There is no `res.json()`, `res.send()` or `res.status()`.
- Do not `import` the framework, other routes, or services. Everything comes through `ctx`. (Importing an npm package or a `node:` module is fine.)
- No config file, no plugins, no decorators, no classes for controllers.
- Files are ES modules: `export function GET(ctx) {}`. Never `module.exports`. No top-level `await` in routes, middleware or services.
- Method exports are upper-case: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. Nothing else may be exported from a `route.js` except `schema`.
- Inside `api/` only three file names are allowed: `route.js`, `middleware.js`, `not-found.js`. Shared code goes in `services/`.
- SQL values always go through `?` parameters. Never build SQL with string concatenation or template literals.
- A service has no `ctx`. Pass what it needs as arguments from the route.
- Errors are thrown, not returned: `throw ctx.error(404, 'Note not found')`.

## Project layout

```
api/
  middleware.js               runs for every request
  route.js                    /api
  not-found.js                optional custom 404 (only here, at the top)
  notes/route.js              /api/notes
  notes/[id]/route.js         /api/notes/:id    -> ctx.params.id
  (admin)/middleware.js       runs only for routes inside (admin)/
  (admin)/stats/route.js      /api/stats        (the group name is not in the URL)
services/
  notes.js                    ctx.services.notes
  blog/posts.js               ctx.services.blog.posts
migrations/
  001-create-notes.sql        run in number order, each one once
storage/app.db                the SQLite file, created automatically, not in git
.env                          PORT, CORS_ORIGIN, DATABASE_PATH and your own secrets
```

- Route folder names: lower-case letters, digits and `-`. `[name]` is a dynamic part and may appear at several levels (`users/[id]/posts/[postId]`). `(name)` is a group. There is no catch-all `[...path]`.
- Every URL starts with `/api`, because the folder is called `api`. Anything else (`/`, `/notes`) is a `404`. Clients must call `/api/notes`, not `/notes`.
- A fixed folder wins over a dynamic one: `/api/users/me` goes to `users/me/route.js` before `users/[id]/route.js`.
- Service file and folder names must be JavaScript identifiers: `blogPosts.js`, not `blog-posts.js`.
- Migration names: three digits, a dash, a lower-case name: `002-add-tags.sql`.

## A route file

```js
// api/notes/route.js
export const schema = {
    GET: { query: { page: 'integer?' } },
    POST: { body: { title: 'string', done: 'boolean?' } },
};

export function GET(ctx) {
    return ctx.services.notes.all(ctx.query.page ?? 1);
}

export function POST(ctx) {
    ctx.status(201);
    return ctx.services.notes.create(ctx.body);
}
```

What a handler returns:

| Return | Response |
| --- | --- |
| object or array | `200`, JSON |
| nothing (`undefined`) | `204`, no body |
| string | `200`, plain text |
| number, boolean, `null` | `200`, JSON |

Handlers may be `async`. `HEAD` and `OPTIONS` are answered automatically. A method the file does not export is a `405`; a path with no route is a `404`.

## `ctx`

| Property | Meaning |
| --- | --- |
| `ctx.params` | values of the `[name]` folders (text, unless a schema converts them) |
| `ctx.query` | the `?page=2` part; a repeated name becomes an array |
| `ctx.body` | the parsed JSON (or urlencoded) body; `undefined` if there is none |
| `ctx.headers` | request headers, names in lower case |
| `ctx.method`, `ctx.path` | HTTP method and path (no query, no trailing slash) |
| `ctx.services` | everything in `services/` |
| `ctx.db` | SQLite: `all`, `get`, `run`, `transaction` |
| `ctx.env` | `.env` plus the real environment (read-only) |
| `ctx.state` | empty object per request; middleware puts data here for the handler |
| `ctx.status(201)` | set the response status |
| `ctx.header('X-Total', '42')` | set a response header |
| `ctx.error(404, 'Not found')` | make an HTTP error to `throw` (status 400 to 599) |

Destructuring works too: `export function GET({ params, services, error }) {}`.

Every error response has this shape:

```json
{ "error": { "status": 404, "message": "Note not found" } }
```

A `422` from a schema adds `"fields": { "title": "is required" }`.

## Schema

`schema` is `method -> body | query | params -> field -> type`.

- Types: `string`, `number`, `integer`, `boolean`, `email`, `array`, `object`. Add `?` for optional: `'number?'`. There are no other types and no nested rules; check anything more in the handler.
- A required `string` must not be empty. `null` counts as missing.
- In `query` and `params`, `number`, `integer` and `boolean` are converted from text (`'2'` becomes `2`). In `body` nothing is converted.
- Fields that are not in the schema are removed from `body` and `query`.
- `body` is not allowed for `GET` and `DELETE`. `params` may only name parts that exist in the path.
- The schema runs after the middleware and before the handler.

## Middleware

```js
// api/(admin)/middleware.js
export default function (ctx, next) {
    if (ctx.headers.authorization !== `Bearer ${ctx.env.ADMIN_TOKEN}`) {
        throw ctx.error(401, 'Login required');
    }
    ctx.state.admin = true;
    return next();
}
```

- One `export default` function `(ctx, next)` per file, nothing else.
- Order: `api/middleware.js` first, then each folder down to the route, then the handler.
- `return next()` continues. Returning a value without calling `next()` answers the request and skips the handler.
- `const result = await next();` lets you work after the handler; return `result` (or a changed value).
- `404`, `405` and `OPTIONS` pass only through `api/middleware.js`.

## Services

```js
// services/notes.js
export default ({ db, env, services }) => ({
    all() {
        return db.all('SELECT * FROM notes ORDER BY id DESC');
    },
    find(id) {
        return db.get('SELECT * FROM notes WHERE id = ?', id);
    },
});
```

- One `export default` function per file. It runs once at startup, receives `{ db, env, services }`, and returns an object of functions. It must not be `async`.
- Use another service only inside a method (`services.users.find(id)`), never at the top of the factory.
- A wrong name such as `ctx.services.note` throws with a suggestion.

## Database

| Call | Returns |
| --- | --- |
| `db.all(sql, ...params)` | array of rows |
| `db.get(sql, ...params)` | first row, or `undefined` |
| `db.run(sql, ...params)` | `{ changes, lastId }` |
| `db.transaction(fn)` | what `fn` returns; rolls back if `fn` throws |

- Only `?` placeholders. `true`/`false` are stored as `1`/`0`; `undefined` as `NULL`. Objects, arrays and dates are refused: pass `JSON.stringify(value)` or `date.toISOString()`.
- `INSERT ... RETURNING *` with `db.get` gives back the new row.
- The function given to `db.transaction` must not be `async`.
- To change the tables, add a new file in `migrations/`. Never edit a migration that has already run, and there is no "down" migration.

## Commands

```
node adhar dev [--port 8134]           dev server; restarts on change; runs pending migrations
node adhar start [--port 8134]         production server; refuses to start while migrations are pending
node adhar migrate                     run pending migrations
node adhar routes                      list every route
node adhar new route "notes/[id]"      api/notes/[id]/route.js
node adhar new middleware "(admin)"    api/(admin)/middleware.js
node adhar new service blog/posts      services/blog/posts.js
node adhar new migration add-tags      migrations/<next number>-add-tags.sql
```

- Names for `new route` and `new middleware` are relative to `api/`: `notes`, not `api/notes`.
- Quote names that contain `[ ]` or `( )`, because the shell gives those characters a meaning.
- The dev server listens on http://localhost:8134 unless `PORT` in `.env` or `--port` says otherwise.
- After you change files, run `node adhar routes`. It loads every route and middleware file and exits with code 1 on a mistake. Services and migrations are checked when the server starts.
- Errors show the file and a hint (for example "Did you mean `GET`?"). Read the hint and fix that exact spot.
- Never edit `storage/`; it holds the database. Never put secrets in a route or service file; they go in `.env`, which is not in git.
- Terminal messages are in English.

## Testing

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '@msilabs/adhar';

test('creates a note', async () => {
    const app = await createApp(process.cwd(), { env: { DATABASE_PATH: ':memory:' } });
    const res = await app.inject({ method: 'POST', path: '/api/notes', body: { title: 'Buy milk' } });
    assert.equal(res.status, 201);
    await app.close();
});
```

`inject` runs a request without opening a port and returns `{ status, headers, body }`.

## Common mistakes

| Wrong | Right |
| --- | --- |
| `export default function handler(req, res)` | `export function GET(ctx)` |
| `res.status(201).json(note)` | `ctx.status(201); return note;` |
| `return ctx.error(404)` | `throw ctx.error(404)` |
| `export function get(ctx)` | `export function GET(ctx)` |
| `import { notes } from '../../services/notes.js'` | `ctx.services.notes` |
| `` db.all(`SELECT * FROM notes WHERE id = ${id}`) `` | `db.all('SELECT * FROM notes WHERE id = ?', id)` |
| `routes/notes/route.js` | `api/notes/route.js` |
| `fetch('/notes')` | `fetch('/api/notes')` |
| `api/notes/helpers.js` | `services/notes.js` |
| `api/notes/:id/route.js` | `api/notes/[id]/route.js` |
| `schema = { POST: { body: { title: { type: 'string', required: true } } } }` | `schema = { POST: { body: { title: 'string' } } }` |
| `export const all = () => ...` in a service | `export default ({ db }) => ({ all() { ... } })` |
| editing `migrations/001-...sql` after it ran | adding `migrations/002-...sql` |
