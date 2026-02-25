# Agent to Bricks Website — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a marketing homepage + Starlight docs site for Agent to Bricks with interactive demos, architecture diagram, and comprehensive documentation.

**Architecture:** Astro + Starlight in `website/`. Custom homepage as an Astro page with React islands for interactivity (GUI mockup, CLI demo, architecture diagram). Starlight handles docs with markdown. Tailwind CSS v4 for styling. Dark mode default with light toggle. Generated graphics via Nano Banana Pro.

**Tech Stack:** Astro 5, Starlight, React 18 (islands), Tailwind CSS v4, TypeScript, Framer Motion (animations), Nano Banana Pro (image generation)

**Design Doc:** `docs/plans/2026-02-25-website-content-design.md`

---

## Phase 1: Project Scaffolding

### Task 1: Create Astro + Starlight project

**Files:**
- Create: `website/package.json`
- Create: `website/astro.config.mjs`
- Create: `website/tsconfig.json`
- Create: `website/src/content/docs/index.md` (placeholder)

**Step 1: Scaffold the project**

```bash
cd website
npm create astro@latest . -- --template starlight/tailwind --install --no-git
```

Accept defaults. This creates Starlight with Tailwind CSS v4 support.

**Step 2: Install additional dependencies**

```bash
cd website
npm install @astrojs/react react react-dom framer-motion
npm install -D @types/react @types/react-dom
```

**Step 3: Configure Astro with React + Starlight + Tailwind**

Update `website/astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://agent-to-bricks.dev',
  integrations: [
    starlight({
      title: 'Agent to Bricks',
      description: 'Update your Bricks website with natural language.',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/nerveband/agent-to-bricks' },
      ],
      customCss: [
        '@astrojs/starlight-tailwind',
        './src/styles/custom.css',
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            'getting-started/introduction',
            'getting-started/installation',
            'getting-started/quick-start',
            'getting-started/configuration',
          ],
        },
        {
          label: 'CLI Reference',
          collapsed: true,
          items: [
            'cli/site-commands',
            'cli/generate-commands',
            'cli/convert-commands',
            'cli/search-commands',
            'cli/template-commands',
            'cli/class-commands',
            'cli/style-commands',
            'cli/media-commands',
            'cli/agent-commands',
            'cli/doctor-validate',
            'cli/config-update',
          ],
        },
        {
          label: 'GUI Guide',
          collapsed: true,
          items: [
            'gui/overview',
            'gui/layout-navigation',
            'gui/prompt-composer',
            'gui/managing-tools',
            'gui/sessions-history',
            'gui/keyboard-shortcuts',
          ],
        },
        {
          label: 'Plugin Reference',
          collapsed: true,
          items: [
            'plugin/rest-api',
            'plugin/authentication',
            'plugin/element-data-model',
            'plugin/global-classes',
            'plugin/snapshots',
            'plugin/settings',
          ],
        },
        {
          label: 'Guides',
          collapsed: true,
          items: [
            'guides/bring-your-own-agent',
            'guides/working-with-templates',
            'guides/html-to-bricks',
            'guides/style-profiles',
            'guides/acss-integration',
            'guides/team-onboarding',
          ],
        },
        {
          label: 'About',
          items: [
            'about/philosophy',
            'about/roadmap',
            'about/contributing',
            'about/credits',
          ],
        },
      ],
    }),
    tailwind({ applyBaseStyles: false }),
    react(),
  ],
});
```

**Step 4: Create base custom CSS**

Create `website/src/styles/custom.css`:

