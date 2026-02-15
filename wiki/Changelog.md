# Changelog

For the complete release history and detailed changes, see the main [CHANGELOG.md](../CHANGELOG.md) in the repository root.

## Recent Releases

### [5.42.2] - 2026-02-15

Changed:
- Autonomi parent brand added across all surfaces (README, SKILL.md, Dockerfiles, package.json, wiki, docs, VSCode extension)
- GitHub Pages redirects to autonomi.dev
- Homepage URL updated to autonomi.dev
- Re-recorded demo with full v5.42 feature showcase (CLI, dashboard, agents, council, memory)
- GitHub Pages color palette updated to indigo/blurple design system

### [5.42.1] - 2026-02-14

Fixed:
- Orphan dashboard process: added async watchdog that checks session PID every 30s and self-terminates if session is gone (prevents dashboard surviving after SIGKILL)

### [5.42.0] - 2026-02-14

Fixed:
- Cost tab always showing zeros: efficiency files now include token counts from context tracker
- Learning tab empty: success patterns and tool efficiency now read from `.loki/learning/signals/`
- Cost API fallback reads `.loki/context/tracking.json` instead of nonexistent `state.tokens`
- Token totals added to `dashboard-state.json` for overview display
- `track_context_usage()` now runs BEFORE efficiency file write so token data is available
- Learning metrics, trends, signals, aggregation all merge data from both event bus and signals directory

### [5.41.0] - 2026-02-13

Added:
- GitHub sync-back: `sync_github_status()` wired into iteration loop and session lifecycle
- GitHub PR creation: `create_github_pr()` called on successful session end (`LOKI_GITHUB_PR=true`)
- GitHub task export: `export_tasks_to_github()` available via CLI
- Deduplication log at `.loki/github/synced.log` prevents duplicate issue comments
- `sync_github_completed_tasks()` batch syncs all completed GitHub tasks after each iteration
- `sync_github_in_progress_tasks()` notifies GitHub when imported issues are being worked on
- `loki github` CLI command with 4 subcommands: sync, export, pr, status
- Dashboard API: `/api/github/status`, `/api/github/tasks`, `/api/github/sync-log`
- Comprehensive CLI reference wiki with copy-paste examples for all commands

Fixed:
- Misleading "API credits" wording in no-PRD confirmation prompt
- GitHub integration status changed from "Planned" to "Implemented" in SKILL.md

### [5.40.1] - 2026-02-13

Fixed:
- OIDC JWT signature validation - fail-closed by default, explicit opt-in for skip
- Provider allowlist and PRD path traversal validation in control API
- Rate limiter memory leak - key eviction with max_keys=10000 limit
- WebSocket connection limit - configurable MAX_CONNECTIONS (default 100)
- Dashboard log stream memory leak - proper event listener cleanup in disconnectedCallback
- Cross-platform millisecond timestamps in event emitter (GNU date, python3, fallback)
- Events.jsonl streaming with 10MB/10000 event size limits to prevent OOM
- Registry discovery max_depth bounded to 1-10 range
- Flock-based session locking to prevent TOCTOU race conditions (with PID fallback)
- Atomic JSON writes with fcntl.flock for control API state files
- Bash validation hook: additional bypass pattern detection
- Telemetry file permissions set to 0600 for sensitive data
- API client global listener cleanup to prevent memory leaks on destroy
- Rate limiting on token/sync/aggregate/ws read endpoints
- Registry symlink traversal prevention
- SHA-256 instead of MD5 for project ID hashing
- Events.jsonl 50MB log rotation with single backup

---

For complete version history, detailed changes, and older releases, see [CHANGELOG.md](../CHANGELOG.md).
