# Agent to Bricks Website

Marketing homepage + documentation site built with Astro and Starlight.

## Quick start

```bash
cd website
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview   # preview the production build
```

Requires Node.js 18+.

## Architecture

The site has two parts:

1. **Custom homepage** (`src/pages/index.astro`) -- a marketing page with interactive React components
2. **Starlight docs** (`src/content/docs/`) -- 37 markdown pages organized into 6 sections

### Tech stack

- **Astro 5** with Starlight for docs
- **React 18** islands for interactive components (`client:visible`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin
- **Framer Motion** for animations
- **TypeScript** throughout

### Project structure

```
website/
├── astro.config.mjs          # Starlight config, sidebar, integrations
├── src/
│   ├── pages/
│   │   └── index.astro       # Homepage (imports all sections)
│   ├── layouts/
│   │   └── HomepageLayout.astro  # HTML shell, meta tags, gradient bg
│   ├── components/home/
│   │   ├── Header.astro      # Sticky nav with glass blur
│   │   ├── Footer.astro      # GitHub badge, credits, disclaimer
│   │   ├── HeroSection.astro # Headline + ViewToggle island
│   │   ├── ViewToggle.tsx    # GUI/CLI toggle with Framer Motion
│   │   ├── GuiMockup.tsx     # Animated GUI simulation
│   │   ├── CliMockup.tsx     # Animated CLI simulation
│   │   ├── ProblemSection.astro
│   │   ├── HowItWorksSection.astro
│   │   ├── ArchitectureDiagram.tsx  # 5-node diagram with step walkthrough
│   │   ├── FeatureShowcase.astro
│   │   ├── FeatureDemo.tsx   # 4 features with mini terminals
│   │   ├── DemoSection.astro
│   │   ├── InteractiveDemo.tsx  # Full GUI/CLI demo with 3 tasks
│   │   ├── QuickWinsGrid.astro
│   │   ├── FounderNote.astro
│   │   └── GetStartedSection.astro
│   ├── content/docs/         # Starlight markdown docs (37 pages)
│   │   ├── getting-started/  # 4 pages
│   │   ├── cli/              # 11 pages
│   │   ├── gui/              # 6 pages
│   │   ├── plugin/           # 6 pages
│   │   ├── guides/           # 6 pages
│   │   └── about/            # 4 pages
│   ├── assets/
│   │   ├── icons/            # Generated feature + quick-win icons (PNG)
│   │   └── logo.svg          # Starlight sidebar logo
│   └── styles/
│       ├── custom.css        # Starlight theme overrides (fonts, colors)
│       └── global.css        # Tailwind import
├── public/
│   ├── favicon.svg
│   └── images/
│       ├── logo-icon.png     # Generated logo
│       └── og-card.png       # Social sharing image
└── dist/                     # Build output (gitignored)
```

## Editing content

### Homepage sections

Each homepage section is a standalone component in `src/components/home/`. The page composition is in `src/pages/index.astro`:

```astro
<HomepageLayout>
  <HeroSection />
  <ProblemSection />
  <HowItWorksSection />
  <FeatureShowcase />
  <DemoSection />
  <QuickWinsGrid />
  <FounderNote />
  <GetStartedSection />
</HomepageLayout>
```

To edit a section, modify the corresponding `.astro` or `.tsx` file. Static content lives in the `.astro` files. Interactive components (toggles, demos, diagrams) are React `.tsx` files loaded with `client:visible`.

To add a new section: create the component, import it in `index.astro`, and place it in the desired order.

To remove a section: delete the import and component tag from `index.astro`.

### Documentation pages

Docs are Markdown files in `src/content/docs/`. Each file has Starlight frontmatter:

```markdown
---
title: Page Title
description: Short description for meta tags and search
---

Content here. Standard markdown with code blocks, tables, links.
```

The sidebar order is defined in `astro.config.mjs` under `sidebar`. To add a new page:

1. Create the markdown file in the appropriate directory
2. Add the slug to the `sidebar` array in `astro.config.mjs`
3. Run `npm run dev` and verify it appears in the sidebar

To add a new doc section:

1. Create a new directory under `src/content/docs/`
2. Add a new sidebar group in `astro.config.mjs`
3. Create markdown files in the new directory

## Design system

### Colors

| Token | Dark mode | Light mode | Usage |
|-------|-----------|------------|-------|
| Gold accent | `#FACC15` | `#EBA40A` | CTAs, highlights, active states |
| Background | `#0a0a0c` | `#fafaf9` | Page background |
| Gradient start | `#0f0c29` | -- | Animated background |
| Gradient mid | `#302b63` | -- | Animated background |
| Gradient end | `#24243e` | -- | Animated background |

### Typography

- **Headings + body:** Manrope (Google Fonts, variable weight 300-800)
- **Code + terminals:** Geist Mono (Google Fonts)

Both are loaded in `HomepageLayout.astro` and `custom.css`.

### Dark/light mode

Default is dark. Toggle via the sun/moon button in the header. State persists in `localStorage`. The `data-theme` attribute on `<html>` controls the mode. Starlight docs handle their own theme separately via Starlight's built-in toggle.

## Graphics

All icons and images were generated with Nano Banana Pro (Gemini image generation).

- **Feature icons** (4): `src/assets/icons/feature-*.png` -- used in FeatureDemo.tsx
- **Quick-win icons** (6): `src/assets/icons/win-*.png` -- used in QuickWinsGrid.astro
- **Logo icon**: `public/images/logo-icon.png`
- **OG card**: `public/images/og-card.png` -- 16:9 social sharing image

### Regenerating an icon

```bash
uv run ~/.claude/skills/nano-banana-pro/scripts/generate_image.py \
  -p "Minimalist icon: [description]. Gold (#FACC15) lines on dark background (#0a0a0c). Clean geometric line art, no text." \
  -f src/assets/icons/icon-name.png \
  --aspect 1:1 --thinking medium
```

Astro automatically optimizes PNGs to WebP during build.

## Building and deploying

### Local build

```bash
npm run build
```

Produces static HTML in `dist/`. The build compiles Astro pages, bundles React islands, optimizes images to WebP, generates a Pagefind search index, and creates a sitemap.

### GitHub Pages deployment

A workflow at `.github/workflows/deploy-website.yml` deploys on push to `main` when `website/` files change. It can also be triggered manually from the Actions tab.

### Custom domain

The site URL is set in `astro.config.mjs`:

```javascript
site: 'https://agent-to-bricks.dev',
```

To change the domain:

1. Update `site` in `astro.config.mjs`
2. Update the `og:url` meta tag in `src/layouts/HomepageLayout.astro`
3. Configure DNS and GitHub Pages custom domain in repo settings

## Accessibility

- Skip-to-content link on homepage
- ARIA roles on tab toggles (`role="tablist"`, `role="tab"`, `aria-selected`)
- `aria-expanded` on mobile menu button
- `aria-live="polite"` on demo output regions
- `prefers-reduced-motion` media query disables all animations
- Starlight provides built-in accessibility for docs (sidebar nav, search, keyboard navigation)

## Content guidelines

When editing homepage or doc content:

- Write in active voice, vary sentence length
- Be specific: name the tools, show the commands, include real output
- Avoid AI-isms: "crucial", "delve", "serves as", "seamless", "landscape", "testament"
- The founder's note and philosophy page are first-person from Ashraf Ali
- Product sections use clean third-person voice
- Keep descriptions short and direct -- one idea per sentence
