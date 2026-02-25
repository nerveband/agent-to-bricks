---
title: Site commands
description: Read page data, push changes, take snapshots, and roll back with the bricks site commands.
---

The `bricks site` commands handle everything between your terminal and your WordPress site. Pull page content as JSON, push changes back, take snapshots before risky edits, and roll back when things go sideways.

## Get site info

Check your connection and see what's running on the other end.

```bash
bricks site info
```

```
Site:       https://example.com
Bricks:     1.11.1
WordPress:  6.5.2
PHP:        8.2.18
ACSS:       3.0.2
Frames:     2.2.0
Breakpoints: base (1280), tablet (1024), mobile_landscape (768), mobile_portrait (480)
```

This is a good first command to run after `bricks config init`. If something is misconfigured, you'll know right away.

## Pull page elements

Download all Bricks elements from a page as JSON.

```bash
bricks site pull <page-id>
```

### Flags

| Flag | Description |
|------|-------------|
| `-o <file>` | Write output to a file instead of stdout |

### Examples

Print elements to the terminal:

```bash
bricks site pull 1460
```

Save to a file for editing:

```bash
bricks site pull 1460 -o homepage.json
```

The output includes a `contentHash` field at the top level. You'll need this hash for push operations -- it prevents you from accidentally overwriting someone else's changes.

## Push page elements

Replace all elements on a page with the contents of a JSON file. This is a full replacement, not a merge.

```bash
bricks site push <page-id> <file.json>
```

The JSON file must include the `contentHash` from a recent pull. If the page has changed since you pulled it, the push will fail with a conflict error. Pull again, re-apply your changes, and try the push again.

### Example

```bash
bricks site pull 1460 -o homepage.json
# ... edit homepage.json ...
bricks site push 1460 homepage.json
```

```
Pushed 24 elements to page 1460
```

## Patch specific elements

Update individual elements without replacing the entire page. Useful when you want to change a headline or swap out an image without touching anything else.

```bash
bricks site patch <page-id> -f <patch.json>
```

### Flags

| Flag | Description |
|------|-------------|
| `-f <file>` | Path to the patch JSON file |

### Example

Change just the hero headline:

```json
[
  {
    "id": "abc123",
    "settings": {
      "text": "New headline text"
    }
  }
]
```

```bash
bricks site patch 1460 -f headline-fix.json
```

```
Patched 1 element on page 1460
```

## Take a snapshot

Save the current state of a page so you can roll back later. Think of it as a manual save point.

```bash
bricks site snapshot <page-id>
```

### Flags

| Flag | Description |
|------|-------------|
| `-l <label>` | Human-readable label for the snapshot |

### Examples

Quick snapshot with no label:

```bash
bricks site snapshot 1460
```

```
Snapshot created: snap_20260225_143052
```

Labeled snapshot before a big change:

```bash
bricks site snapshot 1460 -l "before hero redesign"
```

```
Snapshot created: snap_20260225_143210 (before hero redesign)
```

## List snapshots

See all saved snapshots for a page.

```bash
bricks site snapshots <page-id>
```

### Example

```bash
bricks site snapshots 1460
```

```
ID                       Label                  Created              Elements
snap_20260225_143210     before hero redesign   2026-02-25 14:32:10  24
snap_20260225_110530     initial import         2026-02-25 11:05:30  18
snap_20260224_165423                            2026-02-24 16:54:23  12
```

## Roll back

Restore a page to a previous snapshot.

```bash
bricks site rollback <page-id> [snapshot-id]
```

If you don't provide a snapshot ID, it rolls back to the most recent snapshot.

### Examples

Roll back to the latest snapshot:

```bash
bricks site rollback 1460
```

```
Rolled back page 1460 to snap_20260225_143210 (before hero redesign)
```

Roll back to a specific snapshot:

```bash
bricks site rollback 1460 snap_20260225_110530
```

```
Rolled back page 1460 to snap_20260225_110530 (initial import)
```

## Detect frameworks

See which CSS frameworks and design token systems your site is running.

```bash
bricks site frameworks
```

```
Detected frameworks:
  Automatic.css (ACSS) 3.0.2
    Tokens: 142 custom properties, 38 color variables, 24 spacing scales
  Frames 2.2.0
    Components: 86 registered global classes
```

For more detail on a specific framework:

```bash
bricks frameworks list
bricks frameworks show acss
```

`bricks frameworks show acss` prints the full ACSS configuration -- spacing scales, color palettes, typography tokens, and every registered utility class.

## Related commands

- [`bricks convert html`](/cli/convert-commands/) -- convert HTML files and push them to pages
- [`bricks classes list`](/cli/class-commands/) -- browse global CSS classes
- [`bricks doctor`](/cli/doctor-validate/) -- check a page for structural problems
- [`bricks config init`](/cli/config-update/) -- set up your site connection
