'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../core/app.js');
const { loadServices } = require('../core/services.js');
const { makeProject } = require('./helpers/project.js');

function adharError(file, message, hint) {
    return (err) => {
        assert.equal(err.name, 'AdharError');
        assert.equal(err.file, file);
        assert.match(err.message, message);
        if (hint) assert.match(err.hint, hint);
        return true;
    };
}

const USERS = `
export default () => {
    const users = [{ id: 1, name: 'A' }];
    return {
        all() {
            return users;
        },
        find(id) {
            return users.find((user) => user.id === id);
        },
    };
};
`;

test('a file in services/ becomes a named service', (t) => {
    const root = makeProject(t, { 'services/users.js': USERS });
    const services = loadServices(root);
    assert.deepEqual(services.users.all(), [{ id: 1, name: 'A' }]);
    assert.deepEqual(services.users.find(1), { id: 1, name: 'A' });
});

test('a folder adds its name in front', (t) => {
    const root = makeProject(t, {
        'services/blog/posts.js': 'export default () => ({ count: () => 3 });',
        'services/blog/admin/reports.js': 'export default () => ({ name: () => "reports" });',
        'services/mailer.js': 'export default () => ({ send: () => "sent" });',
    });
    const services = loadServices(root);
    assert.equal(services.blog.posts.count(), 3);
    assert.equal(services.blog.admin.reports.name(), 'reports');
    assert.equal(services.mailer.send(), 'sent');
    assert.deepEqual(Object.keys(services).sort(), ['blog', 'mailer']);
});

test('the factory receives env and db', (t) => {
    const root = makeProject(t, {
        'services/config.js': 'export default ({ env, db }) => ({ token: () => env.TOKEN, table: () => db.name });',
    });
    const services = loadServices(root, { env: { TOKEN: 'secret' }, db: { name: 'fake' } });
    assert.equal(services.config.token(), 'secret');
    assert.equal(services.config.table(), 'fake');
});

test('each factory runs once', (t) => {
    const root = makeProject(t, {
        'services/counter.js': 'let created = 0;\nexport default () => { created++; return { created: () => created }; };',
    });
    const services = loadServices(root);
    services.counter.created();
    assert.equal(services.counter.created(), 1);
});

test('a service can call another one inside its methods, in any load order', (t) => {
    const root = makeProject(t, {
        'services/a.js': 'export default ({ services }) => ({ hello: () => "a+" + services.z.name() });',
        'services/z.js': 'export default ({ services }) => ({ name: () => "z", back: () => services.a.hello() });',
        'services/shop/orders.js': 'export default ({ services }) => ({ owner: () => services.z.name() });',
    });
    const services = loadServices(root);
    assert.equal(services.a.hello(), 'a+z');
    assert.equal(services.z.back(), 'a+z');
    assert.equal(services.shop.orders.owner(), 'z');
});

test('reading another service at the top of the factory is an error', (t) => {
    const root = makeProject(t, {
        'services/orders.js': 'export default ({ services }) => { const users = services.users; return { all: () => users.all() }; };',
        'services/users.js': USERS,
    });
    assert.throws(
        () => loadServices(root),
        adharError('services/orders.js', /`users` was read from `services` while the services were still being created/, /inside a method/),
    );
});

test('a project without services/ still has an empty services object', (t) => {
    const root = makeProject(t, {});
    const services = loadServices(root);
    assert.deepEqual(Object.keys(services), []);
    assert.throws(() => services.users, /No service `users` in services\/\. Create it at services\/users\.js\./);
});

test('an unknown service name throws with a suggestion', (t) => {
    const root = makeProject(t, {
        'services/users.js': USERS,
        'services/blog/posts.js': 'export default () => ({});',
    });
    const services = loadServices(root);
    assert.throws(() => services.user, /No service `user` in services\/\. Did you mean `users`\?/);
    assert.throws(() => services.blog.post, /No service `post` in services\/blog\/\. Did you mean `posts`\?/);
    assert.throws(() => services.payments, /Create it at services\/payments\.js\./);
});

test('the services object survives await, JSON and console.log', async (t) => {
    const root = makeProject(t, { 'services/users.js': USERS });
    const services = loadServices(root);
    assert.equal(await services, services);
    assert.equal(typeof JSON.stringify(services), 'string');
    assert.equal(typeof require('node:util').inspect(services), 'string');
});

test('the services tree cannot be changed', (t) => {
    const root = makeProject(t, { 'services/users.js': USERS });
    const services = loadServices(root);
    assert.throws(() => {
        'use strict';
        services.extra = {};
    }, TypeError);
});

