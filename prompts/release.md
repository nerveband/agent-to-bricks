# Release Prompt

Copy-paste this into Claude Code after you're done with your changes and ready to release:

---

Run the full pre-release check and release pipeline. Do these steps:

**Build checks:**
1. Run `make check-version` to verify version consistency
2. Run `make test` for CLI tests
3. Run `make lint` for Go vet/lint
4. Run `cd gui && npx tsc --noEmit` for GUI type check
5. Run PHP lint on plugin files: `find plugin -name "*.php" -exec php -l {} \;`
6. Run `cd website && npm run build` to verify website builds

**Plugin functional tests:**
7. Deploy to staging using `scripts/deploy-staging.sh`, fix ownership, restart PHP-FPM
8. Run the plugin test suite on staging via WP-CLI: for each file in `tests/plugin/test-*-runner.php`, run it with `wp eval-file` on the staging server. Report any failures.

**Docs & content sync:**
9. Check `git log --oneline` since the last release tag to see all changes
10. For any CLI, GUI, or plugin changes: update the matching docs in `website/src/content/docs/` (new commands, changed flags, new features, changed behavior, removed features)
11. Check if the homepage sections in `website/src/components/home/` need updates for new features
12. Update the changelog section in `README.md` with a summary of what's new in this version

**Cross-link & URL verification:**
13. Grep all URLs in CLI source (cmd/*.go), GUI source (src/), and plugin source (includes/) that point to agenttobricks.com — verify each target page exists in `website/src/content/docs/` or `website/src/pages/`
14. Check that the plugin settings page links and CLI help text URLs are not broken

**GUI E2E tests:**
15. The E2E tests require the GUI running with the MCP debug plugin. Setup:
    - Install JS bindings (one-time): `cd gui && npm install --save-dev tauri-plugin-mcp`
    - Start GUI with MCP: `cd gui && npx tauri dev --features dev-debug`
    - Wait for socket at `/tmp/tauri-mcp-atb.sock` and the app window to appear
    - The `dev-debug` Cargo feature enables `tauri-plugin-mcp` which creates a Unix socket for programmatic control
    - The JS guest bindings (`setupPluginListeners()`) are auto-loaded in dev mode via `src/main.tsx`
16. Run `cd gui && node e2e/run-tests.mjs` to execute the GUI E2E test suite (40 tests)
17. Report any test failures — all tests must pass before releasing

**GUI feature testing (if GUI changed):**
18. With the GUI already running from step 15, manually verify any changed features:
    - If @mention autocomplete changed: open autocomplete for affected types and confirm results appear
    - If status bar changed: check the version number is visible and clickable
    - If settings/about changed: open Settings > About and verify content

**Dependency check:**
19. Run `cd cli && go list -m -u all 2>/dev/null | grep '\[' | head -10` to check for Go dependency updates
20. Run `cd gui && npm audit --production 2>/dev/null | tail -5` to check for npm vulnerabilities
21. If any critical/high vulnerabilities, fix them before releasing

**Website deployment (if website changed):**
22. If any files under `website/` changed (docs, homepage, components, styles):
    - `cd website && npm run build`
    - `cd website && npx netlify deploy --dir=dist` (draft/preview deploy)
    - Share the preview URL for review
    - After review is approved, deploy to production: `cd website && npx netlify deploy --dir=dist --prod`

**Hero changelog badge:**
23. Update the changelog badge in `website/src/components/home/HeroSection.astro`:
    - Update the version number (e.g. `v1.8.0`) in both the `href` URL and the badge text
    - Update the short description text to summarize this release's highlights (keep it under ~8 words)
    - The badge links to `https://github.com/nerveband/agent-to-bricks/releases/tag/v<VERSION>`

**Release:**
24. Ask me what version to bump to (patch, minor, or major). Bump `VERSION`, run `make sync-version`, commit all changes
25. Tag and push to trigger the release workflow: `make tag-release`
26. Monitor the release workflow until all 7 jobs pass (CLI, Plugin ZIP, 4x GUI, Verify)
27. Publish the draft release with release notes summarizing what changed
28. Download and open the macOS aarch64 DMG to verify signing works

**If re-releasing (workflow failed and you need to retry):**
- First try: `gh run rerun <run-id> --failed` to re-run only the failed job
- If that doesn't work: delete the release (`gh release delete v<version> --yes`), delete the tag locally and remotely, re-create the tag on latest commit, and push again
- Common transient failure: Windows GUI build gets GitHub API timeouts during asset upload. The rename step has retry logic, but `tauri-action` itself may timeout. Re-running the failed job usually fixes it.
- After re-release: check that the previous release's assets don't conflict (goreleaser may error if CLI assets already exist)
