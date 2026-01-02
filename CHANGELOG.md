# Changelog

All notable changes to Loki Mode will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.16.0] - 2026-01-02

### Added
- **Model Selection Strategy** - Performance and cost optimization (SKILL.md:78-119):
  - Comprehensive model selection table (Haiku/Sonnet/Opus)
  - Use Haiku 4.5 for simple tasks (tests, docs, commands, fixes)
  - Use Sonnet 4.5 for standard implementation (default)
  - Use Opus 4.5 for complex architecture/planning
  - Speed/cost comparison matrix
  - Haiku task categories checklist (10 common use cases)

- **Haiku Parallelization Examples** - Maximize speed with 10+ concurrent agents (SKILL.md:2748-2806):
  - Parallel unit testing (1 Haiku agent per test file)
  - Parallel documentation (1 Haiku agent per module)
  - Parallel linting (1 Haiku agent per directory)
  - Background task execution with TaskOutput aggregation
  - Performance gain calculations (8x faster with Haiku parallelization)

- **Model Parameter in Task Dispatch Templates** - All templates now include model selection:
  - Updated Task Tool Dispatch template with model parameter (SKILL.md:337)
  - Added 5 concrete examples (Haiku for tests/docs/linting, Sonnet for implementation, Opus for architecture)
  - Updated UNIT_TESTS phase with parallel Haiku execution strategy (SKILL.md:2041-2084)

### Changed
- **Quick Reference** - Added 5th critical step: "OPTIMIZE - Use Haiku for simple tasks" (SKILL.md:19)
- **Agent Spawning Section** - Clarified model selection for implementation agents (SKILL.md:2744)
- **Code Review** - Maintained Opus for security/architecture reviewers, Sonnet for performance

### Performance Impact
- **Unit Testing**: 50 test files × 30s = 25 min (sequential Sonnet) → 3 min (parallel Haiku) = **8x faster**
- **Cost Reduction**: Haiku is cheapest model, using it for 70% of tasks significantly reduces costs
- **Throughput**: 10+ Haiku agents running concurrently vs sequential Sonnet agents

## [2.15.0] - 2026-01-02

### Added
- **Enhanced Quick Reference Section** - Immediate orientation for every turn:
  - Critical First Steps checklist (4-step workflow)
  - Key Files priority table with update frequency
  - Decision Tree flowchart for "What To Do Next?"
  - SDLC Phase Flow diagram (high-level overview)
  - Essential Patterns (one-line quick reference)
  - Common Issues & Solutions troubleshooting table

### Changed
- **Consolidated Redundant Templates** - Improved maintainability:
  - CONTINUITY.md template: Single canonical version (lines 152-190), referenced in bootstrap
  - Task Completion Report: Single canonical template (lines 298-341), all duplicates now reference it
  - Severity-Based Blocking: Detailed table (lines 2639-2647), simplified version references it
- **Improved Navigation** - Better file organization:
  - Added comprehensive Table of Contents with categorized sections
  - Cross-references between related sections
  - Line number references for quick jumps

### Fixed
- Removed duplicate CONTINUITY.md template from bootstrap script (was lines 2436-2470)
- Removed duplicate Task Completion Report from subagent dispatch section (was lines 1731-1764)
- Consolidated severity matrices (removed duplicates, kept one authoritative version)

## [2.14.0] - 2026-01-02

### Added
- **Claude Code Best Practices** - Integrated patterns from "Claude Code in Action" course:

  **CLAUDE.md Generation:**
  - Comprehensive codebase summary generated on bootstrap
  - Included in EVERY Claude request for persistent context
  - Contains: project summary, architecture, key files, critical patterns
  - Auto-updated by agents on significant changes

  **Three Memory Levels:**
  1. **Project Memory**: `.loki/CONTINUITY.md` + `CLAUDE.md` (shared, committed)
  2. **Agent Memory**: `.loki/memory/ledgers/` (per-agent, not committed)
  3. **Global Memory**: `.loki/rules/` (permanent patterns, committed)

  **Plan Mode Pattern:**
  - Research phase (read-only, find all relevant files)
  - Planning phase (create detailed plan, NO code yet)
  - Review checkpoint (get approval before implementing)
  - Implementation phase (execute plan systematically)
  - Use for: multi-file refactoring, architecture decisions, complex features

  **Thinking Mode:**
  - Trigger with "Ultra think" prefix
  - Extended reasoning budget for complex logic
  - Use for: subtle bugs, performance optimization, security assessment, architectural trade-offs

