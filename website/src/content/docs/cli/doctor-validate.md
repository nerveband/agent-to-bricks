---
title: Doctor and validate
description: Check pages for structural problems and validate element JSON before pushing it to your site.
---

Two commands for catching problems before they reach production. `bricks doctor` checks a live page for structural issues. `bricks validate` checks a local JSON file against the Bricks element schema.

## Doctor

Run a health check on a page's Bricks elements.

```bash
bricks doctor <page-id>
```

### Example

```bash
bricks doctor 1460
```

```
Checking page 1460 (Homepage)...

✓ Element tree structure valid
✓ All parent references resolve
✓ No duplicate element IDs
✗ 2 orphaned elements (no parent, not top-level)
    - element txt_9f2a (text-basic) references parent xyz_missing
    - element btn_3c1d (button) references parent xyz_missing
✓ Global class references valid
✓ No empty sections
✗ 1 heading hierarchy issue
    - H3 (element hd_4e5f) appears before any H2 on the page

Summary: 2 issues found
```

### What it checks

The doctor command looks for:

- **Orphaned elements.** Elements whose parent ID points to an element that doesn't exist. This usually happens when a parent gets deleted but its children stay behind.
- **Duplicate IDs.** Two elements sharing the same ID, which causes unpredictable behavior in Bricks.
- **Broken parent/child references.** A parent listing a child that doesn't exist, or a child claiming a parent that doesn't list it.
- **Invalid global class references.** Elements referencing global class IDs that no longer exist on the site.
- **Empty sections.** Sections with no children, which render as blank space.
- **Heading hierarchy.** Headings that skip levels (e.g., H1 followed directly by H4) or appear in unexpected order.
- **Missing required settings.** Elements that are missing settings they need to render properly (e.g., an image with no source).

### When to run it

Run `bricks doctor` after any push operation. It's fast (a single API call) and catches the kinds of issues that are hard to spot in the visual editor.

A good habit:

```bash
bricks convert html new-section.html --push 1460 --snapshot
bricks doctor 1460
```

If the doctor finds problems, roll back:

```bash
bricks site rollback 1460
```

## Validate

Check a local JSON file against the Bricks element schema without touching your site.

```bash
bricks validate <file.json>
```

### Example: clean file

```bash
bricks validate homepage.json
```

```
Validating homepage.json...

✓ Valid JSON syntax
✓ 24 elements parsed
✓ All elements have required fields (id, name, settings)
✓ Element tree is consistent
✓ No duplicate IDs

homepage.json is valid
```

### Example: file with problems

```bash
bricks validate broken-page.json
```

```
Validating broken-page.json...

✓ Valid JSON syntax
✓ 18 elements parsed
✗ Element "abc123" missing required field: name
✗ Element "def456" has unknown type: headng (did you mean: heading?)
✗ Duplicate element ID: ghi789 (appears 2 times)
✗ Element "jkl012" references parent "missing_parent" which is not in the file

4 issues found in broken-page.json
```

### What it checks

Validation runs locally; it doesn't contact your site. It verifies:

- **Valid JSON.** The file parses without errors.
- **Required fields.** Every element has `id`, `name`, and `settings`.
- **Known element types.** The `name` field matches a valid Bricks element type. Typos get flagged with suggestions.
- **Unique IDs.** No two elements share an ID.
- **Tree consistency.** Parent/child references line up. Every `parent` value points to an element that exists in the file (or is `0` for top-level elements).
- **Settings structure.** Settings objects have the expected shape for their element type.

### When to use it

Before pushing hand-edited JSON:

```bash
# Edit the JSON manually
vim homepage.json

# Validate before pushing
bricks validate homepage.json

# If clean, push it
bricks site push 1460 homepage.json
```

After converting HTML you want to inspect before pushing:

```bash
bricks convert html landing-page.html -o draft.json
bricks validate draft.json
```

In CI/CD pipelines that build Bricks pages from templates or scripts:

```bash
bricks compose hero-cali feature-havana -o output.json
bricks validate output.json && bricks site push 1460 output.json
```

## Doctor vs. validate

| | `bricks doctor` | `bricks validate` |
|---|---|---|
| Input | A live page on your site | A local JSON file |
| Requires site connection | Yes | No |
| Checks global class references | Yes (against live class data) | No |
| Checks element schema | Yes | Yes |
| Checks tree structure | Yes | Yes |
| Catches typos in element types | Yes | Yes |

Use `validate` for local files before pushing. Use `doctor` for pages already on your site.

## Related commands

- [`bricks site push`](/cli/site-commands/): push validated JSON to a page
- [`bricks site rollback`](/cli/site-commands/): undo a push that introduced problems
- [`bricks site snapshot`](/cli/site-commands/): save a restore point before risky changes
