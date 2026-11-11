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
        'routes/route.js': GET,
        'routes/users/route.js': GET,
        'routes/users/[id]/route.js': GET,
        'routes/users/[id]/posts/[postId]/route.js': GET,
        'routes/blog-posts/route.js': GET,
    });
    const { routes } = loadRoutes(root);
    assert.deepEqual(
        routes.map((route) => [route.pattern, route.file]).sort(),
        [
            ['/', 'routes/route.js'],
            ['/blog-posts', 'routes/blog-posts/route.js'],
            ['/users', 'routes/users/route.js'],
            ['/users/:id', 'routes/users/[id]/route.js'],
            ['/users/:id/posts/:postId', 'routes/users/[id]/posts/[postId]/route.js'],
        ],
    );
});

test('a group folder does not appear in the URL', (t) => {
    const root = makeProject(t, {
        'routes/(admin)/stats/route.js': GET,
        'routes/(admin)/(reports)/sales/route.js': GET,
    });
    const { routes, match } = loadRoutes(root);
    assert.deepEqual(routes.map((route) => route.pattern).sort(), ['/sales', '/stats']);
    assert.equal(match('/stats').route.file, 'routes/(admin)/stats/route.js');
    assert.equal(match('/admin/stats'), null);
});

test('a route knows its methods and its Allow header', (t) => {
    const root = makeProject(t, {
        'routes/users/route.js': 'export function POST() {}\nexport function GET() {}\nexport const schema = {};',
        'routes/login/route.js': 'export async function POST() {}',
    });
    const { match } = loadRoutes(root);
    assert.deepEqual(match('/users').route.methods, ['GET', 'POST']);
    assert.equal(match('/users').route.allow, 'GET, POST, HEAD, OPTIONS');
    assert.equal(match('/login').route.allow, 'POST, OPTIONS');
    assert.deepEqual(match('/users').route.schema, {});
});

test('match returns the route and its params', (t) => {
    const root = makeProject(t, {
        'routes/route.js': GET,
        'routes/users/[id]/route.js': GET,
        'routes/users/[id]/posts/[postId]/route.js': GET,
    });
    const { match } = loadRoutes(root);

    assert.deepEqual(match('/').params, {});
    assert.deepEqual(match('/users/42').params, { id: '42' });
    assert.deepEqual(match('/users/42/posts/7').params, { id: '42', postId: '7' });
    assert.equal(match('/users/42/posts/7').route.pattern, '/users/:id/posts/:postId');
});

test('match returns null when nothing fits', (t) => {
    const root = makeProject(t, { 'routes/users/[id]/route.js': GET });
    const { match } = loadRoutes(root);

    assert.equal(match('/'), null);
    assert.equal(match('/users'), null);
    assert.equal(match('/users/1/extra'), null);
    assert.equal(match('/Users/1'), null);
    assert.equal(match('/users//'), null);
});

test('params are URL-decoded', (t) => {
    const root = makeProject(t, { 'routes/tags/[name]/route.js': GET });
    const { match } = loadRoutes(root);

    assert.deepEqual(match('/tags/%E0%A6%86%E0%A6%B2%E0%A7%8B').params, { name: 'আলো' });
    assert.deepEqual(match('/tags/a%2Fb').params, { name: 'a/b' });
    assert.deepEqual(match('/tags/hello%20world').params, { name: 'hello world' });
});

test('a broken percent-encoding is a 400', (t) => {
    const root = makeProject(t, { 'routes/tags/[name]/route.js': GET });
    const { match } = loadRoutes(root);
    assert.throws(() => match('/tags/%E0%A6'), (err) => err.name === 'HttpError' && err.status === 400);
});

test('a fixed folder wins over a dynamic one', (t) => {
    const root = makeProject(t, {
        'routes/users/me/route.js': GET,
        'routes/users/[id]/route.js': GET,
    });
    const { match } = loadRoutes(root);
    assert.equal(match('/users/me').route.file, 'routes/users/me/route.js');
    assert.equal(match('/users/7').route.file, 'routes/users/[id]/route.js');
});

test('the dynamic folder is tried when the fixed one leads nowhere', (t) => {
    const root = makeProject(t, {
        'routes/users/me/route.js': GET,
        'routes/users/[id]/posts/route.js': GET,
    });
    const { match } = loadRoutes(root);
    const found = match('/users/me/posts');
    assert.equal(found.route.file, 'routes/users/[id]/posts/route.js');
    assert.deepEqual(found.params, { id: 'me' });
});

test('files that are not .js and hidden folders are ignored', (t) => {
    const root = makeProject(t, {
        'routes/route.js': GET,
        'routes/README.md': '# notes',
        'routes/.cache/route.js': 'this is not JavaScript {',
        'routes/users/notes.txt': 'todo',
    });
    assert.equal(loadRoutes(root).routes.length, 1);
});

test('middleware.js and a root not-found.js are allowed next to routes', (t) => {
    const root = makeProject(t, {
        'routes/route.js': GET,
        'routes/middleware.js': 'export default (ctx, next) => next();',
        'routes/not-found.js': 'export default () => ({});',
        'routes/users/middleware.js': 'export default (ctx, next) => next();',
        'routes/users/route.js': GET,
    });
    assert.equal(loadRoutes(root).routes.length, 2);
});

