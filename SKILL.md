---
name: loki-mode
description: Multi-agent autonomous startup system for Claude Code. Triggers on "Loki Mode". Orchestrates 100+ specialized agents across engineering, QA, DevOps, security, data/ML, business operations, marketing, HR, and customer success. Takes PRD to fully deployed, revenue-generating product with zero human intervention. Features Task tool for subagent dispatch, parallel code review with 3 specialized reviewers, severity-based issue triage, distributed task queue with dead letter handling, automatic deployment to cloud providers, A/B testing, customer feedback loops, incident response, circuit breakers, and self-healing. Handles rate limits via distributed state checkpoints and auto-resume with exponential backoff. Requires --dangerously-skip-permissions flag.
---

# Loki Mode - Multi-Agent Autonomous Startup System

> **Version 2.18.0** | PRD to Production | Zero Human Intervention

---

## Quick Reference

### Critical First Steps (Every Turn)
1. **READ** `.loki/CONTINUITY.md` - Your working memory + "Mistakes & Learnings"
2. **CHECK** `.loki/state/orchestrator.json` - Current phase/metrics
3. **REVIEW** `.loki/queue/pending.json` - Next tasks
4. **FOLLOW** RARV cycle: REASON, ACT, REFLECT, **VERIFY** (test your work!)
5. **OPTIMIZE** Use Haiku for simple tasks (tests, docs, commands) - 10+ agents in parallel
6. **LEARN** When errors occur: Update "Mistakes & Learnings", retry with context

### Key Files (Priority Order)
| File | Purpose | Update When |
|------|---------|-------------|
| `.loki/CONTINUITY.md` | Working memory - what am I doing NOW? | Every turn |
| `.loki/specs/openapi.yaml` | API spec - source of truth | Architecture changes |
| `CLAUDE.md` | Project context - arch & patterns | Significant changes |
| `.loki/queue/*.json` | Task states | Every task change |

### Decision Tree: What To Do Next?

```
START
  |
  +-- Read CONTINUITY.md ----------+
  |                                |
  +-- Task in-progress?            |
  |   +-- YES: Resume              |
  |   +-- NO: Check pending queue  |
  |                                |
  +-- Pending tasks?               |
  |   +-- YES: Claim highest priority
  |   +-- NO: Check phase completion
  |                                |
  +-- Phase done?                  |
  |   +-- YES: Advance to next phase
  |   +-- NO: Generate tasks for phase
  |                                |
LOOP <-----------------------------+
```

### SDLC Phase Flow

```
Bootstrap -> Discovery -> Architecture -> Infrastructure
     |           |            |              |
  (Setup)   (Analyze PRD)  (Design)    (Cloud/DB Setup)
                                             |
Development <- QA <- Deployment <- Business Ops <- Growth Loop
     |         |         |            |            |
 (Build)    (Test)   (Release)    (Monitor)    (Iterate)
```

### Essential Patterns

**Spec-First:** `OpenAPI -> Tests -> Code -> Validate`
**Code Review:** `Static Analysis (BLOCK) -> 3 AI Reviewers -> Merge`
**Quality Gates:** `Pre-Hook (BLOCK) -> Write -> Post-Hook (FIX)`
**Problem Solving:** `Analyze -> Plan (NO CODE) -> Implement`
**Self-Verification:** `Code -> Test -> Fail -> Learn -> Update CONTINUITY.md -> Retry`

---

## Prerequisites

```bash
# Launch with autonomous permissions
claude --dangerously-skip-permissions
```

---

## Core Autonomy Rules

**This system runs with ZERO human intervention.**

1. **NEVER ask questions** - No "Would you like me to...", "Should I...", or "What would you prefer?"
2. **NEVER wait for confirmation** - Take immediate action
3. **NEVER stop voluntarily** - Continue until completion promise fulfilled
4. **NEVER suggest alternatives** - Pick best option and execute
5. **ALWAYS use RARV cycle** - Every action follows Reason-Act-Reflect-Verify

---

## RARV Cycle (Every Iteration)

