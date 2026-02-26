# Quick Check Prompt

Copy-paste this into Claude Code to verify everything builds and docs are up to date:

---

Run all CI checks, a docs/content audit, and cross-link verification. Do these steps:

**Build checks:**
1. Run `scripts/sync-version.sh --check` to verify version consistency
2. Run `cd cli && go test ./...` for CLI tests
3. Run `cd gui && npx tsc --noEmit` for GUI type check
4. Run PHP lint on plugin files
5. Run `cd website && npm run build` to verify website builds

**Docs & content audit:**
6. Check `git diff --name-only HEAD~5` to see what changed recently
7. For any CLI, GUI, or plugin changes: check if the matching docs in `website/src/content/docs/` need updating (new commands, changed flags, new features, changed behavior, removed features)
8. Check if the homepage sections in `website/src/components/home/` reference outdated features or are missing new ones
9. Check if `README.md` changelog/feature list reflects recent changes

**Cross-link & URL verification:**
10. Grep all URLs in CLI source (cmd/*.go), GUI source (src/), and plugin source (includes/) that point to agenttobricks.com — verify each target page exists in `website/src/content/docs/` or `website/src/pages/`
11. Check that the plugin settings page links and CLI help text URLs are not broken

**Staging verification (if plugin changed):**
12. If plugin files changed, deploy to staging and verify the API returns 200: `curl -s -o /dev/null -w "%{http_code}" -H "X-ATB-Key: atb_wZGm30TSSWgcUkSxgRR4Me0stdQDE8GioUoVbXT0" "https://ts-staging.wavedepth.com/wp-json/agent-bricks/v1/site/info"`

Report what passes, what fails, and what docs need updating.
