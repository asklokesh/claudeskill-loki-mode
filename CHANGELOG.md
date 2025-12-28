# Changelog

All notable changes to Loki Mode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2025-12-28

### Added
- **Live Output** - Claude's output now streams in real-time using pseudo-TTY
  - Uses `script` command to allocate PTY for proper streaming
  - Visual separator shows when Claude is working
- **Status Monitor** - `.loki/STATUS.txt` updates every 5 seconds with:
  - Current phase
  - Task counts (pending, in-progress, completed, failed)
  - Monitor with: `watch -n 2 cat .loki/STATUS.txt`

### Changed
- Replaced Vibe Kanban auto-launch with simpler status file monitor
- Autonomy runner uses `script` for proper TTY output on macOS/Linux

## [2.3.0] - 2025-12-27

### Added
- **Unified Autonomy Runner** (`autonomy/run.sh`) - Single script that does everything:
  - Prerequisite checks (Claude CLI, Python, Git, curl, Node.js, jq)
  - Skill installation verification
  - `.loki/` directory initialization
  - Autonomous execution with auto-resume
  - ASCII art banner and colored logging
  - Exponential backoff with jitter
  - State persistence across restarts
  - See `autonomy/README.md` for detailed docs

### Changed
- Moved autonomous execution to dedicated `autonomy/` folder (separate from skill)
- Updated README with new Quick Start using `./autonomy/run.sh`
- Release workflow now includes `autonomy/` folder

### Deprecated
- `scripts/loki-wrapper.sh` still works but `autonomy/run.sh` is now recommended

## [2.2.0] - 2025-12-27

### Added
- **Vibe Kanban Integration** - Optional visual dashboard for monitoring agents:
  - `integrations/vibe-kanban.md` - Full integration guide
  - `scripts/export-to-vibe-kanban.sh` - Export Loki tasks to Vibe Kanban format
  - Task status mapping (Loki queues → Kanban columns)
  - Phase-to-column mapping for visual progress tracking
  - Metadata preservation for debugging
  - See [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban)

### Documentation
- README: Added Integrations section with Vibe Kanban setup

## [2.1.0] - 2025-12-27

### Added
- **Autonomous Wrapper Script** (`scripts/loki-wrapper.sh`) - True autonomy with auto-resume:
  - Monitors Claude Code process and detects when session ends
  - Automatically resumes from checkpoint on rate limits or interruptions
  - Exponential backoff with jitter (configurable via environment variables)
  - State persistence in `.loki/wrapper-state.json`
  - Completion detection via orchestrator state or `.loki/COMPLETED` marker
  - Clean shutdown handling with SIGINT/SIGTERM traps
  - Configurable: `LOKI_MAX_RETRIES`, `LOKI_BASE_WAIT`, `LOKI_MAX_WAIT`

### Documentation
- Added True Autonomy section to README explaining wrapper usage
- Documented how wrapper detects session completion and rate limits

## [2.0.3] - 2025-12-27

### Fixed
- **Proper Skill File Format** - Release artifacts now follow Claude's expected format:
  - `loki-mode-X.X.X.zip` / `.skill` - For Claude.ai (SKILL.md at root)
  - `loki-mode-claude-code-X.X.X.zip` - For Claude Code (loki-mode/ folder)

### Improved
- **Installation Instructions** - Separate instructions for Claude.ai vs Claude Code
- **SKILL.md** - Already has required YAML frontmatter with `name` and `description`

## [2.0.2] - 2025-12-27

### Fixed
- **Release Artifact Structure** - Zip now contains `loki-mode/` folder (not `loki-mode-X.X.X/`)
  - Users can extract directly to skills directory without renaming
  - Only includes essential skill files (no .git or .github folders)

### Improved
- **Installation Instructions** - Updated README with clearer extraction steps

## [2.0.1] - 2025-12-27

### Improved
- **Installation Documentation** - Comprehensive installation guide:
  - Explains which file is the actual skill (`SKILL.md`)
  - Shows skill file structure and required files
  - Option 1: Download from GitHub Releases (recommended)
  - Option 2: Git clone
  - Option 3: Minimal install with curl commands
  - Verification steps

## [2.0.0] - 2025-12-27

### Added
- **Example PRDs** - 4 test PRDs for users to try before implementing:
  - `examples/simple-todo-app.md` - Quick functionality test (~10 min)
  - `examples/api-only.md` - Backend agent testing
  - `examples/static-landing-page.md` - Frontend/marketing testing
  - `examples/full-stack-demo.md` - Comprehensive test (~30-60 min)

