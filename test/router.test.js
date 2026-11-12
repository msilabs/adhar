'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRoutes } = require('../core/router.js');
const { makeProject } = require('./helpers/project.js');

const GET = 'export function GET() { return {}; }';

function adharError(file, message, hint) {
    return (err) => {
        assert.equal(err.name, 'AdharError');
        if (file) assert.equal(err.file, file);
        assert.match(err.message, message);
        if (hint) assert.match(err.hint, hint);
        return true;
    };
}

test('folders become URL patterns', (t) => {
    const root = makeProject(t, {
        'api/route.js': GET,
        'api/users/route.js': GET,
        'api/users/[id]/route.js': GET,
        'api/users/[id]/posts/[postId]/route.js': GET,
        'api/blog-posts/route.js': GET,
    });
    const { routes } = loadRoutes(root);
    assert.deepEqual(
        routes.map((route) => [route.pattern, route.file]).sort(),
        [
            ['/api', 'api/route.js'],
            ['/api/blog-posts', 'api/blog-posts/route.js'],
            ['/api/users', 'api/users/route.js'],
            ['/api/users/:id', 'api/users/[id]/route.js'],
            ['/api/users/:id/posts/:postId', 'api/users/[id]/posts/[postId]/route.js'],
        ],
    );
});

test('a group folder does not appear in the URL', (t) => {
    const root = makeProject(t, {
        'api/(admin)/stats/route.js': GET,
        'api/(admin)/(reports)/sales/route.js': GET,
    });
    const { routes, match } = loadRoutes(root);
    assert.deepEqual(routes.map((route) => route.pattern).sort(), ['/api/sales', '/api/stats']);
    assert.equal(match('/api/stats').route.file, 'api/(admin)/stats/route.js');
    assert.equal(match('/api/admin/stats'), null);
});

test('a route knows its methods and its Allow header', (t) => {
    const root = makeProject(t, {
        'api/users/route.js': 'export function POST() {}\nexport function GET() {}\nexport const schema = {};',
        'api/login/route.js': 'export async function POST() {}',
    });
    const { match } = loadRoutes(root);
    assert.deepEqual(match('/api/users').route.methods, ['GET', 'POST']);
    assert.equal(match('/api/users').route.allow, 'GET, POST, HEAD, OPTIONS');
    assert.equal(match('/api/login').route.allow, 'POST, OPTIONS');
    assert.deepEqual(match('/api/users').route.schema, {});
});

test('match returns the route and its params', (t) => {
    const root = makeProject(t, {
        'api/route.js': GET,
        'api/users/[id]/route.js': GET,
        'api/users/[id]/posts/[postId]/route.js': GET,
    });
    const { match } = loadRoutes(root);

    assert.deepEqual(match('/api').params, {});
    assert.deepEqual(match('/api/users/42').params, { id: '42' });
    assert.deepEqual(match('/api/users/42/posts/7').params, { id: '42', postId: '7' });
    assert.equal(match('/api/users/42/posts/7').route.pattern, '/api/users/:id/posts/:postId');
});

test('match returns null when nothing fits', (t) => {
    const root = makeProject(t, { 'api/users/[id]/route.js': GET });
    const { match } = loadRoutes(root);

    assert.equal(match('/api'), null);
    assert.equal(match('/api/users'), null);
    assert.equal(match('/api/users/1/extra'), null);
    assert.equal(match('/api/Users/1'), null);
    assert.equal(match('/api/users//'), null);
});

test('params are URL-decoded', (t) => {
    const root = makeProject(t, { 'api/tags/[name]/route.js': GET });
    const { match } = loadRoutes(root);

    assert.deepEqual(match('/api/tags/%E0%A6%86%E0%A6%B2%E0%A7%8B').params, { name: 'আলো' });
    assert.deepEqual(match('/api/tags/a%2Fb').params, { name: 'a/b' });
    assert.deepEqual(match('/api/tags/hello%20world').params, { name: 'hello world' });
});

test('a broken percent-encoding is a 400', (t) => {
    const root = makeProject(t, { 'api/tags/[name]/route.js': GET });
    const { match } = loadRoutes(root);
    assert.throws(() => match('/api/tags/%E0%A6'), (err) => err.name === 'HttpError' && err.status === 400);
});

