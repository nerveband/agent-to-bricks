---
title: Prompt composer
description: How to write prompts with @mentions, variable pills, and presets in the Agent to Bricks GUI.
---

The prompt composer is where you build context-aware prompts for your AI coding tools. It lives in two places: the PromptWorkshop in the context panel (right side), and the CommandPalette overlay (`Cmd+P`). Both share the same @mention system and compose logic.

## The @mention system

Type `@` in the prompt input and an autocomplete dropdown appears. First, pick a type:

| Type | What it references |
|---|---|
| `@page` | Pages on your Bricks site |
| `@section` | Sections within pages |
| `@element` | Individual Bricks elements |
| `@class` | Global CSS classes |
| `@color` | Theme colors |
| `@variable` | CSS custom properties |
| `@component` | Reusable components |
| `@media` | Media library items |
| `@template` | Saved templates |
| `@form` | Form elements |
| `@loop` | Query loop builders |
| `@condition` | Conditional display rules |

After selecting a type, the dropdown switches to a search mode. Start typing to filter results -- these are fetched live from your connected WordPress site through the REST API. Select a result and it becomes a **mention pill** attached to your prompt.

You can also trigger autocomplete by typing the category directly, like `@page` followed by a space. Once you have typed at least two characters of a type name, the app matches it and jumps straight to search.

### How autocomplete navigation works

- **Arrow Up / Arrow Down** -- Move through the dropdown list
- **Tab or Enter** -- Select the highlighted item
- **Escape** -- Close the dropdown without selecting

### What happens behind the scenes

When you send a prompt, the app resolves each mention. It calls the site's REST API to fetch the actual data for that page, section, class, or whatever you referenced. That data gets formatted into a structured context block and prepended to your prompt text. The AI tool receives the full composed prompt with all the context it needs.

For example, if you write:

```
Restyle the hero section on @page Homepage to use a dark background
```

The app resolves the `@page Homepage` mention, pulls the page's element tree, and sends the AI tool something like:

```
--- Site Context ---
Page: Homepage (ID 42)
Elements: [section, heading, paragraph, button, ...]
...
--- End Context ---

Restyle the hero section on Homepage to use a dark background
```

## Variable pills

The prompt input uses a `VariableEditor` -- a contentEditable div that renders `{variables}` and `@mentions` as inline colored pills. These are not plain text. They are non-editable spans styled to stand out:

- **Curly brace variables** like `{description}` or `{site_url}` -- shown with the accent color
- **@mention references** -- colored by type (blue for pages, purple for sections, green for elements, amber for classes, pink for colors, cyan for variables, orange for components, lime for media)
- **Double-curly variables** like `{{template}}` -- shown in cyan

Click any pill to open a popover that shows its resolved value (if available) and lets you edit it inline. This is especially useful in the LaunchDialog's system prompt editor, where pills like `{site_url}` resolve to your actual site URL.

## Presets

The PromptWorkshop includes a preset library organized into four categories:

**Build**
- Generate Section -- Create a new section from a description
- Generate Full Page -- Build an entire page layout
- Full Page Build -- Multi-step: snapshot, pull, generate, push

**Edit**
- Modify Elements -- Change existing elements on a page
- Restyle Section -- Update section styling
- Convert HTML -- Transform an HTML file into Bricks elements

**Manage**
- Pull Page -- Download page elements from your site
- Push Page -- Upload local changes back
- Snapshot Page -- Backup current page state
- Rollback Page -- Restore from a previous snapshot

**Inspect**
- Inspect Page -- View all elements on a page
- Check Styles -- View theme styles, colors, and CSS variables

Click a preset to load its prompt template into the editor. The template usually includes `@page` or `@section` mentions and `{description}` placeholders that you fill in.

You can also save your own presets. Write a prompt, click "Save", name it, and it appears alongside the built-in ones. Custom presets persist in your config file.

## PromptWorkshop vs CommandPalette

Both provide the same mention input and compose pipeline. The difference is where they live and how you access them.

**PromptWorkshop** (context panel):
- Always visible when the context panel is open
- Shows presets and history below the input
- Has Send, Save, and Copy buttons
- Best for longer, more involved prompts

**CommandPalette** (`Cmd+P`):
- Overlay that appears on top of everything
- Quick-access mention chips (`@page`, `@section`, `@class`, etc.) below the input
- Shows a preview step before sending -- hit Send once to preview the composed prompt, then again to pipe it to the terminal
- Also handles app commands: add a site, switch sites, change theme, save presets
- Recent prompt history shows when the input is empty
- Best for fast, in-the-flow prompting

## Tips for effective prompts

**Be specific about what you want changed.** "Make the hero section look better" gives the AI little to work with. "Change the hero section background to a dark gradient, increase heading font size to 48px, and add 80px of vertical padding" gives it something concrete.

**Reference real site objects.** A prompt with `@page Homepage` and `@section hero` gives the agent actual element data. Without mentions, the agent has to guess at your site structure.

**Use the pull-edit-push pattern.** Many presets follow this: pull current state, make changes, push back. It is the safest workflow because the agent starts from what actually exists on the site.

**Combine mentions.** You can reference multiple objects in one prompt: "On `@page About`, restyle `@section team` using `@class card-grid` and the `@color primary` from the theme." Each mention adds its own resolved context.

**Save prompts you repeat.** If you find yourself writing the same kind of prompt often, save it as a preset. Next time, one click loads the template and you just fill in the specifics.
