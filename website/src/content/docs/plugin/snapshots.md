---
title: Snapshots
description: How the snapshot system protects your pages, and how to create, list, and roll back snapshots
---

Snapshots are saved copies of a page's element data. Before the plugin modifies a page (or before you push new content), it saves the current state so you can get it back if something goes wrong.

Think of them as lightweight undo points. They're stored in post meta alongside the page, not as separate files or database tables.

## How they're stored

Each page can hold up to **10 snapshots** in the `_agent_bricks_snapshots` post meta key. When you create an 11th, the oldest one is dropped (FIFO).

A snapshot looks like this internally:

```json
{
  "snapshotId": "snap_a1b2c3d4e5f6",
  "contentHash": "e3b0c44298fc1c14...",
  "elementCount": 12,
  "elements": [...],
  "timestamp": "2026-02-25 14:30:00",
  "label": "Before hero redesign"
}
```

The `elements` array is a full copy of the page content at that moment. It's the same format you'd get from `GET /pages/{id}/elements`.

## When snapshots are created

**Automatic snapshots** happen when:
- You do a full page replace via `PUT /pages/{id}/elements`. The plugin saves the current state before overwriting it.
- You roll back to a previous snapshot. A "Pre-rollback auto-snapshot" is created first, so you can undo the rollback.

**Manual snapshots** happen when:
- You create one through the API or CLI before making changes.
- The CLI's `--snapshot` flag triggers one before a push.

## Creating a snapshot

### From the CLI

The easiest approach is to use the `--snapshot` flag when pushing content:

```bash
bricks convert html page.html --push 42 --snapshot
```

Or create one explicitly:

```bash
bricks snapshots create 42 --label "Before redesign"
```

### Via the API

```bash
curl -X POST https://your-site.com/wp-json/agent-bricks/v1/pages/42/snapshots \
  -H "X-ATB-Key: atb_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"label": "Before redesign"}'
```

Response:

```json
{
  "snapshotId": "snap_a1b2c3d4e5f6",
  "contentHash": "e3b0c44298fc1c14...",
  "elementCount": 12,
  "timestamp": "2026-02-25 14:30:00"
}
```

The `label` is optional. Give them names that tell you why you created them, not when. "Before hero redesign" is better than "Snapshot at 2:30pm."

## Listing snapshots

### From the CLI

```bash
bricks snapshots list 42
```

### Via the API

```bash
curl -s https://your-site.com/wp-json/agent-bricks/v1/pages/42/snapshots \
  -H "X-ATB-Key: atb_abc123..."
```

The listing doesn't include element data (too large). You get the snapshot ID, content hash, element count, timestamp, and label:

```json
{
  "snapshots": [
    {
      "snapshotId": "snap_a1b2c3d4e5f6",
      "contentHash": "e3b0c44298fc1c14...",
      "elementCount": 12,
      "timestamp": "2026-02-25 14:30:00",
      "label": "Before hero redesign"
    },
    {
      "snapshotId": "snap_x7y8z9w0v1u2",
      "contentHash": "b4c5d6e7f8a9...",
      "elementCount": 8,
      "timestamp": "2026-02-25 13:15:00",
      "label": "Auto: before full replace"
    }
  ]
}
```

Snapshots are listed in chronological order. The most recent one is last.

## Rolling back

### From the CLI

```bash
bricks snapshots rollback 42 snap_a1b2c3d4e5f6
```

### Via the API

```bash
curl -X POST \
  https://your-site.com/wp-json/agent-bricks/v1/pages/42/snapshots/snap_a1b2c3d4e5f6/rollback \
  -H "X-ATB-Key: atb_abc123..."
```

Response:

```json
{
  "contentHash": "f6e5d4c3b2a1...",
  "count": 12,
  "restoredFrom": "snap_a1b2c3d4e5f6"
}
```

What happens during rollback:

1. The plugin saves the current page state as a new snapshot (labeled "Pre-rollback auto-snapshot")
2. It overwrites the page's element data with the snapshot's elements
3. It regenerates the page's CSS
4. It clears the Bricks cache for that page

The page is immediately live with the restored content. Open it in the Bricks editor and you'll see the old elements.

## Practical workflow

A typical safe workflow looks like this:

```bash
# 1. Take a snapshot before you start
bricks snapshots create 42 --label "Before landing page rework"

# 2. Generate new content
bricks generate page --page 42 --prompt "Modern SaaS landing page with hero, features, pricing, and CTA"

# 3. Check the result in the browser
# If it looks wrong...

# 4. Roll back
bricks snapshots list 42
bricks snapshots rollback 42 snap_a1b2c3d4e5f6

# 5. Try again with a different prompt
```

Or just use the `--snapshot` flag and skip step 1:

```bash
bricks generate page --page 42 --prompt "..." --snapshot
```

## Limits

- **10 snapshots per page.** Oldest gets dropped when you create the 11th. If you need more history, pull the page content and save it as a file.
- **Stored in post meta.** Large pages with many elements will use more database storage. A page with 100 elements might produce a snapshot around 50-100KB of serialized data. 10 of those is 0.5-1MB in post meta -- not a problem for most sites.
- **No diff view.** Snapshots store the full element array, not a diff. There's no built-in way to see what changed between two snapshots. Pull both and compare them with a diff tool if you need that.
- **Rollback bypasses the content hash check.** Since the whole point is to restore previous state, the optimistic locking system is skipped during rollback. The plugin writes directly to post meta.