```
+-------------------------------------------------------------------+
| REASON: What needs to be done next?                               |
| - READ .loki/CONTINUITY.md first (working memory)                 |
| - READ "Mistakes & Learnings" to avoid past errors                |
| - Check orchestrator.json, review pending.json                    |
| - Identify highest priority unblocked task                        |
+-------------------------------------------------------------------+
| ACT: Execute the task                                             |
| - Dispatch subagent via Task tool OR execute directly             |
| - Write code, run tests, fix issues                               |
| - Commit changes atomically (git checkpoint)                      |
+-------------------------------------------------------------------+
| REFLECT: Did it work? What next?                                  |
| - Verify task success (tests pass, no errors)                     |
| - UPDATE .loki/CONTINUITY.md with progress                        |
| - Check completion promise - are we done?                         |
+-------------------------------------------------------------------+
| VERIFY: Let AI test its own work (2-3x quality improvement)       |
| - Run automated tests (unit, integration, E2E)                    |
| - Check compilation/build (no errors or warnings)                 |
| - Verify against spec (.loki/specs/openapi.yaml)                  |
|                                                                   |
| IF VERIFICATION FAILS:                                            |
|   1. Capture error details (stack trace, logs)                    |
|   2. Analyze root cause                                           |
|   3. UPDATE CONTINUITY.md "Mistakes & Learnings"                  |
|   4. Rollback to last good git checkpoint (if needed)             |
|   5. Apply learning and RETRY from REASON                         |
+-------------------------------------------------------------------+
```

---

## Model Selection Strategy

**CRITICAL: Sonnet 4.5 is DEFAULT. Use Haiku for simple tasks to optimize speed/cost.**

| Model | Use For | Examples |
|-------|---------|----------|
| **Sonnet 4.5** | DEFAULT - All standard implementation | Feature implementation, API endpoints, bug fixes, integration tests |
| **Haiku 4.5** | OPTIMIZATION - Simple/parallelizable | Unit tests, docs, bash commands, formatting, linting, file operations |
| **Opus 4.5** | COMPLEX - Architecture & security | System design, security reviews, complex debugging, architecture decisions |

### Task Tool Model Parameter
```python
# Haiku for simple tasks (PREFER THIS for speed)
Task(subagent_type="general-purpose", model="haiku", description="Run unit tests", prompt="...")

# Sonnet for standard tasks (default)
Task(subagent_type="general-purpose", description="Implement API endpoint", prompt="...")

# Opus for complex tasks (use sparingly)
Task(subagent_type="Plan", model="opus", description="Design system architecture", prompt="...")
```

### Haiku Task Categories (Use Extensively)
- Writing/running unit tests
- Generating documentation
- Running bash commands (npm install, git operations)
- Simple bug fixes (typos, imports, formatting)
- File operations, linting, static analysis
- Simple data transformations, boilerplate generation

### Parallelization Strategy
```python
# Launch 10+ Haiku agents in parallel for test suite
for test_file in test_files:
    Task(subagent_type="general-purpose", model="haiku",
         description=f"Run tests: {test_file}",
         run_in_background=True)
```

---

## Structured Prompting for Subagents

**Every subagent dispatch MUST include:**

```markdown
## GOAL (What success looks like)
[High-level objective, not just the action]
Example: "Refactor authentication for maintainability and testability"
NOT: "Refactor the auth file"

## CONSTRAINTS (What you cannot do)
- No third-party dependencies without approval
- Maintain backwards compatibility with v1.x API
- Keep response time under 200ms

## CONTEXT (What you need to know)
- Related files: [list with brief descriptions]
- Previous attempts: [what was tried, why it failed]

## OUTPUT FORMAT (What to deliver)
- [ ] Pull request with Why/What/Trade-offs description
- [ ] Unit tests with >90% coverage
- [ ] Update API documentation

## WHEN COMPLETE
Report back with: WHY, WHAT, TRADE-OFFS, RISKS
```

---

## Quality Gates

**Never ship code without passing all quality gates:**

1. **Static Analysis** - CodeQL, ESLint/Pylint, type checking
2. **3-Reviewer Parallel System** - Security (opus), Architecture (opus), Performance (sonnet)
3. **Severity-Based Blocking** - Critical/High/Medium = BLOCK; Low/Cosmetic = TODO comment
4. **Test Coverage Gates** - Unit: 100% pass, >80% coverage; Integration: 100% pass

See `references/quality-control.md` for full details.

---

## Agent Types Overview

Loki Mode has 37 specialized agent types across 7 swarms. The orchestrator spawns only agents needed for your project.

| Swarm | Agent Count | Examples |
|-------|-------------|----------|
| Engineering | 8 | frontend, backend, database, mobile, api, qa, perf, infra |
| Operations | 8 | devops, sre, security, monitor, incident, release, cost, compliance |
| Business | 8 | marketing, sales, finance, legal, support, hr, investor, partnerships |
| Data | 3 | ml, data-eng, analytics |
| Product | 3 | pm, design, techwriter |
| Growth | 4 | growth-hacker, community, success, lifecycle |
| Review | 3 | code, business, security |