- **Hooks System (Quality Gates)**:

  **Pre-Tool-Use Hooks** - Block execution (exit code 2):
  - Prevent writes to auto-generated files
  - Validate implementation matches spec before write
  - Example: `.loki/hooks/pre-write.sh`

  **Post-Tool-Use Hooks** - Auto-fix after execution:
  - Type checking (TypeScript/mypy) with auto-fix feedback
  - Auto-formatting (Prettier, Black, gofmt)
  - Update CLAUDE.md on architecture changes
  - Example: `.loki/hooks/post-write.sh`

  **Deduplication Hook** - Prevent AI slop:
  - Launches separate Claude instance to detect duplicates
  - Suggests existing functions to reuse
  - Example: `.loki/hooks/post-write-deduplicate.sh`

- **Problem-Solving Workflows**:

  **3-Step Pattern** (for non-trivial tasks):
  1. Identify & Analyze: Grep/Read relevant files, create mental model
  2. Request Planning: Describe feature, get implementation plan (NO CODE)
  3. Implement Plan: Execute systematically, test after each file

  **Test-Driven Development Pattern:**
  1. Context Gathering: Read code, understand patterns, review spec
  2. Test Design: Ask Claude to suggest tests based on spec
  3. Test Implementation: Implement tests → FAIL (red phase)
  4. Implementation: Write code to pass tests → GREEN → refactor

- **Performance Optimization Pattern**:
  - Profile critical paths (benchmarks, profiling tools)
  - Create todo list of optimization opportunities
  - Implement fixes systematically
  - Real example: Chalk library 3.9x throughput improvement

### Changed
- **Directory Structure** - Added:
  - `.loki/hooks/` - Pre/post tool-use hooks for quality gates
  - `.loki/plans/` - Implementation plans (Plan Mode output)

- **Bootstrap Script** - Creates hooks/ and plans/ directories

- **RAR Cycle** - Enhanced with Claude Code patterns:
  - REASON: Read CONTINUITY.md + CLAUDE.md
  - ACT: Use hooks for quality gates
  - REFLECT: Update CONTINUITY.md + CLAUDE.md

### Best Practices
1. **Build incrementally** - Plan mode for architecture, small steps for implementation
2. **Maintain context** - Update CLAUDE.md and CONTINUITY.md continuously
3. **Verify outputs** - Use hooks for automated quality checks
4. **Prevent duplicates** - Deduplication hooks before shipping
5. **Test first** - TDD workflow prevents regressions
6. **Think deeply** - Use "Ultra think" for complex decisions
7. **Block bad writes** - Pre-tool-use hooks enforce quality gates

**"Claude Code functions best as flexible assistant that grows with team needs through tool expansion rather than fixed functionality"**

## [2.13.0] - 2026-01-02

### Added
- **Spec-Driven Development (SDD)** - Specifications as source of truth BEFORE code:

  **Philosophy**: `Spec → Tests from Spec → Code to Satisfy Spec → Validation`

  - OpenAPI 3.1 specifications written FIRST (before architecture/code)
  - Spec is executable contract between frontend/backend
  - Prevents API drift and breaking changes
  - Enables parallel development (frontend mocks from spec)
  - Documentation auto-generated from spec (always accurate)

  **Workflow**:
  1. Parse PRD and extract API requirements
  2. Generate OpenAPI spec with all endpoints, schemas, error codes
  3. Validate spec with Spectral linter
  4. Generate TypeScript types, client SDK, server stubs, docs
  5. Implement contract tests BEFORE implementation
  6. Code implements ONLY what's in spec
  7. CI/CD validates implementation against spec

  **Spec Storage**: `.loki/specs/openapi.yaml`

  **Spec Precedence**: Spec > PRD, Spec > Code, Spec > Documentation

- **Model Context Protocol (MCP) Integration** - Standardized agent communication:

  **Architecture**:
  - Each swarm is an MCP server (engineering, operations, business, data, growth)
  - Orchestrator is MCP client consuming swarm servers
  - Standardized tool/resource exchange protocol
  - Composable, interoperable agents

  **Benefits**:
  1. **Composability**: Mix agents from different sources
  2. **Interoperability**: Work with GitHub Copilot, other AI assistants
  3. **Modularity**: Each swarm is independent, replaceable
  4. **Discoverability**: Listed in GitHub MCP Registry
  5. **Reusability**: Other teams can use Loki agents standalone

  **MCP Servers Implemented**:
  - `loki-engineering-swarm`: Frontend, backend, database, QA agents
    - Tools: implement-feature, run-tests, review-code, refactor-code
    - Resources: loki://engineering/state, loki://engineering/continuity
  - `loki-operations-swarm`: DevOps, security, monitoring agents
    - Tools: deploy-application, run-security-scan, setup-monitoring
  - `loki-business-swarm`: Marketing, sales, legal agents
    - Tools: create-marketing-campaign, generate-sales-materials

  **External MCP Integration**:
  - GitHub MCP (create PRs, manage issues)
  - Playwright MCP (browser automation, E2E tests)
  - Notion MCP (knowledge base, documentation)

  **MCP Directory**: `.loki/mcp/` with servers/, orchestrator.ts, registry.yaml

