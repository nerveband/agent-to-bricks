# Agent to Bricks — Error Log

## [ERR-20260221-001] deploy_to_wrong_server

**Logged**: 2026-02-21T05:10:00Z
**Priority**: critical
**Status**: resolved
**Area**: infra

### Summary
Plugin deployed to Tayseer Seminary production server instead of staging server due to wrong SSH_HOST in .env

### Error
```
.env had SSH_HOST="runcloud@198.23.148.52" (Tayseer Seminary server)
Correct value: SSH_HOST="runcloud@23.94.202.65" (Ashraf's personal server)
```

### Context
- ts-staging.wavedepth.com resolves to 23.94.202.65 (Ashraf's personal RunCloud server)
- 198.23.148.52 is the Tayseer Seminary RunCloud server (tayseerwilderness.org)
- Both servers use RunCloud with user `runcloud`
- Plugin was installed, activated, API keys generated on the wrong server
- Test page 2005 was also created on wrong server in earlier session

### Suggested Fix
Always verify server identity before deploy:
```bash
ssh runcloud@<IP> "ls /home/runcloud/webapps/ | grep -i staging"
# Must show TS-Staging for the correct server
```

### Resolution
- **Resolved**: 2026-02-21T05:15:00Z
- **Notes**: Plugin removed, options deleted, post meta cleaned, .env corrected

### Metadata
- Reproducible: yes (if .env has wrong IP)
- Related Files: .env, scripts/deploy-staging.sh
- Tags: deployment, server-identity, critical-mistake

---

## [ERR-20260221-002] opcache_stale_after_deploy

**Logged**: 2026-02-21T03:00:00Z
**Priority**: high
**Status**: resolved
**Area**: infra

### Summary
PHP-FPM OPcache with validate_timestamps=0 causes deployed code to never be picked up

### Error
```
Web routes return 404 after deploying new PHP files
WP-CLI shows routes registered correctly
opcache_reset() via CLI only clears CLI process, not FPM process
```

### Context
- RunCloud PHP-FPM has opcache.validate_timestamps=0
- This means file changes are NEVER auto-detected
- Must restart php84rc-fpm service as root

### Suggested Fix
Add FPM restart to deploy script, or always run after deploy:
```bash
ssh root@23.94.202.65 "systemctl restart php84rc-fpm"
```

### Resolution
- **Resolved**: 2026-02-21T05:03:00Z
- **Notes**: Fixed by restarting php84rc-fpm as root on correct server

### Metadata
- Reproducible: yes (every deploy)
- Related Files: scripts/deploy-staging.sh
- Tags: opcache, php-fpm, runcloud

---

## [ERR-20260221-003] wp_cli_stdin_via_ssh

**Logged**: 2026-02-21T01:00:00Z
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary
`wp eval-file /dev/stdin` fails via SSH with "No such file or directory"

### Error
```
Error: /dev/stdin - open failed.
```

### Suggested Fix
Use temp files instead:
```bash
ssh user@host "cat > /tmp/script.php << 'EOF'
<?php // code here
EOF
cd /path/to/wp && php wp eval-file /tmp/script.php && rm /tmp/script.php"
```

### Metadata
- Reproducible: yes
- Tags: wp-cli, ssh

---
