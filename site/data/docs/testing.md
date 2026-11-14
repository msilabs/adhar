---
title: টেস্ট লেখা
description: createApp() আর app.inject() দিয়ে পোর্ট না খুলেই request চালানো।
---

পোর্ট না খুলেই request চালানো যায়:

```js
// test/notes.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '@msilabs/adhar';

test('নোট তৈরি হয়', async () => {
    const app = await createApp(process.cwd(), { env: { DATABASE_PATH: ':memory:' } });

    const res = await app.inject({ method: 'POST', path: '/api/notes', body: { title: 'দুধ কিনতে হবে' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.title, 'দুধ কিনতে হবে');

    await app.close();
});
```

চালান `node --test` দিয়ে। `:memory:` দিলে প্রতিটি টেস্ট পায় নতুন, ফাঁকা ডেটাবেস; migration নিজে থেকে চলে। `inject` ফেরত দেয় `{ status, headers, body }`।
