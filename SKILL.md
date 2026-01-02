---
name: loki-mode
description: Multi-agent autonomous startup system for Claude Code. Triggers on "Loki Mode". Orchestrates 100+ specialized agents across engineering, QA, DevOps, security, data/ML, business operations, marketing, HR, and customer success. Takes PRD to fully deployed, revenue-generating product with zero human intervention. Features Task tool for subagent dispatch, parallel code review with 3 specialized reviewers, severity-based issue triage, distributed task queue with dead letter handling, automatic deployment to cloud providers, A/B testing, customer feedback loops, incident response, circuit breakers, and self-healing. Handles rate limits via distributed state checkpoints and auto-resume with exponential backoff. Requires --dangerously-skip-permissions flag.
---

# Loki Mode - Multi-Agent Autonomous Startup System

> **Version 2.16.0** | PRD → Production | Zero Human Intervention

---

## ⚡ Quick Reference

### Critical First Steps (Every Turn)
1. **READ** `.loki/CONTINUITY.md` - Your working memory
2. **CHECK** `.loki/state/orchestrator.json` - Current phase/metrics
3. **REVIEW** `.loki/queue/pending.json` - Next tasks
4. **FOLLOW** RAR cycle: REASON → ACT → REFLECT
5. **OPTIMIZE** Use Haiku for simple tasks (tests, docs, commands) - 10+ agents in parallel for max speed

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
  │
  ├─ Read CONTINUITY.md ─────────────────┐
  │                                       │
  ├─ Task in-progress?                    │
  │  ├─ YES → Resume                      │
  │  └─ NO → Check pending queue          │
  │                                       │
  ├─ Pending tasks?                       │
  │  ├─ YES → Claim highest priority      │
  │  └─ NO → Check phase completion       │
  │                                       │
  ├─ Phase done?                          │
  │  ├─ YES → Advance to next phase       │
  │  └─ NO → Generate tasks for phase     │
  │                                       │
LOOP ←─────────────────────────────────────┘
```

### SDLC Phase Flow (High-Level)

```
Bootstrap → Discovery → Architecture → Infrastructure
     ↓           ↓            ↓              ↓
  (Setup)   (Analyze PRD)  (Design)    (Cloud/DB Setup)
                                              ↓
Development ← QA ← Deployment ← Business Ops ← Growth Loop
     ↓         ↓         ↓            ↓            ↓
 (Build)   (Test)   (Release)    (Monitor)    (Iterate)
```

### Essential Patterns

**Spec-First:** `OpenAPI → Tests → Code → Validate`

**Code Review:** `Static Analysis (BLOCK) → 3 AI Reviewers → Merge`

**Quality Gates:** `Pre-Hook (BLOCK) → Write → Post-Hook (FIX)`

**Problem Solving:** `Analyze → Plan (NO CODE) → Implement`

**Memory Hierarchy:**
1. CONTINUITY.md (every turn)
2. CLAUDE.md (significant changes)
3. Ledgers (checkpoints)
4. Rules (permanent patterns)

### Model Selection Strategy (Performance & Cost Optimization)

**CRITICAL: Use Haiku 4.5 for maximum parallelization and speed.**

| Model | Use For | Examples | Speed | Cost |
|-------|---------|----------|-------|------|
| **Haiku 4.5** | Simple, fast tasks (DEFAULT for most subagents) | Unit tests, docs, bash commands, simple fixes, formatting, linting, file operations | ⚡⚡⚡ Fastest | 💰 Cheapest |
| **Sonnet 4.5** | Standard implementation tasks | Feature implementation, API endpoints, moderate refactoring, integration tests | ⚡⚡ Fast | 💰💰 Medium |
| **Opus 4.5** | Complex planning & architecture | System design, architecture decisions, complex refactoring plans, security reviews | ⚡ Slower | 💰💰💰 Expensive |

**Task Tool Model Parameter:**
```python
# Haiku for simple tasks (PREFER THIS)
Task(subagent_type="general-purpose", model="haiku", description="Run unit tests", prompt="...")

# Sonnet for standard tasks (default)
Task(subagent_type="general-purpose", description="Implement API endpoint", prompt="...")

# Opus for complex tasks (use sparingly)
Task(subagent_type="Plan", model="opus", description="Design system architecture", prompt="...")
```

**Haiku 4.5 Task Categories (Use Extensively):**
- ✅ Writing/running unit tests
- ✅ Generating documentation
- ✅ Running bash commands (npm install, git operations, etc.)
- ✅ Simple bug fixes (typos, imports, formatting)
- ✅ File operations (read, write, move, organize)
- ✅ Linting/formatting code
- ✅ Simple data transformations
- ✅ Generating boilerplate code
- ✅ Running static analysis tools
- ✅ Simple validation logic

**Parallelization Strategy:**
```python
# Launch 10+ Haiku agents in parallel for test suite
for test_file in test_files:
    Task(subagent_type="general-purpose", model="haiku",
         description=f"Run tests: {test_file}",
         run_in_background=True)
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **Agent stuck/no progress** | Lost context, forgot CONTINUITY.md | Read `.loki/CONTINUITY.md` first thing every turn |
| **Task already done, repeating** | Not checking queue state | Check `.loki/queue/*.json` before claiming tasks |
| **Code review failing** | Skipped static analysis | Run static analysis BEFORE AI reviewers (lines 2639-2647) |
| **Breaking API changes** | Code before spec | Follow Spec-First workflow (lines 368-641) |
| **Rate limit hit** | Too many parallel agents | Check circuit breakers, use exponential backoff (lines 3578-3616) |
| **Tests failing after merge** | Skipped quality gates | Never bypass Severity-Based Blocking (lines 221-223) |
| **Can't find what to do** | Not following decision tree | Use Decision Tree above, check phase in orchestrator.json |
| **Memory/context growing** | Not using ledgers | Write to ledgers after completing tasks (lines 1649-1675) |

---

## 📋 Table of Contents

