---
title: Database আর migration
description: ctx.db দিয়ে SQLite-এ সরাসরি SQL; টেবিল বদলায় migrations/ ফোল্ডারের ফাইল দিয়ে।
---

Adhar-এর ডেটাবেস SQLite; একটি ফাইল (`storage/app.db`), আলাদা সার্ভার লাগে না। কোনো ORM নেই, লিখতে হয় SQL।

| ডাক | ফেরত |
| --- | --- |
| `db.all(sql, ...params)` | সারির array |
| `db.get(sql, ...params)` | প্রথম সারি, বা `undefined` |
| `db.run(sql, ...params)` | `{ changes, lastId }` |
| `db.transaction(fn)` | `fn`-এর return; ভুল হলে সব বাতিল |

**মান সবসময় `?` দিয়ে বসান।** SQL-এর ভেতরে string জোড়া লাগাবেন না; এতে SQL injection হয়।

```js
db.all('SELECT * FROM users WHERE city = ?', city);          // ঠিক
db.all(`SELECT * FROM users WHERE city = '${city}'`);        // ভুল
```

- `true`/`false` জমা হয় `1`/`0` হিসেবে, `undefined` হয় `NULL`।
- object, array বা `Date` সরাসরি দেওয়া যায় না; `JSON.stringify(value)` বা `date.toISOString()` দিন।
- একাধিক কাজ একসাথে সফল বা ব্যর্থ করতে:

```js
db.transaction(() => {
    db.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', amount, from);
    db.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', amount, to);
});
```

## Migration

টেবিল বানানো বা বদলানো হয় `migrations/` ফোল্ডারের SQL ফাইলে:

```sql
-- migrations/001-create-users.sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);
```

- নাম: তিন অঙ্কের নম্বর, `-`, তারপর নাম। ফাইলগুলো নম্বরের ক্রমে চলে, প্রতিটি একবার।
- `node adhar dev` বাকি migration নিজে চালায়।
- `node adhar start` চালায় না; বাকি থাকলে চালু হয় না। আগে `node adhar migrate` চালান।
- একবার চলে যাওয়া migration বদলাবেন না। বদল দরকার হলে নতুন ফাইল যোগ করুন: `node adhar new migration add-phone`।
- ডেভেলপমেন্টে একদম নতুন করে শুরু করতে চাইলে `storage/` ফোল্ডার মুছে দিন।
