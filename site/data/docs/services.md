---
title: Service
description: services/ ফোল্ডারের ফাইল import ছাড়াই পাওয়া যায় ctx.services-এ।
---

route ছোট রাখুন; আসল কাজ রাখুন service-এ।

```js
// services/users.js
export default ({ db }) => ({
    all() {
        return db.all('SELECT * FROM users ORDER BY id');
    },
    find(id) {
        return db.get('SELECT * FROM users WHERE id = ?', id);
    },
    create({ name, email }) {
        return db.get('INSERT INTO users (name, email) VALUES (?, ?) RETURNING *', name, email);
    },
});
```

- ফাইলে একটিই export: `default`, একটি ফাংশন। সেটি পায় `{ db, env, services }`, আর ফেরত দেয় ফাংশনের একটি object।
- সার্ভার চালুর সময় ফাংশনটি একবার চলে।
- নাম আসে ফাইলের অবস্থান থেকে। কোথাও `import` লাগে না: route-এ `ctx.services.users`, অন্য service-এ `services.users`।
- ফাইলের নাম JS-এর নামের নিয়ম মানে: `blogPosts.js`, `blog-posts.js` নয়।
- ভুল নাম লিখলে (`ctx.services.user`) সাথে সাথে ভুল আসে, কাছাকাছি নামের ইঙ্গিতসহ।
- service-এ `ctx` নেই। request-এর কিছু লাগলে route থেকে আর্গুমেন্ট হিসেবে পাঠান।