test('hidden folders and files that are not .js are ignored', (t) => {
    const root = makeProject(t, {
        'services/users.js': USERS,
        'services/README.md': '# notes',
        'services/.cache/broken.js': 'not javascript {',
    });
    assert.deepEqual(Object.keys(loadServices(root)), ['users']);
});

test('a name that is not an identifier is an error', (t) => {
    for (const file of ['services/blog-posts.js', 'services/2fa.js', 'services/my-folder/users.js']) {
        const root = makeProject(t, { [file]: 'export default () => ({});' });
        assert.throws(() => loadServices(root), (err) => {
            assert.equal(err.name, 'AdharError');
            assert.match(err.message, /Invalid service name/);
            assert.match(err.hint, /blogPosts/);
            return true;
        }, file);
    }
});

test('a file and a folder with the same name is an error', (t) => {
    const root = makeProject(t, {
        'services/blog.js': 'export default () => ({});',
        'services/blog/posts.js': 'export default () => ({});',
    });
    assert.throws(() => loadServices(root), (err) => {
        assert.equal(err.name, 'AdharError');
        assert.match(err.message, /Both services\/blog\.js and the folder services\/blog\/ want the name `blog`/);
        return true;
    });
});

test('a service file must export one default function', (t) => {
    const cases = [
        ['export function find() {}', /Unknown export `find`/, /Put `find` inside the returned object/],
        ['export default { find() {} };', /must export one default function/, /export default \(\{ db \}\)/],
        ['', /must export one default function/],
        ['export default () => ({});\nexport const extra = 1;', /Unknown export `extra`/],
    ];
    for (const [source, message, hint] of cases) {
        const root = makeProject(t, { 'services/users.js': source });
        assert.throws(() => loadServices(root), adharError('services/users.js', message, hint));
    }
});

test('the factory must return an object', (t) => {
    const cases = [
        ['export default () => {};', /must return an object/, /export default \(\{ db \}\)/],
        ['export default () => [1, 2];', /must return an object/],
        ['export default async () => ({});', /must return an object/, /cannot be `async`/],
    ];
    for (const [source, message, hint] of cases) {
        const root = makeProject(t, { 'services/users.js': source });
        assert.throws(() => loadServices(root), adharError('services/users.js', message, hint));
    }
});

test('a factory that throws names the file', (t) => {
    const root = makeProject(t, { 'services/mailer.js': 'export default ({ env }) => { throw new Error("SMTP_URL is missing"); };' });
    assert.throws(() => loadServices(root), adharError('services/mailer.js', /could not be created: SMTP_URL is missing/));
});

test('routes and middleware reach services through ctx', async (t) => {
    const root = makeProject(t, {
        'services/users.js': USERS,
        'services/auth/tokens.js': 'export default ({ env }) => ({ valid: (token) => token === env.TOKEN });',
        'api/middleware.js': `
export default function ({ headers, services, error }, next) {
    if (!services.auth.tokens.valid(headers['x-token'])) throw error(401);
    return next();
}
`,
        'api/users/[id]/route.js': `
export const schema = { GET: { params: { id: 'integer' } } };
export function GET(ctx) {
    const user = ctx.services.users.find(ctx.params.id);
    if (!user) throw ctx.error(404, 'User not found');
    return user;
}
`,
    });
    const app = await createApp(root, { env: { TOKEN: 'secret' } });
    const headers = { 'x-token': 'secret' };

    assert.equal((await app.inject({ path: '/api/users/1' })).status, 401);
    assert.deepEqual((await app.inject({ path: '/api/users/1', headers })).body, { id: 1, name: 'A' });
    assert.equal((await app.inject({ path: '/api/users/2', headers })).status, 404);
});

test('a wrong service name in a route is a 500 with the suggestion', async (t) => {
    const root = makeProject(t, {
        'services/users.js': USERS,
        'api/route.js': 'export function GET(ctx) { return ctx.services.user.all(); }',
    });
    const app = await createApp(root, { dev: true });
    const res = await app.inject({ path: '/api' });
    assert.equal(res.status, 500);
    assert.equal(res.body.error.message, 'No service `user` in services/. Did you mean `users`?');
});

test('a broken service fails when the app is created', async (t) => {
    const root = makeProject(t, {
        'services/users.js': 'export const all = () => [];',
        'api/route.js': 'export function GET() { return {}; }',
    });
    await assert.rejects(createApp(root), adharError('services/users.js', /Unknown export `all`/));
});
