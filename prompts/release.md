# Release Prompt

Copy-paste this into Claude Code after you're done with your changes and ready to release:

---

Run the full pre-release check, release pipeline, and post-release install/site rollout. Prefer the repo scripts and `make` targets over manual one-off commands. Do these steps:

**Environment and install:**
1. Load repo-local env if present (`.env`) and treat `.env.example` as the source of truth for required staging vars.
2. Run `./scripts/verify-local-install.sh` before release work. This verifies build/install, local binary resolution, and staging connectivity when credentials are configured.
3. If `bricks` resolves to a stale shim before the installed binary, fix that explicitly and note what was changed.
4. Treat `docs/test-data/` as local/private fixture space. Public clones must skip private corpus checks cleanly instead of failing.

**Build checks:**
5. Run `make check-version` to verify version consistency, including `cli/schema.json`
6. Run `make test` for CLI tests
7. Run `make lint` for Go vet/lint
8. Run `cd cli && go run . schema --validate` to verify schema.json is in sync
9. Run `cd gui && npx tsc --noEmit` for GUI type check
10. Run PHP lint on plugin files: `find plugin -name "*.php" -exec php -l {} \;`
11. Run `cd website && npm run build` to verify website builds

**Canonical staging gate:**
12. Prefer `./scripts/verify-staging-release.sh` as the canonical release gate. It deploys staging, verifies `/site/info`, runs the plugin runner matrix, CLI E2E, template smoke, and GUI MCP E2E.
13. If staging SSH is backed by the 1Password agent on this machine, unlock/approve the SSH signing prompt before retrying deploy or runner scripts.
14. If the full gate fails and you need to isolate the breakage, use these narrower scripts:
   - `./scripts/deploy-staging.sh`
   - `./tests/plugin/run-staging-suite.sh`
   - `./tests/e2e/test-full-workflow.sh`
   - `./tests/e2e/test-template-smoke.sh`
   - `./gui/e2e/run-tests.sh`
15. Treat `docs/test-data/templates` as local/private. If the proprietary corpus exists, run the local/private coverage. If it is absent, confirm the repo skips cleanly instead of failing.

**Docs & content sync:**
16. Check `git log --oneline` since the last release tag to see all changes
17. For any CLI, GUI, or plugin changes: update the matching docs in `website/src/content/docs/`
    - If CLI commands, flags, or payloads changed: update docs examples and `cli/schema.json`
    - If staging, install, or env behavior changed: update `.env.example`, `README.md`, and relevant guides
    - If release-facing messaging changed: update `CHANGELOG.md`, `README.md`, and `website/src/components/home/HeroSection.astro`
18. Check if the homepage sections in `website/src/components/home/` need updates for new features
19. Update `CHANGELOG.md`, the release summary in `README.md`, and any affected prompts under `prompts/` if the process changed
20. Confirm the release candidate still follows the repo philosophy in `AGENTS.md`:
    - contract-first, machine-readable public surfaces in the ShipTypes sense
    - agent-DX CLI properties: structured JSON I/O, raw payload input, schema validation, stable errors, pagination/field selection, safety rails
    - no newly introduced structured-string corruption from naive regex or delimiter splitting

**Cross-link & URL verification:**
21. Grep all URLs in CLI source (`cmd/*.go`), GUI source (`src/`), and plugin source (`includes/`) that point to `agenttobricks.com` and verify each target page exists in `website/src/content/docs/` or `website/src/pages/`
22. Check that the plugin settings page links and CLI help text URLs are not broken

**GUI MCP notes:**
23. The GUI E2E tests require the app running with the MCP debug feature:
    - Start GUI with MCP: `cd gui && npm run dev:mcp`
    - Wait for socket at `/tmp/tauri-mcp-atb.sock`
    - Run `./gui/e2e/run-tests.sh`
24. The suite currently contains 41 tests. All must pass before releasing.

**GUI feature testing (if GUI changed):**
25. With the GUI already running from step 23, manually verify any changed features:
    - If @mention autocomplete changed: open autocomplete for affected types and confirm results appear
    - If status bar changed: check the version number is visible and clickable
    - If settings/about changed: open Settings > About and verify content

**Dependency check:**
26. Run `cd cli && go list -m -u all 2>/dev/null | grep '\[' | head -10` to check for Go dependency updates
27. Run `cd gui && npm audit --production 2>/dev/null | tail -5` to check for npm vulnerabilities
28. If any critical/high vulnerabilities, fix them before releasing

**Website deployment (if website changed):**
29. If any files under `website/` changed (docs, homepage, components, styles):
    - `cd website && npm run build`
    - `cd website && npx netlify deploy --dir=dist` (draft/preview deploy)
    - Share the preview URL for review
    - After review is approved, deploy to production: `cd website && npx netlify deploy --dir=dist --prod`

**Hero changelog badge:**
30. Update the changelog badge in `website/src/components/home/HeroSection.astro`:
    - Update the version number (e.g. `v1.8.0`) in both the `href` URL and the badge text
    - Update the short description text to summarize this release's highlights (keep it under ~8 words)
    - The badge links to `https://github.com/nerveband/agent-to-bricks/releases/tag/v<VERSION>`

**Release:**
31. Choose the version bump based on compatibility:
    - patch for internal-only fixes
    - minor for additive public behavior
    - major for breaking CLI/plugin contract changes
32. Bump `VERSION`, run `make sync-version`, and commit all release changes together
33. Push `main` first so the tag points at the final release commit, then push the tag with `make tag-release`
34. Monitor the release workflow until all 7 jobs pass (CLI, Plugin ZIP, 4x GUI, Verify)
35. The release may already be published by an asset job before the workflow finishes. After all 7 jobs pass, make sure the release title and body are correct and include release notes summarizing what changed.
36. Download the macOS aarch64 DMG and verify notarization/signing with `spctl` and `codesign`
37. After the release commit exists, rebuild/install locally one more time so `bricks --version` reports the released commit SHA, not a pre-commit SHA
38. Verify local and staging post-release:
    - `bricks --version`
    - `bricks site info`
    - `gh release view v<VERSION>`

**If re-releasing (workflow failed and you need to retry):**
- First try: `gh run rerun <run-id> --failed` to re-run only the failed job
- If that doesn't work: delete the release (`gh release delete v<version> --yes`), delete the tag locally and remotely, re-create the tag on latest commit, and push again
- Common transient failure: Windows GUI build gets GitHub API timeouts during asset upload. The rename step has retry logic, but `tauri-action` itself may timeout. Re-running the failed job usually fixes it.
- After re-release: check that the previous release's assets don't conflict (goreleaser may error if CLI assets already exist)
