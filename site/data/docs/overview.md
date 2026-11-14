---
title: এক পাতায় আধার
description: এটুকু জানলেই কাজ শুরু করা যায়: আটটি নিয়ম, আর আলো জানলে তার সাথে মিল।
---

এটুকু জানলেই কাজ শুরু করা যায়।

1. **Route:** `api/users/route.js` মানে `/api/users`। ফাইলে `GET`, `POST`, `PUT`, `PATCH`, `DELETE` নামে ফাংশন export করুন।
2. **উত্তর:** ফাংশন যা return করে, তা-ই JSON হয়ে যায়।
3. **ডায়নামিক route:** `api/users/[id]/route.js` মানে `/api/users/:id`; মান থাকে `ctx.params.id`-তে।
4. **Middleware:** `middleware.js` তার ফোল্ডারের সব route-এর আগে চলে। পরের ধাপে যেতে `next()`।
5. **Service:** `services/users.js` হয় `ctx.services.users`। ফোল্ডারে থাকলে `services/blog/posts.js` হয় `ctx.services.blog.posts`।
6. **Database:** `ctx.db` দিয়ে SQL চালানো। টেবিল বানানো হয় `migrations/001-নাম.sql` ফাইলে।
7. **ভ্যালিডেশন:** route ফাইলে `schema` export করলে ভুল ইনপুট handler পর্যন্ত পৌঁছায় না।
8. **ভুল:** `throw ctx.error(404, 'Not found')`।

| লিখবেন | কাজ |
| --- | --- |
| `ctx.params` | URL-এর `[নাম]` অংশের মান |
| `ctx.query` | `?page=2` অংশ |
| `ctx.body` | request-এর JSON body |
| `ctx.headers` | request header (নাম ছোট হাতের) |
| `ctx.method`, `ctx.path` | HTTP method আর path |
| `ctx.services` | `services/` ফোল্ডারের সবকিছু |
| `ctx.db` | SQLite: `all`, `get`, `run`, `transaction` |
| `ctx.env` | `.env` ফাইল আর পরিবেশের ভেরিয়েবল |
| `ctx.state` | middleware থেকে handler-এ তথ্য পাঠানোর জায়গা |
| `ctx.status(201)` | response-এর status বদলানো |
| `ctx.header('X-Total', '42')` | response header বসানো |
| `ctx.error(404, 'Not found')` | throw করার জন্য HTTP ভুল বানানো |

## Alo জানলে

| Alo | Adhar |
| --- | --- |
| `pages/about/page.alo` → `/about/` | `api/users/route.js` → `/api/users` |
| `pages/blog/[slug]/page.alo` | `api/users/[id]/route.js` |
| `layout.alo` আর `<slot />` | `middleware.js` আর `next()` |
| `(site)/` route গ্রুপ | `(admin)/` route গ্রুপ |
| `components/blog/PostCard.alo` → `<Blog.PostCard />` | `services/blog/posts.js` → `ctx.services.blog.posts` |
| `props` | `ctx` |
| `data/*.json` | `migrations/*.sql` আর `ctx.db` |
| `alo dev`, `alo build` | `adhar dev`, `adhar start` |
