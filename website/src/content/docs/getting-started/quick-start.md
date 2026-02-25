---
title: Quick start
description: Get up and running in 5 minutes
---

This walkthrough takes you from a fresh install to pushing AI-generated content to a live Bricks page. It assumes you've already completed the [installation steps](/getting-started/installation/) -- the plugin is active, the CLI is in your PATH, and `bricks site info` returns your site details.

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

Grab the elements from an existing Bricks page. You'll need the page ID -- find it in the WordPress admin URL when editing a page (e.g., `post.php?post=1460` means the ID is `1460`).

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

## Generate a section with AI

Set up an LLM provider if you haven't already:

```bash
bricks config set llm.provider openai
bricks config set llm.api_key sk-proj-abc123...
bricks config set llm.model gpt-4o
```

Now generate a hero section and push it to the page:

```bash
bricks generate section "dark hero section with a bold headline and two CTA buttons" --page 1460
```

```
Generating section...
Provider: openai (gpt-4o)
Tokens used: 1,847

Pushed to page 1460:
  + section (dark hero)
    + container
      + heading: "Build faster with Agent to Bricks"
      + text: "Ship Bricks Builder pages from the command line..."
      + div (button group)
        + button: "Get started"
        + button: "View docs"

Elements: 6 added
Snapshot: snap_e5f6g7h8 (auto)
```

The `--page` flag tells the CLI to push the generated content directly. Without it, the CLI just outputs the element JSON.

## Preview with dry run

Not ready to push? Use `--dry-run` to see what would happen:

```bash
bricks generate section "testimonial grid with 3 cards" --page 1460 --dry-run
```

```
Generating section...
Provider: openai (gpt-4o)
Tokens used: 2,103

DRY RUN - would push to page 1460:
  + section (testimonials)
    + container
      + heading: "What our customers say"
      + div (grid)
        + div (card 1)
        + div (card 2)
        + div (card 3)

Elements: 11 total
No changes made.
```

Nothing is written. Remove the `--dry-run` flag when you're happy with the output.

## Convert HTML directly

If you'd rather write the HTML yourself (or have an AI write it), convert and push in one step:

```bash
echo '<section class="section--l bg--primary-dark">
  <div class="container" style="max-width: var(--content-width)">
    <h1 class="text--white fw--700">Ship pages from the terminal</h1>
    <p class="text--white">No visual editor. No clicking around. Just commands.</p>
  </div>
</section>' | bricks convert html --stdin --push 1460 --snapshot
```

```
Converting HTML...
Resolved 4 global classes: section--l, bg--primary-dark, text--white, fw--700
Snapshot created: snap_i9j0k1l2

Pushed to page 1460:
  + section
    + container
      + heading: "Ship pages from the terminal"
      + text: "No visual editor. No clicking around. Just commands."

Elements: 4 added
```

The `--snapshot` flag saves the page state before pushing, so you can roll back. Get in the habit of always including it.

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
bricks site info                                    # confirm connection
bricks site pull 1460                               # see what's on the page
bricks site snapshot 1460                           # save current state
bricks generate section "..." --page 1460           # generate and push
bricks doctor 1460                                  # check for issues
bricks site rollback 1460                           # undo if needed
```

## Next steps

- [Configuration](/getting-started/configuration/) -- set up LLM providers, multiple sites, and environment variables
- [CLI reference](/cli/commands/) -- full command documentation
- [Guides](/guides/ai-generation/) -- deeper walkthroughs for generation, templates, and search