```css
/* Agent to Bricks — Custom Starlight Theme */

@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300..800&family=Geist+Mono:wght@400;500;700&display=swap');

:root {
  --sl-font: 'Manrope', sans-serif;
  --sl-font-mono: 'Geist Mono', monospace;

  /* Bricks gold accent */
  --sl-color-accent-low: #2a2006;
  --sl-color-accent: #FACC15;
  --sl-color-accent-high: #fef3c7;

  /* Dark backgrounds */
  --sl-color-bg: #0a0a0c;
  --sl-color-bg-nav: #14141680;
  --sl-color-bg-sidebar: #0f0c29;
}

:root[data-theme='light'] {
  --sl-color-accent-low: #fef9e7;
  --sl-color-accent: #EBA40A;
  --sl-color-accent-high: #92400e;
}
```

**Step 5: Create placeholder logo SVG**

Create `website/src/assets/logo.svg` — a simple placeholder (will be replaced with generated graphic later).

**Step 6: Verify the project runs**

```bash
cd website && npm run dev
```

Expected: Starlight dev server starts on localhost:4321 with sidebar and placeholder docs.

**Step 7: Commit**

```bash
git add website/
git commit -m "feat(website): scaffold Astro + Starlight project with Tailwind and React"
```

---

## Phase 2: Homepage — Layout & Hero

### Task 2: Create custom homepage layout

