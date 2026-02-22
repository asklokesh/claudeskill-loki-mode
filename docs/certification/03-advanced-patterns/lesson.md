# Module 3: Advanced Patterns

## Overview

This module covers advanced patterns in Loki Mode: specialist review configuration, structured agent prompting, confidence-based routing, Chain-of-Verification, compound learning, and the event-driven hooks system.

## Structured Agent Prompting

Every Task dispatch in Loki Mode must include four sections: GOAL, CONSTRAINTS, CONTEXT, and OUTPUT. This template is documented in `skills/agents.md`.

```python
Task(
    subagent_type="general-purpose",
    model="opus",
    description="Implement user registration API",
    prompt="""
## GOAL
Create POST /api/users endpoint that registers new users.
Success: Endpoint works, tests pass, matches OpenAPI spec.

## CONSTRAINTS
- Use bcrypt for password hashing (already in dependencies)
- No new dependencies without approval
- Response time < 200ms

## CONTEXT
- Existing auth pattern: src/auth/login.ts
- OpenAPI spec: .loki/specs/openapi.yaml
- User model: src/models/user.ts

## OUTPUT
- [ ] Endpoint implementation in src/routes/users.ts
- [ ] Unit tests in tests/users.test.ts
- [ ] Integration test in tests/integration/users.test.ts
"""
)
```

This structure ensures agents have clear success criteria, boundaries, necessary context, and defined deliverables.

## Confidence-Based Routing

Loki Mode uses confidence scores to determine how much oversight a task needs. This is enabled by default (`LOKI_CONFIDENCE_ROUTING=true`).

| Confidence | Dispatch Strategy |
|------------|-------------------|
| >= 0.95 | Direct execution with fast-tier model, no review |
| 0.70-0.95 | Direct execution + asynchronous review |
| 0.40-0.70 | Supervisor orchestration, mandatory review |
| < 0.40 | Flag for human decision |

Confidence is calculated from five factors:

- Requirement clarity (30%)
- Similar past successes (20%)
- Technical complexity match (25%)
- Resource availability (15%)
- Time pressure (10%)

When confidence is below 0.40, the agent creates a `HUMAN_REVIEW_NEEDED` signal in `.loki/signals/` and blocks the task until human input is received.

## Chain-of-Verification (CoVe)

Based on research from arXiv 2309.11495, CoVe reduces hallucination by using factored, independent verification. The key insight: the verifier cannot see the original response, preventing confirmation bias.

### The 4-Step Process

1. **Draft** -- Generate initial code or response
2. **Plan** -- Self-generate verification questions ("What could be wrong?")
3. **Execute** -- Answer each question INDEPENDENTLY with no access to the original response
4. **Revise** -- Incorporate corrections into the final output

```
Draft --> Plan verification questions --> Execute each independently --> Revise
```

The critical detail is step 3: each verification runs in isolation. The verifier sees only the verification question and minimal context, not the original draft. This prevents the model from rationalizing its initial mistakes.

### Integration with Blind Review

CoVe operates as a self-correction step BEFORE the blind review system:

```
Developer Code --> CoVe (self-verification) --> Blind Review (3 parallel reviewers)
```

CoVe catches errors early via factored checking. Blind review catches remaining issues independently.

## Specialist Review Pool

The 5-specialist pool (detailed in `skills/quality-gates.md`) uses trigger-keyword matching to select the most relevant reviewers:

| Specialist | Trigger Keywords |
|-----------|-----------------|
| security-sentinel | auth, login, password, token, api, sql, query, cookie, cors, csrf |
| performance-oracle | database, query, cache, render, loop, fetch, load, index, join, pool |
| architecture-strategist | (always included) |
| test-coverage-auditor | test, spec, coverage, assert, mock, fixture, expect, describe |
| dependency-analyst | package, import, require, dependency, npm, pip, yarn, lock |

