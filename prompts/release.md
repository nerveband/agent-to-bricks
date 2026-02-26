# Release Prompt

Copy-paste this into Claude Code after you're done with your changes and ready to release:

---

Run the full pre-release check and release pipeline. Do these steps:

1. Run `scripts/sync-version.sh --check` to verify version consistency
2. Run `cd cli && go test ./...` for CLI tests
3. Run `cd gui && npx tsc --noEmit` for GUI type check
4. Run PHP lint on plugin files
5. Run `cd website && npm run build` to verify website builds
6. If anything changed in website/, rebuild and deploy to Netlify
7. If all checks pass, bump the version if needed, commit, tag, and push to trigger the release workflow
8. Monitor the release workflow until all jobs pass, then publish the draft release
9. Download and open the macOS aarch64 DMG to verify it works
