# Quick Check Prompt

Copy-paste this into Claude Code to verify everything builds and docs are up to date:

---

Run the full local verification pass, docs/content audit, and staging-aware checks. Prefer the repo scripts and `make` targets over ad hoc command sequences. Do these steps:

**Environment and install:**
1. Load repo-local env if present (`.env`) and treat `.env.example` as the source of truth for required staging vars.
2. Run `./scripts/verify-local-install.sh` to verify build, install target, local binary resolution, and staging connectivity when credentials are configured.
3. If `bricks` resolves to a stale shim before the installed binary, call that out explicitly and explain how it was handled.
4. Treat `docs/test-data/` as local/private fixture space. Public clones must skip private corpus checks cleanly instead of failing.

**Build checks:**
5. Run `make check-version` to verify version consistency, including `cli/schema.json`
6. Run `make test` for CLI tests
7. Run `make lint` for Go vet/lint
8. Run `cd cli && go run . schema --validate` to verify `schema.json` is in sync with commands
9. Run `cd gui && npx tsc --noEmit` for GUI type check
10. Run PHP lint on plugin files: `find plugin -name "*.php" -exec php -l {} \;`
11. Run `cd website && npm run build` to verify website builds

**Staging and E2E checks:**
12. If staging credentials are available, prefer `./scripts/verify-staging-release.sh` as the canonical end-to-end gate. It deploys staging, verifies `/site/info`, runs the plugin runner matrix, CLI E2E, template smoke, and GUI MCP E2E.
13. If the full gate fails and you need to isolate the breakage, use these narrower scripts:
    - `./scripts/deploy-staging.sh`
    - `./tests/plugin/run-staging-suite.sh`
    - `./tests/e2e/test-full-workflow.sh`
    - `./tests/e2e/test-template-smoke.sh`
    - `./gui/e2e/run-tests.sh`
14. Treat `docs/test-data/templates` as local/private. If the proprietary corpus exists, run the template smoke flow and confirm it used real fixtures. If it is absent, confirm the repo skips cleanly instead of failing.

**Docs & content audit:**
15. Check `git diff --name-only HEAD~5` to see what changed recently
16. For any CLI, GUI, or plugin changes: check if the matching docs in `website/src/content/docs/` need updating
    - If CLI commands, flags, or payloads changed: verify `cli/schema.json` and the docs examples were updated together
    - If staging, install, or env behavior changed: verify `.env.example`, `README.md`, and any relevant guides reflect it
    - If release-facing messaging changed: verify `CHANGELOG.md`, `README.md`, and `website/src/components/home/HeroSection.astro`
17. Check if the homepage sections in `website/src/components/home/` reference outdated features or are missing new ones
18. Check if `README.md`, `CHANGELOG.md`, and the prompt docs under `prompts/` reflect recent process changes

**Cross-link & URL verification:**
19. Grep all URLs in CLI source (`cmd/*.go`), GUI source (`src/`), and plugin source (`includes/`) that point to `agenttobricks.com` and verify each target page exists in `website/src/content/docs/` or `website/src/pages/`
20. Check that plugin settings links and CLI help text URLs are not broken

**Website preview (if website changed):**
21. If any files under `website/` changed, build the website and deploy a preview:
    - `cd website && npm run build`
    - `cd website && npx netlify deploy --dir=dist`
    - Share the preview URL for review
    - After review is approved, deploy to production: `cd website && npx netlify deploy --dir=dist --prod`

**GUI MCP notes:**
22. The GUI E2E tests require the app running with the MCP debug feature:
    - Start GUI with MCP: `cd gui && npm run dev:mcp`
    - Wait for socket at `/tmp/tauri-mcp-atb.sock`
    - Run `./gui/e2e/run-tests.sh`
23. The suite currently contains 41 tests. All should pass before shipping.

**Reporting:**
24. Report what passed, what failed, what was skipped because local/private fixtures were absent, whether the installed binary path is clean, and what docs or release surfaces still need updating.
