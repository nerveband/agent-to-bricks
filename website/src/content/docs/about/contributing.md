---
title: Contributing
description: How to contribute to Agent to Bricks, including reporting bugs, suggesting features, submitting code, and improving docs
---

Agent to Bricks is open source under GPL-3.0. Contributions are welcome: bug reports, feature requests, documentation improvements, and code.

The repository: [github.com/nerveband/agent-to-bricks](https://github.com/nerveband/agent-to-bricks)

## Repository structure

```
agent-to-bricks/
├── cli/          # Go CLI (Go 1.22+)
├── plugin/       # WordPress plugin (PHP 8.0+)
├── gui/          # Tauri desktop app (React + TypeScript)
├── website/      # This documentation site (Astro + Starlight)
├── docs/         # Design documents and specs
├── schema/       # JSON schemas
├── tests/        # Integration tests
└── scripts/      # Build and release scripts
```

## Building from source

### CLI

Requires Go 1.22 or later.

```bash
cd cli
go build -o bricks .
```

Or use the Makefile:

```bash
make build      # builds to bin/bricks
make install    # copies to /usr/local/bin
```

### Plugin

The plugin is plain PHP with no build step. Copy the `plugin/agent-to-bricks/` directory into your WordPress `wp-content/plugins/` folder, or zip it:

```bash
cd plugin
zip -r agent-to-bricks-plugin.zip agent-to-bricks/
```

Then install the zip through the WordPress admin.

### GUI

Requires Node.js 18+ and Rust (for Tauri).

```bash
cd gui
npm install
npm run tauri dev     # development mode with hot reload
npm run tauri build   # production build
```

### Documentation site

```bash
cd website
npm install
npm run dev           # local dev server
```

## Running tests

The CLI has **97 tests across 14 packages**:

```bash
make test
```

Or run specific test suites:

```bash
cd cli && go test ./internal/client/...    # API client tests
cd cli && go test ./internal/convert/...   # HTML converter tests
cd cli && go test ./internal/validator/... # element validation tests
cd cli && go test ./cmd/...                # command integration tests
```

All tests must pass before your PR will be reviewed.

## Reporting bugs

Open a GitHub issue with:

1. **What you did:** commands run, steps to reproduce
2. **What you expected** to happen
3. **What actually happened:** error messages, unexpected behavior
4. **Your environment:** OS, CLI version (`bricks version`), Bricks version, PHP version, WordPress version

Include the output of `bricks doctor` if relevant. It checks your connection, plugin version, and common configuration issues.

## Suggesting features

Open a GitHub issue labeled "feature request." Include:

- The problem you're trying to solve
- How you'd expect the feature to work
- Why existing commands don't cover your use case

Concrete use cases are more useful than abstract ideas. "I manage 12 client sites and need to push the same template update to all of them" is better than "add multi-site support."

## Submitting code

1. Fork the repository and create a branch from `main`
2. Make your changes
3. Run `make test` and confirm everything passes
4. Open a pull request against `main`

For larger changes, open an issue first to discuss the approach. This avoids wasted effort if the change doesn't align with the project's direction.

### What makes a good PR

- **One thing per PR.** A bug fix, a new feature, or a refactor, not all three combined.
- **Tests included.** New features should have tests. Bug fixes should have a test that would have caught the bug.
- **Clear description.** What does the PR do, and why? If it fixes an issue, link to it.
- **Working code.** Make sure `make test` passes. If you're changing the plugin, test it against a real Bricks site.

### Code style

- **CLI (Go):** Standard `gofmt` formatting. Run `gofmt -w .` before committing. No external linter config needed.
- **Plugin (PHP):** WordPress coding standards. Tabs for indentation. Doc blocks on public methods.
- **GUI (TypeScript/React):** ESLint + Prettier with the project's config. Run `npm run lint` before committing.
- **Documentation (Markdown):** Starlight frontmatter with `title` and `description`. No trailing whitespace. One sentence per line is fine but not required.

## Documentation improvements

Documentation changes are always welcome. Typo fixes, better examples, clearer explanations, additional edge cases. If you've hit a confusing part of the docs and figured it out, consider submitting a PR to help the next person.

The docs live in `website/src/content/docs/`. Each file is Markdown with Starlight frontmatter. Run the site locally to preview your changes:

```bash
cd website
npm run dev
```

## Questions

If you're not sure whether something is a bug, a feature request, or something else, open a discussion on GitHub. We'll figure it out together.