- **Comprehensive Test Suite** - 53 tests across 6 test files:
  - `tests/test-bootstrap.sh` - Directory structure, state initialization (8 tests)
  - `tests/test-task-queue.sh` - Queue operations, priorities (8 tests)
  - `tests/test-circuit-breaker.sh` - Failure handling, recovery (8 tests)
  - `tests/test-agent-timeout.sh` - Timeout, stuck process handling (9 tests)
  - `tests/test-state-recovery.sh` - Checkpoints, recovery (8 tests)
  - `tests/test-wrapper.sh` - Wrapper script, auto-resume (12 tests)
  - `tests/run-all-tests.sh` - Main test runner

- **Timeout and Stuck Agent Handling** - New section in SKILL.md:
  - Task timeout configuration per action type (build: 10min, test: 15min, deploy: 30min)
  - macOS-compatible timeout wrapper with Perl fallback
  - Heartbeat-based stuck agent detection
  - Watchdog pattern for long operations
  - Graceful termination handling with SIGTERM/SIGKILL

### Changed
- Updated README with example PRDs and test instructions
- Tests are macOS compatible (Perl-based timeout fallback when `timeout` command unavailable)

## [1.1.0] - 2025-12-27

### Fixed
- **macOS Compatibility** - Bootstrap script now works on macOS:
  - Uses `uuidgen` on macOS, falls back to `/proc/sys/kernel/random/uuid` on Linux
  - Fixed `sed -i` syntax for macOS (uses `sed -i ''`)

- **Agent Count** - Fixed README to show correct agent count (37 agents)

- **Username Placeholder** - Replaced placeholder username with actual GitHub username

## [1.0.1] - 2025-12-27

### Changed
- Minor README formatting updates

## [1.0.0] - 2025-12-27

### Added
- **Initial Release** of Loki Mode skill for Claude Code

- **Multi-Agent Architecture** - 37 specialized agents across 6 swarms:
  - Engineering Swarm (8 agents): frontend, backend, database, mobile, API, QA, perf, infra
  - Operations Swarm (8 agents): devops, security, monitor, incident, release, cost, SRE, compliance
  - Business Swarm (8 agents): marketing, sales, finance, legal, support, HR, investor, partnerships
  - Data Swarm (3 agents): ML, engineering, analytics
  - Product Swarm (3 agents): PM, design, techwriter
  - Growth Swarm (4 agents): hacker, community, success, lifecycle
  - Review Swarm (3 agents): code, business, security

- **Distributed Task Queue** with:
  - Priority-based task scheduling
  - Exponential backoff for retries
  - Dead letter queue for failed tasks
  - Idempotency keys for duplicate prevention
  - File-based locking for atomic operations

- **Circuit Breakers** for failure isolation:
  - Per-agent-type failure thresholds
  - Automatic cooldown and recovery
  - Half-open state for testing recovery

- **8 Execution Phases**:
  1. Bootstrap - Initialize `.loki/` structure
  2. Discovery - Parse PRD, competitive research
  3. Architecture - Tech stack selection
  4. Infrastructure - Cloud provisioning, CI/CD
  5. Development - TDD implementation with parallel code review
  6. QA - 14 quality gates
  7. Deployment - Blue-green, canary releases
  8. Business Operations - Marketing, sales, legal setup
  9. Growth Loop - Continuous optimization

- **Parallel Code Review** - 3 reviewers running simultaneously:
  - Code quality reviewer
  - Business logic reviewer
  - Security reviewer

- **State Recovery** - Checkpoint-based recovery for rate limits:
  - Automatic checkpointing
  - Orphaned task detection and re-queuing
  - Agent heartbeat monitoring

- **Deployment Support** for multiple platforms:
  - Vercel, Netlify, Railway, Render
  - AWS (ECS, Lambda, RDS)
  - GCP (Cloud Run, GKE)
  - Azure (Container Apps)
  - Kubernetes (manifests, Helm charts)

- **Reference Documentation**:
  - `references/agents.md` - Complete agent definitions
  - `references/deployment.md` - Cloud deployment guides
  - `references/business-ops.md` - Business operation workflows

[2.4.0]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.0.3...v2.1.0
[2.0.3]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/asklokesh/claudeskill-loki-mode/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/asklokesh/claudeskill-loki-mode/releases/tag/v1.0.0
