---
title: .env আর CORS
description: PORT, CORS_ORIGIN, DATABASE_PATH আর নিজের গোপন মান রাখার জায়গা।
---

পোর্ট আর গোপন মান থাকে প্রজেক্টের রুটের `.env` ফাইলে, আর পড়া যায় `ctx.env` দিয়ে:

```
PORT=8134
ADMIN_TOKEN=change-me
```

Adhar নিজে যে নামগুলো পড়ে:

| নাম | কাজ | ডিফল্ট |
| --- | --- | --- |
| `PORT` | পোর্ট (`--port` দিলে সেটিই প্রাধান্য পায়) | `8134` |
| `CORS_ORIGIN` | কোন ওয়েবসাইট ব্রাউজার থেকে এই API ডাকতে পারবে | নেই (বন্ধ) |
| `DATABASE_PATH` | SQLite ফাইলের পথ; `:memory:` চলে | `storage/app.db` |

- হোস্টিংয়ের নিজের পরিবেশের ভেরিয়েবল `.env`-এর ওপরে প্রাধান্য পায়।
- `.env` git-এ যায় না (`.gitignore`-এ আছে)। কোন কোন নাম লাগে তা লিখে রাখুন `.env.example`-এ।

অন্য ডোমেইনের ফ্রন্টএন্ড (যেমন Alo সাইট) থেকে ব্রাউজারে API ডাকতে হলে CORS চালু করুন:

```
CORS_ORIGIN=https://example.com, http://localhost:3000
```

পুরো origin লিখুন (`https://` সহ)। `*` দিলে যেকোনো ওয়েবসাইট ডাকতে পারে; production-এ এতে সতর্কবার্তা আসে।
