# পরিবর্তনের তালিকা

## 1.2.0 (২০২৬-১১-১২)

কোনো ভাঙা পরিবর্তন নেই। প্রজেক্টে `web/pages/` ফোল্ডার না থাকলে কিছুই বদলায় না।

### নতুন

- **Full stack:** প্রজেক্টে `web/` ফোল্ডার থাকলে তার ভেতরের [Alo](https://github.com/msilabs/alo) সাইট আর API এক পোর্টে চলে। `/api`-র নিচের ঠিকানা API-র, বাকি সব সাইটের; সাইট থেকে `fetch('/api/notes')` লিখলেই হয়, CORS লাগে না।
- **`adhar init my-app --web`:** full stack টেমপ্লেট, একটি নোটের পেইজসহ যা API ডাকে।
- **`adhar dev`:** full stack প্রজেক্টে Alo-র dev সার্ভারও চালায়, একই ঠিকানায়, লাইভ রিলোডসহ।
- **`adhar build`:** সাইট বানায় `web/dist/`-এ।
- **`adhar start`:** `web/dist/`-এর ফাইল সার্ভ করে (`ETag`, `assets/`-এ দীর্ঘ cache)। Alo তখন চলে না।
- **`adhar web new …`:** `web/`-এর ভেতরে নতুন পেইজ, লেআউট বা কম্পোনেন্ট।
- `app.inject()` সাইটের ফাইলের response-ও ফেরত দেয়।

### জানা দরকার

- Alo থাকে প্রজেক্টের `devDependencies`-এ (`npm i -D @msilabs/alo`, 1.1.0 বা নতুন)। production-এ `node adhar build` চালাতে হলে `npm install` করুন `--omit=dev` ছাড়া।
- `start` নিজে build করে না: ক্রম হলো `node adhar build` → `node adhar migrate` → `node adhar start`।
- `web/pages/api/` বা `web/public/api/` রাখা যায় না; `/api` API-র।

## 1.1.0 (২০২৬-১১-১২)

### ভাঙা পরিবর্তন

- `routes/` ফোল্ডারের নতুন নাম `api/`, আর সব ঠিকানা এখন `/api` দিয়ে শুরু: `routes/notes/route.js` (`/notes`) হয় `api/notes/route.js` (`/api/notes`)। `/api`-র বাইরের ঠিকানা সবসময় `404`।
- কেন: পরে একই প্রজেক্টে Alo-র সাইট যোগ করা যাবে, API-র ঠিকানা না বদলে।
- কেন 2.0.0 নয়: 1.0.0-র বয়স একদিন, ব্যবহারকারী ছিল না। এরপর থেকে ভাঙা পরিবর্তন মানেই major।

### আপগ্রেড

1. `routes/` ফোল্ডারের নাম বদলে `api/` করুন।
2. যারা এই API ডাকে (ফ্রন্টএন্ড, মোবাইল অ্যাপ, টেস্ট), তাদের ঠিকানায় `/api` যোগ করুন।

পুরনো `routes/` থাকলে Adhar চালু হয় না, আর কী করতে হবে তা বলে দেয়।

### নতুন

- dev-এ `/api` ছাড়া ঠিকানায় 404-এর সাথে ইঙ্গিত: "Did you mean `/api/notes`?"
- `adhar new route api/notes` লিখলে ভুল ধরা পড়ে (নাম `api/`-র সাপেক্ষে): "Did you mean `adhar new route notes`?"

## 1.0.0 (২০২৬-১১-১১)

প্রথম স্থিতিশীল রিলিজ।

### বদল

- ডিফল্ট পোর্ট এখন `8134` (আগে `3000`)। `3000` Alo-র dev সার্ভারের পোর্ট, তাই দুটো একসাথে চালালে সংঘর্ষ হতো। 0.1.0 দিয়ে বানানো প্রজেক্টের `.env`-এ `PORT=3000` লেখা আছে, তাই সেগুলো আগের পোর্টেই চলবে; নতুন পোর্ট চাইলে লাইনটি বদলে দিন।
- `adhar init`-এর `.env.example`-এ CORS-এর উদাহরণ এখন `http://localhost:3000` (Alo-র dev সার্ভার)।

### ডকুমেন্টেশন

- `AGENTS.md`-এর "Commands" অংশে নতুন নিয়ম: ফাইল বদলের পরে `node adhar routes` চালিয়ে যাচাই, এররের ইঙ্গিত পড়ে ঠিক সেই জায়গা ঠিক করা, `storage/` না ছোঁয়া, গোপন মান `.env`-এ রাখা।
- README-তে npm badge, আর Alo ও Adhar একসাথে চালানোর নিয়ম।

## 0.1.0 (২০২৬-১১-১১)

প্রথম ভার্সন।

### নতুন

- **Route:** `routes/` ফোল্ডারে `route.js`; `GET`, `POST`, `PUT`, `PATCH`, `DELETE` নামের ফাংশন। ডায়নামিক অংশ `[id]`, route গ্রুপ `(name)`। `404`, `405`, `HEAD` আর `OPTIONS` নিজে থেকে।
- **`ctx`:** `params`, `query`, `body`, `headers`, `env`, `state`, `services`, `db`, `status()`, `header()`, `error()`।
- **Middleware:** ফোল্ডারভিত্তিক `middleware.js`, আর ঐচ্ছিক `routes/not-found.js`।
- **ভ্যালিডেশন:** route ফাইলের `schema` export; `body`, `query`, `params`-এ সাতটি টাইপ; না মিললে `422`।
- **Service:** `services/` ফোল্ডার থেকে `ctx.services`, `import` ছাড়া।
- **Database:** Node.js-এর নিজস্ব SQLite দিয়ে `ctx.db` (`all`, `get`, `run`, `transaction`); `migrations/NNN-name.sql`।
- **`.env` আর CORS:** `PORT`, `CORS_ORIGIN`, `DATABASE_PATH`।
- **কমান্ড:** `init`, `dev` (ফাইল বদলালে নতুন করে চালু), `start` (graceful shutdown), `routes`, `migrate`, `new route|middleware|service|migration`।
- **টেস্ট:** `createApp()` আর `app.inject()` দিয়ে পোর্ট না খুলে request চালানো।
- **AI সহকারী:** `init` প্রজেক্টে `AGENTS.md`, আর রুটে `llms.txt`।
