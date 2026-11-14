---
title: ডিপ্লয়
description: যেখানে Node.js আর একটি স্থায়ী ডিস্ক আছে, সেখানেই আধার চলে।
---

Adhar চলে যেকোনো জায়গায় যেখানে Node.js ২২.১৩+ চলে আর একটি স্থায়ী ডিস্ক আছে (VPS, Railway, Render, Fly.io ইত্যাদি)।

```bash
npm install
node adhar migrate
node adhar start
```

full stack প্রজেক্টে আগে সাইট build করুন:

```bash
npm install
node adhar build
node adhar migrate
node adhar start
```

`build` ধাপে Alo লাগে, আর Alo আছে `devDependencies`-এ। তাই ওই ধাপের আগে `npm install` চালান `--omit=dev` ছাড়া।

মনে রাখুন:

- **`storage/` ফোল্ডার স্থায়ী ডিস্কে থাকতে হবে।** ডেটাবেস ওই ফোল্ডারের একটি ফাইল। যে হোস্টিং প্রতি ডিপ্লয়ে ডিস্ক মুছে ফেলে, সেখানে একটি volume যুক্ত করুন আর `DATABASE_PATH` দিয়ে সেদিকে দেখান।
- গোপন মান দিন হোস্টিংয়ের পরিবেশের ভেরিয়েবলে, `.env` ফাইলে নয়।
- হোস্টিং `PORT` দিলে Adhar সেটিই নেয়।
- serverless প্ল্যাটফর্মে (Vercel, Netlify Functions, Cloudflare Workers) চলে না; সেখানে স্থায়ী প্রসেস আর ডিস্ক নেই।
- ব্যাকআপ: `storage/app.db` ফাইলটি কপি করাই ব্যাকআপ। সার্ভার চালু থাকলে সাথে `app.db-wal` ফাইলও নিন, অথবা SQLite-এর `.backup` কমান্ড ব্যবহার করুন।