**Selection rules:**
1. architecture-strategist fills slot 1 (always)
2. Score remaining 4 specialists by counting keyword matches in the diff
3. Top 2 fill the remaining slots
4. Tie-breaker priority: security-sentinel > test-coverage-auditor > performance-oracle > dependency-analyst

## Two-Stage Review Protocol

Code review is split into two distinct stages. Mixing them causes "technically correct but wrong feature" problems.

**Stage 1: Spec Compliance** -- "Does this code implement what the spec requires?"
- 1 reviewer (spec compliance is objective)
- Must pass before proceeding to Stage 2

**Stage 2: Code Quality** -- "Is this code well-written, maintainable, secure?"
- 3 reviewers (blind, parallel)
- Anti-sycophancy check on unanimous approval

If Stage 1 fails, return to implementation. Do NOT proceed to Stage 2 (reviewing quality of wrong code wastes resources).

## Compound Learning (v5.30.0)

The compound learning system extracts reusable knowledge from completed tasks. It has two phases:

**Deepen-Plan Phase:** Before implementation begins, 4 parallel research agents enhance the plan:
- Technical feasibility researcher
- Similar project pattern finder
- Risk assessment analyst
- Dependency compatibility checker

**Knowledge Extraction Phase:** After verification passes, if a task produced a novel insight (bug fix, non-obvious solution, reusable pattern), it is extracted to `~/.loki/solutions/{category}/{slug}.md` with YAML frontmatter:

```yaml
---
title: Fix bcrypt timing attack in login endpoint
tags: [security, auth, bcrypt, timing]
symptoms: Login endpoint vulnerable to timing analysis
root_cause: Using string comparison instead of constant-time comparison
prevention: Always use crypto.timingSafeEqual for secret comparison
---
```

CLI commands for compound learning:

```bash
loki compound list      # List extracted solutions
loki compound show      # Show a specific solution
loki compound search    # Search solutions by keyword
loki compound run       # Run extraction on recent tasks
loki compound stats     # Show extraction statistics
```

## Event-Driven Hooks

The hooks system (documented in `skills/testing.md`) triggers quality checks on file operations:

```yaml
triggers:
  on_file_write:
    - lint: "npx eslint --fix {file}"
    - typecheck: "npx tsc --noEmit"
    - secrets_scan: "detect-secrets scan {file}"
  on_task_complete:
    - contract_test: "npm run test:contract"
    - spec_lint: "spectral lint .loki/specs/openapi.yaml"
  on_phase_complete:
    - memory_consolidate: "Extract patterns to semantic memory"
    - metrics_update: "Log efficiency scores"
    - checkpoint: "git commit with phase summary"
```

This catches issues 5-10x earlier than waiting for phase-end review.

## Agent Handoffs

When one agent completes work and another needs to continue, structured handoff data is passed:

```python
handoff_data = {
    "completed_work": "Implemented user registration endpoint",
    "files_modified": ["src/routes/users.ts", "tests/users.test.ts"],
    "decisions_made": ["Used bcrypt, not argon2", "Email validation via regex"],
    "open_questions": ["Rate limiting not implemented yet"],
    "mistakes_learned": ["First attempt had SQL injection - fixed"]
}

Task(
    subagent_type="general-purpose",
    model="sonnet",
    description="Integration testing for user registration",
    prompt=f"Previous agent completed: {handoff_data}. Now write integration tests..."
)
```

Handoff messages follow the A2A-inspired format and are stored in `.loki/messages/`.

## Summary

Advanced patterns in Loki Mode include structured prompting (GOAL/CONSTRAINTS/CONTEXT/OUTPUT), confidence-based routing for oversight calibration, Chain-of-Verification for self-correction, keyword-triggered specialist review selection, two-stage review separation, compound learning for knowledge extraction, and event-driven hooks for early issue detection. These patterns are documented in `skills/agents.md`, `skills/quality-gates.md`, `skills/testing.md`, and `skills/compound-learning.md`.
