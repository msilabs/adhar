# Adhar 1.2.0 — পরিকল্পনা: `web/` (full stack)

অবস্থা: সম্পন্ন; 1.2.0 প্রকাশিত (২০২৬-১১-১২)। এটি ইতিহাসের জন্য রাখা; চলতি নিয়ম আছে [SPEC.md](SPEC.md)-এর অংশ ২২ আর [DECISIONS.md](../DECISIONS.md)-এ (#১১৪–#১৩৭)।

এই পরিকল্পনা ধরে নেয় 1.1.0 প্রকাশিত: ফোল্ডারের নাম `api/`, আর সব ঠিকানা `/api` দিয়ে শুরু ([PLAN-1.1.md](PLAN-1.1.md))। 1.2.0 তার ওপরে `web/` যোগ করে। এতে কোনো ভাঙা পরিবর্তন নেই: `web/` ফোল্ডার না থাকলে প্রজেক্টের আচরণ 1.1.0-র মতোই থাকে।

আগের খসড়ার খোলা প্রশ্নগুলোর উত্তর এখন অংশ ২-এ সিদ্ধান্ত হিসেবে আছে। কাজের প্রথম ধাপ: এগুলো `docs/SPEC.md` আর `DECISIONS.md`-এ তোলা (মাইলস্টোন ০)।

---

## ১. লক্ষ্য

Adhar দুইভাবে ব্যবহার হবে:

1. **শুধু API।** 1.1.0-তে যা আছে তা-ই: `api/`, `services/`, `migrations/`। ডাকে আলাদা Alo সাইট, মোবাইল অ্যাপ বা অন্য কিছু। এই ভার্সনে এর কিছুই বদলায় না।
2. **Full stack।** একই প্রজেক্ট, API-র দিকে কিছু বদলায় না। বাড়তি শুধু দুটি জিনিস: রুটের `package.json`-এর `devDependencies`-এ `@msilabs/alo`, আর একটি `web/` ফোল্ডার যার ভেতরে Alo-র নিজের ফোল্ডারগুলো। API আর সাইট এক পোর্টে, এক ডিপ্লয়ে।

শুধু-API প্রজেক্ট পরে full stack হতে পারে, API-র কোনো ঠিকানা না বদলে (অংশ ৩)।

মূল নিয়ম: **Adhar-এর ভেতরে Alo থাকতে পারে, Alo-র ভেতরে Adhar কখনো নয়।** Alo-র কোডে Adhar-এর কোনো উল্লেখ থাকবে না, আর এই ভার্সনের জন্য Alo-তে কোনো বদল বা রিলিজ লাগে না।

ধাঁচটি Laravel-এর মতো:

| কাজ | Laravel | Adhar (full stack) |
| --- | --- | --- |
| ডেভেলপমেন্ট | `php artisan serve` + `npm run dev` | `node adhar dev` (একটাই কমান্ড; API আর Alo দুটোই চলে) |
| production-এর আগে | `npm run build` → `public/build/` | `node adhar build` → `web/dist/` |
| production | তৈরি ফাইল সার্ভ হয়; Vite চলে না | `node adhar start` `web/dist/` সার্ভ করে; Alo চলে না |

---

## ২. সিদ্ধান্ত (মালিক, ২০২৬-১১-১২)

`DECISIONS.md`-এ #১১৪ থেকে যোগ হবে (1.1.0 শেষ হয়েছে #১১৩-এ)।

| # | সিদ্ধান্ত | কারণ |
| --- | --- | --- |
| ক | Full stack মানে Adhar প্রজেক্টের `web/` ফোল্ডারে Alo; উল্টোটা নয় | নির্ভরতা একমুখী; একটাই গঠন শেখাতে হয় |
| খ | `web/`-এ আলাদা `package.json`, `node_modules` বা `alo` লঞ্চার নেই; সব রুটের একটাই `package.json`-এ | এক `npm install`; `alo` লঞ্চার `"type": "module"` প্রজেক্টে ভাঙে (playground-এ দেখা গেছে) |
| গ | `@msilabs/alo` থাকে `devDependencies`-এ | Alo লাগে শুধু `dev` আর `build`-এ; `start` কেবল তৈরি ফাইল সার্ভ করে। Vite প্রজেক্টের প্রচলিত রীতি |
| ঘ | build-এর ফল `web/dist/`-এ; `start` সেখান থেকেই সার্ভ করে | Alo সবসময় নিজের ফোল্ডারের `dist/`-এ লেখে, তাই Alo বদলাতে হয় না; `web/` একটি সাধারণ Alo প্রজেক্টের মতো দেখায় |
| ঙ | `start` নিজে build করে না; `web/dist/index.html` না থাকলে চালু হয় না | build ধীর, ডিপ্লয়ের সময় একবারই যথেষ্ট; Laravel-ও তা-ই করে |
| চ | Full stack মোডে dev আর production দুটোতেই ব্রাউজার শুধু Adhar-এর এক পোর্ট দেখে | CORS লাগে না; ফ্রন্টএন্ডে শুধু `fetch('/api/…')` |
| ছ | কমান্ডের নাম `alo` আর `adhar` আলাদা থাকে; full stack প্রজেক্টে `adhar` একমাত্র প্রবেশপথ | নামই পরিচয়; এক প্রজেক্টে এক কমান্ড |
| জ | "স্ট্যাটিক ফাইল সার্ভ" স্পেকের "কখনো না" থেকে সরে এই ভার্সনে আসে; "HTML টেমপ্লেট রেন্ডার" "কখনো না"-তেই থাকে | full stack-এর জন্য দরকার; Alo-র আউটপুট পুরোপুরি স্ট্যাটিক |
| ঝ | `init`-এ বাছাই ফ্ল্যাগ দিয়ে (`--web`), প্রশ্ন জিজ্ঞেস করে নয় | টেস্ট করা সহজ; CI আর AI সহকারীতে আটকায় না |
| ঞ | `adhar dev`-এ Alo-র "running at http://localhost:<N>" আর "Press Ctrl+C to stop" লাইন Adhar ছেঁকে বাদ দেয়; Alo অপরিবর্তিত | টার্মিনালে একটিই ঠিকানা; Alo-র রিলিজ লাগে না। Alo লেখা বদলালে বাড়তি লাইন দেখা যাবে, কিছু ভাঙবে না |
| ট | Full stack প্রজেক্টের রুটের `AGENTS.md`-এ ছোট একটি "web/" অংশ: কঠোর নিয়মের সারাংশ, Alo-র `AGENTS.md`-এর লিংক, আর "`node alo` নয়, `node adhar web new …`" | পুরো গাইডের কপি দুই repo-তে আলাদা হয়ে যেত |
| ঠ | টেস্টে আসল `@msilabs/alo`, Adhar-এর নিজের `devDependencies`-এ; ভুলের ক্ষেত্রে (Alo নেই, পুরনো, মাঝপথে মরে) টেস্টের বানানো ছোট নকল Alo | মূল পথ বাস্তবের মতো যাচাই হয়; ভুলের ক্ষেত্র আসল Alo দিয়ে দেখানো যায় না। runtime dependency শূন্যই থাকে |
| ড | লগ: `start`-এ সব request; `dev`-এ `/api`-র request আর সাইটের `404`/`5xx` | dev-এ এক পেইজে অনেক ফাইল লাগে, তাতে API-র লাইন হারায়; production-এ লগই সমস্যা খোঁজার উপায় |
| ঢ | `adhar web`-এর পরিধি শুধু `adhar web new …`; `adhar web dev`, `build`, `init` দিলে ইঙ্গিতসহ এরর | `adhar web dev` সাইট খুলত এমন পোর্টে যেখানে `/api` নেই |
| ণ | `web/dist/`-এর ফাইল প্রতি request-এ ডিস্ক থেকে মেলানো হয়; চালুর সময়ের তালিকা নয় | সার্ভার চলা অবস্থায় আবার `build` করলে নতুন ফাইলই যায় |
| ত | সাইটের response-এ `X-Content-Type-Options: nosniff`; CORS header নয় | ব্রাউজার ফাইলের ধরন অনুমান করে না; সাইট আর API একই origin |
| থ | `adhar dev`-এ Alo চালু হতে ব্যর্থ হলে বা মরে গেলে Adhar থামে না: API চলে, সাইটের ঠিকানায় `502`, টার্মিনালে সতর্কবার্তা | API-র কাজ আটকে থাকে না |
| দ | ভার্সন 1.2.0 | শুধু নতুন সুবিধা; `web/` না থাকলে কিছু বদলায় না |

`alo-vscode` নিয়ে এই ভার্সনে কোনো কাজ নেই (অংশ ১০)।

---

## ৩. প্রজেক্টের গঠন আর মোড

```
my-app/
├── api/                      আগের মতোই
│   ├── middleware.js
│   ├── not-found.js          ঐচ্ছিক
│   ├── route.js              → /api
│   └── notes/
│       ├── route.js          → /api/notes
│       └── [id]/route.js     → /api/notes/:id
├── services/                 আগের মতোই
├── migrations/               আগের মতোই
├── web/                      ← থাকলে full stack মোড (Alo-র ফোল্ডারগুলো)
│   ├── pages/  components/  data/  global/  public/
│   └── dist/                 `adhar build`-এর ফল (git-এ যায় না)
├── storage/
├── node_modules/             একটাই, রুটে
├── .env
├── adhar                     একটাই কমান্ড
└── package.json              একটাই, রুটে
```

- **মোড ঠিক হয় ফোল্ডার দেখে, কনফিগ নেই।** `web/pages/` ফোল্ডার থাকলে full stack, না থাকলে শুধু API।
- শুধু-API প্রজেক্টকে full stack করতে: `npm i -D @msilabs/alo` আর `web/pages/page.alo` বানানো।

---

## ৪. আচরণ

### ৪.১ একটি request-এর পথ

| মোড | ঠিকানা | যা ঘটে |
| --- | --- | --- |
| শুধু API | যেকোনো | 1.1.0-র মতোই; `/api`-র বাইরের সবকিছু JSON 404 (`api/middleware.js` চলে) |
| Full stack | `/api` বা `/api/…` | 1.1.0-র pipeline (route, middleware, 404/405 সব JSON) |
| Full stack | বাকি সব | `web`-এর ফাইল; pipeline, middleware আর CORS-এর কিছুই চলে না |

- "`/api` দিয়ে শুরু" মানে ঠিক `/api` অথবা `/api/…`; `/apix` যায় `web`-এ।
- Full stack মোডে `web`-এর অংশে শুধু `GET` আর `HEAD`; অন্য method-এ `405`, `Allow: GET, HEAD`।
- চালুর সময়ের সংঘর্ষ যাচাই: `web/pages/api/` বা `web/public/api/` থাকলে এরর ("`/api` belongs to the API")।
- Alo-র `--base` full stack মোডে সমর্থিত নয়; সাইট সবসময় `/`-এ।
- 1.1.0-র dev ইঙ্গিত ("Did you mean `/api/notes`?") full stack মোডে প্রযোজ্য নয়, কারণ `/api`-র বাইরের ঠিকানা তখন সাইটের; শুধু-API মোডে আগের মতোই থাকে।

### ৪.২ স্ট্যাটিক ফাইল সার্ভ (production, `web/dist/`)

Alo-র dev সার্ভারের নিয়মই অনুসরণ করবে (`alo/cli/dev-server.js`-এর `handle`):

- `/` বা `/`-এ শেষ হওয়া ঠিকানা → সেই ফোল্ডারের `index.html`।
- ফাইল থাকলে সেটি; ফোল্ডার আছে কিন্তু শেষে `/` নেই → `301`, `/` যোগ করে (query অক্ষত)।
- কিছু না মিললে `404`: `web/dist/404.html` থাকলে সেটি, না থাকলে সাধারণ লেখা।
- ঠিকানা decode করা যায় না → `400`। `..` দিয়ে `web/dist/`-এর বাইরে যাওয়া যায় না।
- ফাইল প্রতি request-এ ডিস্ক থেকে মেলানো হয় (সিদ্ধান্ত ণ)।

Header:

| Header | মান |
| --- | --- |
| `Content-Type` | এক্সটেনশন থেকে; Alo-র `MIME_TYPES` তালিকার সমান একটি তালিকা Adhar-এ (আলাদা কপি, কারণ Alo `import` করা যাবে না) |
| `Cache-Control` | `assets/`-এর নিচে: `public, max-age=31536000, immutable` (নামে হ্যাশ আছে); বাকি সব: `no-cache` |
| `ETag` | ফাইলের আকার আর বদলের সময় থেকে; `If-None-Match` মিললে `304` |
| `Content-Length` | ফাইলের আকার |
| `X-Content-Type-Options` | `nosniff` |

- ফাইল stream হয়ে যায় (`fs.createReadStream`), পুরোটা মেমরিতে পড়ে নয়।
- `app.inject()` সাইটের response-ও ফেরত দেয়: লেখার ধরনের ফাইলে (`text/*`, JS, SVG) `body` string, JSON ফাইলে parse করা মান (API-র মতোই), বাকিতে `Buffer`।
- এই ভার্সনে নেই: gzip/brotli, `Range` request। ("পরে ভাবা হবে"-তে যাবে।)

### ৪.৩ কমান্ড

| কমান্ড | শুধু API | Full stack |
| --- | --- | --- |
| `adhar dev` | আগের মতো | API-র সাথে Alo-র dev সার্ভারও চালায়; সব এক পোর্টে (৪.৪) |
| `adhar build` | এরর: "Nothing to build: no `web/` folder." | `web/`-এ `alo build` চালায়; ফল `web/dist/` |
| `adhar start` | আগের মতো | `web/dist/` সার্ভ করে; `web/dist/index.html` না থাকলে চালু হয় না, ইঙ্গিত: "Run `node adhar build` first." |
| `adhar web new …` | এরর, ইঙ্গিতসহ | Alo-র `new` কমান্ড `web/` ফোল্ডারে চালায়: `node adhar web new component Card` |
| `adhar web dev\|build\|init` | এরর | এরর, ইঙ্গিতসহ: "Use `node adhar dev`." / "Use `node adhar build`." |
| `adhar init [folder]` | শুধু-API টেমপ্লেট | — |
| `adhar init [folder] --web` | — | full stack টেমপ্লেট |

Alo খোঁজা (কোড পড়ে যাচাই করা তথ্য):

- Adhar রুট থেকে উপরের দিকে `node_modules/@msilabs/alo/bin/alo.js` খোঁজে। Alo-র `package.json`-এর `exports` শুধু `./cli` দেয়, তাই `require.resolve` দিয়ে `bin` পাওয়া যায় না; সরাসরি পথ খোঁজাই নিরাপদ।
- পাওয়া গেলে চালায়: `process.execPath <bin> <args>`, `cwd` = `web/`। Alo প্রজেক্টের রুট ধরে `process.cwd()`-কে, তাই এটুকুই যথেষ্ট।
- না পেলে: "`web/` needs Alo. Run `npm i -D @msilabs/alo`." `NODE_ENV=production` হলে বাড়তি লাইন: build ধাপে dev dependency লাগে।
- Alo-র ভার্সন `1.1.0`-র নিচে হলে এরর, আপগ্রেডের ইঙ্গিতসহ।

লগ (সিদ্ধান্ত ড): `start`-এ সব request-এর লাইন; `dev`-এ `/api`-র request, আর সাইটের `404` ও `5xx`।

### ৪.৪ `adhar dev`-এ এক পোর্ট

এখনকার গঠন: `cli/dev.js` (ফাইল দেখে) → `cli/worker.js` (সার্ভার চালায়; ফাইল বদলালে নতুন করে চালু)।

নতুন:

1. `dev.js` full stack মোড দেখলে একটি ফাঁকা পোর্ট বেছে নেয় (`localhost`-এ পোর্ট `0`-তে listen করে, নম্বর নিয়ে, বন্ধ করে)।
2. `dev.js` একবার Alo চালু করে: `alo dev --port <N>`, `cwd` = `web/`। API-র ফাইল বদলালে Alo আবার চালু **হয় না**; শুধু worker হয়।
3. worker পোর্ট নম্বরটি পায় (argv বা env দিয়ে)। `/api`-র বাইরের request সে `http://localhost:<N>`-এ proxy করে: `node:http`-এর `request`, দুই দিকেই `pipe`।
4. Alo-র লাইভ রিলোড (`/__alo/reload`, SSE) আর এরর পাতা proxy দিয়েই আসে; আলাদা কিছু লাগে না।
5. `dev.js` Alo-র আউটপুট নিজে পড়ে: "Alo dev server running at …" আর "Press Ctrl+C to stop" লাইন বাদ দিয়ে বাকিটা ছাপে (সিদ্ধান্ত ঞ)। টার্মিনালে ঠিকানা থাকে একটিই: Adhar-এর।

খেয়াল রাখার বিষয়:

- **SSE সংযোগ worker-এর restart আটকে রাখবে।** এখন `start` বন্ধের সময় চলমান request শেষ হওয়ার অপেক্ষা করে (১০ সেকেন্ড পর্যন্ত), আর `dev.js` ২ সেকেন্ড পর জোর করে মারে। খোলা ব্রাউজার ট্যাবের SSE কখনো শেষ হয় না, তাই প্রতিটি restart ২ সেকেন্ড দেরি হবে। সমাধান: dev মোডে বন্ধের সংকেতে সাথে সাথে `closeAllConnections()`। ব্রাউজারের `EventSource` নিজে আবার সংযোগ করে।
- Alo চালু হওয়ার আগে, চালু হতে ব্যর্থ হলে বা বন্ধ হয়ে গেলে proxy `502` দেয়, সাধারণ লেখায়: "The Alo dev server is not running. Restart `adhar dev`." API চলতে থাকে, আর টার্মিনালে একটি সতর্কবার্তা ছাপা হয় (সিদ্ধান্ত থ)।
- `.alo` ফাইলের ভুলে Alo মরে না; সে নিজের এরর পাতা দেখায়, যা proxy দিয়েই আসে।
- Ctrl+C-তে দুটোই বন্ধ হয়।
- পোর্ট বাছা আর Alo-র listen-এর মাঝে অন্য কেউ পোর্টটি নিলে Alo পরের পোর্টে চলে যায় (তার নিজের নিয়ম), আর proxy ভুল পোর্টে যায়। সম্ভাবনা খুবই কম; `502`-এর বার্তার "Restart `adhar dev`" ইঙ্গিতই সমাধান।

### ৪.৫ `init --web` টেমপ্লেট

শুধু-API টেমপ্লেটের সাথে যা যোগ হয়:

- `web/pages/layout.alo`, `page.alo`, `not-found.alo`; `web/components/Notes.alo` (যা `fetch('/api/notes')` ডাকে); `web/global/theme.css`; `web/data/site.json`; `web/public/favicon.svg`।
- `package.json`: `dependencies`-এ `@msilabs/adhar`; `devDependencies`-এ `@msilabs/alo` (`^1.1.0`); scripts: `dev`, `build` (`adhar build`), `start`, `migrate`।
- `.gitignore`-এ `web/dist/` আর `web/.alo/`।
- `.env.example` আর `.env`-এ `CORS_ORIGIN`-এর মন্তব্য থাকে না (এক origin, তাই লাগে না)।
- `.vscode/extensions.json` (`msilabs.alo-vscode`), `.vscode/settings.json` আর `.gitattributes`, Alo-র `init` যেমন বানায়।
- রুটের `AGENTS.md`-এ "web/" অংশ (সিদ্ধান্ত ট)।
- শেষের বার্তা: `npm install`, `node adhar dev`।
- `web/`-এ `package.json`, `alo` লঞ্চার বা `.gitignore` থাকে না।

`Notes.alo`-তে JS দিয়ে বানানো `<li>`-এর স্টাইল `<style global>`-এ থাকবে; স্কোপড `<style>` সেগুলোতে লাগে না (playground-এ দেখা গেছে)।

`init --web` শুধু খালি ফোল্ডারে চলে, `init`-এর এখনকার নিয়মেই।

---

## ৫. Alo-তে যা লাগবে

কিছুই না। কোড পড়ে যাচাই করা:

- **চালানো যায়, বদল ছাড়াই।** `bin/alo.js`-কে `cwd` = `web/` দিয়ে চালালেই হয়।
- **পোর্ট বাঁধা যায়, বদল ছাড়াই।** `--port <N>` আছে; পোর্ট ব্যস্ত থাকলে Alo পরেরটি নেয়, তবে Adhar ফাঁকা পোর্ট বেছে দিলে তা প্রায় ঘটে না।
- **dev সার্ভার শুধু `localhost`-এ শোনে,** তাই ভেতরের পোর্টটি নেটওয়ার্কে খোলা থাকে না।
- **ঠিকানার লাইন** ছাপা হয় এক জায়গায় (`cli/dev-server.js`), তাই ছাঁকা সহজ।

---

## ৬. কোডে যেখানে হাত পড়বে

| ফাইল | বদল |
| --- | --- |
| `core/web.js` (নতুন) | মোড শনাক্ত, সংঘর্ষ যাচাই, `web/dist/` থেকে ফাইল মেলানো আর header (৪.২) |
| `core/app.js` | full stack মোডে `/api`-র বাইরের request আলাদা পথে; dev ইঙ্গিত শুধু শুধু-API মোডে |
| `core/pipeline.js` | `listener`-এ ফাইল stream করা; `inject` যেন `web`-এর response-ও ফেরত দেয় |
| `cli/serve.js` | মোড অনুযায়ী স্ট্যাটিক বা proxy; dev-এ সাথে সাথে সংযোগ বন্ধ; লগের নিয়ম |
| `cli/dev.js`, `cli/worker.js` | Alo-র প্রসেস চালু/বন্ধ, পোর্ট পাঠানো, আউটপুট ছাঁকা |
| `cli/web.js` (নতুন) | Alo খোঁজা, `build`, `web new`, ভার্সন যাচাই |
| `cli/index.js` | `build` আর `web` কমান্ড, `--web` ফ্ল্যাগ, HELP |
| `cli/scaffold.js` | `init --web` |
| `templates/web/` (নতুন) | full stack-এর বাড়তি ফাইল |
| `templates/init/AGENTS.md` | full stack-এ "web/" অংশ যোগ হয় |
| `package.json` | `devDependencies`-এ `@msilabs/alo`; `version`: `1.2.0` |
| `package-lock.json` (নতুন) | CI-র `npm ci`-এর জন্য |
| `.github/workflows/ci.yml`, `publish.yml` | `npm test`-এর আগে `npm ci` |
| `test/*` | নিচে, প্রতিটি মাইলস্টোনে |

---

## ৭. মাইলস্টোন

প্রতিটির শেষে `npm test` সবুজ।

| # | ধাপ | শেষ হলে যা চলে |
| --- | --- | --- |
| ০ | স্পেক আর সিদ্ধান্ত: `SPEC.md` (অংশ ০, ২, ৪, ১২, ১৪, ১৬, ১৯), `DECISIONS.md` | কাগজে নতুন নকশা; কোড অপরিবর্তিত |
| ১ | `start`-এ `web/dist/` সার্ভ: মোড শনাক্ত, সংঘর্ষ যাচাই, ৪.১ আর ৪.২; `dist` না থাকলে এরর | হাতে বানানো `web/dist/` এক পোর্টে API-র সাথে চলে |
| ২ | `adhar build`, Alo খোঁজা আর ভার্সন যাচাই, `adhar web new`; `devDependencies`, lock ফাইল, CI-তে `npm ci` | `node adhar build && node adhar start` |
| ৩ | `adhar dev`-এ এক পোর্ট: Alo-র প্রসেস, proxy, SSE, দ্রুত restart, আউটপুট ছাঁকা | `node adhar dev`; সাইট আর API `localhost:8134`-এ, লাইভ রিলোডসহ |
| ৪ | `init --web` টেমপ্লেট | `npx … init x --web && cd x && npm install && node adhar dev` |
| ৫ | README, CHANGELOG, `llms.txt`, `AGENTS.md`, release যাচাই, প্রকাশ | 1.2.0 npm-এ |

টেস্টের রূপরেখা:

- **১:** `app.inject` দিয়ে: `/` → `index.html`; `/about` → `301`; `/about/` → `200`; নেই এমন ঠিকানা → `404.html`; `/api/x` → JSON 404; `/apix` → `web`; `POST /` → `405`; `/../.env` আটকায়; `assets/`-এ দীর্ঘ ক্যাশ; `If-None-Match` → `304`; `HEAD`-এ body নেই; `nosniff` header; শুধু-API মোডে `/` → JSON 404; `web/pages/api/` → চালুর এরর; স্ট্যাটিকে middleware চলে না; সার্ভার চলা অবস্থায় বদলানো ফাইল নতুন করে যায়।
- **২:** আসল Alo দিয়ে `build` সফল হলে `dist` তৈরি; `web new` ফাইল বানায়। নকল দিয়ে: Alo না থাকলে এরর; পুরনো ভার্সনে এরর; `build`-এর ব্যর্থতায় exit code ১। শুধু-API মোডে `build` আর `web`-এর এরর; `adhar web dev`-এর এরর।
- **৩:** আসল Alo দিয়ে: proxy দিয়ে পেইজ আসে; SSE সংযোগ খোলা থাকে; API-র ফাইল বদলালে Alo-র প্রসেস একই থাকে; খোলা SSE থাকলেও restart দ্রুত; আউটপুটে Alo-র ঠিকানা নেই। নকল দিয়ে: Alo মরলে `502` আর সতর্কবার্তা, API চলে। Ctrl+C-তে দুটি প্রসেসই শেষ (Windows-এ বাদ, 1.1.0-র একই ধরনের টেস্টের মতো)। লগে dev-এ স্ট্যাটিকের লাইন নেই, `404` আছে।
- **৪:** তৈরি ফাইলের তালিকা; `package.json`-এর বিষয়বস্তু (`devDependencies`-এ Alo); `.env.example`-এ `CORS_ORIGIN` নেই; তৈরি প্রজেক্ট build হয়ে চালু হয়।

---

## ৮. ডকুমেন্টেশন

- **README:** শুরুর পরিচিতি ("backend API ফ্রেমওয়ার্ক; Alo-র সাথে full stack"); নতুন অংশ "Full stack"; "Alo-র সাথে ব্যবহার" অংশ নতুন করে (এক প্রজেক্ট বনাম আলাদা প্রজেক্ট, কখন কোনটি); কমান্ডের তালিকা; ডিপ্লয়ের ক্রম (`npm ci` → `node adhar build` → `node adhar migrate` → `node adhar start`, আর build ধাপে dev dependency লাগার কথা); "যা Adhar করে না" থেকে স্ট্যাটিক সার্ভ বাদ।
- **`templates/init/AGENTS.md`:** full stack-এর "web/" অংশ।
- **`llms.txt`:** বিবরণ হালনাগাদ।
- **CHANGELOG 1.2.0:** "নতুন" অংশে `web/`, `adhar build`, এক পোর্টের `dev`, `init --web`, `adhar web new`; স্পষ্ট লেখা যে `web/` না থাকলে কিছু বদলায় না।

---

## ৯. প্রকাশের তালিকা

1. `npm test` সবুজ; CI-র সব OS আর Node ভার্সনে সবুজ।
2. হাতে যাচাই, নতুন ফোল্ডারে: `init --web` → `npm install` → `dev` (লাইভ রিলোড, API, একটিই ঠিকানা) → `build` → `migrate` → `start`।
3. হাতে যাচাই: 1.1.0 দিয়ে বানানো শুধু-API প্রজেক্ট 1.2.0-তে কোনো বদল ছাড়াই চলে।
4. `playgrounds/adhar-with-alo`-কে নতুন ভার্সনে তুলে মিলিয়ে দেখা: `Notes.alo`-এর পোর্ট দেখে ঠিকানা বদলানোর লাইন বাদ, শুধু `/api`; `.env` থেকে `CORS_ORIGIN` বাদ; `dev:web` আর `build:web` script বাদ; Alo `devDependencies`-এ।
5. প্রকাশ, এখনকার release প্রক্রিয়ায় (tag → GitHub release → npm)। প্রকাশিত প্যাকেজে `devDependencies` ব্যবহারকারীর কাছে ইনস্টল হয় না, তা `npm pack`-এর তালিকা দেখে নিশ্চিত করা।

---

## ১০. এই ভার্সনে নেই

- চলমান Alo সাইটকে full stack-এ রূপান্তর (খালি নয় এমন ফোল্ডারে `init --web`): এই পরিকল্পনার অংশ নয়।
- `alo-vscode`-এর কোনো বদল বা যাচাই।
- Alo-র কোনো বদল বা রিলিজ।
- সার্ভারে HTML রেন্ডার (SSR): "কখনো না"।
- `/api`-র বাইরের route: "পরে ভাবা হবে"।
- gzip/brotli, `Range` request, Alo-র `--base`।
- বিল্ডের সময় ডেটাবেস থেকে Alo-র `data` ভরা।
- cookie helper, auth helper, ফাইল আপলোড: 1.2.0-র পরের অগ্রাধিকার, কারণ লগইন ছাড়া full stack অ্যাপ অসম্পূর্ণ।

---

## ১১. গ্রহণযোগ্যতার মানদণ্ড

- `npx @msilabs/adhar init x --web && cd x && npm install && node adhar dev`: `http://localhost:8134`-এ সাইট খোলে, নোট যোগ হয়, `.alo` ফাইল বদলালে পেইজ নিজে রিলোড হয়, আর টার্মিনালে একটিই ঠিকানা দেখায়।
- `node adhar build && node adhar migrate && node adhar start`: একই সাইট আর API এক পোর্টে, CORS ছাড়া।
- `web/` ছাড়া প্রজেক্ট 1.1.0-র মতোই আচরণ করে; 1.1.0-র সব টেস্ট বদল ছাড়া পাস করে।
- Adhar-এর `package.json`-এ কোনো runtime dependency নেই (`dependencies` ফাঁকা); `devDependencies`-এ শুধু `@msilabs/alo`।
- Node 22.13, 24, 26-এ সব টেস্ট পাস।
- একটি AI সহকারী শুধু `AGENTS.md` পড়ে full stack প্রজেক্টে সঠিক route আর সঠিক `.alo` কম্পোনেন্ট লিখতে পারে।
