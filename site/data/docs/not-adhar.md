---
title: যা আধার করে না
description: যা আধার ইচ্ছাকৃতভাবে করে না, আর কেন।
---

- **ORM বা query builder:** SQL নিজেই যথেষ্ট পরিষ্কার, আর শিখলে সব জায়গায় কাজে লাগে।
- **HTML রেন্ডার:** সে কাজ Alo-র। Adhar শুধু Alo-র তৈরি ফাইল সার্ভ করে, তাও কেবল full stack প্রজেক্টে।
- **`import`, কনফিগারেশন ফাইল, প্লাগইন, ডেকোরেটর, controller ক্লাস:** সবকিছু আসে ফোল্ডার আর ফাইলের নাম থেকে।
- **TypeScript বিল্ড, WebSocket, GraphQL:** ছোট API-তে লাগে না।
- **তৈরি auth, ফাইল আপলোড, rate limit, OpenAPI, catch-all route (`[...path]`):** আসল ব্যবহারকারীরা চাইলে পরে ভাবা হবে।
- **migration-এর "down":** ভুল শোধরানো হয় নতুন migration দিয়ে।
