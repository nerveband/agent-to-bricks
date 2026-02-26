# Website Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Agent to Bricks marketing website with new messaging, typography, animations, reworked demos that properly showcase GUI features, and a polished navigation with the chosen icon.

**Architecture:** Astro 5 static site with React 19 islands for interactive components. Framer Motion for component-level animations, GSAP + ScrollTrigger for scroll-based reveals. Tailwind 4 for styling with CSS custom properties for theming.

**Tech Stack:** Astro 5.6, React 19, Framer Motion 12, GSAP 3.12 + ScrollTrigger, Tailwind CSS 4.2, Space Grotesk + Plus Jakarta Sans + JetBrains Mono fonts, Phosphor Icons.

---

### Task 1: Install GSAP ScrollTrigger and Update Fonts

**Files:**
- Modify: `src/layouts/HomepageLayout.astro`
- Modify: `src/styles/custom.css`

**Step 1: Add ScrollTrigger CDN to HomepageLayout.astro**

In `HomepageLayout.astro`, after the existing GSAP script tag (line 46), add:

```html
<script is:inline src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
```

**Step 2: Replace Google Fonts import**

In `HomepageLayout.astro`, replace the Inter font link (line 41-42) with:

```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

**Step 3: Update font-family in HomepageLayout.astro**

Replace the `html, body` font-family block (around line 106) with:

```css
html, body {
  font-family: 'Plus Jakarta Sans', sans-serif;
}
h1, h2, h3, h4, h5, h6 {
  font-family: 'Space Grotesk', sans-serif;
}
.font-mono {
  font-family: 'JetBrains Mono', monospace;
}
```

**Step 4: Add electric blue CSS variable**

In `src/styles/custom.css`, inside the `:root, :root[data-theme='dark']` block (after line 38), add:

```css
--blue: #3B82F6;
```

And in the light theme block (after line 81):

```css
--blue: #2563EB;
```

**Step 5: Add scroll-reveal utility class and deeper gradient**

In `src/styles/custom.css`, after the `.status-dot` block (after line 260), add:

```css
/* Scroll-triggered reveal utilities */
.reveal {
  opacity: 0;
  transform: translateY(40px);
}
.reveal.active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Stagger children utility */
.stagger-children > * {
  opacity: 0;
  transform: translateY(30px);
}
.stagger-children.active > * {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.stagger-children.active > *:nth-child(1) { transition-delay: 0ms; }
.stagger-children.active > *:nth-child(2) { transition-delay: 100ms; }
.stagger-children.active > *:nth-child(3) { transition-delay: 200ms; }
.stagger-children.active > *:nth-child(4) { transition-delay: 300ms; }
.stagger-children.active > *:nth-child(5) { transition-delay: 400ms; }
.stagger-children.active > *:nth-child(6) { transition-delay: 500ms; }

/* 3D tilt hover effect */
.tilt-card {
  transform-style: preserve-3d;
  transition: transform 0.3s ease;
}
.tilt-card:hover {
  transform: perspective(1000px) rotateX(-2deg) rotateY(2deg) translateY(-4px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), var(--shadow-glow);
}

/* Gradient spotlight behind sections */
.section-spotlight {
  position: relative;
}
.section-spotlight::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 400px;
  background: radial-gradient(ellipse, rgba(250, 204, 21, 0.04) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* Sliding underline for nav links */
.nav-link {
  position: relative;
  padding-bottom: 2px;
}
.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 1.5px;
  background: var(--yellow);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.nav-link:hover::after {
  width: 100%;
}

/* Spring button animation */
.spring-btn {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.spring-btn:hover {
  transform: scale(1.03);
}
.spring-btn:active {
  transform: scale(0.97);
}

/* Text accent utilities */
.text-accent-blue { color: var(--blue); }
```

**Step 6: Verify dev server starts**

Run: `cd website && npm run dev`
Expected: Dev server starts, homepage loads with new fonts visible.

**Step 7: Commit**

```bash
git add src/layouts/HomepageLayout.astro src/styles/custom.css
git commit -m "feat(website): update fonts to Space Grotesk + Plus Jakarta Sans, add ScrollTrigger and animation utilities"
```

---

### Task 2: Rebuild Header with Icon, Nav Hover, and Scroll Behavior

**Files:**
- Modify: `src/components/home/Header.astro`
- Asset: `src/assets/icon.png` (already in place)

**Step 1: Rewrite Header.astro**

Replace the entire contents of `src/components/home/Header.astro` with:

```astro
---
import iconImg from '../../assets/icon.png';
---

<header id="site-header" class="fixed top-0 left-0 right-0 z-50 transition-all duration-500" data-scrolled="false">
  <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
    <!-- Left: Logo -->
    <a href="/" class="flex items-center gap-3 group">
      <img src={iconImg.src} alt="Agent to Bricks" class="w-8 h-8 rounded-lg shadow-sm group-hover:shadow-[var(--shadow-glow)] transition-shadow" />
      <span class="text-sm font-semibold text-ui-fg tracking-wide" style="font-family: 'Space Grotesk', sans-serif;">Agent to Bricks</span>
    </a>

    <!-- Center: Nav Links (Desktop) -->
    <nav class="hidden md:flex items-center gap-8" aria-label="Main navigation">
      <div class="relative group">
        <a href="#features" class="nav-link text-sm text-ui-muted hover:text-ui-fg transition-colors py-2">Features</a>
        <!-- Dropdown for Features -->
        <div class="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 translate-y-1 group-hover:translate-y-0">
          <div class="glass-base border border-subtle rounded-xl p-4 min-w-[240px] flex flex-col gap-3">
            <a href="#features" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors">
              <i class="ph ph-terminal-window text-accent-yellow text-lg"></i>
              <div>
                <div class="text-sm font-medium text-ui-fg">CLI</div>
                <div class="text-xs text-ui-muted">Your workflow, your way</div>
              </div>
            </a>
            <a href="#features" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors">
              <i class="ph ph-layout text-accent-yellow text-lg"></i>
              <div>
                <div class="text-sm font-medium text-ui-fg">GUI</div>
                <div class="text-xs text-ui-muted">Everything at your fingertips</div>
              </div>
            </a>
            <a href="#features" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors">
              <i class="ph ph-squares-four text-accent-yellow text-lg"></i>
              <div>
                <div class="text-sm font-medium text-ui-fg">Templates</div>
                <div class="text-xs text-ui-muted">Build your design system</div>
              </div>
            </a>
          </div>
        </div>
      </div>
      <a href="#how-it-works" class="nav-link text-sm text-ui-muted hover:text-ui-fg transition-colors py-2">How It Works</a>
      <div class="relative group">
        <a href="/getting-started/introduction/" class="nav-link text-sm text-ui-muted hover:text-ui-fg transition-colors py-2">Docs</a>
        <!-- Dropdown for Docs -->
        <div class="absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 translate-y-1 group-hover:translate-y-0">
          <div class="glass-base border border-subtle rounded-xl p-4 min-w-[220px] flex flex-col gap-2">
            <a href="/getting-started/introduction/" class="px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors text-sm text-ui-muted hover:text-ui-fg">Getting Started</a>
            <a href="/cli/site-commands/" class="px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors text-sm text-ui-muted hover:text-ui-fg">CLI Reference</a>
            <a href="/gui/overview/" class="px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors text-sm text-ui-muted hover:text-ui-fg">GUI Guide</a>
            <a href="/plugin/rest-api/" class="px-3 py-2 rounded-lg hover:bg-[var(--white-glass)] transition-colors text-sm text-ui-muted hover:text-ui-fg">Plugin API</a>
          </div>
        </div>
      </div>
      <a href="https://github.com/nerveband/agent-to-bricks" target="_blank" rel="noopener noreferrer" class="nav-link text-sm text-ui-muted hover:text-ui-fg transition-colors py-2 flex items-center gap-1.5">
        <i class="ph ph-github-logo text-base"></i>
        GitHub
      </a>
    </nav>

    <!-- Right: CTA + Mobile Menu -->
    <div class="flex items-center gap-4">
      <a href="/getting-started/installation/" class="hidden sm:inline-flex items-center px-5 py-2 rounded-lg bg-accent-yellow text-black text-sm font-semibold spring-btn shadow-[var(--shadow-glow)]">
        Get Started
      </a>
      <!-- Mobile hamburger -->
      <button id="mobile-menu-btn" class="md:hidden flex flex-col gap-1.5 p-2" aria-label="Open menu" aria-expanded="false">
        <span class="w-5 h-0.5 bg-ui-fg transition-all origin-center" id="burger-1"></span>
        <span class="w-5 h-0.5 bg-ui-fg transition-all" id="burger-2"></span>
        <span class="w-5 h-0.5 bg-ui-fg transition-all origin-center" id="burger-3"></span>
      </button>
    </div>
  </div>

  <!-- Mobile Drawer -->
  <div id="mobile-drawer" class="md:hidden fixed inset-0 top-16 bg-[var(--surface-dark)]/95 backdrop-blur-xl z-40 translate-x-full transition-transform duration-300" aria-hidden="true">
    <nav class="flex flex-col gap-2 p-6">
      <a href="#features" class="text-lg text-ui-fg py-3 border-b border-subtle">Features</a>
      <a href="#how-it-works" class="text-lg text-ui-fg py-3 border-b border-subtle">How It Works</a>
      <a href="/getting-started/introduction/" class="text-lg text-ui-fg py-3 border-b border-subtle">Docs</a>
      <a href="https://github.com/nerveband/agent-to-bricks" target="_blank" class="text-lg text-ui-fg py-3 border-b border-subtle flex items-center gap-2">
        <i class="ph ph-github-logo"></i> GitHub
      </a>
      <a href="/getting-started/installation/" class="mt-4 inline-flex items-center justify-center px-6 py-3 rounded-lg bg-accent-yellow text-black font-semibold">
        Get Started
      </a>
    </nav>
  </div>
</header>

<script is:inline>
  // Scroll behavior: add glass effect on scroll
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('backdrop-blur-xl', 'bg-[var(--surface-dark)]/80', 'border-b', 'border-subtle');
      header.dataset.scrolled = 'true';
    } else {
      header.classList.remove('backdrop-blur-xl', 'bg-[var(--surface-dark)]/80', 'border-b', 'border-subtle');
      header.dataset.scrolled = 'false';
    }
  });

  // Mobile menu toggle
  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  let menuOpen = false;
  menuBtn?.addEventListener('click', () => {
    menuOpen = !menuOpen;
    drawer.classList.toggle('translate-x-full', !menuOpen);
    drawer.classList.toggle('translate-x-0', menuOpen);
    drawer.setAttribute('aria-hidden', String(!menuOpen));
    menuBtn.setAttribute('aria-expanded', String(menuOpen));
    document.getElementById('burger-1').style.transform = menuOpen ? 'rotate(45deg) translateY(4px)' : '';
    document.getElementById('burger-2').style.opacity = menuOpen ? '0' : '1';
    document.getElementById('burger-3').style.transform = menuOpen ? 'rotate(-45deg) translateY(-4px)' : '';
  });

  // Close drawer on link click
  drawer?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menuOpen = false;
      drawer.classList.add('translate-x-full');
      drawer.classList.remove('translate-x-0');
    });
  });
