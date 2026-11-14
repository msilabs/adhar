# Adhar 1.1.0 — পরিকল্পনা: `routes/` → `api/`

অবস্থা: সম্পন্ন; 1.1.0 প্রকাশিত (২০২৬-১১-১২)। এটি ইতিহাসের জন্য রাখা; চলতি নিয়ম আছে [SPEC.md](SPEC.md) আর [DECISIONS.md](../DECISIONS.md)-এ (#১০৮–#১১৩)।

এই ভার্সনের পরিধি একটিই: ফোল্ডারের নাম `routes/` থেকে `api/`, আর তার ফলে সব ঠিকানা `/api` দিয়ে শুরু। `web/`, স্ট্যাটিক সার্ভ, `adhar build` বা অন্য কিছু এই ভার্সনে নেই; সেগুলোর স্থগিত খসড়া [PLAN-1.2.md](PLAN-1.2.md)-এ।

---

## ১. কী বদলায়, এক নজরে

| | 1.0.0 | 1.1.0 |
| --- | --- | --- |
| ফোল্ডার | `routes/` | `api/` |
| `…/route.js` (মূল ফোল্ডারে) | `/` | `/api` |
| `…/notes/route.js` | `/notes` | `/api/notes` |
| `…/notes/[id]/route.js` | `/notes/:id` | `/api/notes/:id` |
| `…/(admin)/stats/route.js` | `/stats` | `/api/stats` |
| সবার আগের middleware | `routes/middleware.js` | `api/middleware.js` |
| নিজের 404 | `routes/not-found.js` | `api/not-found.js` |
| `adhar new route notes` | `routes/notes/route.js` | `api/notes/route.js` |

যা বদলায় না:

- `route.js`, `middleware.js`, `not-found.js` ফাইলের নাম; `[id]` আর `(group)` ফোল্ডারের নিয়ম; `schema`; `ctx`; service; database; `.env`; CORS।
- `adhar routes` কমান্ডের নাম, আর "route" শব্দটি (ধারণা হিসেবে)।
- শেষের `/` উপেক্ষিত: `/api/` আর `/api` একই।
- ডিফল্ট পোর্ট `8134`।

"ফোল্ডারই URL" নিয়ম অক্ষুণ্ণ থাকে: ফোল্ডারের নাম `api`, তাই ঠিকানাও `/api/…`।

---

## ২. সিদ্ধান্ত (মালিক, ২০২৬-১১-১২)

`DECISIONS.md`-এ #১০৮ থেকে যোগ হবে।

| # | সিদ্ধান্ত | কারণ |
| --- | --- | --- |
| ১০৮ | `routes/` ফোল্ডারের নতুন নাম `api/`; সব ঠিকানা `/api` দিয়ে শুরু | পরে একই প্রজেক্টে Alo-র সাইট (`web/`) যোগ হলে API-র কোনো ঠিকানা বদলাতে হয় না, আর পেইজের সাথে সংঘর্ষ হয় না; "ফোল্ডারই URL" অক্ষুণ্ণ |
| ১০৯ | `routes/` আর সমর্থিত নয়; পেলে চালুর সময় এরর, যাতে নতুন নাম আর `/api` ঠিকানার কথা থাকে | একই কাজের দুটি পথ বিভ্রান্তি; পরে দরকার হলে `/api`-র বাইরের route যোগ করা ভাঙা পরিবর্তন নয় |
| ১১০ | ভার্সন 1.1.0, যদিও পরিবর্তনটি ভাঙা | 1.0.0-র বয়স একদিন, ব্যবহারকারী নেই। শর্ত: #১০৯-এর এরর, CHANGELOG-এ স্পষ্ট ব্যাখ্যা, 1.0.0 deprecated। এরপর থেকে ভাঙা পরিবর্তন মানেই major |

---

## ৩. আচরণের খুঁটিনাটি

### ৩.১ ঠিকানা মেলানো

- `api/` স্ক্যানের শুরুতেই একটি স্থির অংশ `api` ধরা হয়, তাই প্রতিটি route-এর pattern `/api…`।
- `/api`-র বাইরের ঠিকানা (যেমন `/` বা `/notes`) কোনো route-এর সাথে মেলে না → `404`, আজকের না-মেলা ঠিকানার মতোই: `api/middleware.js` চলে, তারপর `api/not-found.js` (থাকলে) বা সাধারণ JSON 404।
- `/apix` → `404` (`/api` মানে ঠিক `/api` অথবা `/api/…`)।
- `405`, `HEAD`, `OPTIONS`, CORS preflight: আগের মতো।

### ৩.২ পুরনো ফোল্ডারের এরর

প্রজেক্ট যাচাইয়ের নিয়ম (`assertProject`):

| অবস্থা | ফল |
| --- | --- |
| `api/` আছে, `routes/` নেই | চলে |
| `routes/` আছে, `api/` নেই | এরর ১ |
| দুটোই আছে | এরর ২ |
| কোনোটাই নেই | এরর ৩ |

এরর ১:

```
✖ Error: routes/
  The `routes/` folder is now `api/`.

  Hint: Rename `routes/` to `api/`. Every URL then starts with `/api`:
        `/notes` becomes `/api/notes`. Update the clients that call this API.
```

- উদাহরণের ঠিকানা আসে প্রজেক্টের প্রথম আসল route থেকে (`routes/` স্ক্যান করে, ফাইল লোড না করে)। `/` ছাড়া অন্য route না থাকলে, বা স্ক্যানে ভুল হলে, উদাহরণ হয় `/users`।

এরর ২:

```
✖ Error: routes/
  Both `routes/` and `api/` exist.

  Hint: Move what is left in `routes/` into `api/`, then delete `routes/`.
```

এরর ৩ (আগের বার্তা, নতুন নামে):

```
✖ Error: No `api/` folder in <পথ>.

  Hint: Run this inside an Adhar project, or create one with `npx @msilabs/adhar init my-api`.
```

এই যাচাই চলে `dev`, `start`, `routes` আর `new`-এ (আজ যেখানে `assertProject` বা `loadRoutes` ডাকা হয়)। `migrate` route লোড করে না, তাই সেখানে চলে না; এটি অপরিবর্তিত।

### ৩.৩ dev-এ ভুল ঠিকানার ইঙ্গিত

নতুন ব্যবহারকারী আর পুরনো ক্লায়েন্ট `/api` লিখতে ভুলবে। তাই dev মোডে, `api/not-found.js` না থাকলে:

- ঠিকানা `/api` দিয়ে শুরু নয়, অথচ `/api` + ঠিকানা একটি route-এর সাথে মেলে → 404-এর বার্তা: ``Not found. Did you mean `/api/notes`?``
- production-এ বার্তা আগের মতোই `Not found`।

### ৩.৪ `adhar new`

- `adhar new route notes` → `api/notes/route.js`; নোট: `URL: /api/notes`; তৈরি ফাইলের লেখা: `Hello from /api/notes`।
- `adhar new route .` → `api/route.js`; `URL: /api`।
- `adhar new middleware "(admin)"` → `api/(admin)/middleware.js`; নোট: `Runs for every route in api/(admin)/`।
- নামের শুরুতে `api/` বা `routes/` দিলে (অভ্যাসবশে `adhar new route api/notes`) এরর, কারণ ফল হতো `/api/api/notes`:

```
✖ Error: Route names are relative to `api/`.

  Hint: Did you mean `adhar new route notes`?
```

### ৩.৫ অন্যান্য বার্তা আর লেখা

- `adhar routes`: তালিকায় `GET /api/notes  api/notes/route.js`; ফাঁকা হলে "No routes yet. Add one at api/route.js."
- চালুর সতর্কবার্তা: "This project has no routes yet." ইঙ্গিত: "Add one at api/route.js."
- `not-found.js` ভুল জায়গায়: "`not-found.js` only works directly inside `api/`." / "Move it to `api/not-found.js`."
- অচেনা ফাইল: "Unexpected file `x.js` inside `api/`."
- `adhar --help`: `new route` আর `new middleware`-এর উদাহরণে `api/…`।
- dev-এর watcher: `api`, `services`, `migrations` আর `.env`। dev চলার সময় `routes/`-কে `api/` নাম দিলে সার্ভার নিজে থেকে আবার চালু হয় (রুটের watcher `api` নামটি দেখে)।

---

## ৪. কোডে যেখানে হাত পড়বে

| ফাইল | বদল |
| --- | --- |
| `core/router.js` | `scanFolder(root, 'api', [স্থির অংশ api], …)`; `rootChain`-এ `'api'`; `not-found.js`-এর যাচাই আর বার্তা; অচেনা ফাইলের বার্তা; `assertProject`-এর তিনটি এরর (৩.২); মন্তব্য |
| `core/app.js` | সতর্কবার্তার ইঙ্গিত; dev-এ 404-এর ইঙ্গিত (৩.৩); মন্তব্য |
| `cli/dev.js` | `WATCHED_FOLDERS`-এ `'api'` |
| `cli/routes.js` | ফাঁকা তালিকার বার্তা |
| `cli/index.js` | `HELP` |
| `cli/scaffold.js` | `plan()`-এ পথ `api/…`; `urlOf`-এ `/api` উপসর্গ; middleware-এর নোট; ৩.৪-এর এরর; `ENV_EXAMPLE`-এর মন্তব্য (`api/(admin)/`); মন্তব্য |
| `templates/init/routes/` | ফোল্ডারের নাম `api/`; `api/route.js`-এর `try` তালিকায় `/api/…` |
| `templates/init/AGENTS.md` | সব পথ আর ঠিকানা |
| `package.json` | `version`: `1.1.0` |

অভ্যন্তরীণ নাম (`router`, `loadRoutes`, `routes` অ্যারে, `route.pattern`) বদলায় না।

---

## ৫. টেস্ট

পুরনো টেস্টের যান্ত্রিক বদল:

- `makeProject`-এ দেওয়া ফাইলের পথ: `routes/…` → `api/…`।
- request-এর ঠিকানা (`inject`-এর `path`, `fetch`-এর URL): `/x` → `/api/x`। আনুমানিক ৬২টি জায়গা।
- প্রত্যাশিত বার্তা, `Allow`/pattern আর `adhar routes`-এর আউটপুট।
- `createPipeline` সরাসরি ব্যবহার করা টেস্টে (যেমন `pipeline.test.js`) router নেই; সেগুলো অপরিবর্তিত।

`routes` শব্দের গণনা (কাজের পরিমাণ বোঝাতে): `router.test.js` ৮০, `middleware.test.js` ৩৬, `scaffold.test.js` ২৮, `routes-command.test.js` ২০, `dev.test.js` ১৮, `app.test.js` ১১, `validate.test.js` ৯, `start.test.js` ৮, `errors.test.js` ৭, `migrations.test.js` ৬, `cors.test.js` ৫, `services.test.js` ৫, `cli.test.js` ২। সব উল্লেখ বদলাবে না: `adhar routes` কমান্ড আর `routes` নামের ভেরিয়েবল থাকবে।

নতুন টেস্ট:

| বিষয় | যা যাচাই হয় |
| --- | --- |
| ঠিকানা | `api/route.js` → `/api`; `/api/` একই; `api/notes/[id]/route.js` → `/api/notes/:id`; `(group)` ঠিকানায় আসে না |
| `/api`-র বাইরে | `/` আর `/notes` → JSON 404; `api/middleware.js` চলে; `api/not-found.js` থাকলে সেটি উত্তর দেয়; `/apix` → 404 |
| এরর ১ | শুধু `routes/` থাকলে; উদাহরণ প্রজেক্টের প্রথম route থেকে; route না থাকলে `/users` |
| এরর ২ | দুটি ফোল্ডারই থাকলে |
| এরর ৩ | কোনোটি না থাকলে |
| কমান্ড | `dev`, `start`, `routes`, `new`: চারটিতেই এরর ১ আসে, exit code ১ |
| dev-এর ইঙ্গিত | dev-এ `/notes` → "Did you mean `/api/notes`?"; production-এ নয়; `not-found.js` থাকলে নয়; অমিল ঠিকানায় নয় |
| `new` | ৩.৪-এর চারটি ক্ষেত্র |
| `init` | তৈরি প্রজেক্টে `api/` আছে, `routes/` নেই; `.env.example`-এর মন্তব্য; প্রজেক্টটি চালু হয়ে `/api/notes`-এ উত্তর দেয় |
| dev watcher | `api/`-এর ফাইল বদলালে restart |

---

## ৬. ডকুমেন্টেশন

| ফাইল | বদল |
| --- | --- |
| `README.md` | সব `routes/…` পথ আর ঠিকানা (প্রায় ২০ লাইন): "Adhar কী", `curl` উদাহরণ, "এক পাতায় Adhar", "Alo জানলে" টেবিল, Route অংশের গাছ, Middleware, ভ্যালিডেশন, কমান্ড, টেস্টের উদাহরণ (`path: '/api/notes'`), "Alo-র সাথে ব্যবহার"-এর `fetch` আর `curl`, নিজের 404, FAQ, এররের উদাহরণ। নতুন ছোট অংশ: "1.0 থেকে আপগ্রেড" |
| `docs/SPEC.md` | অংশ ০, ৪, ৫, ৭, ১২, ১৩, ১৪, ১৬-র পথ আর ঠিকানা (প্রায় ৩২ লাইন); অংশ ২০-এর মানদণ্ডে `curl localhost:8134/api/notes`; অংশ ২-এর "পরে ভাবা হবে"-তে নতুন লাইন: "`/api`-র বাইরের route" |
| `DECISIONS.md` | #১০৮–#১১০ |
| `templates/init/AGENTS.md` | পথ আর ঠিকানা (প্রায় ১৫ লাইন); "Common mistakes"-এ নতুন সারি: `routes/notes/route.js` → `api/notes/route.js`, আর `fetch('/notes')` → `fetch('/api/notes')` |
| `llms.txt` | বিবরণে "folder-based routes" থাকবে; ঠিকানার উদাহরণ থাকলে হালনাগাদ |
| `CHANGELOG.md` | নিচে |

CHANGELOG-এর 1.1.0 অংশের রূপরেখা:

```markdown
## 1.1.0 (তারিখ)

### ভাঙা পরিবর্তন

- `routes/` ফোল্ডারের নতুন নাম `api/`, আর সব ঠিকানা এখন `/api` দিয়ে শুরু:
  `routes/notes/route.js` (`/notes`) হয় `api/notes/route.js` (`/api/notes`)।
- কেন: পরে একই প্রজেক্টে Alo-র সাইট যোগ করা যাবে, API-র ঠিকানা না বদলে।
- কেন 2.0.0 নয়: 1.0.0-র বয়স একদিন, ব্যবহারকারী ছিল না। এরপর থেকে ভাঙা পরিবর্তন মানেই major।

### আপগ্রেড

1. `routes/` ফোল্ডারের নাম বদলে `api/` করুন।
2. যারা এই API ডাকে (ফ্রন্টএন্ড, মোবাইল অ্যাপ, টেস্ট), তাদের ঠিকানায় `/api` যোগ করুন।

পুরনো `routes/` থাকলে Adhar চালু হয় না, আর কী করতে হবে তা বলে দেয়।

### নতুন

- dev-এ `/api` ছাড়া ঠিকানায় 404-এর সাথে ইঙ্গিত: "Did you mean `/api/notes`?"
```

---

## ৭. মাইলস্টোন

প্রতিটির শেষে `npm test` সবুজ, তারপর থামা। Commit সবসময় জিজ্ঞাসা করে।

| # | ধাপ | শেষ হলে যা চলে |
| --- | --- | --- |
| ০ | কাগজ: `SPEC.md`, `DECISIONS.md` #১০৮–#১১০ | নতুন নকশা লেখা আছে; কোড অপরিবর্তিত |
| ১ | Core: `router.js` (স্ক্যান, pattern, তিনটি এরর), `app.js` (বার্তা, dev-এর ইঙ্গিত); `router`, `middleware`, `app`, `validate`, `services`, `cors`, `errors`, `migrations` টেস্ট | `createApp` + `inject` দিয়ে `/api/…` |
| ২ | CLI আর টেমপ্লেট: `dev.js`, `routes.js`, `index.js`, `scaffold.js`, `templates/init/`, `AGENTS.md`; `scaffold`, `routes-command`, `dev`, `start`, `cli` টেস্ট | `npx … init x && cd x && npm install && node adhar dev`, তারপর `curl localhost:8134/api/notes` |
| ৩ | ডকস আর প্রকাশ: `README.md`, `llms.txt`, `CHANGELOG.md`, `package.json`-এর ভার্সন; অংশ ৮-এর তালিকা | 1.1.0 npm-এ |

প্রতি মাইলস্টোনে প্রস্তাবিত commit (conventional commits):

- ০: `docs: plan the api/ folder for 1.1.0`
- ১: `feat!: rename routes/ to api/ and serve under /api`
- ২: `feat!: use api/ in the CLI and the starter project`
- ৩: `docs: update the readme and changelog for 1.1.0`, তারপর `chore: release v1.1.0`

---

## ৮. প্রকাশের তালিকা

1. `npm test` সবুজ; CI-র সব OS আর Node ভার্সনে সবুজ।
2. পুরো repo-তে খোঁজা: `routes/` শব্দটি শুধু সেখানেই আছে যেখানে থাকা উচিত (৩.২-এর এরর, তার টেস্ট, CHANGELOG, আপগ্রেডের অংশ, DECISIONS)।
3. হাতে যাচাই, নতুন ফোল্ডারে: `init` → `npm install` → `node adhar dev` → `curl` দিয়ে `/api`, `/api/notes` (GET, POST), `/api/notes/1`, `/api/stats` (token সহ আর ছাড়া), `/notes` (ইঙ্গিতসহ 404) → `node adhar routes` → `node adhar new route users` → `node adhar migrate && node adhar start`।
4. হাতে যাচাই, 1.0.0 দিয়ে বানানো প্রজেক্টে: প্যাকেজ 1.1.0 করার পর এরর ১ আসে; নাম বদলানোর পর চলে।
5. `playgrounds/adhar-with-alo` তোলা: `routes/api/*` → `api/`, `routes/middleware.js` → `api/middleware.js`, `routes/` মোছা; `web/components/Notes.alo`-এর ঠিকানা আগের মতোই `/api/notes`।
6. প্রকাশ, এখনকার release প্রক্রিয়ায় (tag → GitHub release → npm)।
7. `npm deprecate @msilabs/adhar@1.0.0 "Use 1.1.0 or newer. The routes/ folder is now api/ and every URL starts with /api."`
8. Alo-র দিকে খোঁজা: Alo-র README, সাইটের ডকস বা ব্লগে Adhar-এর পুরনো ঠিকানার (`localhost:8134/notes`) উল্লেখ থাকলে হালনাগাদ।

---

## ৯. এই ভার্সনে নেই

- `web/` ফোল্ডার, স্ট্যাটিক ফাইল সার্ভ, `adhar build`, এক পোর্টের dev, `init --web`: [PLAN-1.2.md](PLAN-1.2.md)।
- `/api`-র বাইরের route: "পরে ভাবা হবে"।
- cookie, auth, ফাইল আপলোড।

1.1.0-র পর `/api`-র বাইরের ঠিকানা সবসময় 404 দেয়; `web/` এলে সেই জায়গাটিই সাইট পাবে, আর API-র কোনো ঠিকানা বদলাবে না।

---

## ১০. গ্রহণযোগ্যতার মানদণ্ড

- `npx @msilabs/adhar init x && cd x && npm install && node adhar dev` চলে, আর `curl localhost:8134/api/notes` JSON দেয়।
- `routes/` থাকা প্রজেক্টে `dev`, `start`, `routes` আর `new` এরর ১ দেয়, প্রজেক্টের নিজের একটি route-এর উদাহরণসহ।
- dev-এ `curl localhost:8134/notes` 404 দেয়, বার্তায় `/api/notes`-এর ইঙ্গিতসহ।
- README, `AGENTS.md` আর টেমপ্লেটের কোথাও পুরনো পথ বা ঠিকানা নেই।
- `package.json`-এ কোনো dependency নেই।
- Node 22.13, 24, 26-এ সব টেস্ট পাস।