- **Spec Evolution & Versioning**:
  - Semver for API versions (breaking → major, new endpoints → minor, fixes → patch)
  - Backwards compatibility via multiple version support (/v1, /v2)
  - Breaking change detection in CI/CD
  - 6-month deprecation migration path

- **Contract Testing**:
  - Tests written from spec BEFORE implementation
  - Request/response validation against OpenAPI schema
  - Auto-generated Postman collections
  - Schemathesis integration for fuzz testing

### Changed
- **Phase 2: Architecture** - Now SPEC-FIRST:
  1. Extract API requirements from PRD
  2. Generate OpenAPI 3.1 specification (BEFORE code)
  3. Generate artifacts from spec (types, SDK, stubs, docs)
  4. Select tech stack (based on spec requirements)
  5. Generate infrastructure requirements (from spec)
  6. Create project scaffolding (with contract testing)

- **Directory Structure** - Added new directories:
  - `.loki/specs/` - OpenAPI, GraphQL, AsyncAPI specifications
  - `.loki/mcp/` - MCP server implementations and registry
  - `.loki/logs/static-analysis/` - Static analysis results

- **Bootstrap Script** - Creates specs/ and mcp/ directories

### Philosophy
**"Be the best"** - Integrating top approaches from 2025:

1. **Agentic AI**: Autonomous agents that iterate, recognize errors, fix mistakes in real-time
2. **MCP**: Standardized agent communication for composability across platforms
3. **Spec-Driven Development**: Specifications as executable contracts, not afterthoughts

Loki Mode now combines the best practices from GitHub's ecosystem:
- **Speed**: Autonomous multi-agent development
- **Control**: Static analysis + AI review + spec validation
- **Interoperability**: MCP-compatible agents work with any AI platform
- **Quality**: Spec-first prevents drift, contract tests ensure compliance

"Specifications are the shared source of truth" - enabling parallel development, preventing API drift, and ensuring documentation accuracy.

## [2.12.0] - 2026-01-02

### Added
- **Quality Control Principles** - Integrated GitHub's "Speed Without Control" framework:

  **Principle 1: Guardrails, Not Just Acceleration**
  - Static analysis before AI review (CodeQL, ESLint, Pylint, type checking)
  - Automated detection of unused vars, duplicated logic, code smells
  - Cyclomatic complexity limits (max 15 per function)
  - Secret scanning to prevent credential leaks
  - 5 quality gate categories with blocking rules

  **Principle 2: Structured Prompting for Subagents**
  - All subagent dispatches must include: GOAL, CONSTRAINTS, CONTEXT, OUTPUT FORMAT
  - Goals explain "what success looks like" (not just actions)
  - Constraints define boundaries (dependencies, compatibility, performance)
  - Context includes CONTINUITY.md, ledgers, learnings, architecture decisions
  - Output format specifies deliverables (tests, docs, benchmarks)

  **Principle 3: Document Decisions, Not Just Code**
  - Every completed task requires decision documentation
  - WHY: Problem, root cause, solution chosen, alternatives considered
  - WHAT: Files modified, APIs changed, behavior changes, dependencies
  - TRADE-OFFS: Gains, costs, neutral changes
  - RISKS: What could go wrong, mitigation strategies
  - TEST RESULTS: Unit/integration/performance metrics
  - NEXT STEPS: Follow-up tasks

- **AI Slop Prevention** - Automated detection and blocking:
  - Warning signs: quality degradation, copy-paste duplication, over-engineering
  - Missing error handling, generic variable names, magic numbers
  - Commented-out code, TODO comments without issues
  - Auto-fail and re-dispatch with stricter constraints

- **Two-Stage Code Review**:
  - **Stage 1**: Static analysis (automated) runs first
  - **Stage 2**: AI reviewers (opus/sonnet) only after static analysis passes
  - AI reviewers receive static analysis results as context
  - Prevents wasting AI review time on issues machines can catch

