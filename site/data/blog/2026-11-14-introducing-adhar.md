---
title: আধার পরিচিতি: ফোল্ডারে ফাংশন লিখুন, পান JSON API
description: আধার কী, কীভাবে কাজ করে, কাদের জন্য আর কাদের জন্য নয়। ছোট একটি API পাঁচ মিনিটে।
tags: [পরিচিতি]
---

একটি নোট-অ্যাপ বা ফর্ম জমা নেওয়ার জন্য ছোট একটি API দরকার। অথচ শুরুর আগেই ফ্রেমওয়ার্ক বাছাই, ডজনখানেক প্যাকেজ, ডেটাবেস সার্ভার আর কনফিগারেশন ফাইল জমে যায়। আধার বানানো হয়েছে এই ছোট কাজগুলোর জন্য: ফোল্ডারে সাধারণ JavaScript ফাংশন লিখুন, আর পান JSON API।

## কীভাবে কাজ করে

`api/` ফোল্ডারের প্রতিটি `route.js` একটি ঠিকানা। ফোল্ডারের নামই URL, আর ফাইলের ভেতরের `GET`, `POST` নামের ফাংশনই handler। ফাংশন যা return করে, তা-ই JSON হয়ে ক্লায়েন্টে যায়।

প্রথমে টেবিল বানান একটি migration ফাইলে:

```sql
-- migrations/002-create-tasks.sql
CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
```

তারপর `api/tasks/route.js` ফাইল লিখলেই `/api/tasks` ঠিকানা তৈরি হয়:

```js
export const schema = { POST: { body: { title: 'string' } } };

export function GET(ctx) {
    return ctx.db.all('SELECT * FROM tasks');
}

export function POST(ctx) {
    ctx.status(201);
    const sql = 'INSERT INTO tasks (title) VALUES (?) RETURNING *';
    return ctx.db.get(sql, ctx.body.title);
}
```

এই ফাইলে `req`, `res` বা `import` নেই; দরকারি সবকিছু আসে এক `ctx` থেকে। `schema` থাকায় `title` ছাড়া request handler চলার আগেই `422` পায়।

## যা পাবেন

- **রাউটিং:** ফোল্ডারই URL; ডায়নামিক অংশ `[id]`, গ্রুপ `(admin)`।
- **middleware:** `middleware.js` তার ফোল্ডারের সব route-এর আগে চলে, যেমন লগইন যাচাই।
- **ভ্যালিডেশন:** `schema` থেকে `body`, `query` আর `params` যাচাই।
- **service:** `services/` ফোল্ডারের ফাইল `import` ছাড়াই পাওয়া যায় `ctx.services`-এ।
- **ডেটাবেস:** Node.js-এর নিজস্ব SQLite, আলাদা সার্ভার ছাড়া। ডেটা থাকে `storage/app.db` ফাইলে।
- **কোনো নির্ভরতা নেই:** আধার নিজে কোনো npm প্যাকেজের ওপর দাঁড়িয়ে নেই।
- **পরিষ্কার এরর:** ভুল হলে ফাইলের নাম আর সমাধানের ইঙ্গিত আসে, যেমন "Did you mean `GET`?"।

## যা পাবেন না

আধার সবার জন্য নয়, আর সেটি আগেই জানা ভালো:

- একই ডেটাবেস নিয়ে অনেক সার্ভারে ছড়ানো বড় অ্যাপের জন্য এটি নয়, কারণ SQLite একটি ফাইল, যা এক মেশিনে থাকে।
- PostgreSQL বা MySQL-এর কোনো সমর্থন নেই।
- Vercel বা Netlify Functions-এর মতো serverless হোস্টিংয়ে চলে না; দরকার একটি স্থায়ী ডিস্কওয়ালা সার্ভার।
- তৈরি auth, cookie helper আর ফাইল আপলোড এখনো নেই।

সম্পূর্ণ তালিকা আর কারণ আছে [কেন আধার](/about/) পাতায়।

## শুরু করুন

```bash
npx @msilabs/adhar init my-api
cd my-api
npm install
node adhar dev
```

তারপর অন্য টার্মিনালে `curl http://localhost:8134/api/notes`। যেকোনো ফাইল বদলে সংরক্ষণ করলে সার্ভার নিজে থেকে নতুন করে চালু হয়। বিস্তারিত গাইড আছে [দ্রুত শুরু](/docs/) পাতায়।