test('an empty routes folder gives no routes', (t) => {
    const root = makeProject(t, { 'routes/README.md': '' });
    assert.deepEqual(loadRoutes(root).routes, []);
});

test('a missing routes folder is an error', (t) => {
    const root = makeProject(t, {});
    assert.throws(() => loadRoutes(root), adharError(undefined, /No `routes\/` folder/, /adhar init/));
});

test('an invalid folder name is an error', (t) => {
    for (const name of ['Users', 'my_posts', '[user-id]', '(Admin)', 'a b']) {
        const root = makeProject(t, { [`routes/${name}/route.js`]: GET });
        assert.throws(
            () => loadRoutes(root),
            adharError(`routes/${name}`, /Invalid folder name/, /lower-case letters/),
            name,
        );
    }
});

test('a catch-all folder gets its own hint', (t) => {
    const root = makeProject(t, { 'routes/files/[...path]/route.js': GET });
    assert.throws(() => loadRoutes(root), adharError('routes/files/[...path]', /Invalid folder name/, /Catch-all/));
});

test('another .js file inside routes is an error', (t) => {
    const root = makeProject(t, { 'routes/users/route.js': GET, 'routes/users/helpers.js': 'export const x = 1;' });
    assert.throws(
        () => loadRoutes(root),
        adharError('routes/users/helpers.js', /Unexpected file `helpers\.js`/, /services/),
    );
});

test('not-found.js below the root is an error', (t) => {
    const root = makeProject(t, { 'routes/users/not-found.js': 'export default () => ({});' });
    assert.throws(() => loadRoutes(root), adharError('routes/users/not-found.js', /only works directly inside/));
});

test('two files for the same URL is an error', (t) => {
    const root = makeProject(t, {
        'routes/(a)/users/route.js': GET,
        'routes/(b)/users/route.js': GET,
    });
    assert.throws(
        () => loadRoutes(root),
        adharError('routes/(b)/users/route.js', /Two route files answer `\/users`.*routes\/\(a\)\/users\/route\.js/),
    );
});

test('two names for the same dynamic part is an error', (t) => {
    const root = makeProject(t, {
        'routes/users/[id]/route.js': GET,
        'routes/users/[slug]/posts/route.js': GET,
    });
    assert.throws(
        () => loadRoutes(root),
        adharError('routes/users/[slug]/posts/route.js', /named `\[slug\]` here and `\[id\]` in routes\/users\/\[id\]\/route\.js/),
    );
});

test('the same parameter name twice in one path is an error', (t) => {
    const root = makeProject(t, { 'routes/users/[id]/posts/[id]/route.js': GET });
    assert.throws(() => loadRoutes(root), adharError(undefined, /parameter `id` appears twice/, /\[postId\]/));
});

test('a lower-case method export suggests the upper-case name', (t) => {
    const root = makeProject(t, { 'routes/users/route.js': 'export function get() {}' });
    assert.throws(
        () => loadRoutes(root),
        adharError('routes/users/route.js', /Unknown export `get`/, /Did you mean `GET`\? Method names are upper-case/),
    );
});

test('other unknown exports are errors with a fitting hint', (t) => {
    const cases = [
        ['export default function () {}', /Unknown export `default`/, /named function per method/],
        ['export function GET() {}\nexport const shema = {};', /Unknown export `shema`/, /Did you mean `schema`\?$/],
        ['export function GET() {}\nexport const helper = 1;', /Unknown export `helper`/, /can export `GET`/],
    ];
    for (const [source, message, hint] of cases) {
        const root = makeProject(t, { 'routes/route.js': source });
        assert.throws(() => loadRoutes(root), adharError('routes/route.js', message, hint));
    }
});

test('a method export that is not a function is an error', (t) => {
    const root = makeProject(t, { 'routes/route.js': 'export const GET = { hello: "world" };' });
    assert.throws(() => loadRoutes(root), adharError('routes/route.js', /`GET` must be a function/));
});

test('a route file without handlers is an error', (t) => {
    for (const source of ['', 'export const schema = {};']) {
        const root = makeProject(t, { 'routes/route.js': source });
        assert.throws(() => loadRoutes(root), adharError('routes/route.js', /exports no handlers/));
    }
});

test('a syntax error names the file and how to find the line', (t) => {
    const root = makeProject(t, { 'routes/users/route.js': 'export function GET() {\n    return {;\n}\n' });
    assert.throws(
        () => loadRoutes(root),
        (err) => {
            assert.equal(err.name, 'AdharError');
            assert.equal(err.file, 'routes/users/route.js');
            assert.match(err.message, /Could not load this file: Unexpected token/);
            assert.equal(err.hint, 'Run `node --check routes/users/route.js` to see the exact line.');
            return true;
        },
    );
});

test('a file that throws while loading names the file', (t) => {
    const root = makeProject(t, { 'routes/route.js': 'throw new Error("no database");\nexport function GET() {}' });
    assert.throws(() => loadRoutes(root), adharError('routes/route.js', /Could not load this file: no database/));
});

test('top-level await gets a clear error', (t) => {
    const root = makeProject(t, { 'routes/route.js': 'await Promise.resolve();\nexport function GET() {}' });
    assert.throws(() => loadRoutes(root), adharError('routes/route.js', /top-level `await`/, /inside a function/));
});
