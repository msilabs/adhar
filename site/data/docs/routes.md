---
title: Route
description: ফোল্ডারই URL। একটি route.js ফাইলে GET, POST নামের ফাংশন export করলেই API তৈরি।
---

ফোল্ডারই URL:

```
api/
├── middleware.js         ← সব route-এ চলে
├── route.js              → /api
├── users/
│   ├── route.js          → /api/users
│   └── [id]/
│       └── route.js      → /api/users/:id
└── (admin)/
    ├── middleware.js     ← শুধু এই গ্রুপে
    └── stats/
        └── route.js      → /api/stats
```

একটি route ফাইল:

```js
// api/users/[id]/route.js
export function GET(ctx) {
    const user = ctx.services.users.find(ctx.params.id);
    if (!user) throw ctx.error(404, 'User not found');
    return user;
}

export function DELETE(ctx) {
    ctx.services.users.remove(ctx.params.id);
}
```

নিয়ম:

- ফোল্ডারের নাম `api`, তাই সব ঠিকানা `/api` দিয়ে শুরু। `/api`-র বাইরের ঠিকানা (`/`, `/users`) সবসময় `404`।
- `[নাম]` ফোল্ডার URL-এর একটি অংশের সাথে মেলে। একাধিক লেভেলে থাকতে পারে: `api/users/[id]/posts/[postId]/route.js`।
- `(নাম)` ফোল্ডার URL-এ আসে না; শুধু সাজানো আর middleware ভাগ করার জন্য।
- স্থির ফোল্ডার ডায়নামিকের আগে মেলে: `/api/users/me` যায় `users/me/route.js`-এ।
- ফোল্ডারের নাম: ছোট হাতের অক্ষর, সংখ্যা আর `-`।
- `api/`-এর ভেতরে শুধু তিনটি নামের ফাইল থাকে: `route.js`, `middleware.js`, `not-found.js`। বাকি কোড রাখুন `services/`-এ।
- handler `async` হতে পারে।

handler যা return করে:

| return | response |
| --- | --- |
| object বা array | `200`, JSON |
| কিছু না | `204`, body নেই |
| string | `200`, সাধারণ লেখা |
| number, boolean, `null` | `200`, JSON |

নিজে থেকে যা ঘটে:

- route নেই → `404`। dev-এ ঠিকানায় শুধু `/api` বাদ পড়লে বার্তায় ইঙ্গিত থাকে: ``Did you mean `/api/users`?``
- route আছে কিন্তু method-এর ফাংশন নেই → `405`, সাথে `Allow` header।
- `HEAD` চলে `GET` দিয়ে, body ছাড়া। `OPTIONS` নিজে উত্তর পায়।
- শেষের `/` উপেক্ষিত: `/api/users/` আর `/api/users` একই।

সব ভুলের আকার একই:

```json
{ "error": { "status": 404, "message": "User not found" } }
```

handler-এ অপ্রত্যাশিত ভুল হলে `500` যায়। dev-এ response-এ মেসেজ আর stack থাকে; production-এ শুধু `Internal server error`, বিস্তারিত থাকে সার্ভারের লগে।