test('a fixed folder wins over a dynamic one', (t) => {
    const root = makeProject(t, {
        'api/users/me/route.js': GET,
        'api/users/[id]/route.js': GET,
    });
    const { match } = loadRoutes(root);
    assert.equal(match('/api/users/me').route.file, 'api/users/me/route.js');
    assert.equal(match('/api/users/7').route.file, 'api/users/[id]/route.js');
});

test('the dynamic folder is tried when the fixed one leads nowhere', (t) => {
    const root = makeProject(t, {
        'api/users/me/route.js': GET,
        'api/users/[id]/posts/route.js': GET,
    });
    const { match } = loadRoutes(root);
    const found = match('/api/users/me/posts');
    assert.equal(found.route.file, 'api/users/[id]/posts/route.js');
    assert.deepEqual(found.params, { id: 'me' });
});

test('files that are not .js and hidden folders are ignored', (t) => {
    const root = makeProject(t, {
        'api/route.js': GET,
        'api/README.md': '# notes',
        'api/.cache/route.js': 'this is not JavaScript {',
        'api/users/notes.txt': 'todo',
    });
    assert.equal(loadRoutes(root).routes.length, 1);
});

test('middleware.js and a root not-found.js are allowed next to routes', (t) => {
    const root = makeProject(t, {
        'api/route.js': GET,
        'api/middleware.js': 'export default (ctx, next) => next();',
        'api/not-found.js': 'export default () => ({});',
        'api/users/middleware.js': 'export default (ctx, next) => next();',
        'api/users/route.js': GET,
    });
    assert.equal(loadRoutes(root).routes.length, 2);
});

test('an empty api folder gives no routes', (t) => {
    const root = makeProject(t, { 'api/README.md': '' });
    assert.deepEqual(loadRoutes(root).routes, []);
});

test('a missing api folder is an error', (t) => {
    const root = makeProject(t, {});
    assert.throws(() => loadRoutes(root), adharError(undefined, /No `api\/` folder/, /adhar init/));
});

test('an invalid folder name is an error', (t) => {
    for (const name of ['Users', 'my_posts', '[user-id]', '(Admin)', 'a b']) {
        const root = makeProject(t, { [`api/${name}/route.js`]: GET });
        assert.throws(
            () => loadRoutes(root),
            adharError(`api/${name}`, /Invalid folder name/, /lower-case letters/),
            name,
        );
    }
});

test('a catch-all folder gets its own hint', (t) => {
    const root = makeProject(t, { 'api/files/[...path]/route.js': GET });
    assert.throws(() => loadRoutes(root), adharError('api/files/[...path]', /Invalid folder name/, /Catch-all/));
});

test('another .js file inside api is an error', (t) => {
    const root = makeProject(t, { 'api/users/route.js': GET, 'api/users/helpers.js': 'export const x = 1;' });
    assert.throws(
        () => loadRoutes(root),
        adharError('api/users/helpers.js', /Unexpected file `helpers\.js`/, /services/),
    );
});

test('not-found.js below the root is an error', (t) => {
    const root = makeProject(t, { 'api/users/not-found.js': 'export default () => ({});' });
    assert.throws(() => loadRoutes(root), adharError('api/users/not-found.js', /only works directly inside/));
});

test('two files for the same URL is an error', (t) => {
    const root = makeProject(t, {
        'api/(a)/users/route.js': GET,
        'api/(b)/users/route.js': GET,
    });
    assert.throws(
        () => loadRoutes(root),
        adharError('api/(b)/users/route.js', /Two route files answer `\/api\/users`.*api\/\(a\)\/users\/route\.js/),
    );
});

test('two names for the same dynamic part is an error', (t) => {
    const root = makeProject(t, {
        'api/users/[id]/route.js': GET,
        'api/users/[slug]/posts/route.js': GET,
    });
    assert.throws(
        () => loadRoutes(root),
        adharError('api/users/[slug]/posts/route.js', /named `\[slug\]` here and `\[id\]` in api\/users\/\[id\]\/route\.js/),
    );
});

test('the same parameter name twice in one path is an error', (t) => {
    const root = makeProject(t, { 'api/users/[id]/posts/[id]/route.js': GET });
    assert.throws(() => loadRoutes(root), adharError(undefined, /parameter `id` appears twice/, /\[postId\]/));
});

test('a lower-case method export suggests the upper-case name', (t) => {
    const root = makeProject(t, { 'api/users/route.js': 'export function get() {}' });
    assert.throws(
        () => loadRoutes(root),
        adharError('api/users/route.js', /Unknown export `get`/, /Did you mean `GET`\? Method names are upper-case/),
    );
});

