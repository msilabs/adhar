---
title: Middleware
description: middleware.js তার ফোল্ডারের সব route-এর আগে চলে; পরের ধাপে যেতে next()।
---

```js
// api/(admin)/middleware.js
export default function (ctx, next) {
    if (ctx.headers.authorization !== `Bearer ${ctx.env.ADMIN_TOKEN}`) {
        throw ctx.error(401, 'Login required');
    }
    ctx.state.admin = true;
    return next();
}
```

- ফাইলে একটিই export: `default`, ফাংশন `(ctx, next)`।
- ক্রম Alo-র লেআউটের মতো: `api/middleware.js` সবার আগে, তারপর ভেতরের ফোল্ডারগুলো, শেষে handler।
- `return next()` মানে পরের ধাপে যাও। `next()` না ডেকে কিছু return করলে handler চলে না, সেই মানই উত্তর।
- handler-এর পরে কাজ করতে চাইলে:

```js
export default async function (ctx, next) {
    const started = performance.now();
    const result = await next();
    ctx.header('X-Response-Time', `${Math.round(performance.now() - started)}ms`);
    return result;
}
```

`404`, `405` আর `OPTIONS`-এ শুধু `api/middleware.js` চলে।
