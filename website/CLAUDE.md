# Website — Agent to Bricks Documentation

Astro 5 + Starlight documentation site at agenttobricks.com.

## Build & Test

```bash
cd website && npm install         # install dependencies
cd website && npm run dev         # development server
cd website && npm run build       # production build (validates all pages)
```

## Key Paths

- Config: `astro.config.mjs`
- Homepage: `src/pages/index.astro`
- Documentation: `src/content/docs/` (37 Markdown pages)
- Styles: `src/styles/custom.css`
- Components: `src/components/home/`

## Documentation Structure

- `getting-started/` — installation, quick-start, configuration
- `cli/` — CLI command reference (11 pages)
- `gui/` — Desktop app guide (6 pages)
- `plugin/` — Plugin reference (6 pages)
- `guides/` — How-to guides (6 pages)
- `about/` — Philosophy, roadmap, contributing (4 pages)

## Pre-Completion Checklist (MANDATORY)

Before completing ANY change in this component:

- [ ] `cd website && npm run build` passes
- [ ] If CLI docs changed → verify accuracy against current CLI code (`cli/cmd/`)
- [ ] If plugin docs changed → verify accuracy against current plugin code (`plugin/`)
- [ ] If GUI docs changed → verify accuracy against current GUI code (`gui/src/`)
- [ ] If installation page changed → verify download links match GitHub Release assets
- [ ] Domain is `agenttobricks.com` everywhere (not agent-to-bricks.dev)

## Impact Map

- `src/content/docs/` → Must accurately reflect current code behavior
- `astro.config.mjs` → Site URL must be https://agenttobricks.com
- Homepage GetStartedSection → Install instructions must match current process