test('other unknown exports are errors with a fitting hint', (t) => {
    const cases = [
        ['export default function () {}', /Unknown export `default`/, /named function per method/],
        ['export function GET() {}\nexport const shema = {};', /Unknown export `shema`/, /Did you mean `schema`\?$/],
        ['export function GET() {}\nexport const helper = 1;', /Unknown export `helper`/, /can export `GET`/],
    ];
    for (const [source, message, hint] of cases) {
        const root = makeProject(t, { 'api/route.js': source });
        assert.throws(() => loadRoutes(root), adharError('api/route.js', message, hint));
    }
});

test('a method export that is not a function is an error', (t) => {
    const root = makeProject(t, { 'api/route.js': 'export const GET = { hello: "world" };' });
    assert.throws(() => loadRoutes(root), adharError('api/route.js', /`GET` must be a function/));
});

test('a route file without handlers is an error', (t) => {
    for (const source of ['', 'export const schema = {};']) {
        const root = makeProject(t, { 'api/route.js': source });
        assert.throws(() => loadRoutes(root), adharError('api/route.js', /exports no handlers/));
    }
});

test('a syntax error names the file and how to find the line', (t) => {
    const root = makeProject(t, { 'api/users/route.js': 'export function GET() {\n    return {;\n}\n' });
    assert.throws(
        () => loadRoutes(root),
        (err) => {
            assert.equal(err.name, 'AdharError');
            assert.equal(err.file, 'api/users/route.js');
            assert.match(err.message, /Could not load this file: Unexpected token/);
            assert.equal(err.hint, 'Run `node --check api/users/route.js` to see the exact line.');
            return true;
        },
    );
});

test('a file that throws while loading names the file', (t) => {
    const root = makeProject(t, { 'api/route.js': 'throw new Error("no database");\nexport function GET() {}' });
    assert.throws(() => loadRoutes(root), adharError('api/route.js', /Could not load this file: no database/));
});

test('top-level await gets a clear error', (t) => {
    const root = makeProject(t, { 'api/route.js': 'await Promise.resolve();\nexport function GET() {}' });
    assert.throws(() => loadRoutes(root), adharError('api/route.js', /top-level `await`/, /inside a function/));
});

test('every URL starts with /api', (t) => {
    const root = makeProject(t, {
        'api/route.js': GET,
        'api/notes/[id]/route.js': GET,
        'api/(admin)/stats/route.js': GET,
    });
    const { routes, match } = loadRoutes(root);

    assert.deepEqual(routes.map((route) => route.pattern).sort(), ['/api', '/api/notes/:id', '/api/stats']);
    assert.equal(match('/api').route.file, 'api/route.js');
    assert.deepEqual(match('/api/notes/7').params, { id: '7' });
    for (const outside of ['/', '/notes/7', '/stats', '/apix', '/api/api']) assert.equal(match(outside), null, outside);
});

test('a project that still has routes/ is told to rename it, with one of its own URLs', (t) => {
    const root = makeProject(t, {
        'routes/route.js': GET,
        'routes/(shop)/orders/[id]/route.js': GET,
        'routes/notes/route.js': 'this file is never loaded',
    });
    assert.throws(
        () => loadRoutes(root),
        (err) => {
            assert.equal(err.name, 'AdharError');
            assert.equal(err.file, 'routes/');
            assert.equal(err.message, 'The `routes/` folder is now `api/`.');
            assert.equal(
                err.hint,
                'Rename `routes/` to `api/`. Every URL then starts with `/api`:\n' +
                    '`/orders/:id` becomes `/api/orders/:id`. Update the clients that call this API.',
            );
            return true;
        },
    );
});

test('the rename error falls back to /users as its example', (t) => {
    const cases = [
        { 'routes/route.js': GET },
        { 'routes/README.md': '' },
        { 'routes/Bad Name/route.js': GET },
    ];
    for (const files of cases) {
        const root = makeProject(t, files);
        assert.throws(() => loadRoutes(root), adharError('routes/', /is now `api\/`/, /`\/users` becomes `\/api\/users`/));
    }
});

test('routes/ next to api/ is an error', (t) => {
    const root = makeProject(t, { 'routes/notes/route.js': GET, 'api/route.js': GET });
    assert.throws(
        () => loadRoutes(root),
        adharError('routes/', /^Both `routes\/` and `api\/` exist\.$/, /Move what is left in `routes\/` into `api\/`, then delete `routes\/`/),
    );
});
