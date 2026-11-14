---
title: Full stack
description: একই প্রজেক্টে আধারের API আর আলোর সাইট, এক পোর্টে, এক ডিপ্লয়ে।
---

একই প্রজেক্টে Adhar-এর API আর Alo-র সাইট, এক পোর্টে, এক ডিপ্লয়ে:

```bash
npx @msilabs/adhar init my-app --web
cd my-app
npm install
node adhar dev
```

`http://localhost:8134` খুললে সাইট আসে, আর `http://localhost:8134/api/notes`-এ API। `.alo` ফাইল বদলালে পেইজ নিজে রিলোড হয়; `api/`-এর ফাইল বদলালে API নতুন করে চালু হয়।

```
my-app/
├── api/              ← API, আগের মতোই → /api/…
├── services/
├── migrations/
├── web/              ← Alo-র সাইট → বাকি সব ঠিকানা
│   ├── pages/
│   ├── components/
│   ├── data/
│   ├── global/
│   └── public/
├── package.json      ← একটাই; Alo থাকে devDependencies-এ
└── adhar             ← একটাই কমান্ড
```

নিয়ম:

- **`web/pages/` ফোল্ডার থাকলেই প্রজেক্ট full stack।** কোনো কনফিগ নেই। ফোল্ডারটি না থাকলে Adhar আগের মতোই শুধু API।
- `/api` আর তার নিচের সব ঠিকানা API-র; বাকি সব সাইটের। তাই `web/pages/api/` রাখা যায় না।
- সাইট থেকে API ডাকুন শুধু পথ দিয়ে: `fetch('/api/notes')`। একই ঠিকানা, তাই CORS লাগে না।
- `web/`-এর ভেতরে `package.json` বা `alo` লঞ্চার নেই। সব কাজ `node adhar …` দিয়ে; নতুন পেইজ বা কম্পোনেন্ট: `node adhar web new page about`।
- সাইটের অংশে `api/middleware.js` চলে না।

তিনটি কমান্ড:

| কমান্ড | যা করে |
| --- | --- |
| `node adhar dev` | API আর Alo-র dev সার্ভার দুটোই চালায়, এক ঠিকানায়, লাইভ রিলোডসহ |
| `node adhar build` | সাইটকে সাধারণ HTML, CSS, JS ফাইল বানিয়ে `web/dist/`-এ রাখে |
| `node adhar start` | production: API আর `web/dist/`-এর ফাইল সার্ভ করে। Alo তখন চলে না |

`start` নিজে build করে না; `web/dist/` না থাকলে চালু হয় না আর বলে দেয় `node adhar build` চালাতে।

চলমান শুধু-API প্রজেক্টে সাইট যোগ করতে: `npm i -D @msilabs/alo`, তারপর `web/pages/page.alo` বানান। API-র কোনো ঠিকানা বদলায় না।

`.alo` ফাইল লেখার নিয়ম [Alo-র ডকসে](https://msilabs.github.io/alo/docs/)।
