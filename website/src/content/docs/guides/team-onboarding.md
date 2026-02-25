---
title: Team onboarding
description: Using the GUI as a learning tool, transitioning to the CLI, and getting your team productive with Agent to Bricks
---

If you're introducing Agent to Bricks to a team, the question is usually "where do people start?" The answer depends on their comfort level with the command line. The project has three interfaces -- GUI, CLI, and direct API -- and they're all talking to the same backend. People can start wherever they're comfortable and grow from there.

## The GUI is an IDE, not training wheels

The desktop GUI wraps AI coding tools (Claude Code, Codex, OpenCode) with a visual interface that knows about your Bricks site. It's not a simplified version of the CLI. It has features the CLI doesn't: a prompt composer with autocomplete for pages, classes, colors, and components. A session history. A live view of what the agent is doing.

For team members who haven't used a terminal much, the GUI is a real working environment, not a stepping stone they need to outgrow. Some people prefer it permanently, and that's fine.

What the GUI teaches along the way:

- **How prompts map to commands.** The session output shows the CLI commands being run. "Generate a hero section for page 42" becomes `bricks generate section --page 42 --prompt "..."`. Team members see the translation happen.
- **What classes are available.** The @mention autocomplete for class names shows the ACSS utility classes and custom classes on your site. People learn the class vocabulary by using it.
- **How snapshots work.** The session history shows when snapshots are created and what was pushed. The rollback option is right there. People build the habit of snapshotting before changes.
- **What the API does.** Each GUI action maps to an API call. Curious team members can see what happened under the hood and start to understand the system.

## Getting started as a team

### 1. Set up the shared infrastructure

One person (usually the dev lead) does the initial setup:

- Install the WordPress plugin on the Bricks site
- Generate API keys for each team member (one key per person, labeled with their name)
- Document the site URL and any team conventions (naming patterns, preferred templates, etc.)

### 2. Each person sets up their local tools

Give each team member their API key and have them run:

```bash
bricks config init
```

For GUI users, they open the app and enter their site URL and key in the settings.

For CLI users, the config wizard writes `~/.agent-to-bricks/config.yaml` and they're ready.

### 3. Verify the connection

Everyone should run:

```bash
bricks site info
```

If it shows the site details, they're connected. If not, check the URL and key.

### 4. First exercises

**GUI path:** Open the app, select the site, click an AI tool to start a session. Use the "Inspect Page" preset with an @page mention to pull the homepage. Then try "Generate Section" with a prompt like "Add a testimonial section with 3 cards."

**CLI path:** Run through the [Quick start](/getting-started/quick-start/) guide. Pull a page, generate a section, push it, roll it back.

## Transition paths

People move between interfaces naturally. Here's how it usually goes:

### GUI first, CLI later

Someone starts in the GUI. After a few weeks, they notice the CLI commands in the session output and try running them directly. They discover that typing `bricks convert html hero.html --push 42 --snapshot` is faster than composing the same thing in the GUI for a repetitive task.

They don't switch entirely. They use the CLI for repetitive tasks and the GUI for exploratory work where the prompt composer and autocomplete help them figure out what to build.

### CLI first, GUI for context

A developer comfortable in the terminal starts with the CLI. They use the GUI occasionally when they need to browse available classes, preview templates, or work on a prompt that needs the autocomplete suggestions.

### Cheat sheet for transitioning

| GUI action | CLI equivalent |
|-----------|---------------|
| Inspect Page preset | `bricks site pull <page-id>` |
| Generate Section preset | `bricks generate section --page <id> --prompt "..."` |
| @class mention | `bricks classes list` |
| @color mention | `bricks styles colors` |
| Site switcher | `bricks config use <site-name>` |
| Snapshot button | `bricks snapshots create <page-id>` |

### API direct

Someone building an automated pipeline (CI/CD, batch page generation, content migration) goes straight to the REST API. They might never touch the GUI or CLI.

## Team conventions worth establishing

**Snapshot before push, always.** Make `--snapshot` the default for all push operations. It costs nothing and saves hours of pain.

**Use labeled API keys.** When someone leaves the team or their laptop gets stolen, you can revoke their specific key without disrupting everyone else.

**Agree on class naming.** If people create custom global classes, pick a prefix (e.g., `team-card--`, `project-hero--`) so custom classes don't collide with ACSS classes or each other.

**Share templates.** When someone builds a section that others will reuse, save it as a template:

```bash
bricks templates learn --page 42 --element sect01 --name "pricing-three-col"
```

Then anyone on the team can compose it into their pages:

```bash
bricks templates compose pricing-three-col --push 78
```

**Document your prompts.** Good prompts are reusable. Keep a shared doc of prompts that produce good results with your site's design system.

## Managing multiple sites

For agencies managing several Bricks sites, the CLI config supports multiple site profiles:

```yaml
# ~/.agent-to-bricks/config.yaml
sites:
  client-a:
    url: https://client-a.com
    api_key: atb_...
  client-b-staging:
    url: https://staging.client-b.com
    api_key: atb_...
  client-b-production:
    url: https://client-b.com
    api_key: atb_...
```

Switch between them:

```bash
bricks config use client-a
bricks site info  # shows client-a's site details
```

Each team member can have their own keys for each site.

## Common onboarding issues

**"The AI generated content that doesn't match our design."** The AI needs context. Run `bricks agent context --format markdown` and check that your ACSS tokens and classes are showing up. If the context is missing data, the plugin might not be detecting your framework. Run `bricks site frameworks` to check.

**"My push overwrote someone else's changes."** This is what the optimistic locking prevents. If two people pull the same page, make changes, and push, the second push will fail with a `409 Conflict`. The fix: pull again, merge your changes, and push. The `--snapshot` flag makes this safe to experiment with.

**"I can't modify a class."** ACSS-imported classes are read-only through the API. You can only modify custom classes. If you need a variation of an ACSS class, create a new custom class.

**"The GUI can't connect to my site."** Same troubleshooting as the CLI: check the URL includes `https://`, verify the API key is correct, and make sure the plugin is activated. Run `bricks doctor` for a full connection check.

## Related

- [GUI overview](/gui/overview/) -- getting started with the desktop app
- [Prompt composer](/gui/prompt-composer/) -- @mentions and presets
- [Quick start](/getting-started/quick-start/) -- the CLI-first introduction
