---
title: সাধারণ প্রশ্ন
description: যা প্রায়ই জানতে চাওয়া হয়।
---

## `ctx` মানে কী? অন্য নাম দেওয়া যায়?

"context"-এর সংক্ষেপ: একটি request-এর সবকিছু (`params`, `body`, `db`…) যে object-এ থাকে। এটি শুধু প্যারামিটারের নাম, তাই যেকোনো নাম চলে; ডকুমেন্টেশনে সবখানে `ctx`।

## `res.json()` বা `res.send()` নেই কেন?

কারণ return-ই যথেষ্ট। ফাংশন একটি মান ফেরত দেয়, Adhar সেটি পাঠায়। এতে handler সাধারণ ফাংশন থাকে, আর টেস্ট করাও সহজ।

## service-এ `import` না করে `ctx.services` কেন?

`../../../services/users.js`-এর মতো পথ লিখতে আর ঠিক রাখতে হয় না, আর ফাইল সরালেও কিছু ভাঙে না। Alo-তে কম্পোনেন্ট যেমন `import` ছাড়া চলে, এখানেও তেমন।

## PostgreSQL বা MySQL ব্যবহার করা যায়?

Adhar-এর `ctx.db` শুধু SQLite। অন্য ডেটাবেস চাইলে তার npm প্যাকেজ ইনস্টল করে একটি service-এর ভেতরে সংযোগ খুলুন; route-এ তখন `ctx.services.<নাম>` ব্যবহার করুন। migration তখন নিজে সামলাতে হবে।

## SQLite কি production-এ চলে?

হ্যাঁ, এক সার্ভারে চলা ছোট আর মাঝারি অ্যাপের জন্য। একসাথে অনেক পড়া সামলাতে পারে; লেখা হয় একটি একটি করে, যা বেশিরভাগ অ্যাপের জন্য যথেষ্ট দ্রুত। একাধিক সার্ভারে একই ডেটাবেস লাগলে SQLite উপযুক্ত নয়।

## লগইন আর ব্যবহারকারীর অনুমতি কীভাবে করব?

v1-এ তৈরি auth নেই। একটি middleware-এ header থেকে token পড়ে যাচাই করুন (`init` প্রজেক্টের `api/(admin)/middleware.js` দেখুন), আর ব্যবহারকারীর তথ্য রাখুন `ctx.state`-এ। password hash করতে Node.js-এর `node:crypto`-র `scrypt` ব্যবহার করুন।

## TypeScript?

Adhar সাধারণ JS ফাইল লোড করে; কোনো বিল্ড ধাপ নেই।

## এরর মেসেজ কেমন দেখায়?

সার্ভার চালুর সময়ই সব route, schema, middleware আর service যাচাই হয়। ভুল থাকলে ফাইল আর সমাধানের ইঙ্গিত আসে:

```
✖ Error: api/users/route.js
  Unknown export `get`.

  Hint: Did you mean `GET`? Method names are upper-case.
```
