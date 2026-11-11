# পরিবর্তনের তালিকা

## 0.1.0 (প্রকাশিত হয়নি)

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
