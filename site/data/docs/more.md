---
title: আরও কিছু
description: এগুলো না জেনেও কাজ চলে: destructuring, নিজের 404, ভুল ধরা, ফর্মের ডেটা, ভেতরের transaction।
---

এগুলো না জেনেও কাজ চলে।

## Destructuring

`ctx` শুধু প্যারামিটারের নাম। যা লাগে শুধু সেটুকু নিতে পারেন:

```js
export function GET({ params, services, error }) {
    const user = services.users.find(params.id);
    if (!user) throw error(404, 'User not found');
    return user;
}
```

## নিজের 404

```js
// api/not-found.js
export default function (ctx) {
    return { error: { status: 404, message: `${ctx.path} বলে কিছু নেই` } };
}
```

ফাইলটি শুধু `api/`-এর রুটে থাকে।

## ভুল ধরা middleware-এ

handler-এর ভুল middleware দিয়ে উপরে ওঠে, তাই এক জায়গায় ধরা যায়:

```js
export default async function (ctx, next) {
    try {
        return await next();
    } catch (err) {
        if (!err.status) console.error('অপ্রত্যাশিত ভুল:', err);
        throw err;
    }
}
```

## ফর্ম থেকে আসা ডেটা

`Content-Type: application/x-www-form-urlencoded` body-ও `ctx.body`-তে object হয়ে আসে। অন্য ধরনের body-তে (যেমন ফাইল আপলোড) `415` যায়। body-র সীমা 1 MB।

## ভেতরের transaction

`db.transaction()`-এর ভেতরে আরেকটি `db.transaction()` ডাকা যায়। ভেতরেরটি ব্যর্থ হলে শুধু তার কাজ বাতিল হয়; ভুলটি ধরলে বাইরেরটি চলতে থাকে।