- **Enhanced Task Schema**:
  - `payload.goal` - High-level objective (required)
  - `payload.constraints` - Array of limitations
  - `payload.context` - Related files, ADRs, previous attempts
  - `result.decisionReport` - Complete Why/What/Trade-offs documentation
  - Decision reports archived to `.loki/logs/decisions/`

### Changed
- CODE_REVIEW phase now requires static analysis before AI reviewers
- Subagent dispatch template updated with GOAL/CONSTRAINTS/CONTEXT/OUTPUT
- Task completion requires decision documentation (not just code output)
- Quality gates now include static analysis tools (CodeQL, linters, security scanners)
- Context-Aware Subagent Dispatch section rewritten for structured prompting

### Philosophy
"Speed and control aren't trade-offs. They reinforce each other." - GitHub

AI accelerates velocity but can introduce "AI slop" (semi-functional code accumulating technical debt). Loki Mode now pairs acceleration with visible guardrails: static analysis catches machine-detectable issues, structured prompting ensures intentional development, and decision documentation demonstrates thinking beyond shipping features.

## [2.11.0] - 2026-01-02

### Added
- **CONTINUITY.md Working Memory Protocol** - Inspired by OpenAI's persistent memory pattern:
  - Single working memory file at `.loki/CONTINUITY.md`
  - Read at START of every RAR (Reason-Act-Reflect) cycle
  - Update at END of every RAR cycle
  - Primary source of truth for "what am I doing right now?"

- **Working Memory Template** includes:
  - Active goal and current task tracking
  - Just completed items (last 5)
  - Next actions in priority order
  - Active blockers
  - Key decisions this session
  - Working context and files being modified

- **Memory Hierarchy Clarification**:
  1. `CONTINUITY.md` - Active working memory (every turn)
  2. `ledgers/` - Agent checkpoint state (on milestones)
  3. `handoffs/` - Transfer documents (on agent switch)
  4. `learnings/` - Pattern extraction (on task completion)
  5. `rules/` - Permanent validated patterns

### Changed
- RAR cycle now explicitly reads CONTINUITY.md in REASON phase
- RAR cycle now explicitly updates CONTINUITY.md in REFLECT phase
- Bootstrap script creates initial CONTINUITY.md
- Context Continuity Protocol updated to prioritize CONTINUITY.md
- Directory structure updated to show CONTINUITY.md at root of `.loki/`

### Philosophy
CONTINUITY.md provides a simpler, more explicit "every turn" memory protocol that complements the existing sophisticated memory system. It ensures Claude always knows exactly what it's working on, what just happened, and what needs to happen next.

## [2.10.1] - 2026-01-01

### Fixed
- **API Console Upload** - Added `loki-mode-api-X.X.X.zip` artifact for console.anthropic.com
  - API requires SKILL.md inside a folder wrapper (`loki-mode/SKILL.md`)
  - Claude.ai uses flat structure (`SKILL.md` at root)
  - Updated release workflow to generate both formats
  - Three release artifacts now available:
    - `loki-mode-X.X.X.zip` - for Claude.ai website
    - `loki-mode-api-X.X.X.zip` - for console.anthropic.com
    - `loki-mode-claude-code-X.X.X.zip` - for Claude Code CLI

## [2.10.0] - 2025-12-31

### Added
- **Context Memory Management System** - Inspired by Continuous-Claude-v2:
  - **Ledger-based state preservation** - Save state to `.loki/memory/ledgers/` instead of letting context degrade through compaction
  - **Agent Handoff System** - Clean context transfer between agents at `.loki/memory/handoffs/`
  - **Session Learnings** - Extract patterns and learnings to `.loki/memory/learnings/`
  - **Compound Rules** - Promote proven patterns to permanent rules at `.loki/rules/`
  - **Context Clear Signals** - Agent can request context reset via `.loki/signals/CONTEXT_CLEAR_REQUESTED`

- **Memory Directory Structure**:
  ```
  .loki/memory/
  ├── ledgers/     # Current state per agent
  ├── handoffs/    # Agent-to-agent transfers
  └── learnings/   # Extracted patterns
  .loki/rules/     # Permanent proven rules
  .loki/signals/   # Inter-process communication
  ```

- **Context Injection on Resume** - Wrapper now loads ledger and handoff context when resuming iterations

### Changed
- Prompts now include memory management instructions
- Wrapper initializes memory directory structure
- Build prompt includes ledger/handoff content for continuity

### Philosophy
Instead of "degrade gracefully through compression", Loki Mode now uses "reset cleanly with memory preservation" - ensuring perfect context continuity across unlimited iterations.

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
