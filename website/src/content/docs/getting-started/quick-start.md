---
title: Quick start
description: Get up and running in 5 minutes
---

This walkthrough takes you from a fresh install to pushing content to a live Bricks page. It assumes you've already completed the [installation steps](/getting-started/installation/). The plugin is active, the CLI is in your PATH, and `bricks site info` returns your site details.

## Check your connection

Start by confirming everything is wired up:

```bash
bricks site info
```

```
Site:       https://your-site.com
Bricks:     1.11.1
WordPress:  6.7.2
PHP:        8.2.27
Plugin:     1.2.0
```

If you see your site's details, you're good.

## Pull a page

Grab the elements from an existing Bricks page. You'll need the page ID. Find it in the WordPress admin URL when editing a page (e.g., `post.php?post=1460` means the ID is `1460`).

```bash
bricks site pull 1460
```

```json
[
  {
    "id": "xkq7a2",
    "name": "section",
    "parent": 0,
    "children": ["m3p9b1"],
    "settings": {
      "_cssGlobalClasses": ["acss_import_section__l"]
    }
  },
  {
    "id": "m3p9b1",
    "name": "heading",
    "parent": "xkq7a2",
    "children": [],
    "settings": {
      "tag": "h1",
      "text": "Welcome to our site",
      "_cssGlobalClasses": ["acss_import_text__white"]
    }
  }
]
```

Save it to a file if you want to inspect or modify it:

```bash
bricks site pull 1460 -o page.json
```

## Take a snapshot

Before making any changes, save the current state so you can roll back:

```bash
bricks site snapshot 1460 -l "before quick-start"
```

```
Snapshot created: snap_a1b2c3d4
Label: before quick-start
```

This is your safety net. If anything goes wrong in the next steps, `bricks site rollback 1460` brings it all back.

## Build a section with HTML

Write a small HTML file using your site's ACSS classes and design tokens. You can write this yourself, or have your AI agent of choice generate it using the context from `bricks agent context`.

Create a file called `hero.html`:

```html
<section class="section--l bg--primary-dark">
  <div class="container" style="max-width: var(--content-width)">
    <h1 class="text--white fw--700">Build faster with Agent to Bricks</h1>
    <p class="text--white">Ship Bricks Builder pages from the command line.</p>
    <div style="display: flex; gap: var(--space-m)">
      <a class="btn--primary" href="/get-started">Get started</a>
      <a class="btn--outline" href="/docs">View docs</a>
    </div>
  </div>
</section>
```

Convert and push it to the page:

```bash
bricks convert html hero.html --push 1460 --snapshot
```

```
Snapshot created: snap_e5f6g7h8
Converted 6 elements from hero.html
Resolved 4 global classes: section--l, bg--primary-dark, text--white, fw--700

Pushed to page 1460:
  + section
    + container
      + heading: "Build faster with Agent to Bricks"
      + text: "Ship Bricks Builder pages from the command line."
      + div (button group)
        + button: "Get started"
        + button: "View docs"

Elements: 6 added
```

The `--snapshot` flag saves the page state before pushing, so you can roll back. Get in the habit of always including it.

## Preview with dry run

Not ready to push? Use `--dry-run` to see what would happen:

```bash
bricks convert html hero.html --push 1460 --dry-run
```

```
[dry-run] Would push 6 elements to page 1460
```

Nothing is written. Remove the `--dry-run` flag when you're happy with the output.

## Verify the result

Check the page for structural issues:

```bash
bricks doctor 1460
```

```
Page 1460: 10 elements, 0 issues
All elements have valid parents.
No orphaned elements found.
No broken class references.
```

Open the page in Bricks to see the visual result, or pull the elements again to inspect the JSON:

```bash
bricks site pull 1460 -o updated-page.json
```

## Roll back if needed

If the generated content isn't what you wanted:

```bash
bricks site snapshots 1460
```

```
ID              Label                Created
snap_i9j0k1l2  (auto)               2026-02-25 14:32:01
snap_e5f6g7h8  (auto)               2026-02-25 14:30:15
snap_a1b2c3d4  before quick-start   2026-02-25 14:28:03
```

```bash
bricks site rollback 1460 snap_a1b2c3d4
```

```
Rolled back page 1460 to snapshot snap_a1b2c3d4 (before quick-start)
```

The page is back to its original state.

## The full workflow at a glance

```bash
bricks site info                                              # confirm connection
bricks site pull 1460                                         # see what's on the page
bricks site snapshot 1460                                     # save current state
bricks convert html hero.html --push 1460 --snapshot          # convert and push
bricks doctor 1460                                            # check for issues
bricks site rollback 1460                                     # undo if needed
```

## Next steps

- [Configuration](/getting-started/configuration/): set up multiple sites and environment variables
- [Bring your own agent](/guides/bring-your-own-agent/): connect Claude Code, Codex, or any AI tool to your site
- [Working with templates](/guides/working-with-templates/): compose reusable section templates into pages
