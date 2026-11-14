---
title: ভ্যালিডেশন
description: route ফাইলে schema export করলে ভুল ইনপুট handler পর্যন্ত পৌঁছায় না।
---

```js
// api/users/route.js
export const schema = {
    GET: { query: { page: 'integer?', search: 'string?' } },
    POST: { body: { name: 'string', email: 'email', age: 'number?' } },
};

export function POST(ctx) {
    ctx.status(201);
    return ctx.services.users.create(ctx.body);
}
```

- টাইপ: `string`, `number`, `integer`, `boolean`, `email`, `array`, `object`। শেষে `?` মানে ঐচ্ছিক।
- `body`, `query` আর `params`, তিনটিতেই চলে।
- `query` আর `params`-এর মান লেখা হয়ে আসে, তাই সংখ্যা আর বুলিয়ান নিজে থেকে রূপান্তর হয়: `?page=2`-এ `ctx.query.page` হয় সংখ্যা `2`।
- schema-তে নেই এমন field `body` আর `query` থেকে বাদ পড়ে। তাই ক্লায়েন্ট বাড়তি `role: "admin"` পাঠালেও handler-এ পৌঁছায় না।
- না মিললে handler চলে না:

```json
{
    "error": {
        "status": 422,
        "message": "Validation failed",
        "fields": { "name": "is required", "email": "must be a valid email" }
    }
}
```

এর বেশি যাচাই (দৈর্ঘ্য, ধরন, ভেতরের object) handler-এ সাধারণ JS দিয়ে করুন।
