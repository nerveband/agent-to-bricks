# Agent to Bricks Website — Content & Design Document

**Date:** 2026-02-25
**Author:** Ashraf Ali + Claude

## Overview

A marketing homepage + documentation site for Agent to Bricks, built with **Astro + Starlight**. The homepage is a fully custom Astro page with interactive elements (GUI mockup, CLI demo, architecture diagram). The docs section uses Starlight for markdown-driven technical documentation.

## Target Audience

Both equally:
- **Bricks Builder users** who want AI capabilities (homepage speaks to them first)
- **Developers & AI agents** who want CLI-level power (depth clearly signaled)

## Tone

- **Product sections:** Clean, approachable, third-person product voice
- **Founder section:** First-person from Ashraf Ali — personal, passionate, opinionated
- Writing run through humanizer for natural, non-AI feel

## Technology

- **Framework:** Astro with Starlight for docs
- **Homepage:** Custom Astro page with React/Svelte islands for interactivity
- **Docs:** Starlight-powered markdown pages with sidebar, search, versioning
- **Deployment:** Static output (GitHub Pages, Vercel, or Netlify)
- **Graphics:** Generated via Nano Banana Pro (Gemini), not stock

---

## Homepage Structure

### 1. Hero Section
- **Headline:** "Update your Bricks website with natural language."
- **Subline:** Bring your own AI agent, your own workflows, from your machine to the cloud.
- **CTAs:** "Get Started" + "Star on GitHub" (live star count)
- **Visual:** Animated GUI mockup with typing effect. Toggle switch to CLI view.

### 2. The Problem
- Expensive AI tools, monetized platforms, LTD fatigue
- Bricks deserves AI tooling that's free, open, and community-driven
- Matter-of-fact tone, not complaint-driven

### 3. How It Works — Interactive Architecture Diagram
- Animated SVG: WordPress + Bricks ← Plugin → CLI ← → GUI ← → Your AI Agent
- Step-through walkthrough (4 steps highlighting data flow)
- Ambient animation by default, clickable steps for guided tour
- Shows: install plugin, connect CLI, open GUI (or use terminal directly), AI generates elements

### 4. Feature Showcase
Four key capabilities with scripted demo animations:

1. **Natural Language to Bricks Elements** — Describe what you want, get production Bricks JSON
2. **Bring Your Own Agent** — Claude Code, Codex, any tool. Your machine, your keys, your workflows.
3. **Cross-Site Intelligence** — Search elements, pull design tokens, reference components
4. **Templates & Style Profiles** — Bring templates, learn from pages, compose sections

### 5. GUI / CLI Toggle Demo
- Full-width section with interactive toggle
- One-click demo buttons showing scripted workflows:
  - "Generate a hero section"
  - "Upload photos to gallery"
  - "Change all heading colors"
- Theatrical typed output with simulated results

### 6. What You Can Do (Quick Wins Grid)
Concrete examples with generated icons:
- Upload a folder of images into a Bricks gallery
- Generate a full landing page from a brief
- Convert any HTML to Bricks elements
- Search and replace across all pages
- Roll back any change with snapshots
- Ramp up your team on AI-powered Bricks development

### 7. Open Source & Free — Founder's Note
- First person from Ashraf Ali
- Why this exists: fighting the barrage of expensive tools
- Hope that Bricks eventually builds excellent AI tools natively
- This is a bridge, a passion project, a gift to the community
- Not affiliated with Bricks Builder
- Link to ashrafali.net (or personal site)

### 8. Get Started
- Install plugin (WP admin or manual)
- Install CLI (brew / go install / binary download)
- Configure: `bricks config init`
- First command: `bricks site info`
- Link to full docs

### 9. Footer
- GitHub with star badge
- Docs link
- "Made by Ashraf Ali"
- "Not affiliated with Bricks Builder"

---

## Documentation Structure (Starlight)

### Getting Started
- Introduction — what, who, core concepts
- Installation — plugin + CLI + GUI
- Quick Start — 5-minute walkthrough
- Configuration — config.yaml, env vars, LLM providers

### CLI Reference
- Site Commands (info, pull, push, patch, snapshot, rollback, frameworks)
- Generate Commands (section, page, modify)
- Convert Commands (HTML to Bricks)
- Search Commands (elements across site)
- Template Commands (list, show, import, learn, compose)
- Class Commands (list, create, find, delete)
- Style Commands (colors, variables, theme, learn)
- Media Commands (upload, list, search)
- Agent Commands (context export)
- Doctor & Validate
- Config & Update

### GUI Guide
- Overview
- Layout & Navigation
- Prompt Composer (@mentions, pills, presets)
- Managing Tools
- Sessions & History
- Keyboard Shortcuts

### Plugin Reference
- REST API (all endpoints with examples)
- Authentication (X-ATB-Key)
- Element Data Model
- Global Classes
- Snapshots
- Settings

### Guides
- Bring Your Own Agent
- Working with Templates
- HTML to Bricks Workflow
- Style Profiles
- ACSS Integration
- Team Onboarding (GUI as learning environment, transition to CLI)

### About
- Philosophy
- Roadmap
- Contributing
- Credits (Ashraf Ali, not affiliated with Bricks Builder)

---

## Visual Design

### Color System
- Dark mode default (glass morphism from existing design concept)
- Light mode via toggle
- Bricks gold accent: #FACC15 (dark) / #EBA40A (light)
- Deep purple/navy backgrounds: #0f0c29, #302b63, #24243e
- OKLCH palette for perceptual consistency

### Typography
- **Manrope** — headlines and body (Bricks brand alignment)
- **Geist Mono / JetBrains Mono** — code, terminal, CLI examples

### Interactive Elements
- **GUI mockup:** Real AppShell layout (sidebar, terminal, context panel). Animated typing in prompt pane, simulated terminal output.
- **CLI demo:** Dark terminal with typed commands, streaming output, cursor blink.
- **Toggle:** Smooth animated switch between GUI and CLI views.
- **Architecture diagram:** SVG with animated dashed flow lines, glowing nodes, step-through dots.

### Graphics
- Generated via Nano Banana Pro (Gemini image generation)
- Illustrative, slightly abstract, warm tones complementing gold/purple
- Specific to the project (Bricks elements, code blocks, site building)
- Not generic stock illustration style

### Animations
- Ambient gradient shifts and gentle parallax
- Scroll-triggered section reveals
- Terminal typing effects
- Architecture diagram step transitions

---

## Key Messaging

### Primary Message
"Update your Bricks website with natural language."

### Supporting Messages
- Bring your own AI agent, your own workflows, from your machine to the cloud
- Stop copying and pasting — let the agent do the work
- Make changes across multiple pages in seconds
- Access WordPress data without opening the browser
- Work in full context of your site's design system
- Start with the GUI, graduate to the CLI, or go straight to terminal
- Free and open source, forever

### Differentiators
- Not another expensive AI WordPress plugin
- You own your workflow — bring any AI tool
- CLI-first means agents can use it too
- Snapshots and rollback for safety
- Learns your design system (templates, style profiles, ACSS tokens)

### Disclaimer
"Agent to Bricks is an independent open-source project by Ashraf Ali. It is not affiliated with, endorsed by, or officially connected to Bricks Builder."