**Files:**
- Create: `website/src/pages/index.astro`
- Create: `website/src/layouts/HomepageLayout.astro`
- Create: `website/src/components/home/Header.astro`
- Create: `website/src/components/home/Footer.astro`
- Modify: `website/src/content/docs/index.md` — redirect or remove (Starlight's default)

**Step 1: Create the homepage layout**

`website/src/layouts/HomepageLayout.astro` — full custom layout with:
- Dark gradient animated background (from design concept: #0f0c29 → #302b63 → #24243e)
- Glass morphism surface layer
- Manrope font, Bricks gold accent colors
- Dark/light mode toggle
- Head meta tags (OG, Twitter cards, description)

**Step 2: Create the header component**

`website/src/components/home/Header.astro`:
- Logo + "Agent to Bricks" wordmark
- Nav links: Features, How It Works, Docs, GitHub
- Dark/light toggle button
- Sticky with glass blur on scroll

**Step 3: Create the footer component**

`website/src/components/home/Footer.astro`:
- GitHub star badge (shields.io)
- "Docs" link
- "Made by Ashraf Ali" with link to personal site
- "Not affiliated with Bricks Builder" disclaimer
- Minimal, clean

**Step 4: Create the homepage entry**

`website/src/pages/index.astro`:
- Uses HomepageLayout
- Imports all section components (created in subsequent tasks)
- For now, just hero placeholder text

**Step 5: Update Starlight default index**

Change `website/src/content/docs/index.md` to redirect to the custom homepage or rename it to avoid conflict with the custom `src/pages/index.astro`. Starlight pages in `src/content/docs/` don't conflict with `src/pages/` routes, but remove the `index.md` or rename to `docs-home.md` to avoid confusion.

**Step 6: Verify**

```bash
cd website && npm run dev
```

Visit localhost:4321 — should show the custom homepage layout.
Visit localhost:4321/getting-started/introduction — should show Starlight docs.

**Step 7: Commit**

```bash
git add website/src/
git commit -m "feat(website): add custom homepage layout with header and footer"
```

---

### Task 3: Build hero section with animated GUI mockup

**Files:**
- Create: `website/src/components/home/HeroSection.astro`
- Create: `website/src/components/home/GuiMockup.tsx` (React island)
- Create: `website/src/components/home/CliMockup.tsx` (React island)
- Create: `website/src/components/home/ViewToggle.tsx` (React island)

**Step 1: Create HeroSection Astro wrapper**

Contains:
- Headline: "Update your Bricks website with natural language."
- Subline: "Bring your own AI agent, your own workflows, from your machine to the cloud. Free and open source."
- CTA buttons: "Get Started" (→ /getting-started/installation) + "Star on GitHub" (GitHub link with star icon)
- The interactive demo area (React island)

**Step 2: Build GuiMockup React component**

A theatrical, scripted animation of the real GUI:
- Sidebar with tool list (Claude Code highlighted with gold pulse)
- Terminal area showing streaming output
- Prompt pane at bottom with typing animation
- Use Framer Motion for:
  - Typing effect in prompt: "Generate a dark hero section with a CTA button and gradient background"
  - Simulated terminal output scrolling in
  - Status dot pulsing
- Based on real AppShell layout from `gui/src/components/AppShell.tsx`
- Purely visual — no real functionality

**Step 3: Build CliMockup React component**

A theatrical terminal animation:
- Dark terminal window with title bar dots
- Typed command: `bricks generate section "dark hero with gradient and CTA" --push 1460`
- Streaming output showing JSON elements being generated
- Success message with snapshot ID
- Cursor blink between commands

**Step 4: Build ViewToggle React component**

- Toggle switch: "GUI" | "CLI"
- Smooth crossfade between GuiMockup and CliMockup
- Default: GUI view
- Uses Framer Motion AnimatePresence for transitions

**Step 5: Wire into homepage**

Import HeroSection into `website/src/pages/index.astro`. Use `client:visible` directive for React islands.

**Step 6: Verify**

Dev server — hero section visible with animated mockups and toggle.

**Step 7: Commit**

```bash
git add website/src/components/home/
git commit -m "feat(website): add hero section with animated GUI/CLI mockup toggle"
```

---

## Phase 3: Homepage — Content Sections

### Task 4: Build "The Problem" section

**Files:**
- Create: `website/src/components/home/ProblemSection.astro`

**Content (run through humanizer skill before finalizing):**

The section addresses:
- AI tools for WordPress are multiplying, and so are their price tags
- Every platform wants a monthly subscription on top of what you already pay
- LTD deals pile up. Plugin fatigue is real.
- Bricks Builder is powerful enough to deserve better than bolt-on AI tools
- "Building sites with AI shouldn't cost a subscription on top of a subscription."

Design: Dark card with subtle gold border accent. Short, punchy paragraphs. No icons needed — let the words carry it.

**Step 1: Write the component with content**
**Step 2: Run content through humanizer skill**
**Step 3: Wire into homepage**
**Step 4: Verify and commit**

```bash
git commit -m "feat(website): add problem statement section"
```

---

### Task 5: Build interactive architecture diagram

**Files:**
- Create: `website/src/components/home/ArchitectureDiagram.tsx` (React island)
- Create: `website/src/components/home/HowItWorksSection.astro`

**Step 1: Design the SVG diagram**

Nodes (left to right / centered):
1. **WordPress + Bricks** (site icon) — "Your Bricks site"
2. **Plugin** (puzzle piece icon) — "REST API bridge"
3. **CLI** (terminal icon) — "Command-line power"
4. **GUI** (window icon) — "Desktop companion"
5. **Your AI Agent** (brain/sparkle icon) — "Claude Code, Codex, or any tool"

Connections: Animated dashed lines with directional flow indicators.

**Step 2: Build step-through interaction**

4 steps the user clicks through:
1. "Install the Plugin" — Plugin node glows, WordPress connection highlights. Caption: "A WordPress plugin connects your Bricks site to the outside world via a secure REST API."
2. "Connect the CLI" — CLI node glows, Plugin↔CLI line animates. Caption: "The CLI talks to your plugin. Pull pages, push changes, search elements — all from your terminal."
3. "Open the GUI (or don't)" — GUI node glows, CLI↔GUI line animates. Caption: "The desktop app wraps the CLI with a visual interface. Or skip it entirely and work in your own terminal."
4. "Bring Your AI Agent" — Agent node glows, all connections pulse. Caption: "Point any AI coding agent at your site. It uses the CLI to understand your design system and make changes."

Step indicators: dots at the bottom. Auto-advance every 5s or click to navigate.

**Step 3: Add ambient animation**

- Dashed lines gently pulse even when not in step-through
- Subtle particle/data-flow dots traveling along connections
- Nodes have gentle hover glow

**Step 4: Wire into HowItWorksSection with heading "How It Works"**
**Step 5: Verify interactivity and commit**

```bash
git commit -m "feat(website): add interactive architecture diagram with step-through"
```

---

### Task 6: Build feature showcase section

**Files:**
- Create: `website/src/components/home/FeatureShowcase.astro`
- Create: `website/src/components/home/FeatureCard.astro`
- Create: `website/src/components/home/FeatureDemo.tsx` (React island for mini demos)

**4 features, each with a mini scripted demo:**

1. **Natural Language to Bricks Elements**
   - Icon: chat bubble → code block
   - Demo: Typed prompt "A pricing table with three tiers" → animated JSON output
   - Copy: "Describe what you want in plain language. The AI generates production-ready Bricks elements — complete with your design tokens, global classes, and responsive settings."

2. **Bring Your Own Agent**
   - Icon: plug/socket
   - Demo: Show different tool logos (Claude Code, Codex, terminal) cycling
   - Copy: "Use whatever AI coding tool you prefer. Claude Code, Codex, or any CLI tool that can run commands. Your machine, your API keys, your workflows."

3. **Cross-Site Intelligence**
   - Icon: magnifying glass over grid
   - Demo: Typed search `bricks search elements --class fr-hero` → results streaming in
   - Copy: "Search elements across every page. Pull design tokens and color palettes. Reference existing components. Work with full context of your site's design system."

4. **Templates & Style Profiles**
   - Icon: layers/stack
   - Demo: Typed `bricks templates compose hero-cali feature-havana --push 1460` → success
   - Copy: "Bring your own templates or learn from existing pages. Compose sections, apply style profiles, and maintain consistency across your entire site."

**Step 1: Build FeatureCard component (icon, heading, copy, demo slot)**
**Step 2: Build FeatureDemo React component with 4 scripted animations**
**Step 3: Build FeatureShowcase layout (2x2 grid on desktop, stack on mobile)**
**Step 4: Generate 4 feature icons using Nano Banana Pro**

Prompt for icon generation: "Minimalist illustrative icon, warm gold and deep purple tones on dark background, [specific description], clean lines, no text, suitable for web UI, 256x256"

**Step 5: Wire into homepage, verify, commit**

```bash
git commit -m "feat(website): add feature showcase with scripted demo animations"
```

---

### Task 7: Build GUI/CLI toggle demo section

**Files:**
- Create: `website/src/components/home/DemoSection.astro`
- Create: `website/src/components/home/InteractiveDemo.tsx` (React island)

**Step 1: Build full-width demo section**

Heading: "See It in Action"
Subheading: "Click a task below and watch it happen — in the GUI or the CLI."

**Step 2: Build InteractiveDemo React component**

- Toggle: GUI | CLI (same as hero but larger, full-featured)
- Demo buttons (horizontal row):
  - "Generate Hero Section"
  - "Upload Photos to Gallery"
  - "Change Heading Colors"
- Click a button → scripted theatrical animation plays in the selected view (GUI or CLI)
- Each demo is ~5-8 seconds of animated output

Demo scripts:
- **Generate Hero:** `bricks generate section "modern hero with video background" --page 1460` → JSON output → "Pushed to page 1460. Snapshot saved."
- **Upload Photos:** `bricks media upload ./photos/*.jpg && bricks generate section "photo gallery using uploaded images" --page 1460` → upload progress → gallery JSON
- **Change Headings:** `bricks search elements --type heading | bricks modify "change all heading colors to var(--primary)"` → "Modified 12 elements across 4 pages"

**Step 3: Verify interactivity, commit**

```bash
git commit -m "feat(website): add interactive GUI/CLI demo section with task buttons"
```

---

### Task 8: Build quick wins grid + founder's note + get started

**Files:**
- Create: `website/src/components/home/QuickWinsGrid.astro`
- Create: `website/src/components/home/FounderNote.astro`
- Create: `website/src/components/home/GetStartedSection.astro`

**Step 1: Quick Wins Grid**

6 items in a 3x2 grid (2x3 on tablet, 1x6 on mobile):
- Upload images into a Bricks gallery
- Generate a landing page from a brief
- Convert any HTML to Bricks elements
- Search and replace across all pages
- Roll back any change with snapshots
- Ramp up your team on AI-powered development

Each item: generated icon + short title + one-line description.

**Step 2: Founder's Note**

First person from Ashraf Ali. Content (to be humanized):

"I built Agent to Bricks because I was tired of the same pattern: a new AI tool launches, charges $29/month, and does half of what a good CLI tool could do for free.

Bricks Builder is one of the best page builders out there. It deserves AI tooling that matches its quality — without the price tag.

This is a passion project. It's free, it's open source, and it's growing. My hope is that one day Bricks ships built-in AI tools that make all of this unnecessary. Until then, this is my contribution to the community.

— Ashraf Ali"

With link to personal website. Photo optional.

Clearly stated: "Agent to Bricks is an independent open-source project. It is not affiliated with, endorsed by, or connected to Bricks Builder."

**Step 3: Get Started Section**

Clean install steps:
```
1. Install the WordPress plugin
2. Generate an API key in Settings → Agent to Bricks
3. Install the CLI: brew install nerveband/tap/bricks
4. Connect: bricks config init
5. Test: bricks site info
```

CTA: "Read the full guide →" linking to /getting-started/installation

**Step 4: Generate quick wins icons via Nano Banana Pro**
**Step 5: Wire all three into homepage, verify, commit**

```bash
git commit -m "feat(website): add quick wins grid, founder's note, and get started section"
```

---

## Phase 4: Documentation Content

### Task 9: Write Getting Started docs

**Files:**
- Create: `website/src/content/docs/getting-started/introduction.md`
- Create: `website/src/content/docs/getting-started/installation.md`
- Create: `website/src/content/docs/getting-started/quick-start.md`
- Create: `website/src/content/docs/getting-started/configuration.md`

**Content sources:** Pull from existing `README.md` and `docs/plugin-spec.md`. Adapt for the web docs format. Add code blocks with copy buttons (Starlight provides this by default).

**introduction.md** — What is Agent to Bricks, the three components (plugin/CLI/GUI), who it's for, core concepts (elements, snapshots, global classes, templates).

**installation.md** — Step-by-step for all three components. Plugin via WP admin or manual upload. CLI via Homebrew, Go install, or binary download. GUI via GitHub releases. System requirements.

**quick-start.md** — 5-minute walkthrough: install → configure → `bricks site info` → `bricks site pull` → `bricks generate section` → `bricks site push`. Show real output examples.

**configuration.md** — Full `config.yaml` reference. Environment variables. LLM provider setup (OpenAI, Anthropic, Cerebras, custom). Multiple site configurations.

**Step 1: Write each doc file with full content**
**Step 2: Run all content through humanizer**
**Step 3: Verify in Starlight dev server (sidebar, navigation, search)**
**Step 4: Commit**

```bash
git commit -m "docs(website): add Getting Started documentation"
```

---

### Task 10: Write CLI Reference docs

**Files:**
- Create: `website/src/content/docs/cli/site-commands.md`
- Create: `website/src/content/docs/cli/generate-commands.md`
- Create: `website/src/content/docs/cli/convert-commands.md`
- Create: `website/src/content/docs/cli/search-commands.md`
- Create: `website/src/content/docs/cli/template-commands.md`
- Create: `website/src/content/docs/cli/class-commands.md`
- Create: `website/src/content/docs/cli/style-commands.md`
- Create: `website/src/content/docs/cli/media-commands.md`
- Create: `website/src/content/docs/cli/agent-commands.md`
- Create: `website/src/content/docs/cli/doctor-validate.md`
- Create: `website/src/content/docs/cli/config-update.md`

**Content sources:** Existing `README.md` command documentation + CLI source code in `cli/cmd/*.go`.

Each doc page follows this pattern:
- Command overview and when to use it
- Syntax: `bricks <command> [flags]`
- Flags table: flag, short, type, default, description
- Examples with realistic output
- Related commands

**Step 1: Write all 11 CLI reference pages**
**Step 2: Verify sidebar navigation works**
**Step 3: Commit**

```bash
git commit -m "docs(website): add CLI reference documentation"
```

---

### Task 11: Write GUI Guide docs

**Files:**
- Create: `website/src/content/docs/gui/overview.md`
- Create: `website/src/content/docs/gui/layout-navigation.md`
- Create: `website/src/content/docs/gui/prompt-composer.md`
- Create: `website/src/content/docs/gui/managing-tools.md`
- Create: `website/src/content/docs/gui/sessions-history.md`
- Create: `website/src/content/docs/gui/keyboard-shortcuts.md`

**Content sources:** GUI component source code in `gui/src/components/`. Design doc at `docs/plans/2026-02-24-tauri-gui-companion-design.md`.

Include descriptions of every UI element, mention @mention syntax, variable pill system, preset buttons, keyboard shortcuts.

**Step 1: Write all 6 GUI guide pages**
**Step 2: Commit**

```bash
git commit -m "docs(website): add GUI guide documentation"
```

---

### Task 12: Write Plugin Reference docs

**Files:**
- Create: `website/src/content/docs/plugin/rest-api.md`
- Create: `website/src/content/docs/plugin/authentication.md`
- Create: `website/src/content/docs/plugin/element-data-model.md`
- Create: `website/src/content/docs/plugin/global-classes.md`
- Create: `website/src/content/docs/plugin/snapshots.md`
- Create: `website/src/content/docs/plugin/settings.md`

**Content sources:** `docs/plugin-spec.md` + plugin PHP source code.

**rest-api.md** is the big one — every endpoint with method, path, parameters, request body, response body, and example curl commands.

**element-data-model.md** — explain the flat array structure, parent/child references, settings by element type, global class IDs, ACSS vs custom classes. Include the JSON example from the design doc.

**Step 1: Write all 6 plugin reference pages**
**Step 2: Commit**

```bash
git commit -m "docs(website): add Plugin reference documentation"
```

---

### Task 13: Write Guides

**Files:**
- Create: `website/src/content/docs/guides/bring-your-own-agent.md`
- Create: `website/src/content/docs/guides/working-with-templates.md`
- Create: `website/src/content/docs/guides/html-to-bricks.md`
- Create: `website/src/content/docs/guides/style-profiles.md`
- Create: `website/src/content/docs/guides/acss-integration.md`
- Create: `website/src/content/docs/guides/team-onboarding.md`

**Key guides:**

**bring-your-own-agent.md** — How to configure Claude Code, Codex, or any AI tool with `bricks agent context`. Show example system prompts. Explain the context sections (classes, tokens, templates, element types).

**team-onboarding.md** — Using the GUI as a structured learning environment. Start with the GUI to understand what's possible, then transition to CLI for power and speed. Not "training wheels" — more like "an IDE that teaches you the tools."

**Step 1: Write all 6 guide pages**
**Step 2: Commit**

```bash
git commit -m "docs(website): add guides documentation"
```

---

### Task 14: Write About pages

**Files:**
- Create: `website/src/content/docs/about/philosophy.md`
- Create: `website/src/content/docs/about/roadmap.md`
- Create: `website/src/content/docs/about/contributing.md`
- Create: `website/src/content/docs/about/credits.md`

**philosophy.md** — Why Agent to Bricks exists. The vision of bringing AI to Bricks without the cost. Hope for native Bricks AI. Open source values.

**roadmap.md** — What's coming: Chrome extension, MCP transport, embeddings search, server-side transforms, template versioning.

**contributing.md** — How to contribute. Link to GitHub. Issue guidelines. PR process.

**credits.md** — "Created by Ashraf Ali" with link. "Agent to Bricks is an independent open-source project. It is not affiliated with, endorsed by, or officially connected to Bricks Builder."

**Step 1: Write all 4 about pages**
**Step 2: Run content through humanizer**
**Step 3: Commit**

```bash
git commit -m "docs(website): add about pages"
```

---

## Phase 5: Graphics & Polish

### Task 15: Generate graphics with Nano Banana Pro

**Images to generate:**
1. **Logo/icon** — Abstract brick + AI/sparkle motif, gold on dark, SVG-style
2. **Hero background element** — Abstract geometric pattern, purple/navy with gold accents
3. **4 feature icons** (256x256 each):
   - Natural language → code (chat bubble transforming to code block)
   - Bring your own agent (plugs connecting)
   - Cross-site intelligence (magnifying glass over connected nodes)
   - Templates & styles (layered geometric shapes)
4. **6 quick wins icons** (128x128 each):
   - Image upload, page generation, HTML conversion, search/replace, snapshot/rollback, team/learning
5. **OG image** (1200x630) — "Agent to Bricks" branded card for social sharing

**Prompt style:** "Minimalist illustrative, warm gold (#FACC15) and deep purple (#302b63) tones on dark background (#0a0a0c), clean geometric lines, no text, web-optimized"

**Step 1: Generate each image using nano-banana-pro skill**
**Step 2: Optimize images (compress, proper formats)**
**Step 3: Place in `website/src/assets/` and `website/public/`**
**Step 4: Wire into components**
**Step 5: Commit**

```bash
git commit -m "feat(website): add generated graphics and icons"
```

---

### Task 16: Content humanization pass

**Step 1: Invoke humanizer skill on all homepage content**

Run every content section through the humanizer to remove AI-writing tells. Focus on:
- Homepage hero, problem section, feature copy, founder's note
- Ensure natural rhythm, varied sentence length, active voice

**Step 2: Invoke humanizer on key docs pages**

Priority: introduction.md, philosophy.md, team-onboarding.md, bring-your-own-agent.md

**Step 3: Commit**

```bash
git commit -m "style(website): humanize content for natural reading"
```

---

### Task 17: Responsive design and accessibility pass

**Step 1: Test all homepage sections at mobile/tablet/desktop breakpoints**
**Step 2: Ensure interactive elements are keyboard-navigable**
**Step 3: Add proper ARIA labels to interactive demos**
**Step 4: Verify color contrast meets WCAG 2.1 AA**
**Step 5: Test dark/light mode toggle across all pages**
**Step 6: Commit**

```bash
git commit -m "fix(website): responsive and accessibility improvements"
```

---

### Task 18: Build and deploy setup

**Step 1: Add build script and verify static output**

```bash
cd website && npm run build
```

Verify `dist/` output is correct.

**Step 2: Add GitHub Pages or Vercel/Netlify deploy config**

If GitHub Pages:
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://nerveband.github.io',
  base: '/agent-to-bricks',
  // ...
});
```

**Step 3: Verify production build locally**

```bash
cd website && npm run preview
```

**Step 4: Commit**

```bash
git commit -m "chore(website): add build and deploy configuration"
```

---

## Task Dependency Map

```
Phase 1: [Task 1]
Phase 2: [Task 2] → [Task 3] (depends on layout)
Phase 3: [Task 4, 5, 6, 7, 8] (can be parallelized)
Phase 4: [Task 9, 10, 11, 12, 13, 14] (can be parallelized)
Phase 5: [Task 15] → [Task 16] → [Task 17] → [Task 18]
```

Tasks within Phase 3 and Phase 4 are independent and can be dispatched to parallel agents.
