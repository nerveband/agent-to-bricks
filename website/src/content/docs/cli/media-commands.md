---
title: Media commands
description: Upload files to the WordPress media library and search existing media from the command line.
---

The `bricks media` commands manage your WordPress media library. Upload images and files without opening the browser, and search through what's already there.

## Upload a file

```bash
bricks media upload <file>
```

Uploads a file to the WordPress media library and returns the attachment details.

### Example

```bash
bricks media upload hero-bg.jpg
```

```
Uploaded: hero-bg.jpg
  ID:        4521
  URL:       https://example.com/wp-content/uploads/2026/02/hero-bg.jpg
  Type:      image/jpeg
  Size:      284 KB
  Dimensions: 1920x1080
```

You can upload any file type that WordPress allows: images, PDFs, videos, SVGs (if your site has SVG support enabled).

### Upload multiple files

Run the command once per file:

```bash
bricks media upload photos/team-alice.jpg
bricks media upload photos/team-bob.jpg
bricks media upload photos/team-carol.jpg
```

Or use a shell loop for a whole folder:

```bash
for f in photos/*.jpg; do bricks media upload "$f"; done
```

```
Uploaded: team-alice.jpg (ID: 4522)
Uploaded: team-bob.jpg (ID: 4523)
Uploaded: team-carol.jpg (ID: 4524)
```

## List media

Browse what's in the media library.

```bash
bricks media list
```

```
ID    Filename              Type         Size    Date
4521  hero-bg.jpg           image/jpeg   284 KB  2026-02-25
4520  logo-dark.svg         image/svg    12 KB   2026-02-24
4518  product-screenshot.png image/png   156 KB  2026-02-23
4515  team-photo.jpg        image/jpeg   320 KB  2026-02-20
4510  whitepaper.pdf        application  1.2 MB  2026-02-18
```

### Search media

Filter the list with a search query.

```bash
bricks media list --search "logo"
```

```
ID    Filename          Type        Size   Date
4520  logo-dark.svg     image/svg   12 KB  2026-02-24
4492  logo-light.svg    image/svg   11 KB  2026-02-10
4401  logo-icon.png     image/png   8 KB   2026-01-15
```

The search matches against filenames and titles in the media library.

### Flags

| Flag | Description |
|------|-------------|
| `--search "<query>"` | Filter media by filename or title |

## Practical uses

**Upload a batch of images for a gallery page:**
```bash
for f in gallery/*.jpg; do bricks media upload "$f"; done
```

**Find the URL of an uploaded logo:**
```bash
bricks media list --search "logo"
```

**Upload an image and reference it in HTML for conversion:**
```bash
bricks media upload new-hero.jpg
# Note the URL from the output, then use it in your HTML:
# <img src="https://example.com/wp-content/uploads/2026/02/new-hero.jpg" alt="Hero">
```

## Related commands

- [`bricks convert html`](/cli/convert-commands/): reference uploaded media URLs in your HTML
- [`bricks search elements --type image`](/cli/search-commands/): find image elements across your site
