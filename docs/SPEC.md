# Adhar — ইমপ্লিমেন্টেশন প্ল্যান (v1)

> **Adhar (আধার) — lightweight backend API framework**
> ফোল্ডারে সাধারণ JS ফাংশন লিখুন, পান JSON API: রাউটিং, middleware, ভ্যালিডেশন, service আর SQLite। Node.js ছাড়া আর কিছু লাগে না।
>
> প্যাকেজ: `@msilabs/adhar` · CLI: `adhar` · জোড়া প্রজেক্ট: [Alo](https://github.com/msilabs/alo) (স্ট্যাটিক ফ্রন্টএন্ড)

> **Claude-এর জন্য নির্দেশনা:** কোড লেখার আগে পুরো ডকুমেন্ট পড়ুন। অংশ ১৯-এর মাইলস্টোন একটি একটি করে শেষ করুন, প্রতিটির শেষে `npm test` চালান, সারাংশ দিন, তারপর অনুমোদনের অপেক্ষা করুন। অস্পষ্ট বা পরস্পরবিরোধী কিছু পেলে বড় সিদ্ধান্ত নিজে নেবেন না, আগে বিকল্প আর সুপারিশসহ জিজ্ঞাসা করুন। ছোট সিদ্ধান্ত লিখুন `DECISIONS.md`-তে; শুরু অংশ ২১-এর তালিকা দিয়ে। অংশ ২-এর "কখনো না" তালিকায় কিছু যোগ করবেন না। নতুন ফিচারের আগে অংশ ০-এর তিন প্রশ্নের পরীক্ষা করুন।

---

## ০. এক পাতায় Adhar

এই অংশই ফ্রেমওয়ার্কের পরিচয়। এখানে যা নেই, ব্যবহারকারীকে তা শিখতে হবে না।

1. **Route:** `routes/users/route.js` মানে `/users`। ফাইলে `GET`, `POST`, `PUT`, `PATCH`, `DELETE` নামে ফাংশন export করুন।
2. **উত্তর:** ফাংশন যা return করে, তা-ই JSON হয়ে যায়।
3. **ডায়নামিক route:** `routes/users/[id]/route.js` মানে `/users/:id`; মান থাকে `ctx.params.id`-তে।
4. **Middleware:** `middleware.js` তার ফোল্ডারের সব route-এর আগে চলে। পরের ধাপে যেতে `next()`।
5. **Service:** `services/users.js` হয় `ctx.services.users`। ফোল্ডারে থাকলে `services/blog/posts.js` হয় `ctx.services.blog.posts`।
6. **Database:** `ctx.db` দিয়ে SQL চালানো। টেবিল বানানো হয় `migrations/001-নাম.sql` ফাইলে।
7. **ভ্যালিডেশন:** route ফাইলে `schema` export করলে ভুল ইনপুট handler পর্যন্ত পৌঁছায় না।
8. **ভুল:** `throw ctx.error(404, 'Not found')`।

### পুরো `ctx`

| লিখবেন                         | কাজ                                              |
| ------------------------------ | ------------------------------------------------ |
| `ctx.params`                   | URL-এর `[নাম]` অংশের মান                         |
| `ctx.query`                    | `?page=2` অংশ                                    |
| `ctx.body`                     | request-এর JSON body                             |
| `ctx.headers`                  | request header (নাম ছোট হাতের)                   |
| `ctx.method`, `ctx.path`       | HTTP method আর path                              |
| `ctx.services`                 | `services/` ফোল্ডারের সবকিছু                     |
| `ctx.db`                       | SQLite: `all`, `get`, `run`, `transaction`       |
| `ctx.env`                      | `.env` ফাইল আর পরিবেশের ভেরিয়েবল                |
| `ctx.state`                    | middleware থেকে handler-এ তথ্য পাঠানোর জায়গা     |
| `ctx.status(201)`              | response-এর status বদলানো                        |
| `ctx.header('X-Total', '42')`  | response header বসানো                            |
| `ctx.error(404, 'Not found')`  | throw করার জন্য HTTP ভুল বানানো                  |

`ctx` ("context"-এর সংক্ষেপ) শুধু প্যারামিটারের নাম; ফ্রেমওয়ার্ক কোনো নাম বাধ্য করে না। README, টেমপ্লেট আর `AGENTS.md`-তে সবখানে `ctx` লেখা হবে। Destructuring-ও চলে, method সহ: `export function GET({ params, services, error })`; তাই `status`, `header`, `error` `this`-এর ওপর নির্ভর করবে না। এটি থাকবে README-র "পরে দেখুন" অংশে।

### নতুন ফিচারের পরীক্ষা (তিন প্রশ্ন)

1. **JS জানা কেউ ফাইলটি দেখে কি অনুমান করতে পারবে কী হচ্ছে?**
2. **ব্যবহারকারীকে কি এটি শিখতে হয়, নাকি নিজে থেকেই ঘটে?**
3. **ছোট API-র (ব্লগ, todo, ছোট ব্যবসার অ্যাপ) কি সত্যিই এটি লাগে?**

প্রথম প্রশ্নে "না" হলে ফিচারটি যোগ হবে না। দ্বিতীয়তে "শিখতে হয়" আর তৃতীয়তে "না" হলে পরে ভাবা হবে।

---

## ১. লক্ষ্য ও মূলনীতি

Adhar একটি রানটাইম সার্ভার ফ্রেমওয়ার্ক, শুধু JSON API-র জন্য। HTML রেন্ডার করে না, স্ট্যাটিক ফাইল দেয় না; সেই কাজ Alo-র।

এই নীতিগুলো ভাঙা যাবে না:

1. **খাঁটি JS।** নতুন ভাষা, ডেকোরেটর, ক্লাস-ভিত্তিক কাঠামো নেই। Route মানে ফাংশন, service মানে object।
2. **কোনো ইমপোর্ট নয়।** route, middleware আর service-এ ফ্রেমওয়ার্ক বা প্রজেক্টের অন্য ফাইল `import` করতে হয় না; সব আসে `ctx` দিয়ে, ফাইলের অবস্থান দেখে। (নিজের পছন্দের npm প্যাকেজ import করা যাবে; সেটি সাধারণ JS।)
3. **জিরো ডিপেন্ডেন্সি।** শুধু Node.js-এর বিল্ট-ইন মডিউল (`http`, `fs`, `path`, `node:sqlite`, `crypto`, `node:test`)। dev-ডিপেন্ডেন্সিও নয়।
4. **জিরো কনফিগারেশন।** কনফিগ ফাইল নেই। আচরণ ঠিক হয় ফোল্ডার আর ফাইলের নাম থেকে। পরিবেশ অনুযায়ী যা বদলায় (পোর্ট, secret) তা থাকে `.env`-এ। CLI ফ্ল্যাগ একটিই: `--port`।
5. **Node.js ≥ 22.13।** flag ছাড়া `node:sqlite` আর `require()` দিয়ে ESM লোড, দুটোই এই ভার্সন থেকে। CI: 22, 24, 26। CLI শুরুতেই ভার্সন যাচাই করে।
6. **পাঁচ মিনিটে শেখা যায়।** অংশ ০ পড়লেই কাজ শুরু করা যায়।
7. **যা স্বাভাবিক, তা-ই ঘটে।** object return করলে JSON; কিছু না করলে 204; schema-র বাইরের field নিজে থেকে বাদ।
8. **নিরাপদ ডিফল্ট।** body-র সীমা, প্যারামিটারযুক্ত SQL, production-এ stack লুকানো, CORS ডিফল্টে বন্ধ।
9. **ভালো এরর মেসেজ।** ফাইলের পাথ, সম্ভব হলে লাইন, আর সমাধানের ইঙ্গিত। টার্মিনালের সব লেখা ইংরেজিতে (Alo `DECISIONS.md` #৮৪-র কারণেই)।
10. **চালুর সময়েই ভুল ধরা।** সব route, schema, middleware, service সার্ভার চালুর সময় লোড আর যাচাই হয়; প্রথম request-এর অপেক্ষায় থাকে না।
11. **core আর cli আলাদা।** core পোর্ট খোলে না, টার্মিনালে লেখে না; `createApp()` একটি app দেয় যাকে `inject()` দিয়ে পরীক্ষা করা যায়। পোর্ট, watch, লগ cli-র কাজ।

---

## ২. স্কোপ

### v1

Route, ডায়নামিক অংশ, route গ্রুপ, middleware, schema ভ্যালিডেশন, service, SQLite + migration, `.env`, CORS, dev server, production server, `init`, `new`, `routes`, `migrate`, `AGENTS.md`।

### পরে ভাবা হবে (আসল ব্যবহারকারীরা চাইলে)

- Auth helper: `node:crypto` দিয়ে password hash আর signed token
- `schema` থেকে OpenAPI (`adhar docs`)
- File upload (multipart), catch-all route `[...path]`, rate limit, cookie helper
- Alo + Adhar একসাথে চালানোর নির্দেশিকা

### কখনো না

- ORM বা query builder
- HTML টেমপ্লেট রেন্ডার, স্ট্যাটিক ফাইল সার্ভ (Alo আছে)
- কনফিগ ফাইল, plugin সিস্টেম
- ডেকোরেটর, dependency injection container, ক্লাস-ভিত্তিক controller
- TypeScript বিল্ড ধাপ
- WebSocket, GraphQL

### বাতিল করা বিকল্প (আবার আনবে না)

| বিকল্প | কেন বাতিল |
| --- | --- |
| প্রতি method আলাদা ফাইল (`get.js`, `post.js`) | একই resource অনেক ফাইলে ছড়ায় |
| `.adhar` single-file ফরম্যাট | নিজস্ব parser আর এডিটর এক্সটেনশন লাগে, লাভ কম |
| service-এ সাধারণ `import` | relative path-এর ঝামেলা; "কোনো ইমপোর্ট নয়" নীতি ভাঙে |
| ব্যবহারকারীর ফাইলে CommonJS | নতুনরা ESM শেখে |
| JSON ফাইল store | একসাথে লেখায় দুর্বল; production-এ অচল |

---

## ৩. ইনস্টল আর প্রজেক্ট শুরু

```bash
npx @msilabs/adhar init my-api
cd my-api
npm install
node adhar dev
```

রুটের `adhar` ফাইল (এক্সটেনশন ছাড়া), Alo-র `alo` ফাইলের মতোই:

```js
#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
try {
    require('@msilabs/adhar/cli');
} catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && String(e.message).includes('@msilabs/adhar')) {
        console.error('Adhar is not installed. Run `npm install` first.');
        process.exit(1);
    }
    throw e;
}
```

(প্রজেক্টের `package.json`-এ `"type": "module"`, তাই এক্সটেনশন ছাড়া ফাইলটিও ESM।)

`init` যে `package.json` বানায়:

```json
{
    "name": "my-api",
    "private": true,
    "type": "module",
    "engines": { "node": ">=22.13" },
    "scripts": {
        "dev": "adhar dev",
        "start": "adhar start",
        "migrate": "adhar migrate"
    },
    "dependencies": {
        "@msilabs/adhar": "^<বর্তমান ভার্সন>"
    }
}
```

Alo-তে প্যাকেজটি `devDependencies`-এ, কারণ বিল্ডের পর লাগে না। Adhar production-এও চলে, তাই `dependencies`।

`init` আরও বানায়: উদাহরণ route, middleware, service, migration; `.env` আর `.env.example`; `.gitignore` (`node_modules/`, `storage/`, `.env`); `AGENTS.md`।

---

## ৪. ব্যবহারকারী প্রজেক্টের গঠন

```
my-api/
├── adhar
├── routes/
│   ├── middleware.js         ← সব route-এ
│   ├── route.js              → /
│   ├── not-found.js          ← ঐচ্ছিক: নিজের 404
│   ├── users/
│   │   ├── route.js          → /users
│   │   └── [id]/
│   │       └── route.js      → /users/:id
│   └── (admin)/
│       ├── middleware.js     ← শুধু এই গ্রুপে
│       └── stats/
│           └── route.js      → /stats
├── services/
│   ├── users.js              → ctx.services.users
│   └── blog/
│       └── posts.js          → ctx.services.blog.posts
├── migrations/
│   └── 001-create-users.sql
├── storage/
│   └── app.db                ← নিজে তৈরি হয়
├── .env
├── AGENTS.md
└── package.json
```

`routes/` বাধ্যতামূলক। `services/`, `migrations/`, `.env` ঐচ্ছিক। এর বাইরের ফোল্ডার (যেমন `lib/`) Adhar ছোঁয় না।

---

## ৫. Route

### ফাইল থেকে URL

- `routes/<ফোল্ডার>/route.js` → `/<ফোল্ডার>`। `routes/route.js` → `/`।
- `[নাম]` ফোল্ডার একটি path অংশের সাথে মেলে; মান `ctx.params.নাম`-এ, URL-decode করা string। একাধিক লেভেলে থাকতে পারে: `routes/users/[id]/posts/[postId]/route.js`।
- `(নাম)` ফোল্ডার URL-এ আসে না; শুধু সাজানো আর middleware ভাগ করার জন্য।
- শেষের `/` উপেক্ষিত: `/users/` আর `/users` একই।
- স্থির অংশ ডায়নামিকের আগে মেলে: `/users/me` যায় `users/me/route.js`-এ, `users/[id]/route.js`-এ নয়।
- ফোল্ডারের নাম: ছোট হাতের অক্ষর, সংখ্যা, `-`। `[নাম]`-এর ভেতরে JS identifier।

চালুর সময়ের ভুল (ফাইলের পাথ + ইঙ্গিতসহ):

- দুই ফাইল একই URL দেয় (যেমন `(a)/users/route.js` আর `(b)/users/route.js`)
- একই জায়গায় দুই ভিন্ন নামের ডায়নামিক ফোল্ডার (`[id]` আর `[slug]`)
- একই path-এ এক প্যারামিটারের নাম দুবার
- `routes/`-এর ভেতরে `route.js`, `middleware.js`, `not-found.js` ছাড়া অন্য `.js` ফাইল (ইঙ্গিত: "helper রাখুন `services/`-এ")। `not-found.js` শুধু `routes/`-এর রুটে।

### Handler

```js
// routes/users/route.js
export function GET(ctx) {
    return ctx.services.users.all();
}

export function POST(ctx) {
    ctx.status(201);
    return ctx.services.users.create(ctx.body);
}
```

- অনুমোদিত export: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `schema`। অন্য কিছু (যেমন `get`, `Get`, `default`) চালুর সময়ের ভুল, কাছাকাছি নামের ইঙ্গিতসহ।
- Handler sync বা async দুটোই হতে পারে।
- `HEAD` নিজে থেকে `GET` দিয়ে চলে, body ছাড়া। `OPTIONS` নিজে থেকে উত্তর পায় (`Allow` header, CORS preflight)।

### Return থেকে response

| return | response |
| --- | --- |
| object বা array | `200`, `application/json` |
| `undefined` | `204`, body নেই |
| string | `200`, `text/plain; charset=utf-8` |
| number, boolean, `null` | `200`, JSON |

`ctx.status(n)` আর `ctx.header(name, value)` যেকোনো সময় ডাকা যায়; দুটোই `ctx` ফেরত দেয়। `ctx.status()` দিয়ে status বসালে সেটিই থাকে, return যা-ই হোক।

### ভুল

```js
export function GET(ctx) {
    const user = ctx.services.users.find(ctx.params.id);
    if (!user) throw ctx.error(404, 'User not found');
    return user;
}
```

সব ভুলের একই আকার:

```json
{ "error": { "status": 404, "message": "User not found" } }
```

- `ctx.error(status, message)`: status 400–599।
- route নেই → `404` `Not found`।
- route আছে, method নেই → `405` আর `Allow` header।
- অন্য যেকোনো throw → `500`। dev-এ `message` আর `stack` response-এ থাকে, টার্মিনালেও ছাপা হয়। production-এ response-এ শুধু `Internal server error`; বিস্তারিত যায় stderr-এ।

### `not-found.js`

```js
// routes/not-found.js
export default function (ctx) {
    ctx.status(404);
    return { error: { status: 404, message: `No route for ${ctx.path}` } };
}
```

রুটের middleware-এর পরে চলে।

---

## ৬. Request

- `ctx.query`: query string থেকে object। একই নাম একাধিকবার এলে array।
- `ctx.body`: `Content-Type` অনুযায়ী পার্স হয়।
  - `application/json` → পার্স করা মান। ভাঙা JSON → `400` `Invalid JSON body`।
  - `application/x-www-form-urlencoded` → object।
  - body নেই → `undefined`।
  - অন্য `Content-Type`-এ body থাকলে → `415`।
- body-র সীমা 1MB; বেশি হলে `413`।
- `ctx.headers`: Node-এর মতো, নাম ছোট হাতের।
- `ctx.path`: query ছাড়া, শেষের `/` ছাড়া।

---

## ৭. Middleware

```js
// routes/(admin)/middleware.js
export default async function (ctx, next) {
    if (ctx.headers.authorization !== `Bearer ${ctx.env.ADMIN_TOKEN}`) {
        throw ctx.error(401, 'Login required');
    }
    ctx.state.admin = true;
    return next();
}
```

- একটিই export: `default`, ফাংশন `(ctx, next)`।
- ক্রম Alo-র layout-এর মতো: `routes/middleware.js` সবার আগে, তারপর ভেতরের ফোল্ডারগুলো, শেষে handler।
- `next()` পরের ধাপ চালায় আর তার return মান দেয় (Promise)। middleware যা return করে সেটিই response; তাই স্বাভাবিক রূপ `return next()`।
- `next()` না ডেকে কিছু return করলে handler চলে না, সেই মানই response।
- `next()`-এর পরে কাজ করা যায় (যেমন সময় মাপা, header বসানো)।
- একই request-এ `next()` দুবার ডাকলে ভুল।
- `404` আর `405`-এ শুধু রুটের `routes/middleware.js` চলে (লগের মতো কাজ যেন সবখানে হয়); ভেতরের ফোল্ডারের middleware চলে না।

---

## ৮. ভ্যালিডেশন (`schema`)

```js
export const schema = {
    GET: { query: { page: 'integer?', search: 'string?' } },
    POST: { body: { name: 'string', email: 'email', age: 'number?', tags: 'array?' } },
};
```

- চাবি: method → `body` | `query` | `params` → field → টাইপ।
- টাইপ: `string`, `number`, `integer`, `boolean`, `email`, `array`, `object`। শেষে `?` মানে ঐচ্ছিক; না থাকলে বাধ্যতামূলক।
- `string` বাধ্যতামূলক হলে ফাঁকা string (`''`) গ্রহণযোগ্য নয়।
- `query` আর `params`-এর মান string হয়ে আসে, তাই `number`, `integer`, `boolean` নিজে থেকে রূপান্তর হয় (`'2'` → `2`, `'true'` → `true`)। `body`-তে রূপান্তর হয় না।
- schema থাকলে `body` আর `query`-র schema-র বাইরের field বাদ পড়ে (mass assignment থেকে সুরক্ষা)।
- না মিললে handler আর পরের middleware চলে না:

```json
{
    "error": {
        "status": 422,
        "message": "Validation failed",
        "fields": { "email": "must be a valid email", "name": "is required" }
    }
}
```

- ভ্যালিডেশন চলে middleware চেইনের পরে, handler-এর ঠিক আগে (auth আগে, তারপর ইনপুট)।
- চালুর সময়ের ভুল: অজানা টাইপ (কাছাকাছি নামের ইঙ্গিতসহ), অজানা method, export নেই এমন method-এর schema, `GET`/`DELETE`-এ `body`, `params`-এ এমন নাম যা path-এ নেই।
- এর বেশি (দৈর্ঘ্য, pattern, নেস্টেড object) handler-এ সাধারণ JS দিয়ে; v1-এ schema ইচ্ছাকৃতভাবে ছোট।

---

## ৯. Service

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

- একটিই export: `default`, একটি factory ফাংশন। পায় `{ db, env, services }`, ফেরত দেয় একটি object।
- সার্ভার চালুর সময় প্রতিটি factory একবার চলে।
- নাম আসে ফাইলের অবস্থান থেকে: `services/users.js` → `services.users`; `services/blog/posts.js` → `services.blog.posts`।
- ফাইল আর ফোল্ডারের নাম JS identifier (camelCase)। একই নামে ফাইল আর ফোল্ডার (`blog.js` আর `blog/`) ভুল।
- এক service অন্যটিকে ডাকতে পারে `services` দিয়ে, কিন্তু শুধু method-এর ভেতরে (factory চলার সময় অন্যগুলো তখনো তৈরি নাও হতে পারে)। factory-র ভেতরে সরাসরি ছুঁলে পরিষ্কার ভুল।
- route-এ ভুল নাম (`ctx.services.user`) লিখলে ভুল, কাছাকাছি নামের ইঙ্গিতসহ।
- service-এ `ctx` নেই; request-এর তথ্য লাগলে route থেকে আর্গুমেন্ট হিসেবে পাঠান। এতে service পরীক্ষা করা সহজ থাকে।

---

## ১০. Database

`node:sqlite`-এর পাতলা মোড়ক; নতুন কিছু শেখার নেই, SQL-ই।

| ডাক | ফেরত |
| --- | --- |
| `db.all(sql, ...params)` | সারির array |
| `db.get(sql, ...params)` | প্রথম সারি বা `undefined` |
| `db.run(sql, ...params)` | `{ changes, lastId }` |
| `db.transaction(fn)` | `fn`-এর return; ভুল হলে rollback |

- ফাইল: `storage/app.db`, দরকার হলে নিজে তৈরি হয়। `.env`-এ `DATABASE_PATH` দিয়ে বদলানো যায়; `:memory:` চলে (টেস্টে কাজে লাগে)।
- খোলার সময়: `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`।
- মান বসে শুধু `?` দিয়ে। README আর `AGENTS.md`-তে স্পষ্ট নিয়ম: SQL-এ string জোড়া লাগানো নয়।
- `transaction(fn)`-এর `fn` sync হতে হবে (`node:sqlite` sync); Promise ফেরত দিলে ভুল।
- SQL-এর ভুলে মূল SQLite মেসেজ থাকে, সাথে ডাকার জায়গা।
- `db` প্রথম ব্যবহারে খোলে; যে প্রজেক্ট DB ব্যবহার করে না তার `storage/` তৈরি হয় না।

### Migration

- `migrations/NNN-নাম.sql`: তিন অঙ্কের নম্বর, তারপর `-`, তারপর নাম। ক্রম নম্বর অনুযায়ী।
- প্রতিটি ফাইল একটি transaction-এ চলে; চালানো ফাইলের নাম থাকে `_migrations` টেবিলে।
- `adhar dev` চালু আর restart-এ বাকিগুলো নিজে চালায়।
- `adhar start` চালায় না; বাকি থাকলে চালু হয় না, ইঙ্গিত: "run `node adhar migrate`"।
- একই নম্বর দুই ফাইলে, বা নামের ধরন ভুল → ভুল।
- rollback (`down`) নেই; ভুল শোধরাতে নতুন migration। dev-এ `storage/app.db` মুছে আবার চালানো যায়।

---

## ১১. `.env` আর CORS

- প্রজেক্ট রুটের `.env` চালুর সময় পড়া হয় (`node:util`-এর `parseEnv`)। আগে থেকে থাকা পরিবেশের ভেরিয়েবল প্রাধান্য পায়।
- `ctx.env` আর service-এর `env`: অপরিবর্তনীয় object।
- Adhar নিজে যে নামগুলো পড়ে:

| নাম | কাজ | ডিফল্ট |
| --- | --- | --- |
| `PORT` | পোর্ট (`--port` প্রাধান্য পায়) | `8134` |
| `CORS_ORIGIN` | অনুমোদিত origin; কমা দিয়ে একাধিক, বা `*` | নেই (CORS বন্ধ) |
| `DATABASE_PATH` | SQLite ফাইল | `storage/app.db` |
| `NODE_ENV` | `dev` বসায় `development`, `start` বসায় `production` (আগে থেকে না থাকলে) | |

- `CORS_ORIGIN` থাকলে: মিলে যাওয়া origin-এ `Access-Control-Allow-Origin`, `Vary: Origin`; preflight (`OPTIONS`)-এর উত্তরে route-এর method তালিকা আর অনুরোধ করা header। `Access-Control-Allow-Credentials` v1-এ নেই।

---

## ১২. সার্ভার

- `adhar dev`:
  - parent প্রসেস `routes/`, `services/`, `migrations/`, `.env` দেখে (`fs.watch`, recursive, ছোট debounce); বদল হলে worker প্রসেস বন্ধ করে নতুন চালায়। ESM-এর cache মোছা যায় না, তাই restart।
  - worker চালুতে ভুল হলে parent বেঁচে থাকে, ভুল দেখায়, পরের বদলের অপেক্ষা করে।
  - প্রতি request-এ এক লাইন: `GET /users 200 3ms`।
  - পোর্ট ব্যস্ত হলে পরিষ্কার ভুল আর `--port`-এর ইঙ্গিত।
- `adhar start`: একটি প্রসেস, watch নেই। request লগ একই ধরনের। `SIGTERM`/`SIGINT`-এ নতুন সংযোগ নেওয়া বন্ধ, চলমান request শেষ, DB বন্ধ, তারপর exit (সর্বোচ্চ ১০ সেকেন্ড)।
- handler-এর ভুলে প্রসেস মরে না; `unhandledRejection` লগ হয়।

---

## ১৩. এরর আর সতর্কবার্তা

`AdharError` (Alo-র `AloError`-এর মতো): `message`, `file`, `line`, `hint`। ছাপার ধরন:

```
✖ Error: Unknown export `get` in routes/users/route.js

  Hint: Did you mean `GET`? Method names are uppercase.
```

চালুর সময়ের ভুলগুলো (অংশ ৫, ৭, ৮, ৯, ১০-এ বলা) সব এই ধরনে। সম্ভব হলে `suggest()` দিয়ে কাছাকাছি নাম।

সতর্কবার্তা (চালু থামে না): `routes/`-এ কোনো route নেই; `.env`-এ `CORS_ORIGIN=*` আর `NODE_ENV=production`।

---

## ১৪. CLI

```
adhar init [folder]               create a new project
adhar dev [--port 8134]           dev server, restarts on change
adhar start [--port 8134]         production server
adhar routes                      list all routes
adhar migrate                     run pending migrations
adhar new route "users/[id]"      routes/users/[id]/route.js
adhar new middleware "(admin)"    routes/(admin)/middleware.js
adhar new service blog/posts      services/blog/posts.js
adhar new migration create-posts  migrations/<next number>-create-posts.sql
adhar --help
adhar --version
```

- অজানা কমান্ড বা ফ্ল্যাগে কাছাকাছি নামের ইঙ্গিত।
- `adhar routes`-এর আউটপুট:

```
GET     /users          routes/users/route.js
POST    /users          routes/users/route.js
GET     /users/:id      routes/users/[id]/route.js
```

- `new` আগে থেকে থাকা ফাইল বদলায় না; ভুল দেয়।
- `new route`-এর টেমপ্লেটে একটি `GET`; `new migration` পরের নম্বর নিজে বসায়।

---

## ১৫. ফ্রেমওয়ার্কের সোর্স কোডের গঠন

CommonJS, Alo-র মতো।

```
adhar/
├── bin/adhar.js
├── cli/
│   ├── index.js        ← ভার্সন যাচাই, arg parser, কমান্ড বাছাই
│   ├── dev.js          ← watch + worker restart
│   ├── start.js
│   ├── worker.js       ← createApp + listen (dev আর start দুটোই ব্যবহার করে)
│   ├── routes.js
│   ├── migrate.js
│   ├── scaffold.js     ← init, new
│   └── log.js
├── core/
│   ├── app.js          ← createApp(root): সব লোড, যাচাই; handle(), inject(), close()
│   ├── router.js       ← routes/ স্ক্যান, মেলানো
│   ├── context.js      ← ctx
│   ├── middleware.js   ← চেইন
│   ├── validate.js     ← schema
│   ├── services.js
│   ├── db.js
│   ├── migrations.js
│   ├── body.js
│   ├── response.js     ← return মান থেকে response
│   ├── cors.js
│   ├── env.js
│   └── errors.js       ← AdharError, HttpError, suggest
├── templates/init/
├── test/
├── docs/SPEC.md
├── DECISIONS.md
├── README.md
├── CHANGELOG.md
├── LICENSE             ← MIT
└── llms.txt
```

Alo থেকে কপি করে মানিয়ে নেওয়া (dependency নয়; দুই প্যাকেজ স্বাধীন):

| Alo | Adhar-এ |
| --- | --- |
| `core/errors.js` | `AdharError`, `suggest()` |
| `cli/log.js` | হুবহু ধরন |
| `cli/index.js` | Node ভার্সন যাচাই, `parseArgs`, `validateFlags`, HELP |
| `core/routes.js` | ফোল্ডার স্ক্যান, `[param]`, `(group)` |
| `cli/scaffold.js` | `init`, `new` |
| `test/helpers/` | অস্থায়ী প্রজেক্ট বানানোর helper |
| `.github/workflows/ci.yml` | Node 22, 24, 26 |

`package.json`: `"exports": { "./cli": "./cli/index.js", ".": "./core/app.js" }`। `.` থাকায় ব্যবহারকারী নিজের টেস্টে `createApp` পায়।

### `app.inject()`

```js
const app = await createApp(projectRoot);
const res = await app.inject({ method: 'POST', path: '/users', body: { name: 'A', email: 'a@b.c' } });
// res: { status, headers, body }  ← body পার্স করা JSON
await app.close();
```

পোর্ট খোলে না। ফ্রেমওয়ার্কের নিজের প্রায় সব টেস্ট এটি দিয়ে।

---

## ১৬. `init` টেমপ্লেট

ছোট কিন্তু অংশ ০-এর আটটি বিষয়ই দেখায়:

- `routes/route.js`: `{ name, version }`
- `routes/middleware.js`: `X-Response-Time` header (`next()`-এর পরে কাজের উদাহরণ)
- `routes/notes/route.js`: `GET` (তালিকা), `POST` (schema সহ)
- `routes/notes/[id]/route.js`: `GET`, `PATCH`, `DELETE`, 404-এর উদাহরণ
- `routes/(admin)/middleware.js` + `routes/(admin)/stats/route.js`: token যাচাই
- `services/notes.js`
- `migrations/001-create-notes.sql`
- `.env`, `.env.example`: `PORT`, `ADMIN_TOKEN`
- `AGENTS.md`: ইংরেজিতে কঠোর নিয়ম, গঠন, `ctx`, সাধারণ ভুলের তালিকা (Express/Next.js ধরনে না লেখা: `req, res` নেই, `res.json()` নেই, `import express` নেই)

---

## ১৭. README (বাংলায়)

Alo-র README-র ক্রম অনুসরণ: Adhar কী → শুরু করা → AI সহকারী → এক পাতায় Adhar → Route → Middleware → ভ্যালিডেশন → Service → Database → `.env` আর CORS → কমান্ড → টেস্ট লেখা (`inject`) → ডিপ্লয় (যেকোনো Node হোস্ট; `storage/` স্থায়ী ডিস্কে) → Alo-র সাথে ব্যবহার → FAQ → যা Adhar ইচ্ছাকৃতভাবে করে না।

---

## ১৮. টেস্ট

`node --test "test/**/*.test.js"`। dependency নেই।

- unit: `router`, `validate`, `body`, `response`, `env`, `cors`, `errors`, CLI arg parser
- `inject` দিয়ে: route, method, 404/405, middleware ক্রম, schema, service, db, migration
- আসল পোর্টে: `start` (graceful shutdown), `dev` (ফাইল বদলে restart), পোর্ট ব্যস্ত
- scaffold: `init` করা প্রজেক্ট চালু হয় আর উদাহরণ route উত্তর দেয়
- e2e: পুরো উদাহরণ প্রজেক্টে CRUD চক্র
- প্রতিটি চালুর-সময়ের ভুলের জন্য একটি টেস্ট: মেসেজ, ফাইল, ইঙ্গিত

---

## ১৯. কাজের ধাপ (মাইলস্টোন)

| # | ধাপ | শেষ হলে যা চলে |
| --- | --- | --- |
| ১ | ভিত্তি: `package.json`, `bin`, CLI arg parser, `errors`, `log` | `adhar --help`, `--version`, অজানা কমান্ডে ইঙ্গিত |
| ২ | HTTP core: `app`, `context`, `response`, `body`, ভুলের ফরম্যাট, `inject` | হাতে দেওয়া এক handler-এ request/response |
| ৩ | Routing: স্ক্যান, `[id]`, `(group)`, 404/405, HEAD/OPTIONS, `adhar routes` | ফোল্ডার থেকে route |
| ৪ | Middleware চেইন, `not-found.js` | নেস্টেড middleware |
| ৫ | Schema ভ্যালিডেশন | 422 |
| ৬ | Service auto-inject | `ctx.services` |
| ৭ | Database: `db`, migration, `adhar migrate` | CRUD |
| ৮ | `.env`, CORS, `adhar start`, graceful shutdown | production server |
| ৯ | `adhar dev`: watch + restart, request লগ | dev server |
| ১০ | `adhar init`, `adhar new`, টেমপ্লেট, `AGENTS.md` | `npx … init` থেকে চালু |
| ১১ | README, `llms.txt`, e2e, CI, release যাচাই | প্রকাশের জন্য প্রস্তুত |

প্রতিটির শেষে থামা আর অনুমোদন নেওয়া। Git commit সবসময় জিজ্ঞাসা করে।

---

## ২০. গ্রহণযোগ্যতার মানদণ্ড

- `npx @msilabs/adhar init x && cd x && npm install && node adhar dev` কাজ করে, আর `curl localhost:8134/notes` JSON দেয়
- অংশ ০-এর আটটি বিষয়ের প্রতিটি টেমপ্লেটে আছে আর টেস্টে ঢাকা
- `package.json`-এ কোনো dependency নেই
- Node 22.13, 24, 26-এ সব টেস্ট পাস
- প্রতিটি চালুর-সময়ের ভুলে ফাইল আর ইঙ্গিত আছে
- একটি AI সহকারী শুধু `AGENTS.md` পড়ে সঠিক route, service আর migration লিখতে পারে

---

## ২১. আগেই নেওয়া সিদ্ধান্ত (`DECISIONS.md`-এর শুরু)

| # | সিদ্ধান্ত | কারণ |
| --- | --- | --- |
| ১ | অংশ ০ ফ্রেমওয়ার্কের সীমানা; নতুন কিছুর আগে তিন প্রশ্ন | পাঁচ মিনিটে শেখা যায় |
| ২ | ফোল্ডারে `route.js`, method নামে export | একটি resource এক ফাইলে; সাধারণ JS (মালিক, ২০২৬-১১-১১) |
| ৩ | service auto-inject, `ctx.services` | Alo-র "কোনো ইমপোর্ট নয়" (মালিক, ২০২৬-১১-১১) |
| ৪ | Database: `node:sqlite` | জিরো ডিপেন্ডেন্সি; আসল SQL (মালিক, ২০২৬-১১-১১) |
| ৫ | ব্যবহারকারীর ফাইল ESM, core CommonJS | আধুনিক মান; Alo-র core-এর সাথে মিল (মালিক, ২০২৬-১১-১১) |
| ৬ | service একটি factory: `export default ({ db, env, services }) => ({ … })` | সাধারণ closure; লুকানো আর্গুমেন্ট নেই |
| ৭ | service-এ `ctx` নেই | পরীক্ষা সহজ; request আর ব্যবসার লজিক আলাদা |
| ৮ | Node ≥ 22.13 | flag ছাড়া `node:sqlite` আর `require(esm)` |
| ৯ | dev-এ ফাইল বদলালে worker প্রসেস restart | ESM cache মোছা যায় না |
| ১০ | schema-র বাইরের field বাদ পড়ে | নিরাপদ ডিফল্ট |
| ১১ | `query`/`params`-এ সংখ্যা আর বুলিয়ান রূপান্তর হয়; `body`-তে নয় | URL-এ সবই string; JSON-এ টাইপ আছে |
| ১২ | ভ্যালিডেশন middleware-এর পরে | auth আগে, ইনপুট পরে |
| ১৩ | `undefined` return → 204 | যা স্বাভাবিক, তা-ই ঘটে |
| ১৪ | `adhar start` migration চালায় না; বাকি থাকলে চালু হয় না | production-এ DB বদল সচেতন পদক্ষেপ |
| ১৫ | migration-এ `down` নেই | শেখার বিষয় কম; নতুন migration-ই সমাধান |
| ১৬ | CORS ডিফল্টে বন্ধ; `.env`-এর `CORS_ORIGIN` | নিরাপদ ডিফল্ট; কনফিগ ফাইল নেই |
| ১৭ | প্যাকেজ প্রজেক্টের `dependencies`-এ | production-এ চলে |
| ১৮ | `[param]` একাধিক লেভেলে চলে (Alo-তে এক লেভেল) | API-তে `/users/:id/posts/:postId` সাধারণ |
| ১৯ | auth helper, OpenAPI, upload, catch-all → পরে | আগে আসল ব্যবহার দেখা |
| ২০ | ডকুমেন্টেশনে প্যারামিটারের নাম `ctx`; destructuring-ও চলে, method সহ | প্রচলিত আর ছোট; AI সহকারীরা চেনে (মালিক, ২০২৬-১১-১১) |
