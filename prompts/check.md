# Quick Check Prompt

Copy-paste this into Claude Code to verify everything builds and docs are up to date:

---

Run all CI checks, a docs/content audit, and cross-link verification. Do these steps:

**Build checks:**
1. Run `make check-version` to verify version consistency
2. Run `make test` for CLI tests
3. Run `make lint` for Go vet/lint
4. Run `cd gui && npx tsc --noEmit` for GUI type check
5. Run PHP lint on plugin files: `find plugin -name "*.php" -exec php -l {} \;`
6. Run `cd website && npm run build` to verify website builds

**Plugin functional tests (if staging is deployed):**
7. Run the plugin test suite on staging via WP-CLI: for each file in `tests/plugin/test-*-runner.php`, run it with `wp eval-file` on the staging server. Report any failures.

**Docs & content audit:**
8. Check `git diff --name-only HEAD~5` to see what changed recently
9. For any CLI, GUI, or plugin changes: check if the matching docs in `website/src/content/docs/` need updating (new commands, changed flags, new features, changed behavior, removed features)
10. Check if the homepage sections in `website/src/components/home/` reference outdated features or are missing new ones
11. Check if `README.md` changelog/feature list reflects recent changes

**Cross-link & URL verification:**
12. Grep all URLs in CLI source (cmd/*.go), GUI source (src/), and plugin source (includes/) that point to agenttobricks.com — verify each target page exists in `website/src/content/docs/` or `website/src/pages/`
13. Check that the plugin settings page links and CLI help text URLs are not broken

**Website preview (if website changed):**
14. If any files under `website/` changed, build the website and deploy a preview:
    - `cd website && npm run build`
    - `cd website && npx netlify deploy --dir=dist` (draft/preview deploy)
    - Share the preview URL for review
    - After review is approved, deploy to production: `cd website && npx netlify deploy --dir=dist --prod`

**Staging verification (if plugin changed):**
15. If plugin files changed, deploy to staging and verify the API returns 200: `curl -s -o /dev/null -w "%{http_code}" -H "X-ATB-Key: <key-from-config>" "https://ts-staging.wavedepth.com/wp-json/agent-bricks/v1/site/info"`

**Known test limitations:**
- Plugin functional tests run via WP-CLI `wp eval-file`. Some endpoints return 403 `rest_forbidden` in WP-CLI context because the internal REST dispatch lacks full capabilities. This affects elements, snapshots, and components write endpoints. These are WP-CLI permission limitations, not plugin bugs. The affected suites: `test-elements-runner.php`, `test-snapshots-runner.php`, `test-components-runner.php` (partial), `test-api-auth-runner.php` (REST dispatch test), `test-templates-runner.php` (DELETE). Suites that should always pass: `test-classes-runner.php`, `test-element-types-runner.php`, `test-search-runner.php`, `test-site-runner.php`.

Report what passes, what fails, and what docs need updating.
