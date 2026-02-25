# Agent to Bricks — Learnings

## [LRN-20260221-001] correction

**Logged**: 2026-02-21T05:10:00Z
**Priority**: critical
**Status**: promoted
**Promoted**: MEMORY.md, agents.md
**Area**: infra

### Summary
NEVER assume SSH_HOST in .env is correct. Always verify server identity before any action.

### Details
The .env file pointed to the wrong server (198.23.148.52 instead of 23.94.202.65). This caused plugin deployment to a production site that should never have been touched. The user's staging site (ts-staging.wavedepth.com) lives on a completely different server than the one in .env.

Two RunCloud servers with similar setups (both have `runcloud` user, similar directory structure) made it easy to not notice the mismatch.

### Suggested Action
1. Always verify: `ssh <host> "hostname && ls /home/runcloud/webapps/"` before deploying
2. Cross-reference domain DNS resolution with SSH target IP
3. Add server identity check to deploy script

### Metadata
- Source: user_feedback (user caught the mistake)
- Related Files: .env, scripts/deploy-staging.sh
- Tags: server-identity, deployment-safety, critical
- See Also: ERR-20260221-001

---

## [LRN-20260221-002] best_practice

**Logged**: 2026-02-21T05:15:00Z
**Priority**: high
**Status**: promoted
**Promoted**: agents.md
**Area**: infra

### Summary
RunCloud server architecture: each web app has its own nginx server block and PHP-FPM pool

### Details
- Nginx config: `/etc/nginx-rc/conf.d/<WebAppName>.d/main.conf`
- Domains: `/etc/nginx-rc/conf.d/<WebAppName>.domains.d/*.conf`
- FPM socket: `/var/run/<WebAppName>.sock`
- To find which PHP version serves a site: `lsof /var/run/<WebAppName>.sock`
- `systemctl list-units | grep php.*fpm` lists all PHP-FPM services
- Nginx-RC must be reloaded after config changes: `systemctl reload nginx-rc`

### Metadata
- Source: investigation
- Tags: runcloud, nginx, php-fpm, infrastructure

---

## [LRN-20260221-003] best_practice

**Logged**: 2026-02-21T05:15:00Z
**Priority**: high
**Status**: promoted
**Promoted**: agents.md
**Area**: config

### Summary
The .env file is NOT in git and persists across sessions — always validate before using

### Details
The .env file was set up in a previous session with incorrect values. Since it's gitignored, there's no version history or review. Values can be stale or wrong from previous work by different agents or in different contexts.

### Suggested Action
At session start, if using .env values for SSH or deployment, verify at least:
1. SSH_HOST resolves/connects to expected server
2. WP_PATH exists on that server
3. Domain in WP_STAGING_URL actually points to that server's IP

### Metadata
- Source: error
- Related Files: .env, .gitignore
- Tags: configuration, safety

---

## [LRN-20260221-004] knowledge_gap

**Logged**: 2026-02-21T04:00:00Z
**Priority**: medium
**Status**: promoted
**Promoted**: agents.md
**Area**: infra

### Summary
OPcache CLI reset does NOT affect web FPM process — they are separate

### Details
`opcache_reset()` called via WP-CLI only clears the CLI PHP process OPcache. The web-serving PHP-FPM has its own separate OPcache that can only be cleared by:
1. Restarting the FPM service: `systemctl restart php84rc-fpm`
2. Or calling `opcache_reset()` from within a web request (which itself might be cached)

### Metadata
- Source: debugging
- Tags: opcache, php-fpm, caching

---

## [LRN-20260221-005] best_practice

**Logged**: 2026-02-21T05:20:00Z
**Priority**: medium
**Status**: pending
**Area**: backend

### Summary
ATB_API_Auth::generate_key() takes ($user_id, $label), not just ($label)

### Details
The function signature is `generate_key($user_id, $label = '')`. It returns a raw key string, not an array. Don't try to access `$result['key']`.

### Metadata
- Source: error
- Related Files: plugin/agent-to-bricks/includes/class-api-auth.php
- Tags: api, authentication

---
