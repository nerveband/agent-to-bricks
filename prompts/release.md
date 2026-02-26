# Release Prompt

Copy-paste this into Claude Code after you're done with your changes and ready to release:

---

Run the full pre-release check and release pipeline. Do these steps:

**Build checks:**
1. Run `scripts/sync-version.sh --check` to verify version consistency
2. Run `cd cli && go test ./...` for CLI tests
3. Run `cd gui && npx tsc --noEmit` for GUI type check
4. Run PHP lint on plugin files
5. Run `cd website && npm run build` to verify website builds

**Docs & content sync:**
6. Check `git log --oneline` since the last release tag to see all changes
7. For any CLI, GUI, or plugin changes: update the matching docs in `website/src/content/docs/` (new commands, changed flags, new features, changed behavior, removed features)
8. Check if the homepage sections in `website/src/components/home/` need updates for new features
9. Update the changelog section in `README.md` with a summary of what's new in this version

**Cross-link & URL verification:**
10. Grep all URLs in CLI source (cmd/*.go), GUI source (src/), and plugin source (includes/) that point to agenttobricks.com — verify each target page exists in `website/src/content/docs/` or `website/src/pages/`
11. Check that the plugin settings page links and CLI help text URLs are not broken

**Staging verification (if plugin changed):**
12. If plugin files changed, deploy to staging using `scripts/deploy-staging.sh`, fix ownership, restart PHP-FPM, and verify the API returns 200

**Dependency check:**
13. Run `cd cli && go list -m -u all 2>/dev/null | grep '\[' | head -10` to check for Go dependency updates
14. Run `cd gui && npm audit --production 2>/dev/null | tail -5` to check for npm vulnerabilities
15. If any critical/high vulnerabilities, fix them before releasing

**Release:**
16. Rebuild website and deploy to Netlify if any docs/content changed
17. Bump the version in `VERSION`, run `scripts/sync-version.sh`, commit all changes
18. Tag and push to trigger the release workflow
19. Monitor the release workflow until all 7 jobs pass (CLI, Plugin ZIP, 4x GUI, Verify)
20. Publish the draft release with release notes summarizing what changed
21. Download and open the macOS aarch64 DMG to verify signing works
