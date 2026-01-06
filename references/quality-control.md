# Quality Control Reference

Quality gates, code review process, and severity blocking rules.

---

## Core Principle: Guardrails, Not Just Acceleration

**CRITICAL:** Speed without quality controls creates "AI slop" - semi-functional code that accumulates technical debt. Loki Mode enforces strict quality guardrails.

---

## Quality Gates

**Never ship code without passing all quality gates:**

### 1. Static Analysis (Automated)
- CodeQL security scanning
- ESLint/Pylint/Rubocop for code style
- Unused variable/import detection
- Duplicated logic detection
- Type checking (TypeScript/mypy/etc)

### 2. 3-Reviewer Parallel System (AI-driven)

Every code change goes through 3 specialized reviewers **simultaneously**:

```
IMPLEMENT -> REVIEW (parallel) -> AGGREGATE -> FIX -> RE-REVIEW -> COMPLETE
                |
                +-- code-reviewer (Opus) - Code quality, patterns, best practices
                +-- business-logic-reviewer (Opus) - Requirements, edge cases, UX
                +-- security-reviewer (Opus) - Vulnerabilities, OWASP Top 10
```

**Important:**
- ALWAYS launch all 3 reviewers in a single message (3 Task calls)
- ALWAYS specify model: "opus" for each reviewer
- NEVER dispatch reviewers sequentially (always parallel - 3x faster)
- NEVER aggregate before all 3 reviewers complete

### 3. Severity-Based Blocking

| Severity | Action | Continue? |
|----------|--------|-----------|
| **Critical** | BLOCK - Fix immediately | NO |
| **High** | BLOCK - Fix immediately | NO |
| **Medium** | BLOCK - Fix before proceeding | NO |
| **Low** | Add `// TODO(review): ...` comment | YES |
| **Cosmetic** | Add `// FIXME(nitpick): ...` comment | YES |

**Critical/High/Medium = BLOCK and fix before proceeding**
**Low/Cosmetic = Add TODO/FIXME comment, continue**

### 4. Test Coverage Gates
- Unit tests: 100% pass, >80% coverage
- Integration tests: 100% pass
- E2E tests: critical flows pass

### 5. Rulesets (Blocking Merges)
- No secrets in code
- No unhandled exceptions
- No SQL injection vulnerabilities
- No XSS vulnerabilities

---

## Code Review Protocol

### Launching Reviewers (Parallel)

```python
# CORRECT: Launch all 3 in parallel
Task(subagent_type="general-purpose", model="opus",
     description="Code quality review",
     prompt="Review for code quality, patterns, SOLID principles...")

Task(subagent_type="general-purpose", model="opus",
     description="Business logic review",
     prompt="Review for requirements alignment, edge cases, UX...")

Task(subagent_type="general-purpose", model="opus",
     description="Security review",
     prompt="Review for vulnerabilities, OWASP Top 10...")

# WRONG: Sequential reviewers (3x slower)
# Don't do: await reviewer1; await reviewer2; await reviewer3;
```

### After Fixes

- ALWAYS re-run ALL 3 reviewers after fixes (not just the one that found the issue)
- Wait for all reviews to complete before aggregating results

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

---

## Task Completion Report

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
- Performance: p99 improved from 145ms -> 87ms

### NEXT STEPS (if any)
- [ ] Monitor error rates for 24h post-deploy
- [ ] Create follow-up task to remove compatibility shim in v3.0
```

---

## Preventing "AI Slop"

### Warning Signs
- Tests pass but code quality degraded
- Copy-paste duplication instead of abstraction
- Over-engineered solutions to simple problems
- Missing error handling
- No logging/observability
- Generic variable names (data, temp, result)
- Magic numbers without constants
- Commented-out code
- TODO comments without GitHub issues

### When Detected
1. Fail the task immediately
2. Add to failed queue with detailed feedback
3. Re-dispatch with stricter constraints
4. Update CONTINUITY.md with anti-pattern to avoid

---

## Quality Gate Hooks

### Pre-Write Hook (BLOCKING)
```bash
#!/bin/bash
# .loki/hooks/pre-write.sh
# Blocks writes that violate rules

# Check for secrets
if grep -rE "(password|secret|key).*=.*['\"][^'\"]{8,}" "$1"; then
  echo "BLOCKED: Potential secret detected"
  exit 1
fi

# Check for console.log in production
if grep -n "console.log" "$1" | grep -v "test"; then
  echo "BLOCKED: Remove console.log statements"
  exit 1
fi
```

### Post-Write Hook (AUTO-FIX)
```bash
#!/bin/bash
# .loki/hooks/post-write.sh
# Auto-fixes after writes

# Format code
npx prettier --write "$1"

# Fix linting issues
npx eslint --fix "$1"

# Type check
npx tsc --noEmit
```

---

## Constitution Reference

Quality gates are enforced by `autonomy/CONSTITUTION.md`:

**Pre-Commit (BLOCKING):**
- Linting (auto-fix enabled)
- Type checking (strict mode)
- Contract tests (80% coverage minimum)
- Spec validation (Spectral)

**Post-Implementation (AUTO-FIX):**
- Static analysis (ESLint, Prettier, TSC)
- Security scan (Semgrep, Snyk)
- Performance check (Lighthouse score 90+)

**Runtime Invariants:**
- `SPEC_BEFORE_CODE`: Implementation tasks require spec reference
- `TASK_HAS_COMMIT`: Completed tasks have git commit SHA
- `QUALITY_GATES_PASSED`: Completed tasks passed all quality checks
