# Agent to Bricks Website Redesign — Design Document

## Decision
Full page rebuild. Every section rewritten with new messaging, typography, animations, and demo experience. Keep the Astro + React + Framer Motion + Tailwind stack.

## Icon
`src/assets/icon.png` — Dark purple background, golden yellow speech bubble with `>` prompt, soft 3D style.

---

## Typography

**Out:** Inter (generic, overused)

**In:**
- **Headlines:** Space Grotesk (700-800 weight) — bold, geometric, builder personality
- **Body:** Plus Jakarta Sans (400-500) — clean, warmer than Inter
- **Mono:** JetBrains Mono (400, 500, 700) — keep for code/terminal

## Navigation (Header)

- Sticky frosted glass bar (not macOS window chrome)
- **Left:** Icon + "Agent to Bricks" wordmark
- **Center:** Nav links with smooth hover underline animations (Apple-style)
- **Dropdown menus** on hover for "Features" and "Docs" with glass panels
- **Right:** "Get Started" yellow CTA + GitHub stars
- Scroll: Transparent at top, gains blur + border on scroll
- Mobile: Hamburger with slide-in drawer

## Section Flow

### 1. Hero
**Headline:** "Your Bricks site. Your AI. Your rules."
**Subhead:** "Stop clicking through WordPress one page at a time. Bulk update content, upload media from your desktop, generate sections from any AI — all from your terminal or our GUI."

Two-pane animated mockup:
- Left: "The Old Way" — tedious WP admin (greyed out)
- Right: "With Agent to Bricks" — same task in seconds (vibrant, glowing)

Entrance: GSAP stagger on headline characters, subhead fades up, mockup slides up with parallax.

### 2. Pain Points (NEW)
**Headline:** "Bricks Builder is powerful. Managing it at scale isn't."

4 cards with scroll-triggered animations:
1. Bulk updates are manual
2. Media upload is tedious
3. No AI integration — other tools lock you in
4. Styles are siloed between pages

### 3. "What If" Vision (NEW)
**Headline:** "What if you could just talk to your website?"

Scroll-triggered animation sequence in a shared mockup:
- "Change all heading colors to brand blue" → happens across pages
- "Upload these 12 photos and build a gallery" → drag, drop, done
- "Reference this PDF and build a landing page" → AI reads, generates, pushes

### 4. Three Pillars Feature Showcase

**Pillar 1: CLI — "Your workflow, your way"**
- Chainable commands, pipe into tools, automate
- Demo: `bricks search | bricks modify | bricks push`
- Works with ANY coding tool, any AI agent, any API

**Pillar 2: GUI — "Everything at your fingertips"**
- Tab into live pages/colors/styles from sidebar
- @mention pages, variables, components, images inline
- Save prompt templates
- Multi-site management, concurrent sessions
- Demo: Interactive mockup with @mention autocomplete, color swatches, saved templates

**Pillar 3: Templates — "Build your design system"**
- Download, create, generate templates
- Style profiles enforce your brand
- Export/import for teams
- Demo: Template browser with customization

Each pillar: full-width section, large mockup + feature bullets, alternating left-right.

### 5. "See It In Action" Demos (REWORKED)

3 scenarios showing CLI vs GUI differentiation:

**Demo 1: Bulk style update**
- CLI: `bricks search --type heading | bricks modify --style "color: var(--primary)" --push`
- GUI: @mention autocomplete for styles, visual diff before push

**Demo 2: Content from documents**
- CLI: `cat brief.md | bricks generate section --page 1460 --push`
- GUI: Drag-drop PDF, AI reads it, preview renders inline

**Demo 3: Multi-page media upload**
- CLI: `bricks media upload ./photos/*.jpg && bricks generate gallery`
- GUI: Drag-drop images, @mention target page, one-click push

Key: GUI view actually looks like a GUI (sidebar resources, autocomplete, thumbnails, swatches) — NOT terminal text in a different frame.

### 6. Differentiator (NEW)
**Headline:** "Not another AI WordPress plugin."

Comparison showing:
- AI Provider: Bring your own vs locked
- Pricing: Free/OSS vs subscription
- Workflow: CLI, GUI, API vs their interface only
- Automation: Chain commands, cron, CI/CD vs not possible
- Templates: Create/import/generate vs theirs only
- Data: Your machine, your keys vs their servers

### 7. Quick Wins Grid (REFRESHED)
- Better animations (stagger on scroll, 3D tilt hover)
- Each card shows a one-liner command
- Keep 6-card layout

### 8. Get Started (IMPROVED)
- Copy-to-clipboard on code blocks
- Steps animate in sequence on scroll
- Syntax highlighting in code blocks

### 9. Founder Note (KEEP)
- Add personal touch, keep message

### 10. Footer (POLISHED)
- Add icon
- Better link organization

## Animations & Visual Polish

- **Scroll reveals:** GSAP ScrollTrigger (fade up + slight scale) on every section
- **Gradient mesh:** Subtle animated color blobs behind sections (not just linear gradient)
- **Grain texture:** Keep noise overlay at 8-10% opacity
- **Glow effects:** Yellow ambient glow behind mockups, CTAs
- **Parallax:** Mockup windows have slight parallax on scroll
- **Hover micro-interactions:** Cards tilt 3D, buttons spring, nav links slide underline
- **Text reveals:** Headline words stagger in
- **Smooth scroll:** CSS `scroll-behavior: smooth`

## Color Refinements

- Primary: #FACC15 (yellow)
- Secondary: #3B82F6 (electric blue for code highlights)
- Background: Deeper purple-to-black gradient
- Subtle radial gradient spotlights behind sections
- Keep existing glass/surface system, deepen it

## Files to Create/Modify

### New components:
- `PainPoints.tsx` — 4-card scroll-animated section
- `WhatIfSection.tsx` — scroll-triggered animation sequence
- `FeaturePillars.tsx` — 3-pillar deep-dive with mockups
- `Differentiator.tsx` — comparison section
- `NavDropdown.tsx` — dropdown menu component

### Modified components:
- `Header.astro` — new nav with icon, dropdowns, scroll behavior
- `HeroSection.astro` — new messaging, two-pane mockup
- `InteractiveDemo.tsx` — completely reworked demos with real GUI features
- `FeatureShowcase.astro` → replaced by FeaturePillars
- `QuickWinsGrid.astro` — refreshed animations and copy
- `GetStartedSection.astro` — clipboard buttons, scroll animations
- `Footer.astro` — add icon, reorganize
- `HomepageLayout.astro` — new section order, font imports
- `custom.css` — new fonts, deeper colors, animation utilities

### Assets:
- `src/assets/icon.png` — chosen icon (done)
- Favicon update from icon
