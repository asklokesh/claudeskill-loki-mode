# Changelog

All notable changes to Loki Mode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.9.1] - 2025-12-31

### Fixed
- **Immediate continuation on success** - Successful iterations (exit code 0) now continue immediately
- No more 17+ minute waits between successful iterations
- Exponential backoff only applies to errors or rate limits

## [2.9.0] - 2025-12-31

### Added
- **Ralph Wiggum Mode** - True perpetual autonomous operation:
  - Reason-Act-Reflect (RAR) cycle for every iteration
  - Products are NEVER "complete" - always improvements to make
  - Stripped all interactive safety gates
  - Perpetual loop continues even when Claude claims completion

- **Perpetual Improvement Loop** - New philosophy:
  - Claude never declares "done" - there's always more to improve
  - When queue empties: find new improvements, run SDLC phases again, hunt bugs
  - Only stops on: max iterations, explicit completion promise, or user interrupt

- **New Environment Variables**:
  - `LOKI_COMPLETION_PROMISE` - EXPLICIT stop condition (must output exact text)
  - `LOKI_MAX_ITERATIONS` - Safety limit (default: 1000)
  - `LOKI_PERPETUAL_MODE` - Ignore ALL completion signals (default: false)

- **Completion Promise Detection** - Only stops when Claude outputs the exact promise text
  - Example: `LOKI_COMPLETION_PROMISE="ALL TESTS PASSING 100%"`
  - Claude must explicitly output "COMPLETION PROMISE FULFILLED: ALL TESTS PASSING 100%"

### Changed
- Default behavior now runs perpetually until max iterations
- Removed auto-completion based on "finalized" phase (was allowing hallucinated completion)
- Prompts now emphasize never stopping, always finding improvements
- SKILL.md completely rewritten for Ralph Wiggum Mode philosophy

## [2.8.1] - 2025-12-29

### Fixed
- **Dashboard showing all 0s** - Added explicit instructions to SKILL.md to use queue JSON files instead of TodoWrite tool
- Claude now properly populates `.loki/queue/*.json` files for live dashboard tracking
- Added queue system usage guide with JSON format and examples

### Changed
- SKILL.md now explicitly prohibits TodoWrite in favor of queue system
- Added "Task Management: Use Queue System" section with clear examples

## [2.8.0] - 2025-12-29

### Added
- **Smart Rate Limit Detection** - Automatically detects rate limit messages and waits until reset:
  - Parses "resets Xam/pm" from Claude output
  - Calculates exact wait time until reset (+ 2 min buffer)
  - Shows human-readable countdown (e.g., "4h 30m")
  - Longer countdown intervals for multi-hour waits (60s vs 10s)
  - No more wasted retry attempts during rate limits

### Changed
- Countdown display now shows human-readable format (e.g., "Resuming in 4h 28m...")

## [2.7.0] - 2025-12-28

### Added
- **Codebase Analysis Mode** - When no PRD is provided, Loki Mode now:
  1. **Auto-detects PRD files** - Searches for `PRD.md`, `REQUIREMENTS.md`, `SPEC.md`, `PROJECT.md` and docs variants
  2. **Analyzes existing codebase** - If no PRD found, performs comprehensive codebase analysis:
     - Scans directory structure and identifies tech stack
     - Reads package.json, requirements.txt, go.mod, etc.
     - Examines README and entry points
     - Identifies current features and architecture
  3. **Generates PRD** - Creates `.loki/generated-prd.md` with:
     - Project overview and current state
     - Inferred requirements from implementation
     - Identified gaps (missing tests, security, docs)
     - Recommended improvements
  4. **Proceeds with SDLC** - Uses generated PRD as baseline for all testing phases

### Fixed
- Dashboard 404 errors - Server now runs from `.loki/` root to properly serve queue/state JSON files
- Updated dashboard URL to `/dashboard/index.html`

## [2.6.0] - 2025-12-28

### Added
- **Complete SDLC Testing Phases** - 11 comprehensive testing phases (all enabled by default):
  - `UNIT_TESTS` - Run existing unit tests with coverage
  - `API_TESTS` - Functional API testing with real HTTP requests
  - `E2E_TESTS` - End-to-end UI testing with Playwright/Cypress
  - `SECURITY` - OWASP scanning, auth flow verification, dependency audit
  - `INTEGRATION` - SAML, OIDC, Entra ID, Slack, Teams testing
  - `CODE_REVIEW` - 3-reviewer parallel code review (Security, Architecture, Performance)
  - `WEB_RESEARCH` - Competitor analysis, feature gap identification
  - `PERFORMANCE` - Load testing, benchmarking, Lighthouse audits
  - `ACCESSIBILITY` - WCAG 2.1 AA compliance testing
  - `REGRESSION` - Compare against previous version, detect regressions
  - `UAT` - User acceptance testing simulation, bug hunting
- **Phase Skip Options** - Each phase can be disabled via environment variables:
  - `LOKI_PHASE_UNIT_TESTS=false` to skip unit tests
  - `LOKI_PHASE_SECURITY=false` to skip security scanning
  - etc.

### Changed
- Prompt now includes `SDLC_PHASES_ENABLED: [...]` to inform Claude which phases to execute
- SKILL.md updated with detailed instructions for each SDLC phase

## [2.5.0] - 2025-12-28

### Added
- **Real-time Streaming Output** - Claude's output now streams live using `--output-format stream-json`
  - Parses JSON stream in real-time to display text, tool calls, and results
  - Shows `[Tool: name]` when Claude uses a tool
  - Shows `[Session complete]` when done
- **Web Dashboard** - Visual task board with Anthropic design language
  - Cream/beige background with coral (#D97757) accents matching Anthropic branding
  - Auto-starts at `http://127.0.0.1:57374` and opens in browser
  - Shows task counts and Kanban-style columns (Pending, In Progress, Completed, Failed)
  - Auto-refreshes every 3 seconds
  - Disable with `LOKI_DASHBOARD=false`
  - Configure port with `LOKI_DASHBOARD_PORT=<port>`

### Changed
- Replaced `--print` mode with `--output-format stream-json --verbose` for proper streaming
- Python-based JSON parser extracts and displays Claude's responses in real-time
- Simple HTML dashboard replaces Vibe Kanban (no external dependencies)

### Fixed
- Live output now actually streams (was buffered until completion in 2.4.0)
- Completion detection now recognizes `finalized` and `growth-loop` phases
- Prompt now explicitly instructs Claude to act autonomously without asking questions
- Added `.loki/COMPLETED` marker file detection for clean exit

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
