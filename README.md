# আধার (Adhar)

[![npm](https://img.shields.io/npm/v/@msilabs/adhar)](https://www.npmjs.com/package/@msilabs/adhar)
[![CI](https://github.com/msilabs/adhar/actions/workflows/ci.yml/badge.svg)](https://github.com/msilabs/adhar/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/@msilabs/adhar)](LICENSE)

**হালকা backend API ফ্রেমওয়ার্ক।** ফোল্ডারে সাধারণ JS ফাংশন লিখুন, পান JSON API: রাউটিং, middleware, ভ্যালিডেশন, service আর SQLite ডেটাবেস। Node.js ছাড়া আর কিছু লাগে না।

Adhar হলো [Alo](https://github.com/msilabs/alo)-র জোড়া। Alo বানায় স্ট্যাটিক ফ্রন্টএন্ড, Adhar বানায় তার পেছনের API। দুটোর নিয়ম একই ধাঁচের, তাই একটি জানলে অন্যটি শিখতে সময় লাগে না।

## Adhar কী

Adhar একটি সার্ভার ফ্রেমওয়ার্ক, শুধু JSON API-র জন্য। আপনি `routes/` ফোল্ডারে ফাইল রাখেন; ফোল্ডারের নামই URL, আর ফাইলের ভেতরের `GET`, `POST` নামের ফাংশনই handler। ফাংশন যা return করে, তা-ই JSON হয়ে ক্লায়েন্টে যায়।

কোনো নতুন ভাষা নেই, ফ্রেমওয়ার্ক `import` করতে হয় না, কোনো কনফিগারেশন ফাইল নেই। Adhar নিজেও কোনো npm প্যাকেজের ওপর নির্ভর করে না; ডেটাবেস হিসেবে ব্যবহার করে Node.js-এর নিজস্ব SQLite।

## শুরু করা

Node.js ২২.১৩ বা নতুন ভার্সন লাগবে।

```bash
npx @msilabs/adhar init my-api
cd my-api
npm install
node adhar dev
```

এবার আরেকটি টার্মিনালে:

```bash
curl http://localhost:8134/notes
curl -X POST http://localhost:8134/notes -H "Content-Type: application/json" -d '{"title":"প্রথম নোট"}'
```

যেকোনো ফাইল বদলে সংরক্ষণ করলে সার্ভার নিজে থেকে নতুন করে চালু হয়।

একই কমান্ড তিনভাবে চালানো যায়, তিনটিই প্রজেক্টের নিজের ভার্সন চালায়: `node adhar dev`, `npm run dev` অথবা `npx adhar dev`।

## AI সহকারী দিয়ে কাজ করলে

Claude, ChatGPT, Cursor বা Copilot-এর মতো AI সহকারী Adhar সম্পর্কে জানে না। আগে না জানালে সে Express বা Next.js-এর ধরনে কোড লিখবে (`req, res`, `res.json()`, `import express`)। এ সমস্যা এড়াতে:

- **`adhar init` দিয়ে বানানো প্রজেক্টে** রুটে একটি `AGENTS.md` থাকে। Claude Code, Cursor, Codex-এর মতো টুল ফোল্ডার খুললে এটি নিজে পড়ে নেয়।
- **চ্যাটে বা অন্য প্রজেক্টে** AI-কে এই লিংক দিন, বা প্রম্পটে লিখে দিন:

  > Read https://raw.githubusercontent.com/msilabs/adhar/main/templates/init/AGENTS.md and follow it for all Adhar code in this project.

গাইডটি ইংরেজিতে, কারণ AI-এর কাছে নিয়মগুলো এতে সবচেয়ে নির্ভুল পৌঁছায়। রুটের [llms.txt](llms.txt) ফাইলেও একই লিংক আছে।

## এক পাতায় Adhar

এটুকু জানলেই কাজ শুরু করা যায়।

1. **Route:** `routes/users/route.js` মানে `/users`। ফাইলে `GET`, `POST`, `PUT`, `PATCH`, `DELETE` নামে ফাংশন export করুন।
2. **উত্তর:** ফাংশন যা return করে, তা-ই JSON হয়ে যায়।
3. **ডায়নামিক route:** `routes/users/[id]/route.js` মানে `/users/:id`; মান থাকে `ctx.params.id`-তে।
4. **Middleware:** `middleware.js` তার ফোল্ডারের সব route-এর আগে চলে। পরের ধাপে যেতে `next()`।
5. **Service:** `services/users.js` হয় `ctx.services.users`। ফোল্ডারে থাকলে `services/blog/posts.js` হয় `ctx.services.blog.posts`।
6. **Database:** `ctx.db` দিয়ে SQL চালানো। টেবিল বানানো হয় `migrations/001-নাম.sql` ফাইলে।
7. **ভ্যালিডেশন:** route ফাইলে `schema` export করলে ভুল ইনপুট handler পর্যন্ত পৌঁছায় না।
8. **ভুল:** `throw ctx.error(404, 'Not found')`।

| লিখবেন | কাজ |
| --- | --- |
| `ctx.params` | URL-এর `[নাম]` অংশের মান |
| `ctx.query` | `?page=2` অংশ |
| `ctx.body` | request-এর JSON body |
| `ctx.headers` | request header (নাম ছোট হাতের) |
| `ctx.method`, `ctx.path` | HTTP method আর path |
| `ctx.services` | `services/` ফোল্ডারের সবকিছু |
| `ctx.db` | SQLite: `all`, `get`, `run`, `transaction` |
| `ctx.env` | `.env` ফাইল আর পরিবেশের ভেরিয়েবল |
| `ctx.state` | middleware থেকে handler-এ তথ্য পাঠানোর জায়গা |
| `ctx.status(201)` | response-এর status বদলানো |
| `ctx.header('X-Total', '42')` | response header বসানো |
| `ctx.error(404, 'Not found')` | throw করার জন্য HTTP ভুল বানানো |

### Alo জানলে

| Alo | Adhar |
| --- | --- |
| `pages/about/page.alo` → `/about/` | `routes/users/route.js` → `/users` |
| `pages/blog/[slug]/page.alo` | `routes/users/[id]/route.js` |
| `layout.alo` আর `<slot />` | `middleware.js` আর `next()` |
| `(site)/` route গ্রুপ | `(admin)/` route গ্রুপ |
| `components/blog/PostCard.alo` → `<Blog.PostCard />` | `services/blog/posts.js` → `ctx.services.blog.posts` |
| `props` | `ctx` |
| `data/*.json` | `migrations/*.sql` আর `ctx.db` |
| `alo dev`, `alo build` | `adhar dev`, `adhar start` |

## Route

ফোল্ডারই URL:

```
routes/
├── middleware.js         ← সব route-এ চলে
├── route.js              → /
├── users/
│   ├── route.js          → /users
│   └── [id]/
│       └── route.js      → /users/:id
└── (admin)/
    ├── middleware.js     ← শুধু এই গ্রুপে
    └── stats/
        └── route.js      → /stats
```

একটি route ফাইল:

```js
// routes/users/[id]/route.js
export function GET(ctx) {
    const user = ctx.services.users.find(ctx.params.id);
    if (!user) throw ctx.error(404, 'User not found');
    return user;
}

export function DELETE(ctx) {
    ctx.services.users.remove(ctx.params.id);
}
```

নিয়ম:

- `[নাম]` ফোল্ডার URL-এর একটি অংশের সাথে মেলে। একাধিক লেভেলে থাকতে পারে: `routes/users/[id]/posts/[postId]/route.js`।
- `(নাম)` ফোল্ডার URL-এ আসে না; শুধু সাজানো আর middleware ভাগ করার জন্য।
- স্থির ফোল্ডার ডায়নামিকের আগে মেলে: `/users/me` যায় `users/me/route.js`-এ।
- ফোল্ডারের নাম: ছোট হাতের অক্ষর, সংখ্যা আর `-`।
- `routes/`-এর ভেতরে শুধু তিনটি নামের ফাইল থাকে: `route.js`, `middleware.js`, `not-found.js`। বাকি কোড রাখুন `services/`-এ।
- handler `async` হতে পারে।

handler যা return করে:

| return | response |
| --- | --- |
| object বা array | `200`, JSON |
| কিছু না | `204`, body নেই |
| string | `200`, সাধারণ লেখা |
| number, boolean, `null` | `200`, JSON |

নিজে থেকে যা ঘটে:

- route নেই → `404`।
- route আছে কিন্তু method-এর ফাংশন নেই → `405`, সাথে `Allow` header।
- `HEAD` চলে `GET` দিয়ে, body ছাড়া। `OPTIONS` নিজে উত্তর পায়।
- শেষের `/` উপেক্ষিত: `/users/` আর `/users` একই।

সব ভুলের আকার একই:

```json
{ "error": { "status": 404, "message": "User not found" } }
```

handler-এ অপ্রত্যাশিত ভুল হলে `500` যায়। dev-এ response-এ মেসেজ আর stack থাকে; production-এ শুধু `Internal server error`, বিস্তারিত থাকে সার্ভারের লগে।

## Middleware

```js
// routes/(admin)/middleware.js
export default function (ctx, next) {
    if (ctx.headers.authorization !== `Bearer ${ctx.env.ADMIN_TOKEN}`) {
        throw ctx.error(401, 'Login required');
    }
    ctx.state.admin = true;
    return next();
}
```

- ফাইলে একটিই export: `default`, ফাংশন `(ctx, next)`।
- ক্রম Alo-র লেআউটের মতো: `routes/middleware.js` সবার আগে, তারপর ভেতরের ফোল্ডারগুলো, শেষে handler।
- `return next()` মানে পরের ধাপে যাও। `next()` না ডেকে কিছু return করলে handler চলে না, সেই মানই উত্তর।
- handler-এর পরে কাজ করতে চাইলে:

```js
export default async function (ctx, next) {
    const started = performance.now();
    const result = await next();
    ctx.header('X-Response-Time', `${Math.round(performance.now() - started)}ms`);
    return result;
}
```

`404`, `405` আর `OPTIONS`-এ শুধু `routes/middleware.js` চলে।

## ভ্যালিডেশন

```js
// routes/users/route.js
export const schema = {
    GET: { query: { page: 'integer?', search: 'string?' } },
    POST: { body: { name: 'string', email: 'email', age: 'number?' } },
};

export function POST(ctx) {
    ctx.status(201);
    return ctx.services.users.create(ctx.body);
}
```

- টাইপ: `string`, `number`, `integer`, `boolean`, `email`, `array`, `object`। শেষে `?` মানে ঐচ্ছিক।
- `body`, `query` আর `params`, তিনটিতেই চলে।
- `query` আর `params`-এর মান লেখা হয়ে আসে, তাই সংখ্যা আর বুলিয়ান নিজে থেকে রূপান্তর হয়: `?page=2`-এ `ctx.query.page` হয় সংখ্যা `2`।
- schema-তে নেই এমন field `body` আর `query` থেকে বাদ পড়ে। তাই ক্লায়েন্ট বাড়তি `role: "admin"` পাঠালেও handler-এ পৌঁছায় না।
- না মিললে handler চলে না:

```json
{
    "error": {
        "status": 422,
        "message": "Validation failed",
        "fields": { "name": "is required", "email": "must be a valid email" }
    }
}
```

এর বেশি যাচাই (দৈর্ঘ্য, ধরন, ভেতরের object) handler-এ সাধারণ JS দিয়ে করুন।

## Service

route ছোট রাখুন; আসল কাজ রাখুন service-এ।

```js
// services/users.js
export default ({ db }) => ({
    all() {
        return db.all('SELECT * FROM users ORDER BY id');
    },
    find(id) {
        return db.get('SELECT * FROM users WHERE id = ?', id);
    },
    create({ name, email }) {
        return db.get('INSERT INTO users (name, email) VALUES (?, ?) RETURNING *', name, email);
    },
});
```

- ফাইলে একটিই export: `default`, একটি ফাংশন। সেটি পায় `{ db, env, services }`, আর ফেরত দেয় ফাংশনের একটি object।
- সার্ভার চালুর সময় ফাংশনটি একবার চলে।
- নাম আসে ফাইলের অবস্থান থেকে। কোথাও `import` লাগে না: route-এ `ctx.services.users`, অন্য service-এ `services.users`।
- ফাইলের নাম JS-এর নামের নিয়ম মানে: `blogPosts.js`, `blog-posts.js` নয়।
- ভুল নাম লিখলে (`ctx.services.user`) সাথে সাথে ভুল আসে, কাছাকাছি নামের ইঙ্গিতসহ।
- service-এ `ctx` নেই। request-এর কিছু লাগলে route থেকে আর্গুমেন্ট হিসেবে পাঠান।

## Database

Adhar-এর ডেটাবেস SQLite; একটি ফাইল (`storage/app.db`), আলাদা সার্ভার লাগে না। কোনো ORM নেই, লিখতে হয় SQL।

| ডাক | ফেরত |
| --- | --- |
| `db.all(sql, ...params)` | সারির array |
| `db.get(sql, ...params)` | প্রথম সারি, বা `undefined` |
| `db.run(sql, ...params)` | `{ changes, lastId }` |
| `db.transaction(fn)` | `fn`-এর return; ভুল হলে সব বাতিল |

**মান সবসময় `?` দিয়ে বসান।** SQL-এর ভেতরে string জোড়া লাগাবেন না; এতে SQL injection হয়।

```js
db.all('SELECT * FROM users WHERE city = ?', city);          // ঠিক
db.all(`SELECT * FROM users WHERE city = '${city}'`);        // ভুল
```

- `true`/`false` জমা হয় `1`/`0` হিসেবে, `undefined` হয় `NULL`।
- object, array বা `Date` সরাসরি দেওয়া যায় না; `JSON.stringify(value)` বা `date.toISOString()` দিন।
- একাধিক কাজ একসাথে সফল বা ব্যর্থ করতে:

```js
db.transaction(() => {
    db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', amount, from);
    db.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', amount, to);
});
```

### Migration

টেবিল বানানো বা বদলানো হয় `migrations/` ফোল্ডারের SQL ফাইলে:

```sql
-- migrations/001-create-users.sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);
```

- নাম: তিন অঙ্কের নম্বর, `-`, তারপর নাম। ফাইলগুলো নম্বরের ক্রমে চলে, প্রতিটি একবার।
- `node adhar dev` বাকি migration নিজে চালায়।
- `node adhar start` চালায় না; বাকি থাকলে চালু হয় না। আগে `node adhar migrate` চালান।
- একবার চলে যাওয়া migration বদলাবেন না। বদল দরকার হলে নতুন ফাইল যোগ করুন: `node adhar new migration add-phone`।
- ডেভেলপমেন্টে একদম নতুন করে শুরু করতে চাইলে `storage/` ফোল্ডার মুছে দিন।

## `.env` আর CORS

পোর্ট আর গোপন মান থাকে প্রজেক্টের রুটের `.env` ফাইলে, আর পড়া যায় `ctx.env` দিয়ে:

```
PORT=8134
ADMIN_TOKEN=change-me
```

Adhar নিজে যে নামগুলো পড়ে:

| নাম | কাজ | ডিফল্ট |
| --- | --- | --- |
| `PORT` | পোর্ট (`--port` দিলে সেটিই প্রাধান্য পায়) | `8134` |
| `CORS_ORIGIN` | কোন ওয়েবসাইট ব্রাউজার থেকে এই API ডাকতে পারবে | নেই (বন্ধ) |
| `DATABASE_PATH` | SQLite ফাইলের পথ; `:memory:` চলে | `storage/app.db` |

- হোস্টিংয়ের নিজের পরিবেশের ভেরিয়েবল `.env`-এর ওপরে প্রাধান্য পায়।
- `.env` git-এ যায় না (`.gitignore`-এ আছে)। কোন কোন নাম লাগে তা লিখে রাখুন `.env.example`-এ।

অন্য ডোমেইনের ফ্রন্টএন্ড (যেমন Alo সাইট) থেকে ব্রাউজারে API ডাকতে হলে CORS চালু করুন:

```
CORS_ORIGIN=https://example.com, http://localhost:3000
```

পুরো origin লিখুন (`https://` সহ)। `*` দিলে যেকোনো ওয়েবসাইট ডাকতে পারে; production-এ এতে সতর্কবার্তা আসে।

## কমান্ড

```bash
node adhar init [folder]               # উদাহরণসহ নতুন প্রজেক্ট (npx @msilabs/adhar init)
node adhar dev [--port 8134]           # dev সার্ভার; ফাইল বদলালে নতুন করে চালু হয়
node adhar start [--port 8134]         # production সার্ভার
node adhar routes                      # সব route-এর তালিকা
node adhar migrate                     # বাকি migration চালানো
node adhar new route "users/[id]"      # routes/users/[id]/route.js
node adhar new middleware "(admin)"    # routes/(admin)/middleware.js
node adhar new service blog/posts      # services/blog/posts.js
node adhar new migration create-posts  # migrations/<পরের নম্বর>-create-posts.sql
node adhar --help
node adhar --version
```

- নামে `[ ]` বা `( )` থাকলে উদ্ধৃতিচিহ্ন দিন, কারণ shell-এ এগুলোর আলাদা অর্থ আছে।
- `dev` আর `start`-এর পার্থক্য:

| | `dev` | `start` |
| --- | --- | --- |
| ফাইল বদলালে | নতুন করে চালু হয় | কিছু হয় না |
| বাকি migration | নিজে চালায় | চালু হয় না, `migrate` চালাতে বলে |
| `500`-এর বিস্তারিত | response-এ দেখায় | শুধু সার্ভারের লগে |
| `ctx.env.NODE_ENV` | `development` | `production` |

- দুটোতেই প্রতি request-এ এক লাইন ছাপা হয়: `GET /users 200 3ms`।
- `start` বন্ধ করলে (Ctrl+C বা হোস্টের থামানোর সংকেত) চলমান request শেষ হয়, তারপর ডেটাবেস বন্ধ হয়।

## টেস্ট লেখা

পোর্ট না খুলেই request চালানো যায়:

```js
// test/notes.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '@msilabs/adhar';

test('নোট তৈরি হয়', async () => {
    const app = await createApp(process.cwd(), { env: { DATABASE_PATH: ':memory:' } });

    const res = await app.inject({ method: 'POST', path: '/notes', body: { title: 'দুধ কিনতে হবে' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'দুধ কিনতে হবে');

    await app.close();
});
```

চালান `node --test` দিয়ে। `:memory:` দিলে প্রতিটি টেস্ট পায় নতুন, ফাঁকা ডেটাবেস; migration নিজে থেকে চলে। `inject` ফেরত দেয় `{ status, headers, body }`।

## ডিপ্লয়

Adhar চলে যেকোনো জায়গায় যেখানে Node.js ২২.১৩+ চলে আর একটি স্থায়ী ডিস্ক আছে (VPS, Railway, Render, Fly.io ইত্যাদি)।

```bash
npm install
node adhar migrate
node adhar start
```

মনে রাখুন:

- **`storage/` ফোল্ডার স্থায়ী ডিস্কে থাকতে হবে।** ডেটাবেস ওই ফোল্ডারের একটি ফাইল। যে হোস্টিং প্রতি ডিপ্লয়ে ডিস্ক মুছে ফেলে, সেখানে একটি volume যুক্ত করুন আর `DATABASE_PATH` দিয়ে সেদিকে দেখান।
- গোপন মান দিন হোস্টিংয়ের পরিবেশের ভেরিয়েবলে, `.env` ফাইলে নয়।
- হোস্টিং `PORT` দিলে Adhar সেটিই নেয়।
- serverless প্ল্যাটফর্মে (Vercel, Netlify Functions, Cloudflare Workers) চলে না; সেখানে স্থায়ী প্রসেস আর ডিস্ক নেই।
- ব্যাকআপ: `storage/app.db` ফাইলটি কপি করাই ব্যাকআপ। সার্ভার চালু থাকলে সাথে `app.db-wal` ফাইলও নিন, অথবা SQLite-এর `.backup` কমান্ড ব্যবহার করুন।

## Alo-র সাথে ব্যবহার

Alo সাইট স্ট্যাটিক, তাই ফর্ম জমা বা লাইভ ডেটার জন্য সে ব্রাউজার থেকে Adhar API ডাকে।

Adhar-এর `.env`:

```
CORS_ORIGIN=https://my-site.example.com
```

নিজের কম্পিউটারে দুটো একসাথে চালানো যায়: `node alo dev` চলে `http://localhost:3000`-এ, `node adhar dev` চলে `http://localhost:8134`-এ। তখন Adhar-এর `.env`-এ লিখুন `CORS_ORIGIN=http://localhost:3000`, আর Alo থেকে ডাকুন `http://localhost:8134/notes`।

Alo-র কোনো কম্পোনেন্টে:

```html
<template>
    <form>
        <input name="title" required />
        <button>যোগ করুন</button>
    </form>
</template>

<script>
    $el.querySelector('form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = new FormData(event.target).get('title');
        const res = await fetch('https://api.example.com/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (res.ok) event.target.reset();
    });
</script>
```

## পরে দেখুন

এগুলো না জেনেও কাজ চলে।

### Destructuring

`ctx` শুধু প্যারামিটারের নাম। যা লাগে শুধু সেটুকু নিতে পারেন:

```js
export function GET({ params, services, error }) {
    const user = services.users.find(params.id);
    if (!user) throw error(404, 'User not found');
    return user;
}
```

### নিজের 404

```js
// routes/not-found.js
export default function (ctx) {
    return { error: { status: 404, message: `${ctx.path} বলে কিছু নেই` } };
}
```

ফাইলটি শুধু `routes/`-এর রুটে থাকে।

### ভুল ধরা middleware-এ

handler-এর ভুল middleware দিয়ে উপরে ওঠে, তাই এক জায়গায় ধরা যায়:

```js
export default async function (ctx, next) {
    try {
        return await next();
    } catch (err) {
        if (!err.status) console.error('অপ্রত্যাশিত ভুল:', err);
        throw err;
    }
}
```

### ফর্ম থেকে আসা ডেটা

`Content-Type: application/x-www-form-urlencoded` body-ও `ctx.body`-তে object হয়ে আসে। অন্য ধরনের body-তে (যেমন ফাইল আপলোড) `415` যায়। body-র সীমা 1 MB।

### ভেতরের transaction

`db.transaction()`-এর ভেতরে আরেকটি `db.transaction()` ডাকা যায়। ভেতরেরটি ব্যর্থ হলে শুধু তার কাজ বাতিল হয়; ভুলটি ধরলে বাইরেরটি চলতে থাকে।

## FAQ

**`ctx` মানে কী? অন্য নাম দেওয়া যায়?**

"context"-এর সংক্ষেপ: একটি request-এর সবকিছু (`params`, `body`, `db`…) যে object-এ থাকে। এটি শুধু প্যারামিটারের নাম, তাই যেকোনো নাম চলে; ডকুমেন্টেশনে সবখানে `ctx`।

**`res.json()` বা `res.send()` নেই কেন?**

কারণ return-ই যথেষ্ট। ফাংশন একটি মান ফেরত দেয়, Adhar সেটি পাঠায়। এতে handler সাধারণ ফাংশন থাকে, আর টেস্ট করাও সহজ।

**service-এ `import` না করে `ctx.services` কেন?**

`../../../services/users.js`-এর মতো পথ লিখতে আর ঠিক রাখতে হয় না, আর ফাইল সরালেও কিছু ভাঙে না। Alo-তে কম্পোনেন্ট যেমন `import` ছাড়া চলে, এখানেও তেমন।

**PostgreSQL বা MySQL ব্যবহার করা যায়?**

Adhar-এর `ctx.db` শুধু SQLite। অন্য ডেটাবেস চাইলে তার npm প্যাকেজ ইনস্টল করে একটি service-এর ভেতরে সংযোগ খুলুন; route-এ তখন `ctx.services.<নাম>` ব্যবহার করুন। migration তখন নিজে সামলাতে হবে।

**SQLite কি production-এ চলে?**

হ্যাঁ, এক সার্ভারে চলা ছোট আর মাঝারি অ্যাপের জন্য। একসাথে অনেক পড়া সামলাতে পারে; লেখা হয় একটি একটি করে, যা বেশিরভাগ অ্যাপের জন্য যথেষ্ট দ্রুত। একাধিক সার্ভারে একই ডেটাবেস লাগলে SQLite উপযুক্ত নয়।

**লগইন আর ব্যবহারকারীর অনুমতি কীভাবে করব?**

v1-এ তৈরি auth নেই। একটি middleware-এ header থেকে token পড়ে যাচাই করুন (`init` প্রজেক্টের `routes/(admin)/middleware.js` দেখুন), আর ব্যবহারকারীর তথ্য রাখুন `ctx.state`-এ। password hash করতে Node.js-এর `node:crypto`-র `scrypt` ব্যবহার করুন।

**TypeScript?**

Adhar সাধারণ JS ফাইল লোড করে; কোনো বিল্ড ধাপ নেই।

**এরর মেসেজ কেমন দেখায়?**

সার্ভার চালুর সময়ই সব route, schema, middleware আর service যাচাই হয়। ভুল থাকলে ফাইল আর সমাধানের ইঙ্গিত আসে:

```
✖ Error: routes/users/route.js
  Unknown export `get`.

  Hint: Did you mean `GET`? Method names are upper-case.
```

## যা Adhar ইচ্ছাকৃতভাবে করে না, আর কেন

- **ORM বা query builder:** SQL নিজেই যথেষ্ট পরিষ্কার, আর শিখলে সব জায়গায় কাজে লাগে।
- **HTML রেন্ডার আর স্ট্যাটিক ফাইল সার্ভ:** সে কাজ Alo-র।
- **`import`, কনফিগারেশন ফাইল, প্লাগইন, ডেকোরেটর, controller ক্লাস:** সবকিছু আসে ফোল্ডার আর ফাইলের নাম থেকে।
- **TypeScript বিল্ড, WebSocket, GraphQL:** ছোট API-তে লাগে না।
- **তৈরি auth, ফাইল আপলোড, rate limit, OpenAPI, catch-all route (`[...path]`):** আসল ব্যবহারকারীরা চাইলে পরে ভাবা হবে।
- **migration-এর "down":** ভুল শোধরানো হয় নতুন migration দিয়ে।

---

## Adhar-এ কাজ করতে চাইলে

```bash
git clone https://github.com/msilabs/adhar.git
cd adhar
npm test
```

- পুরো স্পেক: [docs/SPEC.md](docs/SPEC.md)
- নকশার সিদ্ধান্ত আর তাদের কারণ: [DECISIONS.md](DECISIONS.md)
- নতুন ফিচার প্রস্তাবের আগে স্পেকের অংশ ০-এর তিন প্রশ্ন দেখুন: JS জানা কেউ কি দেখে বুঝবে? শিখতে হয় কি? ছোট API-তে সত্যিই লাগে কি?

## লাইসেন্স

[MIT](LICENSE)
