---
title: কমান্ড
description: node adhar দিয়ে চালানো সব কমান্ড।
---

```bash
node adhar init [folder]               # উদাহরণসহ নতুন প্রজেক্ট (npx @msilabs/adhar init)
node adhar dev [--port 8134]           # dev সার্ভার; ফাইল বদলালে নতুন করে চালু হয়
node adhar build                       # full stack: web/-এর সাইট বানায় web/dist/-এ
node adhar start [--port 8134]         # production সার্ভার
node adhar routes                      # সব route-এর তালিকা
node adhar migrate                     # বাকি migration চালানো
node adhar new route "users/[id]"      # api/users/[id]/route.js
node adhar new middleware "(admin)"    # api/(admin)/middleware.js
node adhar new service blog/posts      # services/blog/posts.js
node adhar new migration create-posts  # migrations/<পরের নম্বর>-create-posts.sql
node adhar web new component Card      # full stack: web/components/Card.alo
node adhar --help
node adhar --version
```

- নামে `[ ]` বা `( )` থাকলে উদ্ধৃতিচিহ্ন দিন, কারণ shell-এ এগুলোর আলাদা অর্থ আছে।
- `dev` আর `start`-এর পার্থক্য:

| | `dev` | `start` |
| --- | --- | --- |
| ফাইল বদলালে | নতুন করে চালু হয় | কিছু হয় না |
| বাকি migration | নিজে চালায় | চালু হয় না, `migrate` চালাতে বলে |
| `500`-এর বিস্তারিত | response-এ দেখায় | শুধু সার্ভারের লগে |
| `ctx.env.NODE_ENV` | `development` | `production` |

- দুটোতেই প্রতি request-এ এক লাইন ছাপা হয়: `GET /api/users 200 3ms`।
- `start` বন্ধ করলে (Ctrl+C বা হোস্টের থামানোর সংকেত) চলমান request শেষ হয়, তারপর ডেটাবেস বন্ধ হয়।
