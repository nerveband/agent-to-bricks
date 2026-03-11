# Implementation Prompt

Copy-paste this into Claude Code when you want a coding session to implement changes and validate the right build/test surface before handing work back:

---

Implement the requested changes end to end, then run the relevant verification and docs updates for every touched surface. Prefer the repo scripts and `make` targets over ad hoc command sequences. Do these steps:

**Environment and guardrails:**
1. Load repo-local env if present (`.env`) and treat `.env.example` as the source of truth for required staging vars.
2. Treat `docs/test-data/` as local/private fixture space. If proprietary Bricks templates exist locally, use them for validation. If they are absent, skip cleanly and say so.
3. Do not release unless explicitly asked. For release work, follow `prompts/release.md`.

**Before editing:**
4. Inspect the touched subsystem first (`cli/`, `plugin/`, `gui/`, `website/`, `tests/`, `scripts/`) and identify the smallest meaningful verification set for the change.
5. If the change affects staging env, install flow, fixture IDs, or test orchestration, treat it as process work and update the matching scripts/docs/prompts together.
6. Treat the repo's core philosophy as part of the acceptance criteria:
   - Keep public surfaces contract-first and machine-readable in the ShipTypes sense
   - Preserve or improve the agent-DX CLI qualities: structured JSON I/O, raw payload input, schema validation, stable errors, pagination/field selection, and safety rails
   - Do not rewrite structured strings with naive regex or delimiter splits when valid CSS/HTML/JSON/URL content could be corrupted

**Required baseline checks for product code changes:**
7. Run `make check-version` if you touched any public contract, docs examples, or versioned assets such as `cli/schema.json`.
8. Run `make test` for CLI and shared Go coverage when anything under `cli/`, `tests/e2e/`, `scripts/`, or `schema/` changes.
9. Run `make lint` when Go code changes.
10. Run `cd cli && go run . schema --validate` when CLI commands, flags, payloads, or schemas change.
11. Run PHP lint on touched plugin files, or on all plugin PHP files if the plugin surface changed broadly: `find plugin -name "*.php" -exec php -l {} \;`
12. Run `cd gui && npx tsc --noEmit` when anything under `gui/` changes.
13. Run `cd website && npm run build` when anything under `website/` changes or when docs/content changed enough to risk a broken build.

**Staging and integration checks:**
14. If the change affects live API behavior, plugin deployment, snapshots, templates, GUI E2E, or end-to-end flows, prefer `./scripts/verify-staging-release.sh` when staging credentials are available.
15. If you only need a narrower staging pass, use the smallest matching scripts:
    - `./scripts/deploy-staging.sh`
    - `./tests/plugin/run-staging-suite.sh`
    - `./tests/e2e/test-full-workflow.sh`
    - `./tests/e2e/test-template-smoke.sh`
    - `./gui/e2e/run-tests.sh`
16. If staging SSH is backed by the 1Password agent on this machine, unlock/approve the key prompt before retrying deploy or runner scripts.
17. Any staging mutation test must leave staging reusable. Use snapshots/rollback or equivalent cleanup and confirm the cleanup happened.

**Private corpus and conversion coverage:**
18. If templates, Frames parsing, composition, or conversion logic changed, use the local/private `docs/test-data/templates` corpus when available.
19. For those changes, confirm both:
    - offline/local validation still passes or skips cleanly in public clones
    - staging smoke uses representative real fixtures when the corpus is available locally

**Docs and prompt sync:**
20. Update matching docs in `website/src/content/docs/` for any CLI, GUI, or plugin user-facing change.
21. Update `.env.example`, `README.md`, `CHANGELOG.md`, and `website/src/components/home/HeroSection.astro` when staging/install/release-facing behavior changes.
22. If you change the expected build, install, staging, release workflow, or core agent-facing philosophy, update the prompt docs under `prompts/` and align `AGENTS.md` so future AI sessions inherit the same process.

**Reporting:**
23. Report the code changes, the exact verification you ran, what was skipped because private fixtures or staging creds were unavailable, any ShipTypes/agent-DX regressions you prevented or improved, and any remaining risks.
