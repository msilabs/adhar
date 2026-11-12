## The site in `web/` (Alo)

This is a full stack project: `web/` holds an Alo site, served on the same port as the API. Alo is a small static site framework; `.alo` files are plain HTML with a few extras. Do not guess from React, Vue, Astro or Svelte. The full guide is at https://raw.githubusercontent.com/msilabs/alo/main/templates/init/AGENTS.md; read it before you write more than a small change.

```
web/
  pages/layout.alo            wraps every page; exactly one <slot />
  pages/page.alo              /
  pages/about/page.alo        /about/
  pages/not-found.alo         the 404 page
  components/Notes.alo        <Notes />      (blog/PostCard.alo -> <Blog.PostCard />)
  data/site.json              data.site
  global/                     .css and .js for every page
  public/                     copied as it is
  dist/                       built by `node adhar build`; never edit, not in git
```

- Everything under `/api` is the API (`api/`); every other URL is the site (`web/`). `web/pages/api/` and `web/public/api/` are not allowed.
- In the browser call the API with a relative URL: `fetch('/api/notes')`. No host, no port, no CORS.
- A `.alo` file has up to four top-level blocks: `<head>`, `<template>`, `<style>`, `<script>`. No `import`, and no `<link>` or `<script src>` for local files.
- `{{ }}` runs once at build time and is not reactive. Data from the API is loaded in a `<script>` with `fetch`; inside it, `$el` is the component's root element.
- Loops and conditions are only `<template for="note in data.notes">` and `<template if="...">`, never attributes on other tags.
- In a component read props as `props.title`. A component in a folder is always written with its full name: `<Blog.PostCard />`.
- Elements created in a `<script>` are not reached by the scoped `<style>`; style them in `<style global>`.
- There is no `node alo` here. Use Adhar's commands:

```
node adhar dev                         the API and the site on one port, with live reload
node adhar build                       builds the site into web/dist/
node adhar start                       production: serves the API and web/dist/ (run `build` and `migrate` first)
node adhar web new page about          web/pages/about/page.alo
node adhar web new component Card      web/components/Card.alo
```

| Wrong | Right |
| --- | --- |
| `fetch('http://localhost:8134/api/notes')` | `fetch('/api/notes')` |
| `node alo dev`, `cd web && npx alo build` | `node adhar dev`, `node adhar build` |
| `web/pages/api/page.alo` | a route in `api/`, or another page name |
| `<li for="note in notes">` | `<template for="note in data.notes"><li>…</li></template>` |
| rendering API data with `{{ }}` | `fetch` in a `<script>`, then update the DOM |
| editing `web/dist/` | editing `web/pages/` or `web/components/`, then `node adhar build` |
