# brisk4t.github.io

Portfolio, blog, and scrapbook, built with [Astro](https://astro.build). Deploys to GitHub Pages automatically on every push to `main` (see [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Structure

```text
src/
  content.config.ts        # collections: blog, labs
  layouts/
    BaseLayout.astro        # shared chrome (nav/footer) for hub pages
    MinimalShell.astro       # opt-in "back to hub" link, no imposed style
  components/
    SiteNav.astro
  content/
    blog/*.md                # blog posts
    labs/*.md                 # one entry per lab piece (registry/metadata)
  pages/
    index.astro                # home
    blog/index.astro, [...slug].astro
    lab/index.astro            # auto-generated grid, driven by the labs collection
    lab/<slug>/index.astro     # each one a self-contained page/island
```

## Adding a blog post

Add a Markdown file to `src/content/blog/`, e.g. `src/content/blog/my-post.md`:

```md
---
title: My Post
description: One line.
pubDate: 2026-08-20T09:00:00Z
tags: [notes]
---

Body in Markdown.
```

`pubDate` accepts a full ISO 8601 datetime (date-only also works, but is treated as midnight UTC — two posts on the same day with no time will tie and fall back to arbitrary order). Use a `Z`-suffixed UTC time so ordering is deterministic regardless of where the site is built.

It shows up at `/blog/my-post/` and in the `/blog/` index automatically.

## Adding a lab piece

Lab pieces are meant to be **self-contained islands** — a page can look nothing like the rest of the site, use a different framework, or embed a fully independent static bundle.

1. Create `src/pages/lab/<slug>/index.astro`. It does not need to use `BaseLayout`; it can own its entire `<html>`, fonts, and styles. Optionally drop in `<MinimalShell />` for a small "back to hub" link.
2. Register it so it shows up on `/lab/` and the homepage: add `src/content/labs/<slug>.md`:

   ```md
   ---
   title: My Experiment
   description: One line.
   pubDate: 2026-08-20
   tags: [css]
   slug: my-experiment
   accent: "#22c55e"
   ---
   ```

That's the entire extension mechanism — no nav or index code needs to change. See `src/pages/lab/gradient-playground/` for a working example of a fully custom-themed page.

## Commands

| Command           | Action                                       |
| :----------------- | :------------------------------------------- |
| `npm install`       | Install dependencies                         |
| `npm run dev`       | Start local dev server at `localhost:4321`   |
| `npm run build`     | Build production site to `./dist/`           |
| `npm run preview`   | Preview the build locally                    |
