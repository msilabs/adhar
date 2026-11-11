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
| ২৬ | Milestone ২-এ `createApp({ handler })` একটি handler হাতে নেয়; milestone ৩-এ এর জায়গায় আসবে `routes/` স্ক্যান | routing-এর আগে request থেকে response-এর পথটি আলাদাভাবে পরীক্ষা করা |
| ২৭ | JSON response-এর `Content-Type`: `application/json; charset=utf-8` | বাংলা লেখা সব ক্লায়েন্টে ঠিক দেখায় |
| ২৮ | `ctx.error(404)`-এ মেসেজ না দিলে আসে HTTP-র প্রমিত লেখা (`Not Found`) | যা স্বাভাবিক, তা-ই ঘটে |
| ২৯ | throw-এর আগে `ctx.header()` দিয়ে বসানো header ভুলের response-এও থাকে; `Content-Type` সবসময় JSON | middleware-এর বসানো header (যেমন request id) ভুলেও দরকার |
| ৩০ | `204` আর `304`-এ body কখনো যায় না, handler কিছু return করলেও | HTTP-র নিয়ম |
| ৩১ | handler function, symbol বা BigInt return করলে `500`, পরিষ্কার মেসেজসহ | নীরবে ফাঁকা response না দেওয়া |
| ৩২ | ফাঁকা body মানে `ctx.body === undefined`, `Content-Type` যা-ই হোক; `+json` দিয়ে শেষ হওয়া টাইপও JSON | body ছাড়া `DELETE`/`POST` স্বাভাবিক |
| ৩৩ | `Content-Type` ছাড়া body এলে `415`, কীভাবে JSON পাঠাতে হয় তার ইঙ্গিতসহ | অনুমান করে পার্স করা নিরাপদ নয় |
| ৩৪ | query আর form-এ `__proto__` নামের field বাদ পড়ে | prototype pollution থেকে সুরক্ষা |
| ৩৫ | core অপ্রত্যাশিত ভুল (`500`) জানায় `onError` callback দিয়ে; নিজে কিছু ছাপে না। `ctx.error()`-এর ভুল জানানো হয় না | core আর cli আলাদা; 4xx স্বাভাবিক ঘটনা |
| ৩৬ | `ctx.status()` 100–599 আর `ctx.error()` 400–599-এর বাইরের মান পেলে `TypeError` | টাইপো তখনই ধরা পড়ে |
| ৩৭ | body-র সীমা দুই জায়গায় দেখা হয়: stream পড়ার সময় (`Content-Length` আগে) আর পার্সের আগে | মেমরি সুরক্ষা; `inject` আর আসল HTTP একই আচরণ করে |
| ৩৮ | request থেকে response-এর পথ `core/pipeline.js`-এ; `core/app.js` প্রজেক্ট লোড করে আর route মেলায়। #২৬-এর সাময়িক `createApp({ handler })` এখন `createPipeline` | pipeline প্রজেক্ট ছাড়াই পরীক্ষা করা যায় |
| ৩৯ | `Allow` header-এ route-এর method গুলো, `GET` থাকলে `HEAD`, আর সবসময় `OPTIONS` | `HEAD` আর `OPTIONS` নিজে থেকে চলে |
| ৪০ | স্থির ফোল্ডার আগে মেলে; সেই পথে route না পেলে ডায়নামিক ফোল্ডার চেষ্টা হয় (`/users/me/posts` → `users/[id]/posts`) | যা স্বাভাবিক, তা-ই ঘটে |
| ৪১ | `routes/`-এ `.` দিয়ে শুরু ফোল্ডার আর `.js` নয় এমন ফাইল উপেক্ষিত | `.DS_Store`, README-র মতো ফাইলে ভুল না দেওয়া |
| ৪২ | route ফাইলের syntax ভুলে লাইন নম্বর নেই; ইঙ্গিতে `node --check <ফাইল>` | `require()` দিয়ে লোড করা ES module-এর syntax ভুলে Node জায়গা জানায় না |
| ৪৩ | route আছে কিন্তু method অজানা (যেমন `TRACE`) → `405` | route নেই বলা ভুল হতো |
| ৪৪ | body পার্স হয় route মেলানোর আগে, তাই ভাঙা JSON-এ `400` আসে `404`-এর আগে | এক ক্রম, সহজ pipeline |
| ৪৫ | route ফাইলে top-level `await` চলে না; পরিষ্কার ভুল | `require()` async module লোড করতে পারে না |
| ৪৬ | টেস্টের প্রজেক্ট আসল অস্থায়ী ফোল্ডারে লেখা হয় (Alo-র মতো memory fs নয়) | ব্যবহারকারীর ফাইল Node নিজে লোড করে |
| ৪৭ | middleware `next()` ডেকে কিছু return না করলে (`await next();`) handler-এর উত্তরই যায় | সাধারণ ভুলে উত্তর হারিয়ে `204` হওয়া এড়ানো; স্পেকের "middleware যা return করে সেটিই response" শুধু `undefined` ছাড়া মানে প্রযোজ্য |
| ৪৮ | `not-found.js`-এ status ডিফল্টে `404`; `ctx.status()` দিয়ে বদলানো যায় | নাম থেকেই প্রত্যাশিত |
| ৪৯ | `OPTIONS`-ও `404`/`405`-এর মতো শুধু রুটের middleware দিয়ে যায় | preflight-এ auth middleware চললে ব্রাউজারের অনুরোধ আটকে যেত |
| ৫০ | কোনো route ব্যবহার না করলেও প্রতিটি `middleware.js` চালুর সময় যাচাই হয় | চালুর সময়েই ভুল ধরা |
| ৫১ | CI-র ফল পড়া হয় GitHub-এর public Actions পেইজ থেকে, API থেকে নয় | লগইন ছাড়া API ঘণ্টায় ৬০ বারের বেশি ডাকা যায় না; `gh` ইনস্টল নেই |