</script>

<style>
  #site-header[data-scrolled='true'] {
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    background: rgba(10, 10, 12, 0.8);
    border-bottom: 1px solid var(--border-subtle);
  }
</style>
```

**Step 2: Verify header renders with icon, dropdowns, scroll effect**

Run dev server, scroll page, hover nav items, test mobile menu.

**Step 3: Commit**

```bash
git add src/components/home/Header.astro
git commit -m "feat(website): rebuild header with icon, dropdowns, scroll behavior, mobile drawer"
```

---

### Task 3: Rewrite Hero Section

**Files:**
- Modify: `src/components/home/HeroSection.astro`

**Step 1: Replace HeroSection.astro contents**

Replace entire file with new hero featuring the rewritten messaging and a simplified mockup. The hero should:
- Use the new headline: "Your Bricks site. Your AI. Your rules."
- Use the new subhead about stopping one-page-at-a-time clicking
- Show a two-pane "Old Way vs Agent to Bricks" comparison mockup
- GSAP entrance animations on headline words
- Parallax effect on the mockup

The hero mockup left pane shows a greyed-out, tedious WordPress admin sequence. The right pane shows the same task done via Agent to Bricks in seconds with vibrant yellow/green accents.

Key implementation details:
- Headline uses `font-family: 'Space Grotesk'` with `text-5xl sm:text-6xl lg:text-7xl font-bold`
- Yellow accent on "Your rules." with glow
- Subhead uses Plus Jakarta Sans, `text-lg text-ui-muted max-w-2xl`
- Two CTAs: "Get Started" (yellow, spring-btn) and "Star on GitHub" (glass)
- Two-pane mockup in glass-base container, split 50/50
- Left pane: greyed-out, small text showing "Click page > Edit > Find heading > Change color > Save > Repeat for 19 more pages..."
- Right pane: vibrant terminal showing `$ bricks search --type heading | bricks modify --color "var(--primary)" --push` with green checkmark output

**Step 2: Verify hero renders correctly**

Run dev server, check headline renders with new fonts, mockup shows two panes, animations fire.

**Step 3: Commit**

```bash
git add src/components/home/HeroSection.astro
git commit -m "feat(website): rewrite hero with new messaging and old-way vs new-way mockup"
```

---

### Task 4: Create Pain Points Section

**Files:**
- Create: `src/components/home/PainPoints.tsx`

**Step 1: Create the component**

A React component with 4 cards that animate on scroll using Framer Motion's `useInView`:

1. **"Bulk updates are manual"** — icon: `ph-repeat`, description about clicking through 20 pages
2. **"Media upload is tedious"** — icon: `ph-upload-simple`, description about desktop-to-WP-to-element pipeline
3. **"Other tools lock you in"** — icon: `ph-lock-key`, description about subscription AI tools
4. **"Styles stay siloed"** — icon: `ph-columns`, description about copying styles between pages

Each card: glass-base, tilt-card hover, icon with yellow accent, title in Space Grotesk, description in Plus Jakarta Sans. Cards stagger in from bottom with Framer Motion.

Section header: "Bricks Builder is powerful. Managing it at scale isn't."

**Step 2: Verify cards render and animate**

**Step 3: Commit**

```bash
git add src/components/home/PainPoints.tsx
git commit -m "feat(website): add pain points section with scroll-animated cards"
```

---

### Task 5: Create "What If" Vision Section

**Files:**
- Create: `src/components/home/WhatIfSection.tsx`

**Step 1: Create the component**

A scroll-triggered sequence with a shared terminal mockup. As the user scrolls, 3 scenarios play out in order:

1. "Change all heading colors to brand blue" — terminal types command, shows headings updating across pages
2. "Upload these 12 photos and build a gallery" — shows drag-drop + gallery generation
3. "Reference this PDF and build a landing page" — shows AI reading doc + generating section

Implementation: Use Framer Motion's `useScroll` and `useTransform` to map scroll position to animation progress. A sticky container holds the mockup, text captions swap as user scrolls through trigger zones.

Section header: "What if you could just talk to your website?"

**Step 2: Verify scroll-triggered animation works**

**Step 3: Commit**

```bash
git add src/components/home/WhatIfSection.tsx
git commit -m "feat(website): add What If scroll-triggered vision section"
```

---

### Task 6: Create Three Pillars Feature Showcase

**Files:**
- Create: `src/components/home/FeaturePillars.tsx`
- Remove usage of: `src/components/home/FeatureShowcase.astro` (from index.astro)

**Step 1: Create the component**

Three full-width sections, alternating layout (mockup left/right):

**Pillar 1: CLI — "Your workflow, your way"**
- Left: Feature bullets (chainable commands, any AI agent, pipe into tools, automate with cron)
- Right: Terminal mockup showing `bricks search --type heading --json | bricks modify --style "color: var(--primary)" | bricks push --all`
- Highlight: works with Claude Code, Codex, any coding tool

**Pillar 2: GUI — "Everything at your fingertips"** (THIS IS THE KEY SECTION)
- Right: Feature bullets:
  - Tab into your live pages, colors, styles from the sidebar
  - @mention pages, variables, components, images inline in prompts
  - Save and reuse prompt templates
  - Multi-site management — switch between sites
  - Run multiple concurrent sessions
- Left: GUI mockup showing:
  - Sidebar with "Pages", "Colors", "Styles", "Images" tabs
  - Prompt input with `@page:Homepage` autocomplete dropdown visible
  - Color swatch chips for `@color:primary` mention
  - A saved template chip "Bulk Style Update"
  - Status bar showing "Connected to: mysite.com"

**Pillar 3: Templates — "Build your design system"**
- Left: Feature bullets (download templates, create your own, generate from AI, style profiles, export/import)
- Right: Template browser mockup with cards showing template names, preview thumbnails, "Use" buttons

Each pillar: section-spotlight, reveal animation, large mockup (~400px height).

**Step 2: Verify all three pillars render**

**Step 3: Commit**

```bash
git add src/components/home/FeaturePillars.tsx
git commit -m "feat(website): add three-pillar feature showcase with CLI, GUI, Templates"
```

---

### Task 7: Rework Interactive Demo Section

**Files:**
- Modify: `src/components/home/InteractiveDemo.tsx`
- Modify: `src/components/home/DemoSection.astro`

**Step 1: Rewrite InteractiveDemo.tsx**

New demos that properly differentiate CLI and GUI:

**Demo 1: "Bulk style update"**
- CLI view: Terminal showing `bricks search --type heading | bricks modify --style "color: var(--primary)" --push` with output lines
- GUI view: Shows sidebar with site styles list, prompt area with `@style:heading-xl` autocomplete dropdown, a visual diff showing "Before: #333 → After: var(--primary)" for 12 headings, push button

**Demo 2: "Content from documents"**
- CLI view: `cat brief.md | bricks generate section --page 1460 --push`
- GUI view: Shows a document icon in the prompt area (drag-drop), AI processing indicator, then inline preview of generated section with "Push to Homepage" button

**Demo 3: "Multi-page media upload"**
- CLI view: `bricks media upload ./photos/*.jpg && bricks generate gallery --images latest --push`
- GUI view: Shows image thumbnails grid in sidebar, `@page:Gallery` mention in prompt, one-click "Build Gallery" button, thumbnail previews

The KEY difference: GUI view must render actual GUI elements (dropdowns, autocomplete chips, image thumbnails, color swatches, buttons) — NOT just terminal text in a different frame.

**Step 2: Update DemoSection.astro heading**

Change heading to: "See it in action"
Change subheading to: "Pick a task. Watch the difference between CLI precision and GUI convenience."

**Step 3: Verify demos render with differentiated GUI**

**Step 4: Commit**

```bash
git add src/components/home/InteractiveDemo.tsx src/components/home/DemoSection.astro
git commit -m "feat(website): rework demos to properly showcase GUI features vs CLI"
```

---

### Task 8: Create Differentiator Section

**Files:**
- Create: `src/components/home/Differentiator.tsx`

**Step 1: Create the component**

Section with headline "Not another AI WordPress plugin." and a comparison grid:

| Feature | Other AI Tools | Agent to Bricks |
|---------|---------------|-----------------|
| AI Provider | Locked to their API | Bring your own |
| Pricing | Monthly subscription | Free & open source |
| Workflow | Their interface only | CLI, GUI, or API |
| Automation | Not possible | Chain commands, cron, CI/CD |
| Templates | Their templates | Create, import, generate your own |
| Data | Sent to their servers | Your machine, your keys |

"Other AI Tools" column: muted, slightly red-tinted text
"Agent to Bricks" column: bright, green checkmarks, yellow accents

Glass-base container, reveal animation. Each row can have a subtle icon.

**Step 2: Verify comparison renders**

**Step 3: Commit**

```bash
git add src/components/home/Differentiator.tsx
git commit -m "feat(website): add differentiator comparison section"
```

---

### Task 9: Refresh Quick Wins Grid

**Files:**
- Modify: `src/components/home/QuickWinsGrid.astro`

**Step 1: Update QuickWinsGrid.astro**

Keep the 6-card grid but:
- Add `tilt-card` class to each card for 3D hover
- Add `stagger-children` class to the grid container
- Add a one-liner command below each card description (small, mono, muted)
- Update icons to use Phosphor filled variants for more weight

Cards:
1. Upload images → `bricks media upload ./photos/*.jpg`
2. Generate a landing page → `bricks generate page "SaaS landing page"`
3. Convert HTML to Bricks → `bricks convert ./template.html --push`
4. Search and replace → `bricks search "old text" | bricks modify`
5. Roll back any change → `bricks snapshot restore --page 1460`
6. Onboard your team → `bricks config export | bricks config import`

**Step 2: Verify cards render with hover effects and commands**

**Step 3: Commit**

```bash
git add src/components/home/QuickWinsGrid.astro
git commit -m "feat(website): refresh quick wins grid with 3D tilt, commands, stagger animation"
```

---

### Task 10: Improve Get Started Section

**Files:**
- Modify: `src/components/home/GetStartedSection.astro`

**Step 1: Add copy-to-clipboard functionality**

Add a small copy button (Phosphor `ph-copy` icon) next to each code block. On click, copy the command text to clipboard and show a brief "Copied!" tooltip.

**Step 2: Add reveal animations**

Wrap each step in a `reveal` div. Add an inline `<script>` that uses GSAP ScrollTrigger to activate `.reveal` elements on scroll.

**Step 3: Verify clipboard and animations work**

**Step 4: Commit**

```bash
git add src/components/home/GetStartedSection.astro
git commit -m "feat(website): add copy-to-clipboard and scroll animations to Get Started"
```

---

### Task 11: Polish Footer

**Files:**
- Modify: `src/components/home/Footer.astro`

**Step 1: Add icon to footer**

Import the icon image and add it next to the "Agent to Bricks" text in the footer. Reorganize links into two columns: "Product" (Features, Docs, GitHub) and "Resources" (Getting Started, CLI Reference, GUI Guide).

**Step 2: Commit**

```bash
git add src/components/home/Footer.astro
git commit -m "feat(website): polish footer with icon and organized link columns"
```

---

### Task 12: Wire Up New Section Order in index.astro

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/HomepageLayout.astro`

**Step 1: Update index.astro imports and section order**

```astro
---
import HomepageLayout from '../layouts/HomepageLayout.astro';
import HeroSection from '../components/home/HeroSection.astro';
import PainPoints from '../components/home/PainPoints.tsx';
import WhatIfSection from '../components/home/WhatIfSection.tsx';
import FeaturePillars from '../components/home/FeaturePillars.tsx';
import DemoSection from '../components/home/DemoSection.astro';
import Differentiator from '../components/home/Differentiator.tsx';
import QuickWinsGrid from '../components/home/QuickWinsGrid.astro';
import GetStartedSection from '../components/home/GetStartedSection.astro';
import FounderNote from '../components/home/FounderNote.astro';
---

<HomepageLayout>
  <HeroSection />
  <PainPoints client:visible />
  <WhatIfSection client:visible />
  <FeaturePillars client:visible />
  <DemoSection />
  <Differentiator client:visible />
  <QuickWinsGrid />
  <GetStartedSection />
  <FounderNote />
</HomepageLayout>
```

Note: Remove `HowItWorksSection` and `FeatureShowcase` imports — they are replaced by the new sections.

**Step 2: Update GSAP scroll reveal initialization**

In `HomepageLayout.astro`, update the `<script>` block to register ScrollTrigger and add batch reveal:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  gsap.registerPlugin(ScrollTrigger);

  // Reveal all .reveal elements on scroll
  gsap.utils.toArray('.reveal').forEach(el => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => el.classList.add('active'),
      once: true,
    });
  });

  // Stagger children
  gsap.utils.toArray('.stagger-children').forEach(el => {
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => el.classList.add('active'),
      once: true,
    });
  });

  // Hero entrance
  const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.from('.hero-headline .word', {
    duration: 0.8,
    opacity: 0,
    y: 60,
    stagger: 0.08,
  })
  .from('.hero-subhead', {
    duration: 0.8,
    opacity: 0,
    y: 30,
  }, '-=0.4')
  .from('.hero-cta', {
    duration: 0.6,
    opacity: 0,
    y: 20,
    stagger: 0.1,
  }, '-=0.4')
  .from('.hero-mockup', {
    duration: 1,
    opacity: 0,
    y: 60,
    ease: 'power3.out',
  }, '-=0.6');
});
```

**Step 3: Update favicon**

Copy the icon to `public/` as favicon:
```bash
cp src/assets/icon.png public/favicon.png
```

Update `HomepageLayout.astro` favicon link:
```html
<link rel="icon" type="image/png" href="/favicon.png" />
```

**Step 4: Full page test — verify all sections render in order**

Run: `npm run dev`
Walk through entire page top to bottom. Verify:
- Header shows icon, dropdowns work, scroll effect works
- Hero shows new messaging and two-pane mockup
- Pain points cards animate in
- What If section scroll-triggers work
- Feature Pillars show all 3 with proper mockups
- Demo section shows differentiated GUI vs CLI
- Differentiator comparison renders
- Quick Wins cards tilt on hover
- Get Started has copy buttons
- Footer has icon
- All scroll animations fire

**Step 5: Build test**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 6: Commit**

```bash
git add src/pages/index.astro src/layouts/HomepageLayout.astro public/favicon.png
git commit -m "feat(website): wire up new section order, scroll reveals, favicon update"
```

---

### Task 13: Final Polish and Cleanup

**Files:**
- Remove unused: `src/components/home/FeatureShowcase.astro`
- Remove unused: `src/components/home/HowItWorksSection.astro`
- Remove unused: `src/components/home/ArchitectureDiagram.tsx`
- Remove unused: `src/components/home/FeatureDemo.tsx`
- Remove unused: `src/components/home/ViewToggle.tsx`
- Remove unused: `src/components/home/CliMockup.tsx`
- Remove unused: `src/components/home/GuiMockup.tsx`

**Step 1: Delete unused components**

```bash
rm src/components/home/FeatureShowcase.astro
rm src/components/home/HowItWorksSection.astro
rm src/components/home/ArchitectureDiagram.tsx
rm src/components/home/FeatureDemo.tsx
rm src/components/home/ViewToggle.tsx
rm src/components/home/CliMockup.tsx
rm src/components/home/GuiMockup.tsx
```

**Step 2: Final build verification**

Run: `npm run build`
Expected: Clean build, no broken imports.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(website): remove unused legacy components"
```