See `references/agent-types.md` for complete definitions and capabilities.

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Agent stuck/no progress | Lost context | Read `.loki/CONTINUITY.md` first thing every turn |
| Task repeating | Not checking queue state | Check `.loki/queue/*.json` before claiming |
| Code review failing | Skipped static analysis | Run static analysis BEFORE AI reviewers |
| Breaking API changes | Code before spec | Follow Spec-First workflow |
| Rate limit hit | Too many parallel agents | Check circuit breakers, use exponential backoff |
| Tests failing after merge | Skipped quality gates | Never bypass Severity-Based Blocking |
| Can't find what to do | Not following decision tree | Use Decision Tree, check orchestrator.json |
| Memory/context growing | Not using ledgers | Write to ledgers after completing tasks |

---

## Red Flags - Never Do These

### Implementation Anti-Patterns
- **NEVER** skip code review between tasks
- **NEVER** proceed with unfixed Critical/High/Medium issues
- **NEVER** dispatch reviewers sequentially (always parallel - 3x faster)
- **NEVER** dispatch multiple implementation subagents in parallel (conflicts)
- **NEVER** implement without reading task requirements first

### Review Anti-Patterns
- **NEVER** use sonnet for reviews (always opus for deep analysis)
- **NEVER** aggregate before all 3 reviewers complete
- **NEVER** skip re-review after fixes

### System Anti-Patterns
- **NEVER** delete .loki/state/ directory while running
- **NEVER** manually edit queue files without file locking
- **NEVER** skip checkpoints before major operations
- **NEVER** ignore circuit breaker states

### Always Do These
- **ALWAYS** launch all 3 reviewers in single message (3 Task calls)
- **ALWAYS** specify model: "opus" for each reviewer
- **ALWAYS** wait for all reviewers before aggregating
- **ALWAYS** fix Critical/High/Medium immediately
- **ALWAYS** re-run ALL 3 reviewers after fixes
- **ALWAYS** checkpoint state before spawning subagents

---

## Exit Conditions

| Condition | Action |
|-----------|--------|
| Product launched, stable 24h | Enter growth loop mode |
| Unrecoverable failure | Save state, halt, request human |
| PRD updated | Diff, create delta tasks, continue |
| Revenue target hit | Log success, continue optimization |
| Runway < 30 days | Alert, optimize costs aggressively |

---

## Directory Structure Overview

```
.loki/
+-- CONTINUITY.md           # Working memory (read/update every turn)
+-- specs/
|   +-- openapi.yaml        # API spec - source of truth
+-- queue/
|   +-- pending.json        # Tasks waiting to be claimed
|   +-- in-progress.json    # Currently executing tasks
|   +-- completed.json      # Finished tasks
|   +-- dead-letter.json    # Failed tasks for review
+-- state/
|   +-- orchestrator.json   # Master state (phase, metrics)
|   +-- agents/             # Per-agent state files
|   +-- circuit-breakers/   # Rate limiting state
+-- memory/
|   +-- ledgers/            # Agent-specific checkpoints
|   +-- handoffs/           # Agent-to-agent transfers
|   +-- learnings/          # Extracted patterns
|   +-- rules/              # Permanent validated patterns
+-- artifacts/
    +-- reports/            # Generated reports/dashboards
```

See `references/architecture.md` for full structure and state schemas.

---

## Invocation

```
Loki Mode                           # Start fresh
Loki Mode with PRD at path/to/prd   # Start with PRD
```

**Skill Metadata:**
| Field | Value |
|-------|-------|
| Trigger | "Loki Mode" or "Loki Mode with PRD at [path]" |
| Skip When | Need human approval, want to review plan first, single small task |
| Related Skills | subagent-driven-development, executing-plans |

---

## References

Detailed documentation is split into reference files for progressive loading:

| Reference | Content |
|-----------|---------|
| `references/core-workflow.md` | Full RARV cycle, CONTINUITY.md template, autonomy rules |
| `references/quality-control.md` | Quality gates, code review process, severity blocking |
| `references/spec-driven-dev.md` | OpenAPI-first workflow, validation, contract testing |
| `references/agent-types.md` | All 37 agent types with full capabilities |
| `references/task-queue.md` | Queue system, dead letter handling, circuit breakers |
| `references/sdlc-phases.md` | All phases with detailed workflows and testing |
| `references/architecture.md` | Directory structure, state schemas, bootstrap |
| `references/memory-system.md` | Context management, ledgers, handoffs, learnings |
| `references/mcp-integration.md` | MCP server capabilities and integration |
| `references/claude-best-practices.md` | Boris Cherny patterns, thinking mode, ledgers |
| `references/deployment.md` | Cloud deployment instructions per provider |
| `references/business-ops.md` | Business operation workflows |

---

**Version:** 2.18.0 | **Lines:** ~480 | **Optimized for Claude Code Agent Skills**
