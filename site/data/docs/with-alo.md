---
title: আলোর সাথে, আলাদা প্রজেক্ট হিসেবে
description: সাইট স্ট্যাটিক হোস্টে আর API আলাদা সার্ভারে থাকলে CORS দিয়ে দুটোকে জোড়া।
---

কখন কোনটি: সাইট আর API একসাথে ডিপ্লয় হলে [Full stack](/docs/full-stack/) সহজ। সাইট স্ট্যাটিক হোস্টে (GitHub Pages, Netlify) আর API আলাদা সার্ভারে থাকলে, বা একই API মোবাইল অ্যাপও ডাকলে, দুটি আলাদা প্রজেক্ট রাখুন; তখন নিচের নিয়ম।

Alo সাইট স্ট্যাটিক, তাই ফর্ম জমা বা লাইভ ডেটার জন্য সে ব্রাউজার থেকে Adhar API ডাকে।

Adhar-এর `.env`:

```
CORS_ORIGIN=https://my-site.example.com
```

নিজের কম্পিউটারে দুটো একসাথে চালানো যায়: `node alo dev` চলে `http://localhost:3000`-এ, `node adhar dev` চলে `http://localhost:8134`-এ। তখন Adhar-এর `.env`-এ লিখুন `CORS_ORIGIN=http://localhost:3000`, আর Alo থেকে ডাকুন `http://localhost:8134/api/notes`।

Alo-র কোনো কম্পোনেন্টে:

```html
<template>
    <form>
        <input name="title" required />
        <button>যোগ করুন</button>
    </form>
</template>

<script>
    $el.querySelector('form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = new FormData(event.target).get('title');
        const res = await fetch('https://api.example.com/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        if (res.ok) event.target.reset();
    });
</script>
```
