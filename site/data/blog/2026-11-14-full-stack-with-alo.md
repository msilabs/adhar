---
title: এক প্রজেক্টে API আর আলোর সাইট
description: আধার 1.2-এ প্রজেক্টে web/ ফোল্ডার থাকলে আলোর সাইট আর API এক পোর্টে চলে। কীভাবে, কেন, আর কখন আলাদা প্রজেক্টই ভালো।
tags: [full stack, 1.2]
---

আধার আর [আলো](https://msilabs.github.io/alo/) জোড়া ফ্রেমওয়ার্ক: একটি বানায় স্ট্যাটিক সাইট, অন্যটি তার পেছনের API। আধার 1.2.0 থেকে দুটো এক প্রজেক্টে, এক পোর্টে চলে।

## শুরু

```bash
npx @msilabs/adhar init my-app --web
cd my-app
npm install
node adhar dev
```

`http://localhost:8134` খুললে সাইট আসে, আর `http://localhost:8134/api/notes`-এ API। `.alo` ফাইল বদলালে পেইজ নিজে রিলোড হয়; `api/`-এর ফাইল বদলালে API নতুন করে চালু হয়।

## গঠন

```
my-app/
├── api/              ← আধার: /api/…
├── services/
├── migrations/
├── web/              ← আলো: বাকি সব ঠিকানা
├── package.json      ← একটাই
└── adhar             ← একটাই কমান্ড
```

নিয়ম সহজ: প্রজেক্টে `web/pages/` ফোল্ডার থাকলে সেটি full stack, কোনো কনফিগ ছাড়াই। `/api` আর তার নিচের ঠিকানা API-র; বাকি সব সাইটের। তাই সাইট থেকে API ডাকতে শুধু `fetch('/api/notes')` লিখলেই হয়। একই ঠিকানা, তাই CORS লাগে না।

## কেন 1.1.0-তে `routes/` বদলে `api/` হলো

এই কাজের জন্যই 1.1.0-তে ফোল্ডারের নাম `routes/` থেকে `api/` করা হয়, আর সব ঠিকানা `/api` দিয়ে শুরু হয়। API যদি `/notes`-এ থাকত, তাহলে একই প্রজেক্টে সাইটের পেইজের সাথে ঠিকানার সংঘর্ষ হতো। `/api` আলাদা করে রাখায় API-র কোনো ঠিকানা না বদলিয়েই পরে সাইট যোগ করা যায়। 1.0 থেকে আসলে করণীয় আছে [আপগ্রেড](/docs/upgrade/) পাতায়।

## প্রকাশের সময়

```bash
npm install
node adhar build
node adhar migrate
node adhar start
```

- `build` সাইটকে সাধারণ HTML, CSS, JS ফাইল বানিয়ে `web/dist/`-এ রাখে। `start` নিজে build করে না; `web/dist/` না থাকলে চালু হয় না আর বলে দেয় `node adhar build` চালাতে।
- আলো থাকে `devDependencies`-এ, কারণ লাগে শুধু `dev` আর `build`-এ। production-এ `build` চালালে `npm install` করুন `--omit=dev` ছাড়া।
- `start`-এর সময় আলো চলে না; আধার শুধু তৈরি ফাইলগুলো সার্ভ করে।

## যা মনে রাখতে হবে

- full stack প্রজেক্টের সাইটও Node সার্ভার থেকে যায়, তাই GitHub Pages বা Netlify-র মতো স্ট্যাটিক হোস্টে এটি চলে না।
- সাইটের অংশে `api/middleware.js` চলে না, আর সেখানে শুধু `GET` আর `HEAD` চলে।
- `web/pages/api/` রাখা যায় না, কারণ `/api` API-র।

## কখন আলাদা প্রজেক্টই ভালো

সাইট স্ট্যাটিক হোস্টে (GitHub Pages, Netlify) থাকলে, বা একই API মোবাইল অ্যাপও ডাকলে, আলো আর আধার আলাদা প্রজেক্ট রাখাই ঠিক। তখন সাইট ব্রাউজার থেকে API ডাকে, আর API-র `.env`-এ `CORS_ORIGIN` দিয়ে সাইটের ঠিকানা জানাতে হয়। বিস্তারিত: [আলাদা প্রজেক্ট হিসেবে](/docs/with-alo/) আর [Full stack](/docs/full-stack/)।
