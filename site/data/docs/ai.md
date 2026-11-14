---
title: AI সহকারী দিয়ে কাজ
description: প্রতিটি নতুন প্রজেক্টের AGENTS.md ফাইল AI সহকারীকে আধারের নিয়ম শেখায়।
---

Claude, ChatGPT, Cursor বা Copilot-এর মতো AI সহকারী Adhar সম্পর্কে জানে না। আগে না জানালে সে Express বা Next.js-এর ধরনে কোড লিখবে (`req, res`, `res.json()`, `import express`)। এ সমস্যা এড়াতে:

- **`adhar init` দিয়ে বানানো প্রজেক্টে** রুটে একটি `AGENTS.md` থাকে। Claude Code, Cursor, Codex-এর মতো টুল ফোল্ডার খুললে এটি নিজে পড়ে নেয়।
- **চ্যাটে বা অন্য প্রজেক্টে** AI-কে এই লিংক দিন, বা প্রম্পটে লিখে দিন:

  > Read https://raw.githubusercontent.com/msilabs/adhar/main/templates/init/AGENTS.md and follow it for all Adhar code in this project.

গাইডটি ইংরেজিতে, কারণ AI-এর কাছে নিয়মগুলো এতে সবচেয়ে নির্ভুল পৌঁছায়। রুটের [llms.txt](https://github.com/msilabs/adhar/blob/main/llms.txt) ফাইলেও একই লিংক আছে।
