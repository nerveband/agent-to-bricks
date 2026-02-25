---
title: Contributing
description: How to contribute to Agent to Bricks
---

Agent to Bricks is open source under GPL-3.0. Contributions are welcome -- bug reports, feature requests, documentation improvements, and code.

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

The plugin is plain PHP. No build step. Copy the `plugin/` directory to your WordPress `wp-content/plugins/` folder, or zip it up:

```bash
cd plugin
zip -r agent-to-bricks-plugin.zip agent-to-bricks/
```

### GUI

Requires Node.js 18+ and Rust.

```bash
cd gui
npm install
npm run tauri dev     # development mode
npm run tauri build   # production build
```

## Running tests

The CLI has 97 tests across 14 packages:

```bash
make test
```

Or run specific test suites:

```bash
cd cli && go test ./internal/client/...    # API client tests
cd cli && go test ./internal/convert/...   # HTML converter tests
cd cli && go test ./cmd/...                # command integration tests
```

## Reporting bugs

Open an issue on GitHub with:

1. What you did (commands, steps to reproduce)
2. What you expected
3. What actually happened
4. Your environment (OS, CLI version, Bricks version, PHP version)

Include the output of `bricks version` and `bricks site info` if relevant.

## Suggesting features

Open a GitHub issue labeled "feature request." Include:

- The problem you're solving
- How you'd expect it to work
- Why existing commands don't cover it

Concrete use cases are more useful than abstract ideas.

## Submitting code

1. Fork the repo and create a branch
2. Make your changes
3. Run `make test` and make sure everything passes
4. Open a pull request against `main`

For larger changes, open an issue first to discuss the approach. This avoids wasted effort if the change doesn't fit the project's direction.

### Code style

- **CLI (Go):** Standard `gofmt` formatting. No external linter config needed.
- **GUI (TypeScript/React):** ESLint + Prettier with the project's config.
- **Plugin (PHP):** WordPress coding standards.

## Documentation

This documentation site lives in `website/`. It uses Astro with Starlight. To run it locally:

```bash
cd website
npm install
npm run dev
```

Documentation improvements are always appreciated. Typo fixes, better examples, and clearer explanations all help.
