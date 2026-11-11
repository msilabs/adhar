# সিদ্ধান্তের খাতা

এখানে Adhar-এর নকশার সিদ্ধান্তগুলো লেখা থাকে। ১–২০ এসেছে মূল স্পেক থেকে ([docs/SPEC.md](docs/SPEC.md), অংশ ২১)। এরপরের সিদ্ধান্তগুলো এসেছে ইমপ্লিমেন্টেশনের সময়।

## স্পেক থেকে

| # | সিদ্ধান্ত | কারণ |
| --- | --- | --- |
| ১ | অংশ ০ ফ্রেমওয়ার্কের সীমানা; নতুন কিছুর আগে তিন প্রশ্ন | পাঁচ মিনিটে শেখা যায় |
| ২ | ফোল্ডারে `route.js`, method নামে export | একটি resource এক ফাইলে; সাধারণ JS (মালিক, ২০২৬-১১-১১) |
| ৩ | service auto-inject, `ctx.services` | Alo-র "কোনো ইমপোর্ট নয়" (মালিক, ২০২৬-১১-১১) |
| ৪ | Database: `node:sqlite` | জিরো ডিপেন্ডেন্সি; আসল SQL (মালিক, ২০২৬-১১-১১) |
| ৫ | ব্যবহারকারীর ফাইল ESM, core CommonJS | আধুনিক মান; Alo-র core-এর সাথে মিল (মালিক, ২০২৬-১১-১১) |
| ৬ | service একটি factory: `export default ({ db, env, services }) => ({ … })` | সাধারণ closure; লুকানো আর্গুমেন্ট নেই |
| ৭ | service-এ `ctx` নেই | পরীক্ষা সহজ; request আর ব্যবসার লজিক আলাদা |
| ৮ | Node ≥ 22.13 | flag ছাড়া `node:sqlite` আর `require(esm)` |
| ৯ | dev-এ ফাইল বদলালে worker প্রসেস restart | ESM cache মোছা যায় না |
| ১০ | schema-র বাইরের field বাদ পড়ে | নিরাপদ ডিফল্ট |
| ১১ | `query`/`params`-এ সংখ্যা আর বুলিয়ান রূপান্তর হয়; `body`-তে নয় | URL-এ সবই string; JSON-এ টাইপ আছে |
| ১২ | ভ্যালিডেশন middleware-এর পরে | auth আগে, ইনপুট পরে |
| ১৩ | `undefined` return → 204 | যা স্বাভাবিক, তা-ই ঘটে |
| ১৪ | `adhar start` migration চালায় না; বাকি থাকলে চালু হয় না | production-এ DB বদল সচেতন পদক্ষেপ |
| ১৫ | migration-এ `down` নেই | শেখার বিষয় কম; নতুন migration-ই সমাধান |
| ১৬ | CORS ডিফল্টে বন্ধ; `.env`-এর `CORS_ORIGIN` | নিরাপদ ডিফল্ট; কনফিগ ফাইল নেই |
| ১৭ | প্যাকেজ প্রজেক্টের `dependencies`-এ | production-এ চলে |
| ১৮ | `[param]` একাধিক লেভেলে চলে (Alo-তে এক লেভেল) | API-তে `/users/:id/posts/:postId` সাধারণ |
| ১৯ | auth helper, OpenAPI, upload, catch-all → পরে | আগে আসল ব্যবহার দেখা |
| ২০ | ডকুমেন্টেশনে প্যারামিটারের নাম `ctx`; destructuring-ও চলে, method সহ | প্রচলিত আর ছোট; AI সহকারীরা চেনে (মালিক, ২০২৬-১১-১১) |

## ইমপ্লিমেন্টেশনের সময়

| # | সিদ্ধান্ত | কারণ |
| --- | --- | --- |
| ২১ | `AdharError`-এ শুধু `file`, `line`, `message`, `hint`; Alo-র `column`, code frame আর `calledFrom` নেই | Adhar নিজে কোনো ফাইল পার্স করে না; JS-এর ভুলে Node নিজেই frame দেখায় |
| ২২ | CLI-র Node যাচাই major আর minor দুটোই দেখে (22.13) | 22.0–22.12-তে `node:sqlite` বা `require(esm)` flag ছাড়া চলে না |
| ২৩ | CI: Linux আর Windows-এ Node 22, 24, 26; macOS-এ শুধু 24 | macOS runner ধীর; OS-নির্ভর ভুল Node ভার্সনে কমই বদলায় (মালিক, ২০২৬-১১-১১) |
| ২৪ | লোকাল ডেভেলপমেন্ট Node 24-এ | মালিক, ২০২৬-১১-১১ |
| ২৫ | এখনো তৈরি না হওয়া কমান্ড চালালে পরিষ্কার ভুল: "is not built yet" | milestone চলাকালীন নীরব ব্যর্থতা এড়ানো; milestone ১০-এর পর এই পথ থাকবে না |