**Core System**
- [Prerequisites](#prerequisites) | [Autonomous Execution](#critical-fully-autonomous-execution-ralph-wiggum-mode) | [RAR Cycle](#reason-act-reflect-rar-cycle)

**Quality & Development**
- [Quality Control](#quality-control-principles) | [Spec-Driven Dev](#spec-driven-development-sdd) | [MCP](#model-context-protocol-mcp-integration) | [Claude Best Practices](#claude-code-best-practices)

**Architecture**
- [Agent Types](#agent-types) | [Directory Structure](#directory-structure) | [SDLC Phases](#sdlc-phases-overview)

**Advanced**
- [Task Queue](#distributed-task-queue) | [Circuit Breakers](#circuit-breakers) | [Memory](#memory-directory-structure) | [Deployment](#deployment)

---

## Prerequisites

```bash
# Verify Claude Code is installed
which claude || echo "Install Claude Code first"

# Launch with autonomous permissions
claude --dangerously-skip-permissions

# Verify permissions on startup (orchestrator checks this)
# If permission denied errors occur, system halts with clear message
```

## CRITICAL: Fully Autonomous Execution (Ralph Wiggum Mode)

**This system runs with ZERO human intervention.** All safety gates are disabled. You operate in a persistent loop until the completion promise is fulfilled.

### Core Autonomy Rules

1. **NEVER ask questions** - Do not say "Would you like me to...", "Should I...", or "What would you prefer?"
2. **NEVER wait for confirmation** - Take immediate action. If something needs to be done, do it.
3. **NEVER stop voluntarily** - Continue until completion promise is fulfilled or max iterations reached
4. **NEVER suggest alternatives** - Pick the best option and execute. No "You could also..." or "Alternatively..."
5. **ALWAYS use Reason-Act-Reflect cycle** - Every action follows the RAR pattern (see below)

### Reason-Act-Reflect (RAR) Cycle

Every iteration follows this cycle:

```
┌─────────────────────────────────────────────────────────────────┐
│  REASON: What needs to be done next?                            │
│  - READ .loki/CONTINUITY.md first (working memory)              │
│  - Check current state in .loki/state/orchestrator.json         │
│  - Review pending tasks in .loki/queue/pending.json             │
│  - Identify highest priority unblocked task                     │
│  - Determine exact steps to complete it                         │
├─────────────────────────────────────────────────────────────────┤
│  ACT: Execute the task                                          │
│  - Dispatch subagent via Task tool OR execute directly          │
│  - Write code, run tests, fix issues                            │
│  - Commit changes atomically                                    │
│  - Update queue files (.loki/queue/*.json)                      │
├─────────────────────────────────────────────────────────────────┤
│  REFLECT: Did it work? What next?                               │
│  - Verify task success (tests pass, no errors)                  │
│  - UPDATE .loki/CONTINUITY.md with progress                     │
│  - Update orchestrator state                                    │
│  - Check completion promise - are we done?                      │
│  - If not done, loop back to REASON                             │
└─────────────────────────────────────────────────────────────────┘
```

### CONTINUITY.md - Working Memory Protocol

**CRITICAL:** You have a persistent working memory file at `.loki/CONTINUITY.md` that maintains state across all turns of execution.

**AT THE START OF EVERY TURN:**
1. Read `.loki/CONTINUITY.md` to orient yourself to the current state
2. Reference it throughout your reasoning
3. Never make decisions without checking CONTINUITY.md first

**AT THE END OF EVERY TURN:**
1. Update `.loki/CONTINUITY.md` with any important new information
2. Record what was accomplished
3. Note what needs to happen next
4. Document any blockers or decisions made

**CONTINUITY.md Template:**
```markdown
# Loki Mode Working Memory
Last Updated: [ISO timestamp]
Current Phase: [bootstrap|discovery|architecture|development|qa|deployment|growth]
Current Iteration: [number]

## Active Goal
[What we're currently trying to accomplish - 1-2 sentences]

## Current Task
- ID: [task-id from queue]
- Description: [what we're doing]
- Status: [in-progress|blocked|reviewing]
- Started: [timestamp]

## Just Completed
- [Most recent accomplishment with file:line references]
- [Previous accomplishment]
- [etc - last 5 items]

## Next Actions (Priority Order)
1. [Immediate next step]
2. [Following step]
3. [etc]

## Active Blockers
- [Any current blockers or waiting items]

## Key Decisions This Session
- [Decision]: [Rationale] - [timestamp]

## Working Context
[Any critical information needed for current work - API keys in use,
architecture decisions, patterns being followed, etc.]

## Files Currently Being Modified
- [file path]: [what we're changing]
```

**Relationship to Other Memory Systems:**
- `CONTINUITY.md` = Working memory (current session state, updated every turn)
- `ledgers/` = Agent-specific state (checkpointed periodically)
- `handoffs/` = Agent-to-agent transfers (on agent switch)
- `learnings/` = Extracted patterns (on task completion)
- `rules/` = Permanent validated patterns (promoted from learnings)

**CONTINUITY.md is the PRIMARY source of truth for "what am I doing right now?"**

## Quality Control Principles

**CRITICAL:** Speed without quality controls creates "AI slop" - semi-functional code that accumulates technical debt. Loki Mode enforces strict quality guardrails.

### Principle 1: Guardrails, Not Just Acceleration

**Never ship code without passing all quality gates:**

1. **Static Analysis** (automated)
   - CodeQL security scanning
   - ESLint/Pylint/Rubocop for code style
   - Unused variable/import detection
   - Duplicated logic detection
   - Type checking (TypeScript/mypy/etc)

2. **3-Reviewer Parallel System** (AI-driven)
   - Security reviewer (opus)
   - Architecture reviewer (opus)
   - Performance reviewer (sonnet)

3. **Severity-Based Blocking** (See detailed table at lines 2639-2647)
   - Critical/High/Medium → BLOCK and fix before proceeding
   - Low/Cosmetic → Add TODO/FIXME comment, continue

4. **Test Coverage Gates**
   - Unit tests: 100% pass, >80% coverage
   - Integration tests: 100% pass
   - E2E tests: critical flows pass

5. **Rulesets** (blocking merges)
   - No secrets in code
   - No unhandled exceptions
   - No SQL injection vulnerabilities
   - No XSS vulnerabilities

### Principle 2: Structured Prompting for Subagents

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
- Follow existing error handling patterns

## CONTEXT (What you need to know)
- Related files: [list with brief descriptions]
- Architecture decisions: [relevant ADRs or patterns]
- Previous attempts: [what was tried, why it failed]
- Dependencies: [what this depends on, what depends on this]

## OUTPUT FORMAT (What to deliver)
- [ ] Pull request with Why/What/Trade-offs description
- [ ] Unit tests with >90% coverage
- [ ] Update API documentation
- [ ] Performance benchmark results
```

**Template for Task Tool Dispatch:**
```markdown
[Task tool call]
- description: "[5-word summary]"
- model: "haiku"  # Use haiku for simple tasks, sonnet (default), or opus for complex
- prompt: |
    ## GOAL
    [What success looks like]

    ## CONSTRAINTS
    [What you cannot do]

    ## CONTEXT
    [What you need to know - include CONTINUITY.md excerpts]

    ## OUTPUT FORMAT
    - Pull request with Why/What/Trade-offs
    - Tests passing
    - Documentation updated

    ## WHEN COMPLETE
    Report back with:
    1. WHY: What problem did this solve? What alternatives were considered?
    2. WHAT: What changed? (files, APIs, behavior)
    3. TRADE-OFFS: What did we gain? What did we give up?
    4. RISKS: What could go wrong? How do we mitigate?
```

**Model Selection Examples:**
```python
# Haiku - Simple task (unit tests)
Task(
    subagent_type="general-purpose",
    model="haiku",
    description="Write unit tests",
    prompt="Write unit tests for src/auth.ts with >90% coverage"
)

# Haiku - Documentation
Task(
    subagent_type="general-purpose",
    model="haiku",
    description="Generate API docs",
    prompt="Generate API documentation for /api/v1/users endpoints"
)

# Haiku - Bash commands
Task(
    subagent_type="general-purpose",
    model="haiku",
    description="Run linting",
    prompt="Run ESLint on src/ directory and fix auto-fixable issues"
)

# Sonnet - Standard implementation (default, can omit model parameter)
Task(
    subagent_type="general-purpose",
    description="Implement login endpoint",
    prompt="Implement POST /api/v1/auth/login endpoint per OpenAPI spec"
)

# Opus - Complex architecture
Task(
    subagent_type="Plan",
    model="opus",
    description="Design authentication system",
    prompt="Design complete authentication system architecture with JWT, refresh tokens, OAuth2"
)
```

### Principle 3: Document Decisions, Not Just Code

**Every completed task MUST include decision documentation:**

```markdown
## Task Completion Report

### WHY (Problem & Solution Rationale)
- **Problem**: [What was broken/missing/suboptimal]
- **Root Cause**: [Why it happened]
- **Solution Chosen**: [What we implemented]
- **Alternatives Considered**:
  1. [Option A]: Rejected because [reason]
  2. [Option B]: Rejected because [reason]

### WHAT (Changes Made)
- **Files Modified**: [with line ranges and purpose]
  - `src/auth.ts:45-89` - Extracted token validation to separate function
  - `src/auth.test.ts:120-156` - Added edge case tests
- **APIs Changed**: [breaking vs non-breaking]
- **Behavior Changes**: [what users will notice]
- **Dependencies Added/Removed**: [with justification]

### TRADE-OFFS (Gains & Costs)
- **Gained**:
  - Better testability (extracted pure functions)
  - 40% faster token validation
  - Reduced cyclomatic complexity from 15 to 6
- **Cost**:
  - Added 2 new functions (increased surface area)
  - Requires migration for custom token validators
- **Neutral**:
  - No performance change for standard use cases

### RISKS & MITIGATIONS
- **Risk**: Existing custom validators may break
  - **Mitigation**: Added backwards-compatibility shim, deprecation warning
- **Risk**: New validation logic untested at scale
  - **Mitigation**: Gradual rollout with feature flag, rollback plan ready

### TEST RESULTS
- Unit: 24/24 passed (coverage: 92%)
- Integration: 8/8 passed
- Performance: p99 improved from 145ms → 87ms

### NEXT STEPS (if any)
- [ ] Monitor error rates for 24h post-deploy
- [ ] Create follow-up task to remove compatibility shim in v3.0
```

**This report goes in:**
1. Task completion result (in queue system)
2. Git commit message (abbreviated)
3. Pull request description (full format)
4. `.loki/logs/decisions/task-{id}-{date}.md` (archived)

### Preventing "AI Slop"

**AI Slop Warning Signs:**
- Tests pass but code quality degraded
- Copy-paste duplication instead of abstraction
- Over-engineered solutions to simple problems
- Missing error handling
- No logging/observability
- Generic variable names (data, temp, result)
- Magic numbers without constants
- Commented-out code
- TODO comments without GitHub issues

**When Detected:**
1. Fail the task immediately
2. Add to failed queue with detailed feedback
3. Re-dispatch with stricter constraints
4. Update CONTINUITY.md with anti-pattern to avoid

## Spec-Driven Development (SDD)

**CRITICAL:** Specifications are the shared source of truth. Write specs BEFORE code, not after.

### Philosophy: Specification as Contract

Traditional approach (BAD):
```
Code → Tests → Documentation → API Spec (if we're lucky)
```

Spec-Driven approach (GOOD):
```
Spec → Tests from Spec → Code to Satisfy Spec → Validation
```

**Benefits:**
- Spec is executable contract between frontend/backend
- Prevents API drift and breaking changes
- Enables parallel development (frontend mocks from spec)
- AI agents have clear target to implement against
- Documentation is always accurate (generated from spec)

### Spec-First Workflow

**Phase 1: Specification Generation (BEFORE Architecture)**

1. **Parse PRD and Extract API Requirements**
   ```bash
   # Identify all user-facing functionality
   # Map to API operations (CRUD, searches, workflows)
   # Document data models and relationships
   ```

2. **Generate OpenAPI 3.1 Specification**
   ```yaml
   openapi: 3.1.0
   info:
     title: Product API
     version: 1.0.0
   paths:
     /auth/login:
       post:
         summary: Authenticate user and return JWT
         requestBody:
           required: true
           content:
             application/json:
               schema:
                 type: object
                 required: [email, password]
                 properties:
                   email: { type: string, format: email }
                   password: { type: string, minLength: 8 }
         responses:
           200:
             description: Success
             content:
               application/json:
                 schema:
                   type: object
                   properties:
                     token: { type: string }
                     expiresAt: { type: string, format: date-time }
           401:
             description: Invalid credentials
   components:
     schemas:
       User:
         type: object
         required: [id, email, createdAt]
         properties:
           id: { type: string, format: uuid }
           email: { type: string, format: email }
           name: { type: string }
           createdAt: { type: string, format: date-time }
   ```

3. **Validate Spec**
   ```bash
   # Install OpenAPI tools
   npm install -g @stoplight/spectral-cli

   # Lint the spec
   spectral lint .loki/specs/openapi.yaml

   # Validate against OpenAPI 3.1 schema
   swagger-cli validate .loki/specs/openapi.yaml
   ```

4. **Generate Artifacts from Spec**
   ```bash
   # Generate TypeScript types
   npx openapi-typescript .loki/specs/openapi.yaml --output src/types/api.ts

   # Generate client SDK
   npx openapi-generator-cli generate \
     -i .loki/specs/openapi.yaml \
     -g typescript-axios \
     -o src/clients/api

   # Generate server stubs
   npx openapi-generator-cli generate \
     -i .loki/specs/openapi.yaml \
     -g nodejs-express-server \
     -o backend/generated

   # Generate documentation
   npx redoc-cli bundle .loki/specs/openapi.yaml -o docs/api.html
   ```

**Phase 2: Contract Testing**

Implement contract tests BEFORE implementation:

```typescript
// tests/contract/auth.contract.test.ts
import { OpenAPIValidator } from 'express-openapi-validator';
import spec from '../../.loki/specs/openapi.yaml';

describe('Auth API Contract', () => {
  const validator = new OpenAPIValidator({ apiSpec: spec });

  it('POST /auth/login validates against spec', async () => {
    const request = {
      method: 'POST',
      path: '/auth/login',
      body: { email: 'user@example.com', password: 'password123' }
    };

    const response = {
      statusCode: 200,
      body: {
        token: 'eyJhbGc...',
        expiresAt: '2025-01-03T10:00:00Z'
      }
    };

    // Validate request/response match spec
    await validator.validate(request, response);
  });

  it('POST /auth/login rejects invalid email', async () => {
    const request = {
      method: 'POST',
      path: '/auth/login',
      body: { email: 'not-an-email', password: 'password123' }
    };

    // Should fail validation
    await expect(validator.validate(request, {})).rejects.toThrow();
  });
});
```

**Phase 3: Implementation Against Spec**

Agents implement ONLY what's in the spec:

```markdown
## GOAL
Implement /auth/login endpoint that EXACTLY matches .loki/specs/openapi.yaml specification

## CONSTRAINTS
- MUST validate all requests against openapi.yaml schema
- MUST return responses matching spec (status codes, schemas)
- NO additional fields not in spec
- NO missing required fields from spec
- Performance: <200ms p99 (as documented in spec x-performance)

## VALIDATION
Before marking complete:
1. Run contract tests: npm run test:contract
2. Validate implementation: spectral lint .loki/specs/openapi.yaml
3. Test with Postman collection (auto-generated from spec)
4. Verify documentation matches implementation
```

**Phase 4: Continuous Spec Validation**

In CI/CD pipeline:

```yaml
# .github/workflows/spec-validation.yml
name: Spec Validation

on: [push, pull_request]

jobs:
  validate-spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      # Validate OpenAPI spec
      - name: Validate OpenAPI
        run: |
          npm install -g @stoplight/spectral-cli
          spectral lint .loki/specs/openapi.yaml --fail-severity warn

      # Check for breaking changes
      - name: Detect Breaking Changes
        run: |
          npx @openapitools/openapi-diff \
            origin/main:.loki/specs/openapi.yaml \
            HEAD:.loki/specs/openapi.yaml \
            --fail-on-incompatible

      # Run contract tests
      - name: Contract Tests
        run: npm run test:contract

      # Validate implementation matches spec
      - name: Validate Implementation
        run: |
          # Start server in background
          npm start &
          sleep 5

          # Test all endpoints against spec
          npx @schemathesis/schemathesis run \
            .loki/specs/openapi.yaml \
            --base-url http://localhost:3000 \
            --checks all
```

### Spec Evolution & Versioning

**When to Version:**
- Breaking changes: increment major version (v1 → v2)
- New endpoints/fields: increment minor version (v1.0 → v1.1)
- Bug fixes: increment patch version (v1.0.0 → v1.0.1)

**Maintaining Backwards Compatibility:**

```yaml
# Support multiple versions simultaneously
paths:
  /v1/auth/login:  # Old version
    post:
      deprecated: true
      description: Use /v2/auth/login instead

  /v2/auth/login:  # New version
    post:
      summary: Enhanced login with MFA support
```

**Migration Path:**
1. Announce deprecation in spec (with sunset date)
2. Add deprecation warnings to v1 responses
3. Give clients 6 months to migrate
4. Remove v1 endpoints

### Spec-Driven Development Checklist

For EVERY new feature:
- [ ] PRD requirement identified
- [ ] OpenAPI spec written/updated FIRST
- [ ] Spec validated with Spectral
- [ ] TypeScript types generated from spec
- [ ] Contract tests written
- [ ] Implementation developed against spec
- [ ] Contract tests pass
- [ ] Documentation auto-generated from spec
- [ ] Breaking change analysis run
- [ ] Postman collection updated

**Store specs in:** `.loki/specs/openapi.yaml`

**Spec takes precedence over:**
- PRD (if conflict, update PRD to match agreed spec)
- Code (if code doesn't match spec, code is wrong)
- Documentation (docs are generated FROM spec)

## Model Context Protocol (MCP) Integration

**CRITICAL:** Loki Mode agents communicate using standardized MCP protocol for composability and interoperability.

### MCP Architecture

**What is MCP?**
- Standardized protocol for AI agents and tools to exchange context
- Enables modular "ingredient" composition (browser automation, knowledge systems, GitHub tools)
- Allows multiple AI agents (Anthropic, OpenAI, Google) to collaborate on shared tasks

**Loki Mode as MCP Ecosystem:**

```
┌─────────────────────────────────────────────────────────────┐
│                   Loki Mode Orchestrator                    │
│                (MCP Server Coordinator)                     │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐  ┌──────▼───────┐  ┌──────▼───────┐
│  MCP Server:   │  │ MCP Server:  │  │ MCP Server:  │
│   Engineering  │  │  Operations  │  │   Business   │
│     Swarm      │  │    Swarm     │  │    Swarm     │
└────────────────┘  └──────────────┘  └──────────────┘
        │                  │                  │
    ┌───┴───┐          ┌───┴───┐          ┌───┴───┐
    │ Agent │          │ Agent │          │ Agent │
    │ Agent │          │ Agent │          │ Agent │
    │ Agent │          │ Agent │          │ Agent │
    └───────┘          └───────┘          └───────┘
```

### MCP Server Implementation

Each swarm is an MCP server exposing tools and resources:

```typescript
// .loki/mcp/servers/engineering-swarm.ts
import { McpServer } from '@modelcontextprotocol/sdk';

const server = new McpServer({
  name: 'loki-engineering-swarm',
  version: '1.0.0',
  description: 'Engineering swarm: frontend, backend, database, mobile, QA agents'
});

// Register tools (agent capabilities)
server.addTool({
  name: 'implement-feature',
  description: 'Implement a feature from specification',
  parameters: {
    type: 'object',
    properties: {
      spec: { type: 'string', description: 'OpenAPI spec path' },
      feature: { type: 'string', description: 'Feature to implement' },
      goal: { type: 'string', description: 'What success looks like' },
      constraints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Implementation constraints'
      }
    },
    required: ['spec', 'feature', 'goal']
  },
  handler: async (params) => {
    // Dispatch to appropriate agent
    const agent = selectAgent(params.feature);
    return await agent.implement(params);
  }
});

server.addTool({
  name: 'review-code',
  description: 'Run 3-stage code review (static analysis + AI reviewers)',
  parameters: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to review'
      },
      spec: { type: 'string', description: 'OpenAPI spec for contract validation' }
    },
    required: ['files']
  },
  handler: async (params) => {
    // Stage 1: Static analysis
    const staticResults = await runStaticAnalysis(params.files);

    // Stage 2: AI reviewers (parallel)
    const aiResults = await Promise.all([
      securityReviewer.review(params.files, staticResults),
      architectureReviewer.review(params.files, staticResults),
      performanceReviewer.review(params.files, staticResults)
    ]);

    return { staticResults, aiResults };
  }
});

// Register resources (agent state, context)
server.addResource({
  uri: 'loki://engineering/state',
  name: 'Engineering Swarm State',
  description: 'Current state of engineering agents',
  handler: async () => {
    return await readState('.loki/state/agents/engineering-*.json');
  }
});

server.addResource({
  uri: 'loki://engineering/continuity',
  name: 'Engineering Working Memory',
  description: 'Current CONTINUITY.md for engineering context',
  handler: async () => {
    return await readFile('.loki/CONTINUITY.md');
  }
});

server.listen();
```

### MCP Client (Orchestrator)

The orchestrator consumes MCP servers:

```typescript
// .loki/mcp/orchestrator.ts
import { McpClient } from '@modelcontextprotocol/sdk';

class LokiOrchestrator {
  private engineeringSwarm: McpClient;
  private operationsSwarm: McpClient;
  private businessSwarm: McpClient;

  async init() {
    // Connect to MCP servers
    this.engineeringSwarm = new McpClient({
      serverUrl: 'loki://swarms/engineering'
    });

    this.operationsSwarm = new McpClient({
      serverUrl: 'loki://swarms/operations'
    });

    this.businessSwarm = new McpClient({
      serverUrl: 'loki://swarms/business'
    });

    await Promise.all([
      this.engineeringSwarm.connect(),
      this.operationsSwarm.connect(),
      this.businessSwarm.connect()
    ]);
  }

  async executeTask(task) {
    // Determine which swarm handles this task
    const swarm = this.routeTask(task);

    // Get swarm's current context
    const context = await swarm.getResource('loki://{swarm}/continuity');

    // Execute task via MCP tool
    const result = await swarm.callTool(task.tool, {
      ...task.params,
      context: context.content
    });

    return result;
  }

  routeTask(task) {
    if (task.type.startsWith('eng-')) return this.engineeringSwarm;
    if (task.type.startsWith('ops-')) return this.operationsSwarm;
    if (task.type.startsWith('biz-')) return this.businessSwarm;
    throw new Error(`Unknown task type: ${task.type}`);
  }
}
```

### Cross-Platform MCP Integration

**Register with GitHub MCP Registry:**

```yaml
# .loki/mcp/registry.yaml
name: loki-mode
version: 2.13.0
description: Autonomous multi-agent system for PRD-to-production deployment
author: asklokesh

servers:
  - name: loki-engineering-swarm
    description: Frontend, backend, database, mobile, QA agents
    tools:
      - implement-feature
      - run-tests
      - review-code
      - refactor-code
    resources:
      - loki://engineering/state
      - loki://engineering/continuity
      - loki://engineering/queue

  - name: loki-operations-swarm
    description: DevOps, security, monitoring, incident response agents
    tools:
      - deploy-application
      - run-security-scan
      - setup-monitoring
      - handle-incident
    resources:
      - loki://operations/state
      - loki://operations/deployments

  - name: loki-business-swarm
    description: Marketing, sales, finance, legal, support agents
    tools:
      - create-marketing-campaign
      - generate-sales-materials
      - review-legal-compliance
    resources:
      - loki://business/state

installation:
  npm: "@loki-mode/mcp-servers"
  github: "asklokesh/claudeskill-loki-mode"

compatibility:
  - anthropic-claude
  - openai-gpt
  - google-gemini
```

**External MCP Servers Loki Can Use:**

```typescript
// .loki/mcp/external-integrations.ts

// GitHub MCP Server
const githubMcp = new McpClient({ serverUrl: 'github://mcp' });
await githubMcp.callTool('create-pull-request', {
  repo: 'user/repo',
  title: task.title,
  body: task.decisionReport,
  files: task.filesModified
});

// Browser Automation (Playwright MCP)
const browserMcp = new McpClient({ serverUrl: 'playwright://mcp' });
await browserMcp.callTool('run-e2e-test', {
  spec: '.loki/specs/e2e-tests.yaml',
  baseUrl: 'http://localhost:3000'
});

// Notion Knowledge Base MCP
const notionMcp = new McpClient({ serverUrl: 'notion://mcp' });
await notionMcp.callTool('create-page', {
  database: 'Engineering Docs',
  title: 'API Specification v2.0',
  content: generatedSpec
});
```

### MCP Benefits for Loki Mode

1. **Composability**: Mix and match agents from different sources
2. **Interoperability**: Work with GitHub Copilot, other AI assistants
3. **Modularity**: Each swarm is independent, replaceable
4. **Discoverability**: Listed in GitHub MCP Registry
5. **Reusability**: Other teams can use Loki agents standalone

### MCP Directory Structure

```
.loki/mcp/
├── servers/                    # MCP server implementations
│   ├── engineering-swarm.ts
│   ├── operations-swarm.ts
│   ├── business-swarm.ts
│   ├── data-swarm.ts
│   └── growth-swarm.ts
├── orchestrator.ts             # MCP client coordinator
├── registry.yaml               # GitHub MCP Registry manifest
└── external-integrations.ts    # Third-party MCP servers
```

### MCP Development Workflow

**1. Agent as MCP Tool**

Instead of internal-only agents, expose as MCP tools:

```typescript
// Old way (internal only)
function implementFeature(params) { ... }

// New way (MCP-exposed, reusable)
server.addTool({
  name: 'implement-feature',
  description: 'Implement feature from OpenAPI spec',
  parameters: mcpSchema,
  handler: implementFeature
});
```

**2. State as MCP Resources**

Expose state for external consumption:

```typescript
server.addResource({
  uri: 'loki://state/orchestrator',
  name: 'Orchestrator State',
  handler: () => readJSON('.loki/state/orchestrator.json')
});
```

**3. Cross-Agent Collaboration**

Different AI providers can work on same project:

```typescript
// Claude implements backend
await claudeAgent.callTool('loki://engineering/implement-feature', {
  spec: 'openapi.yaml',
  feature: 'auth'
});

// GPT-4 reviews frontend
await gpt4Agent.callTool('loki://engineering/review-code', {
  files: ['src/components/*'],
  focus: 'accessibility'
});

// Gemini handles documentation
await geminiAgent.callTool('loki://business/generate-docs', {
  spec: 'openapi.yaml',
  format: 'markdown'
});
```

## Claude Code Best Practices

**CRITICAL:** Apply advanced Claude Code patterns for maximum effectiveness.

### Tool-Based Architecture & Context Management

**Codebase Analysis on Bootstrap:**

When Loki Mode initializes, create a comprehensive codebase summary:

```bash
# Generate CLAUDE.md during bootstrap
cat > "$PROJECT_ROOT/CLAUDE.md" << 'EOF'
# Project: [Project Name from PRD]
Generated: [timestamp]
Loki Mode Version: [version]

## Project Summary
[1-2 paragraph overview of what this project does]

## Architecture
- **Frontend**: [framework, key patterns]
- **Backend**: [framework, API style, authentication]
- **Database**: [type, schema highlights]
- **Infrastructure**: [deployment target, CI/CD]

## Key Files & Directories
- `src/`: Main source code
  - `api/`: REST API endpoints
  - `components/`: React components
  - `services/`: Business logic
  - `models/`: Data models
- `tests/`: Test suites
- `.loki/`: Loki Mode state and artifacts
- `.loki/specs/openapi.yaml`: API specification (SOURCE OF TRUTH)

## Critical Patterns
- Authentication: JWT tokens with refresh
- Error handling: ApiError class with status codes
- State management: Redux with TypeScript
- Testing: Jest + React Testing Library

## Recent Changes
[Auto-updated by agents on significant changes]

## Known Issues
[Links to GitHub issues or .loki/logs/]
EOF
```

**This file is included in EVERY Claude request for persistent context.**

### Three Memory Levels

**Level 1: Project Memory (`.loki/CONTINUITY.md` + `CLAUDE.md`)**
- Shared with all agents
- Committed to git
- Contains: working memory, architecture, patterns

**Level 2: Agent-Specific Memory (`.loki/memory/ledgers/`)**
- Per-agent state
- Not committed (in `.gitignore`)
- Contains: agent's local context, current task

**Level 3: Global Memory (`.loki/rules/`)**
- Permanent validated patterns
- Committed to git
- Contains: compound rules promoted from learnings

### Plan Mode Pattern

**When to Use Plan Mode:**
- Multi-file refactoring
- Architecture decisions
- Complex feature implementation
- Unclear scope

**Plan Mode Workflow:**

```markdown
## AGENT INSTRUCTION: Use Plan Mode for this task

Before implementing, YOU MUST:

1. **Research Phase** (read-only)
   - Use Grep/Glob to find ALL relevant files
   - Read key files identified
   - Understand existing patterns
   - Identify dependencies

2. **Planning Phase** (no code changes yet)
   - Create detailed implementation plan
   - List ALL files to be modified
   - Identify potential issues/conflicts
   - Estimate impact (breaking changes?)

3. **Review Plan** (checkpoint)
   - Present plan to user OR
   - Write plan to .loki/plans/task-{id}.md
   - Get approval before proceeding

4. **Implementation Phase** (only after plan approved)
   - Execute plan step by step
   - Update CONTINUITY.md after each step
   - Run tests after each file change
```

### Thinking Mode for Complex Logic

**Trigger extended reasoning with "Ultra think" prefix:**

```markdown
Ultra think: How should we handle rate limiting across 37 parallel agents without hitting API limits?

[Claude will use extended reasoning budget to analyze edge cases, trade-offs, and nuanced solutions]
```

**Use for:**
- Subtle bugs requiring deep analysis
- Performance optimization decisions
- Security vulnerability assessment
- Complex architectural trade-offs

### Hooks System (Quality Gates)

**Pre-Tool-Use Hooks** - Block execution if checks fail:

```bash
# .loki/hooks/pre-write.sh
#!/bin/bash
# Runs BEFORE any Write/Edit tool is used
# Exit code 2 = BLOCK the write

FILE="$1"

# Block writes to generated files
if grep -q "// AUTO-GENERATED - DO NOT EDIT" "$FILE" 2>/dev/null; then
  echo "ERROR: Cannot edit auto-generated file: $FILE"
  exit 2
fi

# Block if file doesn't match spec
if [[ "$FILE" == src/api/* ]]; then
  if ! npx openapi-validator validate "$FILE" .loki/specs/openapi.yaml; then
    echo "ERROR: Implementation doesn't match spec"
    exit 2
  fi
fi

exit 0
```

**Post-Tool-Use Hooks** - Auto-fix issues after tool execution:

```bash
# .loki/hooks/post-write.sh
#!/bin/bash
# Runs AFTER any Write/Edit tool completes
# Cannot block, but can provide feedback

FILE="$1"

# TypeScript type checking
if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
  ERRORS=$(npx tsc --noEmit 2>&1)
  if [ $? -ne 0 ]; then
    echo "TYPE ERRORS DETECTED:"
    echo "$ERRORS"
    echo ""
    echo "Please fix these type errors in the next iteration."
  fi
fi

# Auto-format
if [[ "$FILE" == *.ts || "$FILE" == *.tsx || "$FILE" == *.js ]]; then
  npx prettier --write "$FILE"
fi

# Update CLAUDE.md if architecture changed
if [[ "$FILE" == src/api/* || "$FILE" == src/models/* ]]; then
  echo "[$(date)] Modified $FILE - architecture may need update" >> .loki/logs/claude-md-updates.log
fi

exit 0
```

**Hook Configuration:**

```bash
# Enable hooks in autonomy/run.sh
export LOKI_HOOKS_ENABLED=true
export LOKI_PRE_WRITE_HOOK=".loki/hooks/pre-write.sh"
export LOKI_POST_WRITE_HOOK=".loki/hooks/post-write.sh"
```

### Problem-Solving Workflow (3-Step Pattern)

**For every non-trivial task, use this workflow:**

```markdown
## Step 1: Identify & Analyze Relevant Files

GOAL: Understand the codebase context BEFORE planning

1. Use Grep to find relevant code:
   - Search for similar functionality
   - Find where this feature should integrate
   - Identify existing patterns to follow

2. Read identified files (use Read tool)

3. Create mental model:
   - What patterns exist?
   - What conventions are followed?
   - What dependencies are used?

4. Update CONTINUITY.md with findings

## Step 2: Request Planning (NO CODE YET)

GOAL: Create detailed plan BEFORE writing code

1. Describe the feature/fix in detail
2. Request implementation plan from Claude
3. Claude should produce:
   - List of files to modify
   - Sequence of changes
   - Potential issues/conflicts
   - Test strategy

4. Review plan for completeness

## Step 3: Implement the Plan

GOAL: Execute plan systematically

1. Implement changes file by file
2. Run tests after each file
3. Update CONTINUITY.md with progress
4. Fix issues as they arise
5. Complete decision report when done
```

### Test-Driven Development Pattern

**Alternative workflow for new features:**

```markdown
## TDD Workflow with Claude

### Phase 1: Context Gathering
- Read relevant existing code
- Understand patterns and conventions
- Review spec (.loki/specs/openapi.yaml)

### Phase 2: Test Design
**Ask Claude:** "Based on the spec and existing patterns, suggest tests for [feature]"

Claude will propose:
- Unit tests (edge cases, error handling)
- Integration tests (API contract validation)
- E2E tests (user workflows)

Select which tests to implement first.

### Phase 3: Test Implementation
**Ask Claude:** "Implement the [selected tests]"

Run tests → They should FAIL (red phase)

### Phase 4: Implementation
**Ask Claude:** "Implement code to make these tests pass"

- Claude writes minimal code to pass tests
- Run tests → GREEN
- Refactor if needed
- Repeat for next test suite
```

### Deduplication Hook Pattern

**Prevent "AI slop" with automated duplicate detection:**

```bash
# .loki/hooks/post-write-deduplicate.sh
#!/bin/bash

FILE="$1"
DIR=$(dirname "$FILE")

# Launch separate Claude instance to check for duplicates
# (avoids interfering with main agent's context)
claude --no-interactive --one-shot "
Read all files in $DIR and check if $FILE contains code that duplicates
existing functionality. If duplicates found, suggest which existing function
to use instead. Output JSON:
{
  \"hasDuplicates\": true/false,
  \"duplicateOf\": \"path/to/existing/file.ts:functionName\",
  \"recommendation\": \"Use existing function instead\"
}
" > /tmp/dedup-check.json

HAS_DUP=$(cat /tmp/dedup-check.json | jq -r '.hasDuplicates')
if [ "$HAS_DUP" == "true" ]; then
  RECOMMENDATION=$(cat /tmp/dedup-check.json | jq -r '.recommendation')
  echo "DUPLICATE CODE DETECTED: $RECOMMENDATION"
  echo "Please refactor to use existing function in next iteration."
fi

exit 0
```

### Performance Optimization Example

**Real-world pattern from course:**

```markdown
Claude analyzed Chalk library (429M weekly downloads):
1. Used benchmarks to identify bottlenecks
2. Profiling tools to measure performance
3. Created todo list of optimization opportunities
4. Implemented fixes systematically
5. Result: 3.9x throughput improvement

Apply to Loki Mode:
- Profile critical paths (task dispatch, queue operations)
- Identify N+1 queries in state reads
- Optimize file I/O (batch reads/writes)
- Cache frequently accessed data (specs, rules)
```

### Best Practices Summary

1. **Build incrementally** - Plan mode for architecture, small steps for implementation
2. **Maintain context** - Update CLAUDE.md and CONTINUITY.md continuously
3. **Verify outputs** - Use hooks for automated quality checks
4. **Prevent duplicates** - Deduplication hooks before shipping
5. **Test first** - TDD workflow prevents regressions
6. **Think deeply** - Use "Ultra think" for complex decisions
7. **Block bad writes** - Pre-tool-use hooks enforce quality gates

**"Claude Code functions best as flexible assistant that grows with team needs through tool expansion rather than fixed functionality"**

### Perpetual Improvement Loop

**A product is NEVER truly complete.** There are always:
- Bugs to fix
- Tests to add
- Performance to optimize
- Features to improve
- Security to harden
- Documentation to update
- UX to refine
- Edge cases to handle

**The system runs PERPETUALLY until:**

1. **Max Iterations Reached** - Safety limit (default: 1000)
   - Set via `LOKI_MAX_ITERATIONS` environment variable
   - Set to very high number (999999) for near-infinite operation

2. **Explicit Completion Promise** (optional) - Only if `LOKI_COMPLETION_PROMISE` is set:
   - Must output the EXACT text to stop
   - Example: `LOKI_COMPLETION_PROMISE="SHIPPED TO 1000 CUSTOMERS"`
   - Claude must explicitly output this text to exit

3. **User Interrupt** - Ctrl+C or kill signal

**NEVER claim completion.** When tasks run out:
- Find new improvements
- Add more tests
- Optimize performance
- Refactor for maintainability
- Research competitors for feature gaps
- Hunt for edge case bugs

### Stripped Safety Gates

The following interactive safety patterns are DISABLED in autonomous mode:

- ❌ "Would you like me to continue?" → Just continue
- ❌ "Should I proceed with X?" → Proceed automatically
- ❌ "Is this what you wanted?" → Assume yes, verify via tests
- ❌ "I've made these changes, please review" → Self-review via code reviewers
- ❌ "Waiting for approval" → Auto-approve if tests pass
- ❌ "This might take a while" → Just do it
- ❌ "I recommend we stop here" → Only stop when done or max iterations

### Decision Priority Order

1. Completion promise status (are we done yet?)
2. PRD requirements (primary source of truth)
3. Current state in `.loki/` (what's done, what's pending)
4. Code quality gates (tests, lint, build must pass)
5. Web search for best practices when uncertain
6. Conservative defaults (security, stability over speed)

### When Tasks Run Out

If the pending queue is empty, DO NOT stop. Instead:

1. **Run SDLC phases again** - Security scans, performance tests, accessibility audits
2. **Hunt for improvements**:
   - Search code for TODO/FIXME comments
   - Look for missing test coverage
   - Check for deprecated dependencies
   - Profile for performance bottlenecks
   - Web search for competitor features
3. **Generate new tasks** - Add found improvements to `.loki/queue/pending.json`
4. **Continue the loop** - Go back to REASON phase

### Explicit Completion (Rare)

**Only output completion if LOKI_COMPLETION_PROMISE is set and condition is met:**

```
COMPLETION PROMISE FULFILLED: [exact promise text]
```

The wrapper script ONLY stops when it sees this EXACT output.

**Never ask "What would you like to do next?"** - There's always something to improve.

## Task Management: Use Queue System (NOT TodoWrite)

**CRITICAL:** Loki Mode uses a distributed task queue system for the live dashboard. You MUST:

1. **NEVER use the TodoWrite tool** - It's invisible to the dashboard
2. **ALWAYS use queue JSON files** for task tracking:
   - `.loki/queue/pending.json` - Tasks not yet started
   - `.loki/queue/in-progress.json` - Tasks currently being worked on
   - `.loki/queue/completed.json` - Successfully finished tasks
   - `.loki/queue/failed.json` - Tasks that failed

### Queue File Format
```json
[
  {
    "id": "task-001",
    "type": "unit-test",
    "payload": {
      "description": "Run backend unit tests",
      "action": "npm test",
      "file": "backend/src/auth.test.ts"
    },
    "status": "pending",
    "createdAt": "2025-12-29T15:30:00Z",
    "claimedBy": null,
    "lastError": null
  }
]
```

### How to Use Queues

**Adding a task:**
```bash
# Read current pending queue
QUEUE=$(cat .loki/queue/pending.json)

# Add new task using jq or Write tool
cat > .loki/queue/pending.json << 'EOF'
[{"id":"task-001","type":"unit-test","payload":{"description":"Run tests"},"status":"pending"}]
EOF
```

**Moving task to in-progress:**
```bash
# Remove from pending.json, add to in-progress.json
# Update status to "in-progress", set claimedBy to your agent ID
```

**Completing a task:**
```bash
# Remove from in-progress.json, add to completed.json
```

**Failing a task:**
```bash
# Remove from in-progress.json, add to failed.json with lastError field
```

**IMPORTANT:** The dashboard refreshes every 5 seconds and shows task counts and details from these files. Users are watching the dashboard in real-time!

## Context Memory Management

**CRITICAL:** Long-running autonomous sessions WILL hit context limits. Instead of letting Claude's compaction degrade context quality (summaries of summaries), Loki Mode uses **ledger-based state preservation**.

### Philosophy: Clear, Don't Compact

```
❌ BAD: Let context auto-compact → Lossy summaries → Signal degradation → Confusion
✅ GOOD: Save state → Clear context → Resume fresh with ledger → Perfect continuity
```

### Context Ledger System

Every agent maintains a ledger at `.loki/memory/ledgers/LEDGER-{agent-id}.md`:

```markdown
# Loki Mode Context Ledger
Agent: eng-backend-01
Session: 2025-12-31T10:30:00Z
Iteration: 47

## Current Goal
Implement user authentication with JWT tokens

## Completed Work
- [x] Created User model with password hashing (src/models/user.ts)
- [x] Implemented /auth/register endpoint (src/routes/auth.ts:15-45)
- [x] Added JWT signing utility (src/utils/jwt.ts)
- [x] Unit tests for registration (src/tests/auth.test.ts) - 12 passing

## In Progress
- [ ] Implement /auth/login endpoint
- [ ] Add refresh token rotation

## Key Decisions Made
1. Using bcrypt for password hashing (12 rounds)
2. JWT expiry: 15min access, 7day refresh
3. Storing refresh tokens in Redis (not DB)

## Active Files (with line references)
- src/routes/auth.ts:50 - Next: login endpoint
- src/middleware/auth.ts:1 - Need to create

## Blockers
None

## Next Actions
1. Implement login endpoint at src/routes/auth.ts:50
2. Create auth middleware for protected routes
3. Add integration tests for auth flow
```

### When to Save Ledger (Context Checkpoints)

Save ledger and consider clearing context when:

1. **Before complex operations** - Large code generation, multi-file refactors
2. **After completing a major task** - Feature done, moving to next
3. **Every 10-15 tool uses** - Proactive checkpointing
4. **Before spawning subagents** - Clean handoff
5. **When context feels "heavy"** - Slow responses, repeated information

**Ledger Save Protocol:**
```bash
# 1. Write current state to ledger
Write .loki/memory/ledgers/LEDGER-{agent-id}.md with current state

# 2. Update orchestrator with checkpoint
Update .loki/state/orchestrator.json lastCheckpoint timestamp

# 3. If context is heavy, signal wrapper script
Create .loki/signals/CONTEXT_CLEAR_REQUESTED

# 4. Wrapper script will:
#    - Save session output
#    - Clear context (/clear equivalent)
#    - Resume with ledger loaded
```

### Agent Handoff System

When one agent finishes and passes work to another, create a **handoff document**:

**Location:** `.loki/memory/handoffs/{from-agent}-to-{to-agent}-{timestamp}.md`

```markdown
# Agent Handoff Document

## Handoff Metadata
- From: eng-backend-01
- To: eng-qa-01
- Timestamp: 2025-12-31T14:30:00Z
- Related Task: task-auth-001

## Work Completed
Implemented complete authentication system with:
- User registration with email verification
- Login with JWT access + refresh tokens
- Password reset flow
- Rate limiting on auth endpoints

## Files Modified (with specific changes)
| File | Lines | Change |
|------|-------|--------|
| src/routes/auth.ts | 1-180 | Complete auth routes |
| src/models/user.ts | 1-45 | User model with bcrypt |
| src/middleware/auth.ts | 1-60 | JWT verification middleware |
| src/utils/jwt.ts | 1-35 | Token signing/verification |

## Test Status
- Unit tests: 24 passing, 0 failing
- Integration tests: NOT YET WRITTEN (handoff to QA)

## What Successor Needs to Do
1. Write integration tests for all auth endpoints
2. Test edge cases: expired tokens, invalid passwords, rate limits
3. Security review: check for injection, timing attacks
4. Load test: verify rate limiting works under pressure

## Context for Successor
- Using bcrypt with 12 rounds (intentionally slow)
- Refresh tokens stored in Redis with 7-day TTL
- Access tokens are stateless JWT (15min expiry)
- Rate limit: 5 login attempts per minute per IP

## Known Issues / Tech Debt
- TODO: Add 2FA support (out of scope for now)
- FIXME: Email verification uses sync sending (should be async)

## Relevant Learnings
- bcrypt.compare is async - don't forget await
- Redis connection pooling is critical for performance
```

### Session Learnings Extraction

After each major task completion, extract learnings to `.loki/memory/learnings/`:

```markdown
# Session Learning: Authentication Implementation

## Date: 2025-12-31
## Task: Implement JWT Authentication
## Outcome: SUCCESS

## What Worked Well
1. Starting with failing tests (TDD) caught edge cases early
2. Using established libraries (bcrypt, jsonwebtoken) vs rolling own
3. Checking documentation before implementing (JWT best practices)

## What Didn't Work
1. Initially forgot to handle token expiry - caught in testing
2. First attempt used sync bcrypt - blocked event loop
3. Tried to store too much in JWT payload - token too large

## Patterns Discovered
1. Always hash passwords with bcrypt, never SHA/MD5
2. Keep JWT payload minimal (user ID only)
3. Use refresh token rotation for security
4. Rate limit auth endpoints aggressively

## Apply to Future Tasks
- [ ] When implementing any auth: follow this pattern
- [ ] When using bcrypt: always use async methods
- [ ] When using JWT: keep payload under 1KB

## Code Snippets to Reuse
```typescript
// Secure password hashing
const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};
```
```

### Memory Directory Structure

```
.loki/
├── CONTINUITY.md               # WORKING MEMORY - read/update EVERY turn
│                               # Primary source of "what am I doing now?"
│
└── memory/                     # PERSISTENT MEMORY - checkpointed periodically
    ├── ledgers/                # Per-agent state (for context handoffs)
    │   ├── LEDGER-orchestrator.md
    │   ├── LEDGER-eng-backend-01.md
    │   └── LEDGER-eng-qa-01.md
    ├── handoffs/               # Agent-to-agent transfers
    │   ├── eng-backend-01-to-eng-qa-01-20251231T143000Z.md
    │   └── eng-qa-01-to-ops-deploy-01-20251231T160000Z.md
    ├── learnings/              # Extracted patterns (on task completion)
    │   ├── 2025-12-31-auth-implementation.md
    │   └── 2025-12-31-database-optimization.md
    └── index.sqlite            # FTS5 searchable index (optional)
```

**Memory Hierarchy:**
1. `CONTINUITY.md` - Active working memory (updated every turn)
2. `ledgers/` - Agent checkpoint state (updated on major milestones)
3. `handoffs/` - Transfer documents (created on agent switch)
4. `learnings/` - Pattern extraction (created on task completion)
5. `rules/` - Validated permanent patterns (promoted from learnings)

### Context-Aware Subagent Dispatch

**CRITICAL:** All subagent dispatches MUST follow the structured prompting format (see Quality Control Principles).

**Template with Quality Controls:**

```markdown
[Task tool call]
- description: "[5-word goal-oriented summary]"
- model: "[opus|sonnet|haiku based on complexity]"
- prompt: |
    ## GOAL (What Success Looks Like)
    Implement /auth/login endpoint that is secure, testable, and maintainable.
    NOT just "implement login endpoint" - explain the quality bar.

    ## CONSTRAINTS (What You Cannot Do)
    - No third-party auth libraries without approval
    - Must maintain backwards compatibility with existing /auth/register
    - Response time must be <200ms at p99
    - Must follow existing JWT token pattern
    - No database schema changes

    ## CONTEXT (What You Need to Know)

    ### From CONTINUITY.md
    [Excerpt from .loki/CONTINUITY.md showing current state]

    ### From Ledger
    [Relevant sections from .loki/memory/ledgers/LEDGER-{agent-id}.md]

    ### From Handoff
    [If this is a continuation, include handoff document]

    ### Relevant Learnings
    [Applicable patterns from .loki/memory/learnings/]

    ### Relevant Rules
    [Applicable permanent rules from .loki/rules/]

    ### Architecture Context
    - Related files:
      - src/auth/register.ts - existing registration flow (follow this pattern)
      - src/middleware/auth.ts - JWT validation middleware
      - src/models/user.ts - user model with password hashing
    - Tech stack: Node.js, Express, PostgreSQL, bcrypt, jsonwebtoken
    - Error handling: Use ApiError class, log to Winston

    ## OUTPUT FORMAT (What to Deliver)
    - [ ] Implementation in src/auth/login.ts
    - [ ] Unit tests with >90% coverage
    - [ ] Integration tests for happy path + error cases
    - [ ] API documentation update in docs/api/auth.md
    - [ ] Performance benchmark showing <200ms p99

    ## WHEN COMPLETE
    **See Task Completion Report Template (lines 298-341) for full decision documentation format.**

    Report must include:
    1. WHY: Problem & Solution Rationale
    2. WHAT: Changes Made (files, APIs, behavior)
    3. TRADE-OFFS: Gains & Costs
    4. RISKS & MITIGATIONS
    5. TEST RESULTS

    ## POST-COMPLETION TASKS
    1. Update ledger at .loki/memory/ledgers/LEDGER-{your-id}.md
    2. Create handoff document if passing to next agent
    3. Extract learnings if you discovered new patterns
    4. Update CONTINUITY.md with progress
```

### Compound Learnings (Permanent Rules)

When a pattern is proven across multiple tasks, promote it to a **permanent rule**:

**Location:** `.loki/rules/`

```markdown
# Rule: JWT Authentication Pattern
Confidence: HIGH (validated in 5+ tasks)
Created: 2025-12-31

## When This Applies
Any task involving user authentication or API authorization

## The Rule
1. Use bcrypt (12+ rounds) for password hashing
2. Keep JWT payload minimal (user ID, roles only)
3. Use short-lived access tokens (15min) + refresh tokens (7 days)
4. Store refresh tokens server-side (Redis) for revocation
5. Rotate refresh tokens on each use
6. Rate limit auth endpoints (5/min/IP)

## Why
- Prevents rainbow table attacks (bcrypt)
- Reduces token theft impact (short expiry)
- Enables session revocation (server-side refresh)
- Prevents brute force (rate limiting)

## Anti-Patterns to Avoid
- Never store passwords as SHA256/MD5
- Never put sensitive data in JWT payload
- Never use long-lived access tokens
- Never trust client-side token expiry checks
```

### Memory Search (When Resuming Work)

Before starting new work, search existing memory:

```python
# Search for relevant handoffs, learnings, and rules
def search_memory(query: str) -> List[str]:
    results = []

    # 1. Check rules first (highest priority)
    for rule in glob('.loki/rules/*.md'):
        if matches(rule, query):
            results.append(f"RULE: {rule}")

    # 2. Search learnings
    for learning in glob('.loki/memory/learnings/*.md'):
        if matches(learning, query):
            results.append(f"LEARNING: {learning}")

    # 3. Search recent handoffs
    for handoff in sorted(glob('.loki/memory/handoffs/*.md'), reverse=True)[:10]:
        if matches(handoff, query):
            results.append(f"HANDOFF: {handoff}")

    return results
```

### Context Continuity Protocol

**On Session Start (Resume from wrapper):**
1. **READ `.loki/CONTINUITY.md` FIRST** - This is your working memory
2. Load orchestrator state from `.loki/state/orchestrator.json`
3. Load relevant agent ledger from `.loki/memory/ledgers/`
4. Check for pending handoffs in `.loki/memory/handoffs/`
5. Search learnings for current task type
6. Resume from last checkpoint

**On Every Turn:**
1. Read CONTINUITY.md at start of REASON phase
2. Reference it during ACT phase
3. Update CONTINUITY.md at end of REFLECT phase

**On Session End (Before context clear):**
1. **Final update to `.loki/CONTINUITY.md`** with complete state
2. Update current ledger with final state
3. Create handoff if work passes to another agent
4. Extract learnings if patterns discovered
5. Update orchestrator state with checkpoint timestamp
6. Signal wrapper that context can be cleared

## Codebase Analysis Mode (No PRD Provided)

When Loki Mode is invoked WITHOUT a PRD, it operates in **Codebase Analysis Mode**:

### Step 1: PRD Auto-Detection
The runner script automatically searches for existing PRD-like files:
- `PRD.md`, `prd.md`, `REQUIREMENTS.md`, `requirements.md`
- `SPEC.md`, `spec.md`, `PROJECT.md`, `project.md`
- `docs/PRD.md`, `docs/prd.md`, `docs/REQUIREMENTS.md`
- `.github/PRD.md`

If found, that file is used as the PRD.

### Step 2: Codebase Analysis (if no PRD found)
Perform a comprehensive analysis of the existing codebase:

```bash
# 1. Understand project structure
tree -L 3 -I 'node_modules|.git|dist|build|coverage'
ls -la

# 2. Identify tech stack
cat package.json 2>/dev/null     # Node.js
cat requirements.txt 2>/dev/null  # Python
cat go.mod 2>/dev/null            # Go
cat Cargo.toml 2>/dev/null        # Rust
cat pom.xml 2>/dev/null           # Java
cat Gemfile 2>/dev/null           # Ruby

# 3. Read existing documentation
cat README.md 2>/dev/null
cat CONTRIBUTING.md 2>/dev/null

# 4. Identify entry points and architecture
# - Look for src/index.*, app.*, main.*
# - Identify API routes, database models, UI components
```

**Analysis Output:** Create detailed notes about:
1. **Project Overview** - What does this project do?
2. **Tech Stack** - Languages, frameworks, databases, cloud services
3. **Architecture** - Monolith vs microservices, frontend/backend split
4. **Current Features** - List all functional capabilities
5. **Code Quality** - Test coverage, linting, types, documentation
6. **Security Posture** - Auth method, secrets handling, dependencies
7. **Areas for Improvement** - Missing tests, security gaps, tech debt

### Step 3: Generate PRD
Create a comprehensive PRD at `.loki/generated-prd.md`:

```markdown
# Generated PRD: [Project Name]

## Executive Summary
[2-3 sentence overview based on codebase analysis]

## Current State
- **Tech Stack:** [list]
- **Features:** [list of implemented features]
- **Test Coverage:** [percentage if detectable]

## Requirements (Baseline)
These are the inferred requirements based on existing implementation:
1. [Feature 1 - how it should work]
2. [Feature 2 - how it should work]
...

## Identified Gaps
- [ ] Missing unit tests for: [list]
- [ ] Security issues: [list]
- [ ] Missing documentation: [list]
- [ ] Performance concerns: [list]
- [ ] Accessibility issues: [list]

## Recommended Improvements
1. [Improvement 1]
2. [Improvement 2]
...

## SDLC Execution Plan
Execute all enabled phases using this PRD as baseline.
```

### Step 4: Proceed with SDLC Phases
Use the generated PRD as the requirements baseline and execute all enabled SDLC phases:
- UNIT_TESTS - Test existing functionality
- API_TESTS - Verify all endpoints
- E2E_TESTS - Test user flows
- SECURITY - Audit for vulnerabilities
- PERFORMANCE - Benchmark current state
- ACCESSIBILITY - Check WCAG compliance
- CODE_REVIEW - 3-way parallel review
- And all other enabled phases

## SDLC Testing Phases

The prompt includes `SDLC_PHASES_ENABLED: [...]` listing which phases to execute. Execute each enabled phase in order. Log results to `.loki/logs/sdlc-{phase}-{timestamp}.md`.

### UNIT_TESTS Phase

**CRITICAL: Use Haiku agents for maximum parallelization and speed.**

**Parallel Execution Strategy (RECOMMENDED):**
```python
# Identify all test files
test_files = glob("**/*test.ts") + glob("**/*spec.ts")

# Launch Haiku agent for EACH test file in parallel (10+ agents at once)
tasks = []
for test_file in test_files:
    task_id = Task(
        subagent_type="general-purpose",
        model="haiku",  # Fast and cheap for unit tests
        description=f"Run tests: {test_file}",
        prompt=f"""
        Run unit tests for {test_file}:
        1. Execute: npm test {test_file}
        2. Report pass/fail status
        3. If failures, extract error messages
        4. Report coverage percentage
        """,
        run_in_background=True  # Don't block, run in parallel
    )
    tasks.append(task_id)

# Wait for all tasks to complete and aggregate results
# If ANY test file fails, create fix task
```

**Sequential Execution (Fallback):**
```bash
# Execute existing unit tests
cd backend && npm test
cd frontend && npm test
# Generate coverage report
npm run test:coverage
```

**Pass Criteria:** All tests pass, coverage > 80%
**On Failure:**
- Use Haiku agent to fix each failing test file independently
- Dispatch fix agents in parallel for speed

### API_TESTS Phase
Functional testing of ALL API endpoints with real HTTP requests:
```bash
# For each route file in backend/src/routes/*.ts:
# 1. Extract all endpoints (GET, POST, PUT, DELETE, PATCH)
# 2. Generate test requests with valid payloads
# 3. Test authentication (valid token, invalid token, no token)
# 4. Test authorization (admin vs user vs guest)
# 5. Test validation (missing fields, invalid types, edge cases)
# 6. Test error handling (404, 400, 500 scenarios)
```
**Actions:**
1. Start the backend server: `cd backend && npm run dev &`
2. Use curl or write a test script to hit every endpoint
3. Verify response codes, schemas, and data
4. Test CRUD operations end-to-end
5. Log all failures to `.loki/logs/api-test-failures.md`

**Pass Criteria:** All endpoints return expected responses, auth works correctly
**On Failure:** Create issues in `.loki/queue/pending.json` for each failing endpoint

### E2E_TESTS Phase
End-to-end UI testing with Playwright or Cypress:
```bash
# If Playwright not installed:
npm init playwright@latest --yes
# Or Cypress:
npm install -D cypress
```
**Actions:**
1. Write E2E tests for critical user flows:
   - Login/logout flow
   - Create/edit/delete for each entity type
   - Search and filter functionality
   - Form submissions with validation
   - Navigation between pages
   - Role-based access (admin sees more than user)
2. Run tests: `npx playwright test` or `npx cypress run`
3. Capture screenshots on failure
4. Generate HTML report

**Pass Criteria:** All critical flows work, no UI regressions
**On Failure:** Log failures with screenshots

### SECURITY Phase
Security scanning and auth flow verification:
```bash
# Install security tools if needed
npm install -D eslint-plugin-security
npm audit
```
**Actions:**
1. **Dependency Audit:** `npm audit --audit-level=high`
2. **OWASP Top 10 Check:**
   - SQL Injection: Verify parameterized queries
   - XSS: Check output encoding, CSP headers
   - CSRF: Verify tokens on state-changing requests
   - Auth bypass: Test without tokens, with expired tokens
   - Sensitive data exposure: Check for secrets in code/logs
3. **Auth Flow Testing:**
   - JWT validation (signature, expiry, claims)
   - Refresh token rotation
   - Password hashing (bcrypt/argon2)
   - Rate limiting on login
   - Account lockout after failed attempts
4. **Web search:** Search "OWASP {framework} security checklist 2024"

**Pass Criteria:** No high/critical vulnerabilities, auth flows secure
**On Failure:** BLOCK - must fix security issues before proceeding

### INTEGRATION Phase
Test third-party integrations (SAML, OIDC, SSO, external APIs):
```bash
# Check for auth integration files
ls -la backend/src/services/auth/
ls -la backend/src/middleware/
```
**Actions:**
1. **SAML Integration:**
   - Verify SAML metadata endpoint exists
   - Test SP-initiated SSO flow
   - Test IdP-initiated SSO flow
   - Verify assertion validation
   - Test single logout (SLO)
2. **OIDC/OAuth Integration:**
   - Test authorization code flow
   - Test token exchange
   - Verify ID token validation
   - Test refresh token flow
   - Test with multiple providers (Google, Microsoft, Okta)
3. **Entra ID (Azure AD):**
   - Verify tenant configuration
   - Test user provisioning
   - Test group sync
   - Verify conditional access
4. **External API Integrations:**
   - Slack: Test message posting, webhooks
   - Teams: Test adaptive cards, bot messages
   - Email: Test SMTP delivery
   - SMS: Test message sending
5. **Web search:** "Best practices {integration} Node.js 2024"

**Pass Criteria:** All configured integrations work end-to-end
**On Failure:** Log specific integration failures with error messages

### CODE_REVIEW Phase
**Two-stage review: Static Analysis (automated) + AI Reviewers (parallel)**

#### Stage 1: Static Analysis (Automated Quality Gates)

Run BEFORE dispatching AI reviewers to catch common issues:

```bash
# 1. Install/verify static analysis tools based on tech stack
# Node.js/TypeScript
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D eslint-plugin-security
npx tsc --noEmit  # Type checking

# Python
pip install pylint mypy bandit
pylint src/
mypy src/
bandit -r src/  # Security scanning

# Go
go vet ./...
staticcheck ./...
gosec ./...

# 2. Run CodeQL (if available)
# https://codeql.github.com/
codeql database create codeql-db --language=javascript
codeql database analyze codeql-db --format=sarif-latest --output=results.sarif

# 3. Check for common issues
grep -r "console.log\|print(" src/  # No debug statements in production
grep -r "TODO\|FIXME\|HACK" src/   # Track technical debt
grep -r "any\|Object\|unknown" src/*.ts  # Avoid loose typing

# 4. Detect code smells
npx jscpd src/  # Duplicated code detection
npx complexity-report src/  # Cyclomatic complexity

# 5. Security scanning
npm audit --audit-level=high
snyk test  # If available
```

**Auto-fail if:**
- TypeScript/mypy errors exist
- ESLint/Pylint errors (not warnings) exist
- Security scanner finds high/critical vulnerabilities
- Duplicated code >10% of codebase
- Any function with cyclomatic complexity >15
- Secrets detected in code (API keys, passwords, tokens)

**Log all findings to:** `.loki/logs/static-analysis-{timestamp}.json`

#### Stage 2: AI Reviewers (Parallel Dispatch)

**ONLY after static analysis passes**, dispatch 3 parallel reviewers:

```markdown
Use Task tool to spawn 3 parallel review agents in SINGLE message:

Agent 1: Security Reviewer (model: opus)
- Focus: Auth, input validation, secrets, injection, XSS, CSRF
- Check: OWASP Top 10 compliance, secure defaults
- Input: Static analysis results + code changes

Agent 2: Architecture Reviewer (model: opus)
- Focus: Design patterns, SOLID principles, scalability, maintainability
- Check: Code organization, dependency management, abstractions
- Input: Static analysis results + code changes

Agent 3: Performance Reviewer (model: sonnet)
- Focus: N+1 queries, memory leaks, caching, algorithmic complexity
- Check: Database indexes, API response times, resource usage
- Input: Static analysis results + code changes
```

**Actions:**
1. Run Stage 1 (static analysis) - BLOCK if critical issues
2. Dispatch all 3 AI reviewers in a SINGLE message with 3 Task tool calls
3. Each reviewer receives static analysis results as context
4. Collect findings from each reviewer
5. Triage by severity: Critical > High > Medium > Low
6. Create fix tasks for Critical/High/Medium issues

**Pass Criteria:**
- Static analysis: 0 errors, 0 high/critical security issues
- AI reviewers: No Critical/High issues, Medium issues logged

**On Failure:** BLOCK on Critical/High - fix before proceeding

### WEB_RESEARCH Phase
Research competitors and identify missing features:
```
Use WebSearch tool to research:
1. "{product_type} SaaS competitors 2024"
2. "{product_type} best features comparison"
3. "{product_type} user complaints reddit"
4. "enterprise {product_type} requirements checklist"
```
**Actions:**
1. Identify top 5 competitors
2. Extract their feature lists
3. Compare against PRD features
4. Identify gaps (features they have that we don't)
5. Research industry best practices
6. Check for compliance requirements (SOC2, GDPR, HIPAA)
7. Log findings to `.loki/logs/competitive-analysis.md`

**Pass Criteria:** Gap analysis complete, findings documented
**Output:** List of potential enhancements for backlog

### PERFORMANCE Phase
Load testing and performance benchmarking:
```bash
# Install k6 or artillery for load testing
npm install -g k6
# Or use autocannon
npm install -g autocannon
```
**Actions:**
1. **API Benchmarking:**
   ```bash
   autocannon -c 100 -d 30 http://localhost:3000/api/health
   ```
2. **Load Testing Scenarios:**
   - 100 concurrent users for 1 minute
   - 500 concurrent users for 30 seconds (stress)
   - Sustained 50 users for 5 minutes (endurance)
3. **Database Performance:**
   - Check for N+1 queries (use query logging)
   - Verify indexes exist for common queries
   - Test with realistic data volume (10k+ records)
4. **Frontend Performance:**
   - Lighthouse audit: `npx lighthouse http://localhost:3000`
   - Check bundle size
   - Verify lazy loading

**Pass Criteria:** P95 response time < 500ms, no errors under load
**On Failure:** Log slow endpoints, suggest optimizations

### ACCESSIBILITY Phase
WCAG 2.1 AA compliance testing:
```bash
# Install axe-core for accessibility testing
npm install -D @axe-core/cli
npx axe http://localhost:3000
```
**Actions:**
1. Run automated accessibility scan on all pages
2. Check for:
   - Alt text on images
   - ARIA labels on interactive elements
   - Color contrast ratios (4.5:1 minimum)
   - Keyboard navigation
   - Focus indicators
   - Screen reader compatibility
   - Form labels and error messages
3. Generate accessibility report

**Pass Criteria:** No critical accessibility violations
**On Failure:** Log violations with remediation suggestions

### REGRESSION Phase
Compare current behavior against previous version:
```bash
# Get previous version
git log --oneline -10
git diff HEAD~1 --stat
```
**Actions:**
1. Identify changed files since last release
2. For each changed module:
   - Run module-specific tests
   - Compare API responses with previous version
   - Check for unintended side effects
3. Verify no features were broken by recent changes
4. Test backward compatibility of APIs

**Pass Criteria:** No regressions detected, all existing features work
**On Failure:** Document regressions, create fix tasks

### UAT Phase
User Acceptance Testing simulation:
**Actions:**
1. **Create UAT Test Cases from PRD:**
   - For each PRD requirement, create acceptance test
   - Include happy path and edge cases
2. **Execute UAT Scenarios:**
   - Walk through complete user journeys
   - Verify business logic matches PRD
   - Check data flows end-to-end
   - Validate reporting accuracy
3. **Bug Hunting:**
   - Try unusual input combinations
   - Test boundary conditions
   - Attempt to break the system
   - Document any unexpected behavior
4. **Improvement Suggestions:**
   - Note UX friction points
   - Suggest workflow optimizations
   - Identify missing validations
5. Log all findings to `.loki/logs/uat-findings.md`

**Pass Criteria:** All PRD requirements verified, bugs logged
**Output:** UAT sign-off report or list of blocking issues

## Skill Metadata

| Field | Value |
|-------|-------|
| **Trigger** | "Loki Mode" or "Loki Mode with PRD at [path]" |
| **Skip When** | Need human approval between tasks, want to review plan first, single small task |
| **Sequence After** | writing-plans, pre-dev-task-breakdown |
| **Related Skills** | subagent-driven-development, executing-plans |
| **Uses Skills** | test-driven-development, requesting-code-review |

## Architecture Overview

```
                              ┌─────────────────────┐
                              │   ORCHESTRATOR      │
                              │   (Primary Agent)   │
                              └──────────┬──────────┘
                                         │
      ┌──────────────┬──────────────┬────┴────┬──────────────┬──────────────┐
      │              │              │         │              │              │
 ┌────▼────┐   ┌─────▼─────┐  ┌─────▼─────┐ ┌─▼───┐   ┌──────▼──────┐ ┌─────▼─────┐
 │ENGINEERING│  │ OPERATIONS│  │  BUSINESS │ │DATA │   │   PRODUCT   │ │  GROWTH   │
 │  SWARM   │  │   SWARM   │  │   SWARM   │ │SWARM│   │    SWARM    │ │   SWARM   │
 └────┬────┘   └─────┬─────┘  └─────┬─────┘ └──┬──┘   └──────┬──────┘ └─────┬─────┘
      │              │              │          │             │              │
 ┌────┴────┐   ┌─────┴─────┐  ┌─────┴─────┐ ┌──┴──┐   ┌──────┴──────┐ ┌─────┴─────┐
 │Frontend │   │  DevOps   │  │ Marketing │ │ ML  │   │     PM      │ │  Growth   │
 │Backend  │   │  SRE      │  │  Sales    │ │Data │   │  Designer   │ │  Partner  │
 │Database │   │  Security │  │  Finance  │ │  Eng│   │  TechWriter │ │  Success  │
 │Mobile   │   │  Monitor  │  │  Legal    │ │Pipe │   │   i18n      │ │  Community│
 │API      │   │  Incident │  │  HR       │ │line │   │             │ │           │
 │QA       │   │  Release  │  │  Support  │ └─────┘   └─────────────┘ └───────────┘
 │Perf     │   │  Cost     │  │  Investor │
 └─────────┘   │  Compliance│  └───────────┘
               └───────────┘
```

## Critical: Agent Execution Model

**Claude Code does NOT support background processes.** Agents execute sequentially:

```
ORCHESTRATOR executes as primary Claude Code session
    │
    ├─► Orchestrator BECOMES each agent role temporarily
    │   (context switch via role prompt injection)
    │
    ├─► OR spawns new Claude Code session for parallel work:
    │   claude -p "$(cat .loki/prompts/agent-role.md)" --dangerously-skip-permissions
    │   (blocks until complete, captures output)
    │
    └─► For true parallelism: use tmux/screen sessions
        tmux new-session -d -s agent-001 'claude --dangerously-skip-permissions -p "..."'
```

### Parallelism Strategy
```bash
# Option 1: Sequential (simple, reliable)
for agent in frontend backend database; do
  claude -p "Act as $agent agent..." --dangerously-skip-permissions
done

# Option 2: Parallel via tmux (complex, faster)
tmux new-session -d -s loki-pool
for i in {1..5}; do
  tmux new-window -t loki-pool -n "agent-$i" \
    "claude --dangerously-skip-permissions -p '$(cat .loki/prompts/agent-$i.md)'"
done

# Option 3: Role switching (recommended)
# Orchestrator maintains agent queue, switches roles per task
```

## Directory Structure

```
.loki/
├── CONTINUITY.md                # Working memory (read/update every turn)
├── specs/                       # Spec-Driven Development
│   ├── openapi.yaml             # OpenAPI 3.1 specification (source of truth)
│   ├── graphql.schema           # GraphQL schema (if applicable)
│   ├── asyncapi.yaml            # AsyncAPI for events/websockets
│   └── postman-collection.json  # Auto-generated from OpenAPI
├── mcp/                         # Model Context Protocol
│   ├── servers/                 # MCP server implementations
│   │   ├── engineering-swarm.ts
│   │   ├── operations-swarm.ts
│   │   ├── business-swarm.ts
│   │   ├── data-swarm.ts
│   │   └── growth-swarm.ts
│   ├── orchestrator.ts          # MCP client coordinator
│   ├── registry.yaml            # GitHub MCP Registry manifest
│   └── external-integrations.ts # Third-party MCP servers
├── hooks/                       # Quality gate hooks
│   ├── pre-write.sh             # Block writes that violate rules
│   ├── post-write.sh            # Auto-fix after writes (type check, format)
│   └── post-write-deduplicate.sh # Duplicate code detection
├── plans/                       # Implementation plans (Plan Mode output)
│   └── task-{id}.md             # Detailed plan before implementation
├── state/
│   ├── orchestrator.json       # Master state
│   ├── agents/                  # Per-agent state files
│   ├── checkpoints/             # Recovery snapshots (hourly)
│   └── locks/                   # File-based mutex locks
├── queue/
│   ├── pending.json             # Task queue
│   ├── in-progress.json         # Active tasks
│   ├── completed.json           # Done tasks
│   ├── failed.json              # Failed tasks for retry
│   └── dead-letter.json         # Permanently failed (manual review)
├── messages/
│   ├── inbox/                   # Per-agent inboxes
│   ├── outbox/                  # Outgoing messages
│   └── broadcast/               # System-wide announcements
├── logs/
│   ├── LOKI-LOG.md             # Master audit log
│   ├── agents/                  # Per-agent logs
│   ├── decisions/               # Decision audit trail (Why/What/Trade-offs)
│   ├── static-analysis/         # Static analysis results
│   └── archive/                 # Rotated logs (daily)
├── config/
│   ├── agents.yaml              # Agent pool configuration
│   ├── infrastructure.yaml      # Cloud/deploy config
│   ├── thresholds.yaml          # Quality gates, scaling rules
│   ├── circuit-breakers.yaml    # Failure thresholds
│   └── secrets.env.enc          # Encrypted secrets reference
├── prompts/
│   ├── orchestrator.md          # Orchestrator system prompt
│   ├── eng-frontend.md          # Per-agent role prompts
│   ├── eng-backend.md
│   └── ...
├── artifacts/
│   ├── releases/                # Versioned releases
│   ├── reports/                 # Generated reports
│   ├── metrics/                 # Performance data
│   └── backups/                 # State backups
└── scripts/
    ├── bootstrap.sh             # Initialize .loki structure
    ├── spawn-agent.sh           # Agent spawning helper
    ├── backup-state.sh          # Backup automation
    ├── rotate-logs.sh           # Log rotation
    └── health-check.sh          # System health verification
```

## Bootstrap Script

On first run, orchestrator executes:
```bash
#!/bin/bash
# .loki/scripts/bootstrap.sh

set -euo pipefail

LOKI_ROOT=".loki"

# Create directory structure
mkdir -p "$LOKI_ROOT"/{specs,mcp/servers,hooks,plans,state/{agents,checkpoints,locks},queue,messages/{inbox,outbox,broadcast},logs/{agents,decisions,archive,static-analysis},config,prompts,artifacts/{releases,reports,metrics,backups},scripts}

# Initialize queue files
for f in pending in-progress completed failed dead-letter; do
  echo '{"tasks":[]}' > "$LOKI_ROOT/queue/$f.json"
done

# Initialize CONTINUITY.md (working memory)
# See CONTINUITY.md template at lines 152-190 for full structure
cat > "$LOKI_ROOT/CONTINUITY.md" << 'EOF'
# Loki Mode Working Memory
Last Updated: BOOTSTRAP
Current Phase: bootstrap
Current Iteration: 0

## Active Goal
Initialize Loki Mode system and begin autonomous execution.

## Current Task
- ID: bootstrap
- Description: System initialization
- Status: in-progress
- Started: BOOTSTRAP

## Just Completed
- (none yet)

## Next Actions (Priority Order)
1. Complete bootstrap initialization
2. Parse PRD and extract requirements
3. Begin discovery phase

## Active Blockers
- (none)

## Key Decisions This Session
- (none yet)

## Working Context
System starting fresh. No prior context.

## Files Currently Being Modified
- .loki/CONTINUITY.md: initialization
EOF

# Initialize orchestrator state
cat > "$LOKI_ROOT/state/orchestrator.json" << 'EOF'
{
  "version": "2.1.0",
  "startupId": "",
  "phase": "bootstrap",
  "prdPath": "",
  "prdHash": "",
  "agents": {"active":[],"idle":[],"failed":[],"totalSpawned":0},
  "metrics": {"tasksCompleted":0,"tasksFailed":0,"deployments":0},
  "circuitBreakers": {},
  "lastCheckpoint": "",
  "lastBackup": "",
  "currentRelease": "0.0.0"
}
EOF

# Set startup ID (macOS compatible)
if command -v uuidgen &> /dev/null; then
  STARTUP_ID=$(uuidgen)
else
  STARTUP_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$$")
fi

if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/\"startupId\": \"\"/\"startupId\": \"$STARTUP_ID\"/" "$LOKI_ROOT/state/orchestrator.json"
else
  sed -i "s/\"startupId\": \"\"/\"startupId\": \"$STARTUP_ID\"/" "$LOKI_ROOT/state/orchestrator.json"
fi

echo "Bootstrap complete: $LOKI_ROOT initialized"
```

## State Schema

### `.loki/state/orchestrator.json`
```json
{
  "version": "2.1.0",
  "startupId": "uuid",
  "phase": "string",
  "subPhase": "string",
  "prdPath": "string",
  "prdHash": "md5",
  "prdLastModified": "ISO-timestamp",
  "agents": {
    "active": [{"id":"eng-backend-01","role":"eng-backend","taskId":"uuid","startedAt":"ISO"}],
    "idle": [],
    "failed": [{"id":"eng-frontend-02","role":"eng-frontend","failureCount":3,"lastError":"string"}],
    "totalSpawned": 0,
    "totalTerminated": 0
  },
  "circuitBreakers": {
    "eng-frontend": {"state":"closed","failures":0,"lastFailure":null,"cooldownUntil":null},
    "external-api": {"state":"open","failures":5,"lastFailure":"ISO","cooldownUntil":"ISO"}
  },
  "metrics": {
    "tasksCompleted": 0,
    "tasksFailed": 0,
    "tasksInDeadLetter": 0,
    "deployments": 0,
    "rollbacks": 0,
    "incidentsDetected": 0,
    "incidentsResolved": 0,
    "revenue": 0,
    "customers": 0,
    "agentComputeMinutes": 0
  },
  "lastCheckpoint": "ISO-timestamp",
  "lastBackup": "ISO-timestamp",
  "lastLogRotation": "ISO-timestamp",
  "currentRelease": "semver",
  "systemHealth": "green|yellow|red",
  "pausedAt": null,
  "pauseReason": null
}
```

### Agent State Schema (`.loki/state/agents/[id].json`)
```json
{
  "id": "eng-backend-01",
  "role": "eng-backend",
  "status": "active|idle|failed|terminated",
  "currentTask": "task-uuid|null",
  "tasksCompleted": 12,
  "tasksFailed": 1,
  "consecutiveFailures": 0,
  "lastHeartbeat": "ISO-timestamp",
  "lastTaskCompleted": "ISO-timestamp",
  "idleSince": "ISO-timestamp|null",
  "errorLog": ["error1", "error2"],
  "resourceUsage": {
    "tokensUsed": 50000,
    "apiCalls": 25
  }
}
```

### Circuit Breaker States
```
CLOSED (normal) ──► failures++ ──► threshold reached ──► OPEN (blocking)
                                                              │
                                                         cooldown expires
                                                              │
                                                              ▼
                                                        HALF-OPEN (testing)
                                                              │
                                          success ◄───────────┴───────────► failure
                                             │                                  │
                                             ▼                                  ▼
                                          CLOSED                              OPEN
```

**Circuit Breaker Config (`.loki/config/circuit-breakers.yaml`):**
```yaml
defaults:
  failureThreshold: 5
  cooldownSeconds: 300
  halfOpenRequests: 3

overrides:
  external-api:
    failureThreshold: 3
    cooldownSeconds: 600
  eng-frontend:
    failureThreshold: 10
    cooldownSeconds: 180
```

## Agent Spawning via Task Tool

### Primary Method: Claude Task Tool (Recommended)
```markdown
Use the Task tool to dispatch subagents. Each task gets a fresh context (no pollution).

**Dispatch Implementation Subagent:**
[Task tool call]
- description: "Implement [task name] from plan"
- instructions: |
    1. Read task requirements from .loki/queue/in-progress.json
    2. Implement following TDD (test first, then code)
    3. Verify all tests pass
    4. Commit with conventional commit message
    5. Report: WHAT_WAS_IMPLEMENTED, FILES_CHANGED, TEST_RESULTS
- model: "sonnet" (default for standard implementation)
- working_directory: [project root]
```

### Haiku Parallelization for Speed (CRITICAL)

**When to use Haiku agents (EXTENSIVELY):**
- Unit test execution (1 agent per test file = 10-50 parallel agents)
- Documentation generation (1 agent per module)
- Linting/formatting (1 agent per directory)
- Simple bug fixes (1 agent per file)
- Bash command execution (git, npm, docker, etc.)

**Example: Parallel Unit Testing (10+ Haiku Agents):**
```python
# Get all test files
test_files = glob("**/*test.ts") + glob("**/*.spec.ts")

# Dispatch Haiku agent for EACH test file (DON'T wait for sequential completion)
background_tasks = []
for test_file in test_files:
    task = Task(
        subagent_type="general-purpose",
        model="haiku",  # Fast, cheap, perfect for unit tests
        description=f"Test: {test_file}",
        prompt=f"Run npm test {test_file} and report results",
        run_in_background=True  # CRITICAL: Non-blocking parallel execution
    )
    background_tasks.append(task)

# Collect results from all background tasks
results = [TaskOutput(task_id=t, block=True) for t in background_tasks]
```

**Example: Parallel Documentation (5+ Haiku Agents):**
```python
modules = ["auth", "users", "products", "orders", "payments"]
for module in modules:
    Task(
        subagent_type="general-purpose",
        model="haiku",
        description=f"Document {module} module",
        prompt=f"Generate API documentation for src/{module}/ with examples",
        run_in_background=True
    )
```

**Example: Parallel Linting (Directory-level):**
```python
directories = ["src/components", "src/api", "src/utils", "src/models"]
for directory in directories:
    Task(
        subagent_type="general-purpose",
        model="haiku",
        description=f"Lint {directory}",
        prompt=f"Run ESLint on {directory} and fix auto-fixable issues",
        run_in_background=True
    )
```

**Performance Gain:**
- **Sequential (Sonnet)**: 50 test files × 30s = 25 minutes
- **Parallel (Haiku)**: 50 test files ÷ 10 concurrent = ~3 minutes (8x faster + cheaper)

### Parallel Code Review (3 Reviewers Simultaneously)

**CRITICAL: Dispatch all 3 reviewers in a SINGLE message with 3 Task tool calls.**

```markdown
[Task tool call 1: code-reviewer]
- description: "Code quality review for [task]"
- instructions: Review for code quality, patterns, maintainability
- model: "opus" (deep analysis)
- context: WHAT_WAS_IMPLEMENTED, BASE_SHA, HEAD_SHA

[Task tool call 2: business-logic-reviewer]  
- description: "Business logic review for [task]"
- instructions: Review for correctness, edge cases, requirements alignment
- model: "opus"
- context: WHAT_WAS_IMPLEMENTED, REQUIREMENTS, BASE_SHA, HEAD_SHA

[Task tool call 3: security-reviewer]
- description: "Security review for [task]"
- instructions: Review for vulnerabilities, auth issues, data exposure
- model: "opus"
- context: WHAT_WAS_IMPLEMENTED, BASE_SHA, HEAD_SHA
```

**Each reviewer returns:**
```json
{
  "strengths": ["list of good things"],
  "issues": [
    {"severity": "Critical|High|Medium|Low|Cosmetic", "description": "...", "location": "file:line"}
  ],
  "assessment": "PASS|FAIL"
}
```

### Severity-Based Issue Handling

| Severity | Action | Tracking |
|----------|--------|----------|
| **Critical** | BLOCK. Dispatch fix subagent immediately. Re-run ALL 3 reviewers. | None (must fix) |
| **High** | BLOCK. Dispatch fix subagent. Re-run ALL 3 reviewers. | None (must fix) |
| **Medium** | BLOCK. Dispatch fix subagent. Re-run ALL 3 reviewers. | None (must fix) |
| **Low** | PASS. Add TODO comment, commit, continue. | `# TODO(review): [issue] - [reviewer], [date], Severity: Low` |
| **Cosmetic** | PASS. Add FIXME comment, commit, continue. | `# FIXME(nitpick): [issue] - [reviewer], [date], Severity: Cosmetic` |

### Re-Review Loop
```
IMPLEMENT → REVIEW (3 parallel) → AGGREGATE
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
        Critical/High/Medium?                           All PASS?
              │                                               │
              ▼                                               ▼
    Dispatch fix subagent                              Mark complete
              │                                        Add TODO/FIXME
              ▼                                        Next task
    Re-run ALL 3 reviewers ─────────────────────────────────┘
              │
              └──► Loop until all PASS
```

### Context Pollution Prevention
**Each subagent gets fresh context. NEVER:**
- Try to fix in orchestrator context (dispatch fix subagent instead)
- Carry state between subagent invocations
- Mix implementation and review in same subagent

### Alternative Spawn Methods

**Method 2: Sequential Subprocess (for environments without Task tool)**
```bash
claude --dangerously-skip-permissions \
  -p "$(cat .loki/prompts/eng-backend.md)" \
  --output-format json \
  > .loki/messages/outbox/eng-backend-01/result.json
```

**Method 3: Parallel via tmux (Advanced, for true parallelism)**
```bash
#!/bin/bash
# Spawn 3 reviewers in parallel
tmux new-session -d -s reviewers
tmux new-window -t reviewers -n code "claude -p '$(cat .loki/prompts/code-reviewer.md)' --dangerously-skip-permissions"
tmux new-window -t reviewers -n business "claude -p '$(cat .loki/prompts/business-reviewer.md)' --dangerously-skip-permissions"
tmux new-window -t reviewers -n security "claude -p '$(cat .loki/prompts/security-reviewer.md)' --dangerously-skip-permissions"
# Wait for all to complete
```

### Model Selection by Task Type

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Implementation | sonnet | Fast, good enough for coding |
| Code Review | opus | Deep analysis, catches subtle issues |
| Security Review | opus | Critical, needs thoroughness |
| Business Logic Review | opus | Needs to understand requirements deeply |
| Documentation | sonnet | Straightforward writing |
| Quick fixes | haiku | Fast iteration |

### Agent Lifecycle
```
SPAWN → INITIALIZE → POLL_QUEUE → CLAIM_TASK → EXECUTE → REPORT → POLL_QUEUE
           │              │                        │          │
           │         circuit open?             timeout?    success?
           │              │                        │          │
           ▼              ▼                        ▼          ▼
     Create state    WAIT_BACKOFF              RELEASE    UPDATE_STATE
                          │                    + RETRY         │
                     exponential                              │
                       backoff                                ▼
                                                    NO_TASKS ──► IDLE (5min)
                                                                    │
                                                             idle > 30min?
                                                                    │
                                                                    ▼
                                                               TERMINATE
```

### Dynamic Scaling Rules
| Condition | Action | Cooldown |
|-----------|--------|----------|
| Queue depth > 20 | Spawn 2 agents of bottleneck type | 5min |
| Queue depth > 50 | Spawn 5 agents, alert orchestrator | 2min |
| Agent idle > 30min | Terminate agent | - |
| Agent failed 3x consecutive | Terminate, open circuit breaker | 5min |
| Critical task waiting > 10min | Spawn priority agent | 1min |
| Circuit breaker half-open | Spawn 1 test agent | - |
| All agents of type failed | HALT, request human intervention | - |

### File Locking for Task Claims
```bash
#!/bin/bash
# Atomic task claim using flock

QUEUE_FILE=".loki/queue/pending.json"
LOCK_FILE=".loki/state/locks/queue.lock"

(
  flock -x -w 10 200 || exit 1
  
  # Read, claim, write atomically
  TASK=$(jq -r '.tasks | map(select(.claimedBy == null)) | .[0]' "$QUEUE_FILE")
  if [ "$TASK" != "null" ]; then
    TASK_ID=$(echo "$TASK" | jq -r '.id')
    jq --arg id "$TASK_ID" --arg agent "$AGENT_ID" \
      '.tasks |= map(if .id == $id then .claimedBy = $agent | .claimedAt = now else . end)' \
      "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" && mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
    echo "$TASK_ID"
  fi
  
) 200>"$LOCK_FILE"
```

## Agent Types (37 Total)

See `references/agents.md` for complete definitions. Summary:

### Engineering Swarm (8 agents)
| Agent | Capabilities |
|-------|-------------|
| `eng-frontend` | React/Vue/Svelte, TypeScript, Tailwind, accessibility |
| `eng-backend` | Node/Python/Go, REST/GraphQL, auth, business logic |
| `eng-database` | PostgreSQL/MySQL/MongoDB, migrations, query optimization |
| `eng-mobile` | React Native/Flutter/Swift/Kotlin, offline-first |
| `eng-api` | OpenAPI specs, SDK generation, versioning, webhooks |
| `eng-qa` | Unit/integration/E2E tests, coverage, automation |
| `eng-perf` | Profiling, benchmarking, optimization, caching |
| `eng-infra` | Docker, K8s manifests, IaC review |

### Operations Swarm (8 agents)
| Agent | Capabilities |
|-------|-------------|
| `ops-devops` | CI/CD pipelines, GitHub Actions, GitLab CI |
| `ops-sre` | Reliability, SLOs/SLIs, capacity planning, on-call |
| `ops-security` | SAST/DAST, pen testing, vulnerability management |
| `ops-monitor` | Observability, Datadog/Grafana, alerting, dashboards |
| `ops-incident` | Incident response, runbooks, RCA, post-mortems |
| `ops-release` | Versioning, changelogs, blue-green, canary, rollbacks |
| `ops-cost` | Cloud cost optimization, right-sizing, FinOps |
| `ops-compliance` | SOC2, GDPR, HIPAA, PCI-DSS, audit preparation |

### Business Swarm (8 agents)
| Agent | Capabilities |
|-------|-------------|
| `biz-marketing` | Landing pages, SEO, content, email campaigns |
| `biz-sales` | CRM setup, outreach, demos, proposals, pipeline |
| `biz-finance` | Billing (Stripe), invoicing, metrics, runway, pricing |
| `biz-legal` | ToS, privacy policy, contracts, IP protection |
| `biz-support` | Help docs, FAQs, ticket system, chatbot |
| `biz-hr` | Job posts, recruiting, onboarding, culture docs |
| `biz-investor` | Pitch decks, investor updates, data room, cap table |
| `biz-partnerships` | BD outreach, integration partnerships, co-marketing |

### Data Swarm (3 agents)
| Agent | Capabilities |
|-------|-------------|
| `data-ml` | Model training, MLOps, feature engineering, inference |
| `data-eng` | ETL pipelines, data warehousing, dbt, Airflow |
| `data-analytics` | Product analytics, A/B tests, dashboards, insights |

### Product Swarm (3 agents)
| Agent | Capabilities |
|-------|-------------|
| `prod-pm` | Backlog grooming, prioritization, roadmap, specs |
| `prod-design` | Design system, Figma, UX patterns, prototypes |
| `prod-techwriter` | API docs, guides, tutorials, release notes |

### Growth Swarm (4 agents)
| Agent | Capabilities |
|-------|-------------|
| `growth-hacker` | Growth experiments, viral loops, referral programs |
| `growth-community` | Community building, Discord/Slack, ambassador programs |
| `growth-success` | Customer success, health scoring, churn prevention |
| `growth-lifecycle` | Email lifecycle, in-app messaging, re-engagement |

### Review Swarm (3 agents)
| Agent | Capabilities |
|-------|-------------|
| `review-code` | Code quality, design patterns, SOLID, maintainability |
| `review-business` | Requirements alignment, business logic, edge cases |
| `review-security` | Vulnerabilities, auth/authz, OWASP Top 10 |

## Distributed Task Queue

### Task Schema
```json
{
  "id": "uuid",
  "idempotencyKey": "hash-of-task-content",
  "type": "eng-backend|eng-frontend|ops-devops|...",
  "priority": 1-10,
  "dependencies": ["task-id-1", "task-id-2"],
  "payload": {
    "action": "implement|test|deploy|...",
    "target": "file/path or resource",
    "params": {},
    "goal": "What success looks like (high-level objective)",
    "constraints": ["No third-party deps", "Maintain backwards compat"],
    "context": {
      "relatedFiles": ["file1.ts", "file2.ts"],
      "architectureDecisions": ["ADR-001: Use JWT tokens"],
      "previousAttempts": "What was tried before, why it failed"
    }
  },
  "createdAt": "ISO",
  "claimedBy": null,
  "claimedAt": null,
  "timeout": 3600,
  "retries": 0,
  "maxRetries": 3,
  "backoffSeconds": 60,
  "lastError": null,
  "completedAt": null,
  "result": {
    "status": "success|failed",
    "output": "What was produced",
    "decisionReport": {
      "why": {
        "problem": "What was broken/missing",
        "rootCause": "Why it happened",
        "solutionChosen": "What we implemented",
        "alternativesConsidered": [
          {"option": "Option A", "rejected": "reason"},
          {"option": "Option B", "rejected": "reason"}
        ]
      },
      "what": {
        "filesModified": [
          {"path": "src/auth.ts", "lines": "45-89", "purpose": "Extracted validation"}
        ],
        "apisChanged": {"breaking": [], "nonBreaking": ["/auth/login"]},
        "behaviorChanges": "What users will notice",
        "dependenciesChanged": {"added": [], "removed": []}
      },
      "tradeoffs": {
        "gained": ["Better testability", "40% faster"],
        "cost": ["Added 2 new functions", "Migration required"],
        "neutral": ["No performance change for standard use"]
      },
      "risks": [
        {
          "risk": "Custom validators may break",
          "mitigation": "Added backwards-compat shim"
        }
      ],
      "testResults": {
        "unit": {"passed": 24, "failed": 0, "coverage": "92%"},
        "integration": {"passed": 8, "failed": 0},
        "performance": "p99: 145ms → 87ms"
      },
      "nextSteps": [
        "Monitor error rates for 24h",
        "Remove compat shim in v3.0"
      ]
    }
  }
}
```

**Decision Report is REQUIRED for completed tasks.** Tasks without proper decision documentation will be marked as incomplete.

### Queue Operations

**Claim Task (with file locking):**
```python
# Pseudocode - actual implementation uses flock
def claim_task(agent_id, agent_capabilities):
    with file_lock(".loki/state/locks/queue.lock", timeout=10):
        pending = read_json(".loki/queue/pending.json")
        
        # Find eligible task
        for task in sorted(pending.tasks, key=lambda t: -t.priority):
            if task.type not in agent_capabilities:
                continue
            if task.claimedBy and not claim_expired(task):
                continue
            if not all_dependencies_completed(task.dependencies):
                continue
            if circuit_breaker_open(task.type):
                continue
                
            # Claim it
            task.claimedBy = agent_id
            task.claimedAt = now()
            move_task(task, "pending", "in-progress")
            return task
        
        return None
```

**Complete Task:**
```python
def complete_task(task_id, result, success=True):
    with file_lock(".loki/state/locks/queue.lock"):
        task = find_task(task_id, "in-progress")
        task.completedAt = now()
        task.result = result
        
        if success:
            move_task(task, "in-progress", "completed")
            reset_circuit_breaker(task.type)
            trigger_dependents(task_id)
        else:
            handle_failure(task)
```

**Failure Handling with Exponential Backoff:**
```python
def handle_failure(task):
    task.retries += 1
    task.lastError = get_last_error()
    
    if task.retries >= task.maxRetries:
        # Move to dead letter queue
        move_task(task, "in-progress", "dead-letter")
        increment_circuit_breaker(task.type)
        alert_orchestrator(f"Task {task.id} moved to dead letter queue")
    else:
        # Exponential backoff: 60s, 120s, 240s, ...
        task.backoffSeconds = task.backoffSeconds * (2 ** (task.retries - 1))
        task.availableAt = now() + task.backoffSeconds
        move_task(task, "in-progress", "pending")
        log(f"Task {task.id} retry {task.retries}, backoff {task.backoffSeconds}s")
```

### Dead Letter Queue Handling
Tasks in dead letter queue require manual review:
```markdown
## Dead Letter Queue Review Process

1. Read `.loki/queue/dead-letter.json`
2. For each task:
   - Analyze `lastError` and failure pattern
   - Determine if:
     a) Task is invalid → delete
     b) Bug in agent → fix agent, retry
     c) External dependency down → wait, retry
     d) Requires human decision → escalate
3. To retry: move task back to pending with reset retries
4. Log decision in `.loki/logs/decisions/dlq-review-{date}.md`
```

### Idempotency
```python
def enqueue_task(task):
    # Generate idempotency key from content
    task.idempotencyKey = hash(json.dumps(task.payload, sort_keys=True))
    
    # Check if already exists
    for queue in ["pending", "in-progress", "completed"]:
        existing = find_by_idempotency_key(task.idempotencyKey, queue)
        if existing:
            log(f"Duplicate task detected: {task.idempotencyKey}")
            return existing.id  # Return existing, don't create duplicate
    
    # Safe to create
    save_task(task, "pending")
    return task.id
```

### Task Cancellation
```python
def cancel_task(task_id, reason):
    with file_lock(".loki/state/locks/queue.lock"):
        for queue in ["pending", "in-progress"]:
            task = find_task(task_id, queue)
            if task:
                task.cancelledAt = now()
                task.cancelReason = reason
                move_task(task, queue, "cancelled")
                
                # Cancel dependent tasks too
                for dep_task in find_tasks_depending_on(task_id):
                    cancel_task(dep_task.id, f"Parent {task_id} cancelled")
                
                return True
        return False
```

## Execution Phases

### Phase 0: Bootstrap
1. Create `.loki/` directory structure
2. Initialize orchestrator state
3. Validate PRD exists and is readable
4. Spawn initial agent pool (3-5 agents)

### Phase 1: Discovery
1. Parse PRD, extract requirements
2. Spawn `biz-analytics` agent for competitive research
3. Web search competitors, extract features, reviews
4. Identify market gaps and opportunities
5. Generate task backlog with priorities and dependencies

### Phase 2: Architecture
**SPEC-FIRST WORKFLOW** - Generate OpenAPI spec BEFORE code:

1. **Extract API Requirements from PRD**
   - Parse PRD for user stories and functionality
   - Map to REST/GraphQL operations
   - Document data models and relationships

2. **Generate OpenAPI 3.1 Specification**
   - Create `.loki/specs/openapi.yaml` with all endpoints
   - Define request/response schemas
   - Document error codes and validation rules
   - Add performance requirements (x-performance extension)
   - Validate spec with Spectral

3. **Generate Artifacts from Spec**
   - TypeScript types: `npx openapi-typescript .loki/specs/openapi.yaml --output src/types/api.ts`
   - Client SDK for frontend
   - Server stubs for backend
   - API documentation (ReDoc/Swagger UI)

4. **Select Tech Stack** (via consensus)
   - Spawn `eng-backend` + `eng-frontend` architects
   - Both agents review spec and propose stack
   - Consensus required (both must agree)
   - Self-reflection checkpoint with evidence

5. **Generate Infrastructure Requirements**
   - Based on spec and tech stack
   - Database schema from data models
   - Caching strategy from performance requirements
   - Scaling requirements from load estimates

6. **Create Project Scaffolding**
   - Initialize project with tech stack
   - Install dependencies
   - Configure linters based on spec validation rules
   - Setup contract testing framework

### Phase 3: Infrastructure
1. Spawn `ops-devops` agent
2. Provision cloud resources (see `references/deployment.md`)
3. Set up CI/CD pipelines
4. Configure monitoring and alerting
5. Create staging and production environments

### Phase 4: Development
1. Decompose into parallelizable tasks
2. For each task:
   ```
   a. Dispatch implementation subagent (Task tool, model: sonnet)
   b. Subagent implements with TDD, commits, reports back
   c. Dispatch 3 reviewers IN PARALLEL (single message, 3 Task calls):
      - code-reviewer (opus)
      - business-logic-reviewer (opus)
      - security-reviewer (opus)
   d. Aggregate findings by severity
   e. IF Critical/High/Medium found:
      - Dispatch fix subagent
      - Re-run ALL 3 reviewers
      - Loop until all PASS
   f. Add TODO comments for Low issues
   g. Add FIXME comments for Cosmetic issues
   h. Mark task complete
   ```
3. Orchestrator monitors progress, scales agents
4. Continuous integration on every commit

### Phase 5: Quality Assurance
1. Spawn `eng-qa` and `ops-security` agents
2. Execute all quality gates (see Quality Gates section)
3. Bug hunt phase with fuzzing and chaos testing
4. Security audit and penetration testing
5. Performance benchmarking

### Phase 6: Deployment
1. Spawn `ops-release` agent
2. Generate semantic version, changelog
3. Create release branch, tag
4. Deploy to staging, run smoke tests
5. Blue-green deploy to production
6. Monitor for 30min, auto-rollback if errors spike

### Phase 7: Business Operations
1. Spawn business swarm agents
2. `biz-marketing`: Create landing page, SEO, content
3. `biz-sales`: Set up CRM, outreach templates
4. `biz-finance`: Configure billing, invoicing
5. `biz-support`: Create help docs, chatbot
6. `biz-legal`: Generate ToS, privacy policy

### Phase 8: Growth Loop
Continuous cycle:
```
MONITOR → ANALYZE → OPTIMIZE → DEPLOY → MONITOR
    ↓
Customer feedback → Feature requests → Backlog
    ↓
A/B tests → Winner → Permanent deploy
    ↓
Incidents → RCA → Prevention → Deploy fix
```

### Final Review (After All Development Tasks)

Before any deployment, run comprehensive review:
```
1. Dispatch 3 reviewers reviewing ENTIRE implementation:
   - code-reviewer: Full codebase quality
   - business-logic-reviewer: All requirements met
   - security-reviewer: Full security audit

2. Aggregate findings across all files
3. Fix Critical/High/Medium issues
4. Re-run all 3 reviewers until all PASS
5. Generate final report in .loki/artifacts/reports/final-review.md
6. Proceed to deployment only after all PASS
```

## Quality Gates

All gates must pass before production deploy:

| Gate | Agent | Pass Criteria |
|------|-------|---------------|
| Unit Tests | eng-qa | 100% pass |
| Integration Tests | eng-qa | 100% pass |
| E2E Tests | eng-qa | 100% pass |
| Coverage | eng-qa | > 80% |
| Linting | eng-qa | 0 errors |
| Type Check | eng-qa | 0 errors |
| Security Scan | ops-security | 0 high/critical |
| Dependency Audit | ops-security | 0 vulnerabilities |
| Performance | eng-qa | p99 < 200ms |
| Accessibility | eng-frontend | WCAG 2.1 AA |
| Load Test | ops-devops | Handles 10x expected traffic |
| Chaos Test | ops-devops | Recovers from failures |
| Cost Estimate | ops-cost | Within budget |
| Legal Review | biz-legal | Compliant |

## Deployment Targets

See `references/deployment.md` for detailed instructions. Supported:
- **Vercel/Netlify**: Frontend, serverless
- **AWS**: EC2, ECS, Lambda, RDS, S3
- **GCP**: Cloud Run, GKE, Cloud SQL
- **Azure**: App Service, AKS, Azure SQL
- **Railway/Render**: Simple full-stack
- **Self-hosted**: Docker Compose, K8s manifests

## Inter-Agent Communication

### Message Schema
```json
{
  "from": "agent-id",
  "to": "agent-id | broadcast",
  "type": "request | response | event",
  "subject": "string",
  "payload": {},
  "timestamp": "ISO",
  "correlationId": "uuid"
}
```

### Message Types
- `task-complete`: Notify dependent tasks
- `blocker`: Escalate to orchestrator
- `review-request`: Code review from peer
- `deploy-ready`: Signal release agent
- `incident`: Alert incident response
- `scale-request`: Request more agents
- `heartbeat`: Agent alive signal

## Incident Response

### Auto-Detection
- Error rate > 1% for 5min
- p99 latency > 500ms for 10min
- Health check failures
- Memory/CPU threshold breach

### Response Protocol
1. `ops-incident` agent activated
2. Capture logs, metrics, traces
3. Attempt auto-remediation (restart, scale, rollback)
4. If unresolved in 15min: escalate to orchestrator
5. Generate RCA document
6. Create prevention tasks in backlog

## Rollback System

### Version Management
```
releases/
├── v1.0.0/
│   ├── manifest.json
│   ├── artifacts/
│   └── config/
├── v1.0.1/
└── v1.1.0/
```

### Rollback Triggers
- Error rate increases 5x post-deploy
- Health checks fail
- Manual trigger via message

### Rollback Execution
1. Identify last known good version
2. Deploy previous artifacts
3. Restore previous config
4. Verify health
5. Log incident for RCA

## Tech Debt Tracking

### TODO/FIXME Comment Format

**Low Severity Issues:**
```javascript
// TODO(review): Extract token validation to separate function - code-reviewer, 2025-01-15, Severity: Low
function authenticate(req) {
  const token = req.headers.authorization;
  // ...
}
```

**Cosmetic Issues:**
```python
# FIXME(nitpick): Consider renaming 'data' to 'user_payload' for clarity - code-reviewer, 2025-01-15, Severity: Cosmetic
def process_data(data):
    pass
```

### Tech Debt Backlog

After each review cycle, aggregate TODO/FIXME comments:
```bash
# Generate tech debt report
grep -rn "TODO(review)\|FIXME(nitpick)" src/ > .loki/artifacts/reports/tech-debt.txt

# Count by severity
echo "Low: $(grep -c 'Severity: Low' .loki/artifacts/reports/tech-debt.txt)"
echo "Cosmetic: $(grep -c 'Severity: Cosmetic' .loki/artifacts/reports/tech-debt.txt)"
```

### Tech Debt Remediation

When backlog exceeds threshold:
```yaml
thresholds:
  low_issues_max: 20      # Create remediation sprint if exceeded
  cosmetic_issues_max: 50 # Create cleanup task if exceeded
  
actions:
  low: Create task priority 3, assign to original agent type
  cosmetic: Batch into single cleanup task, priority 5
```

## Conflict Resolution

### File Contention
When multiple agents might edit the same file:
```python
def acquire_file_lock(file_path, agent_id, timeout=300):
    lock_file = f".loki/state/locks/files/{hash(file_path)}.lock"
    
    while timeout > 0:
        if not os.path.exists(lock_file):
            # Create lock
            with open(lock_file, 'w') as f:
                json.dump({
                    "file": file_path,
                    "agent": agent_id,
                    "acquired": datetime.now().isoformat(),
                    "expires": (datetime.now() + timedelta(minutes=10)).isoformat()
                }, f)
            return True
        
        # Check if lock expired
        lock_data = json.load(open(lock_file))
        if datetime.fromisoformat(lock_data["expires"]) < datetime.now():
            os.remove(lock_file)
            continue
        
        # Wait and retry
        time.sleep(5)
        timeout -= 5
    
    return False  # Failed to acquire

def release_file_lock(file_path):
    lock_file = f".loki/state/locks/files/{hash(file_path)}.lock"
    if os.path.exists(lock_file):
        os.remove(lock_file)
```

### Decision Conflicts
When two agents disagree (e.g., architecture decisions):
```markdown
## Conflict Resolution Protocol

1. **Detection**: Agent detects conflicting recommendation in messages
2. **Escalate**: Both agents submit reasoning to orchestrator
3. **Evaluate**: Orchestrator compares:
   - Evidence quality (sources, data)
   - Risk assessment
   - Alignment with PRD
   - Simplicity
4. **Decide**: Orchestrator makes final call, documents in LOKI-LOG.md
5. **Notify**: Losing agent receives decision with explanation

Decision logged as:
```
## [TIMESTAMP] CONFLICT RESOLUTION: {topic}
**Agents:** {agent-1} vs {agent-2}
**Position 1:** {summary}
**Position 2:** {summary}
**Decision:** {chosen position}
**Reasoning:** {why this was chosen}
**Dissent noted:** {key points from rejected position for future reference}
```
```

### Merge Conflicts (Code)
```bash
# When git merge conflict detected:
1. Identify conflicting files
2. For each file:
   a. Parse conflict markers
   b. Analyze both versions
   c. Determine intent of each change
   d. If complementary → merge manually
   e. If contradictory → escalate to orchestrator
3. Run tests after resolution
4. If tests fail → revert, re-queue both tasks with dependency
```

## Anti-Hallucination Protocol

Every agent must:
1. **Verify before claiming**: Web search official docs
2. **Test before committing**: Run code, don't assume
3. **Cite sources**: Log URLs for all external claims
4. **Cross-validate**: Critical decisions need 2 agent agreement
5. **Fail safe**: When uncertain, ask orchestrator

## Self-Reflection Checkpoints

Triggered at:
- Architecture decisions
- Technology selections
- Major refactors
- Pre-deployment
- Post-incident

Questions (logged in LOKI-LOG.md):
1. What evidence supports this?
2. What would disprove this?
3. What's the worst case?
4. Is there a simpler way?
5. What would an expert challenge?

## Timeout and Stuck Agent Handling

### Task Timeout Configuration
Different task types have different timeout limits:

```yaml
# .loki/config/timeouts.yaml
defaults:
  task: 300          # 5 minutes for general tasks

overrides:
  build:
    timeout: 600     # 10 minutes for builds (npm build, webpack, etc.)
    retryIncrease: 1.25  # Increase by 25% on retry
  test:
    timeout: 900     # 15 minutes for test suites
    retryIncrease: 1.5
  deploy:
    timeout: 1800    # 30 minutes for deployments
    retryIncrease: 1.0   # Don't increase
  quick:
    timeout: 60      # 1 minute for simple tasks
    retryIncrease: 1.0
```

### Command Execution with Timeout
All bash commands are wrapped with timeout to prevent stuck processes:

```bash
# Standard command execution pattern
run_with_timeout() {
  local timeout_seconds="$1"
  shift
  local cmd="$@"

  # Use timeout command (GNU coreutils)
  if timeout "$timeout_seconds" bash -c "$cmd"; then
    return 0
  else
    local exit_code=$?
    if [ $exit_code -eq 124 ]; then
      echo "TIMEOUT: Command exceeded ${timeout_seconds}s"
      return 124
    fi
    return $exit_code
  fi
}

# Example: npm build with 10 minute timeout
run_with_timeout 600 "npm run build"
```

### Stuck Agent Detection (Heartbeat)
Agents must send heartbeats to indicate they're still alive:

```python
HEARTBEAT_INTERVAL = 60     # Send every 60 seconds
HEARTBEAT_TIMEOUT = 300     # Consider dead after 5 minutes

def check_agent_health(agent_state):
    if not agent_state.get('lastHeartbeat'):
        return 'unknown'

    last_hb = datetime.fromisoformat(agent_state['lastHeartbeat'])
    age = (datetime.utcnow() - last_hb).total_seconds()

    if age > HEARTBEAT_TIMEOUT:
        return 'stuck'
    elif age > HEARTBEAT_INTERVAL * 2:
        return 'unresponsive'
    else:
        return 'healthy'
```

### Stuck Process Recovery
When an agent is detected as stuck:

```python
def handle_stuck_agent(agent_id):
    # 1. Mark agent as failed
    update_agent_status(agent_id, 'failed')

    # 2. Release claimed task back to queue
    task = get_current_task(agent_id)
    if task:
        task['claimedBy'] = None
        task['claimedAt'] = None
        task['lastError'] = f'Agent {agent_id} became unresponsive'
        task['retries'] += 1

        # Increase timeout for retry
        timeout_config = get_timeout_config(task['type'])
        task['timeout'] = int(task['timeout'] * timeout_config.get('retryIncrease', 1.25))

        move_task(task, 'in-progress', 'pending')

    # 3. Increment circuit breaker failure count
    increment_circuit_breaker(agent_role(agent_id))

    # 4. Log incident
    log_incident(f'Agent {agent_id} stuck, task requeued')
```

### Watchdog Pattern
Each subagent implements a watchdog that must be "pet" regularly:

```python
class AgentWatchdog:
    def __init__(self, timeout_seconds):
        self.timeout = timeout_seconds
        self.last_pet = datetime.utcnow()

    def pet(self):
        """Call this during long operations to prevent timeout"""
        self.last_pet = datetime.utcnow()
        self.update_heartbeat()

    def is_expired(self):
        age = (datetime.utcnow() - self.last_pet).total_seconds()
        return age > self.timeout

    def update_heartbeat(self):
        # Write to agent state file
        state_file = f'.loki/state/agents/{self.agent_id}.json'
        with open(state_file, 'r+') as f:
            state = json.load(f)
            state['lastHeartbeat'] = datetime.utcnow().isoformat() + 'Z'
            f.seek(0)
            json.dump(state, f)
            f.truncate()
```

### Graceful Termination
When terminating an agent, use graceful shutdown:

```bash
terminate_agent() {
  local pid="$1"
  local grace_period=30  # seconds

  # 1. Send SIGTERM for graceful shutdown
  kill -TERM "$pid" 2>/dev/null || return 0

  # 2. Wait for graceful exit
  for i in $(seq 1 $grace_period); do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Agent terminated gracefully"
      return 0
    fi
    sleep 1
  done

  # 3. Force kill if still running
  echo "Force killing agent after ${grace_period}s"
  kill -9 "$pid" 2>/dev/null || true
}
```

## Rate Limit Handling

### Distributed State Recovery
Each agent maintains own state in `.loki/state/agents/[id].json`

### Orchestrator Recovery
1. On startup, check `.loki/state/orchestrator.json`
2. If `lastCheckpoint` < 60min ago → resume
3. Scan agent states, identify incomplete tasks
4. Re-queue orphaned tasks (claimedAt expired)
5. Reset circuit breakers if cooldown expired
6. Spawn replacement agents for failed ones

### Agent Recovery
1. On spawn, check if state file exists for this ID
2. If resuming, continue from last task checkpoint
3. Report recovery event to orchestrator

### Exponential Backoff on Rate Limits
```python
def handle_rate_limit():
    base_delay = 60  # seconds
    max_delay = 3600  # 1 hour cap
    
    for attempt in range(10):
        delay = min(base_delay * (2 ** attempt), max_delay)
        jitter = random.uniform(0, delay * 0.1)
        
        checkpoint_state()
        log(f"Rate limited. Waiting {delay + jitter}s (attempt {attempt + 1})")
        sleep(delay + jitter)
        
        if not still_rate_limited():
            return True
    
    # Exceeded retries
    halt_system("Rate limit not clearing after 10 attempts")
    return False
```

## System Operations

### Pause/Resume
```bash
# Pause system (graceful)
echo '{"command":"pause","reason":"manual pause","timestamp":"'$(date -Iseconds)'"}' \
  > .loki/messages/broadcast/system-pause.json

# Orchestrator handles pause:
# 1. Stop claiming new tasks
# 2. Wait for in-progress tasks to complete (max 30min)
# 3. Checkpoint all state
# 4. Set orchestrator.pausedAt timestamp
# 5. Terminate idle agents

# Resume system
rm .loki/messages/broadcast/system-pause.json
# Orchestrator detects removal, resumes operations
```

### Graceful Shutdown
```bash
#!/bin/bash
# .loki/scripts/shutdown.sh

echo "Initiating graceful shutdown..."

# 1. Stop accepting new tasks
touch .loki/state/locks/shutdown.lock

# 2. Wait for in-progress tasks (max 30 min)
TIMEOUT=1800
ELAPSED=0
while [ -s .loki/queue/in-progress.json ] && [ $ELAPSED -lt $TIMEOUT ]; do
  echo "Waiting for $(jq '.tasks | length' .loki/queue/in-progress.json) tasks..."
  sleep 30
  ELAPSED=$((ELAPSED + 30))
done

# 3. Checkpoint everything
cp -r .loki/state .loki/artifacts/backups/shutdown-$(date +%Y%m%d-%H%M%S)

# 4. Update orchestrator state
jq '.phase = "shutdown" | .systemHealth = "offline"' \
  .loki/state/orchestrator.json > tmp && mv tmp .loki/state/orchestrator.json

echo "Shutdown complete"
```

### Backup Strategy
```bash
#!/bin/bash
# .loki/scripts/backup-state.sh
# Run hourly via orchestrator or cron

BACKUP_DIR=".loki/artifacts/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_PATH="$BACKUP_DIR/state-$TIMESTAMP"

mkdir -p "$BACKUP_PATH"

# Backup critical state
cp .loki/state/orchestrator.json "$BACKUP_PATH/"
cp -r .loki/state/agents "$BACKUP_PATH/"
cp -r .loki/queue "$BACKUP_PATH/"
cp .loki/logs/LOKI-LOG.md "$BACKUP_PATH/"

# Compress
tar -czf "$BACKUP_PATH.tar.gz" -C "$BACKUP_DIR" "state-$TIMESTAMP"
rm -rf "$BACKUP_PATH"

# Retain last 24 backups (24 hours if hourly)
ls -t "$BACKUP_DIR"/state-*.tar.gz | tail -n +25 | xargs -r rm

# Update orchestrator
jq --arg ts "$(date -Iseconds)" '.lastBackup = $ts' \
  .loki/state/orchestrator.json > tmp && mv tmp .loki/state/orchestrator.json

echo "Backup complete: $BACKUP_PATH.tar.gz"
```

### Log Rotation
```bash
#!/bin/bash
# .loki/scripts/rotate-logs.sh
# Run daily

LOG_DIR=".loki/logs"
ARCHIVE_DIR="$LOG_DIR/archive"
DATE=$(date +%Y%m%d)

mkdir -p "$ARCHIVE_DIR"

# Rotate main log
if [ -f "$LOG_DIR/LOKI-LOG.md" ]; then
  mv "$LOG_DIR/LOKI-LOG.md" "$ARCHIVE_DIR/LOKI-LOG-$DATE.md"
  echo "# Loki Mode Log - $(date +%Y-%m-%d)" > "$LOG_DIR/LOKI-LOG.md"
fi

# Rotate agent logs
for log in "$LOG_DIR/agents"/*.log; do
  [ -f "$log" ] || continue
  AGENT=$(basename "$log" .log)
  mv "$log" "$ARCHIVE_DIR/${AGENT}-${DATE}.log"
done

# Compress archives older than 7 days
find "$ARCHIVE_DIR" -name "*.md" -mtime +7 -exec gzip {} \;
find "$ARCHIVE_DIR" -name "*.log" -mtime +7 -exec gzip {} \;

# Delete archives older than 30 days
find "$ARCHIVE_DIR" -name "*.gz" -mtime +30 -delete

# Update orchestrator
jq --arg ts "$(date -Iseconds)" '.lastLogRotation = $ts' \
  .loki/state/orchestrator.json > tmp && mv tmp .loki/state/orchestrator.json
```

### External Alerting
```yaml
# .loki/config/alerting.yaml

channels:
  slack:
    webhook_url: "${SLACK_WEBHOOK_URL}"
    enabled: true
    severity: [critical, high]
  
  pagerduty:
    integration_key: "${PAGERDUTY_KEY}"
    enabled: false
    severity: [critical]
  
  email:
    smtp_host: "smtp.example.com"
    to: ["team@example.com"]
    enabled: true
    severity: [critical, high, medium]

alerts:
  system_down:
    severity: critical
    message: "Loki Mode system is down"
    channels: [slack, pagerduty, email]
  
  circuit_breaker_open:
    severity: high
    message: "Circuit breaker opened for {agent_type}"
    channels: [slack, email]
  
  dead_letter_queue:
    severity: high
    message: "{count} tasks in dead letter queue"
    channels: [slack, email]
  
  deployment_failed:
    severity: high
    message: "Deployment to {environment} failed"
    channels: [slack, pagerduty]
  
  budget_exceeded:
    severity: medium
    message: "Cloud costs exceeding budget by {percent}%"
    channels: [slack, email]
```

```bash
# Alert sending function
send_alert() {
  SEVERITY=$1
  MESSAGE=$2
  
  # Log locally
  echo "[$(date -Iseconds)] [$SEVERITY] $MESSAGE" >> .loki/logs/alerts.log
  
  # Send to Slack if configured
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      -d "{\"text\":\"[$SEVERITY] Loki Mode: $MESSAGE\"}"
  fi
}
```

## Invocation

**"Loki Mode"** or **"Loki Mode with PRD at [path]"**

### Startup Sequence
```
╔══════════════════════════════════════════════════════════════════╗
║                    LOKI MODE v2.0 ACTIVATED                       ║
║              Multi-Agent Autonomous Startup System                ║
╠══════════════════════════════════════════════════════════════════╣
║ PRD:          [path]                                              ║
║ State:        [NEW | RESUMING]                                    ║
║ Agents:       [0 active, spawning initial pool...]                ║
║ Permissions:  [VERIFIED --dangerously-skip-permissions]           ║
╠══════════════════════════════════════════════════════════════════╣
║ Initializing distributed task queue...                            ║
║ Spawning orchestrator agents...                                   ║
║ Beginning autonomous startup cycle...                             ║
╚══════════════════════════════════════════════════════════════════╝
```

## Monitoring Dashboard

Generated at `.loki/artifacts/reports/dashboard.md`:
```
# Loki Mode Dashboard

## Agents: 12 active | 3 idle | 0 failed
## Tasks: 45 completed | 8 in-progress | 12 pending
## Release: v1.2.0 (deployed 2h ago)
## Health: ALL GREEN

### Recent Activity
- [10:32] eng-backend-02 completed: Implement user auth
- [10:28] ops-devops-01 completed: Configure CI pipeline
- [10:25] biz-marketing-01 completed: Landing page copy

### Metrics
- Uptime: 99.97%
- p99 Latency: 145ms
- Error Rate: 0.02%
- Daily Active Users: 1,247
```

## Red Flags - Never Do These

### Implementation Anti-Patterns
- **NEVER** skip code review between tasks
- **NEVER** proceed with unfixed Critical/High/Medium issues
- **NEVER** dispatch reviewers sequentially (always parallel - 3x faster)
- **NEVER** dispatch multiple implementation subagents in parallel (conflicts)
- **NEVER** implement without reading the task requirements first
- **NEVER** forget to add TODO/FIXME comments for Low/Cosmetic issues
- **NEVER** try to fix issues in orchestrator context (dispatch fix subagent)

### Review Anti-Patterns
- **NEVER** use sonnet for reviews (always opus for deep analysis)
- **NEVER** aggregate before all 3 reviewers complete
- **NEVER** skip re-review after fixes
- **NEVER** mark task complete with Critical/High/Medium issues open

### System Anti-Patterns
- **NEVER** delete .loki/state/ directory while running
- **NEVER** manually edit queue files without file locking
- **NEVER** skip checkpoints before major operations
- **NEVER** ignore circuit breaker states
- **NEVER** deploy without final review passing

### Always Do These
- **ALWAYS** launch all 3 reviewers in single message (3 Task calls)
- **ALWAYS** specify model: "opus" for each reviewer
- **ALWAYS** wait for all reviewers before aggregating
- **ALWAYS** fix Critical/High/Medium immediately
- **ALWAYS** re-run ALL 3 reviewers after fixes (not just the one that found issue)
- **ALWAYS** checkpoint state before spawning subagents
- **ALWAYS** log decisions with evidence in LOKI-LOG.md

### If Subagent Fails
1. Do NOT try to fix manually (context pollution)
2. Dispatch fix subagent with specific error context
3. If fix subagent fails 3x, move to dead letter queue
4. Open circuit breaker for that agent type
5. Alert orchestrator for human review

## Exit Conditions

| Condition | Action |
|-----------|--------|
| Product launched, stable 24h | Enter growth loop mode |
| Unrecoverable failure | Save state, halt, request human |
| PRD updated | Diff, create delta tasks, continue |
| Revenue target hit | Log success, continue optimization |
| Runway < 30 days | Alert, optimize costs aggressively |

## References

- `references/agents.md`: Complete agent type definitions and capabilities
- `references/deployment.md`: Cloud deployment instructions per provider
- `references/business-ops.md`: Business operation workflows
