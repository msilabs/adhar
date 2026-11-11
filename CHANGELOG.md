# পরিবর্তনের তালিকা

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
