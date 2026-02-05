# Definition of Done (DoD) Framework

A comprehensive, research-backed framework for determining when AI agent tasks are complete.
Based on 2025 research from Anthropic, Google DeepMind, OpenAI, METR, and cognitive science.

---

## Executive Summary

**A task is "done" when it satisfies all three verification layers:**

1. **Outcome Verification** - The intended state change exists in the environment
2. **Process Verification** - Quality gates passed, no policy violations
3. **Consistency Verification** - Would pass again if re-run (pass@k reliability)

---

## Theoretical Foundation

### Cognitive Science: Goal-Directed Behavior Criteria

From [Heyes & Dickinson (1990)](https://link.springer.com/article/10.1007/s00426-021-01563-w), behavior is goal-directed when it meets:

| Criterion | Definition | Application to AI Agents |
|-----------|------------|-------------------------|
| **Belief Criterion** | Agent shows knowledge of behavior-outcome relationship | Agent understands what actions lead to task completion |
| **Desire Criterion** | Agent shows evidence of wanting the outcome | Agent has clear goal representation, not just following steps |

**Implication:** Tasks must have explicit, verifiable goals. Agents must demonstrate they understand *why* actions lead to outcomes, not just *what* to do.

### CLEAR Framework (Enterprise AI Evaluation)

From [arXiv 2511.14136](https://arxiv.org/abs/2511.14136) - Multi-dimensional evaluation:

| Dimension | Metric | Threshold for "Done" |
|-----------|--------|---------------------|
| **Cost** | Cost-Normalized Accuracy (CNA) | Within budget allocation |
| **Latency** | SLA Compliance Rate | 95%+ within time bounds |
| **Efficacy** | Task-specific success metrics | Meets acceptance criteria |
| **Assurance** | Policy Adherence Score (PAS) | Zero high-severity violations |
| **Reliability** | pass@k consistency | pass@3 >= 80% |

### Four Pillars Framework (Agentic System Assessment)

From [arXiv 2512.12791](https://arxiv.org/abs/2512.12791):

| Pillar | What to Verify | Done When |
|--------|---------------|-----------|
| **LLM** | Instruction following, safety alignment | 100% policy adherence |
| **Memory** | Storage correctness, retrieval accuracy | F1 >= 0.8 on context |
| **Tools** | Selection, parameters, sequencing | Correct tool chain executed |
| **Environment** | Workflows, guardrails, permissions | All constraints satisfied |

---

## The Three-Layer DoD Model

### Layer 1: Outcome Verification (Primary)

**Principle:** "The outcome is whether a reservation exists in the database, not whether the agent said 'Your flight is booked.'" - [Anthropic Evals Guide](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

```yaml
outcome_verification:
  description: "Verify the intended state change exists in the environment"

  methods:
    code_based:
      - file_system_state: "Expected files exist with correct content"
      - database_state: "Expected records exist"
      - api_state: "Endpoints respond correctly"
      - test_state: "All tests pass"
      - build_state: "Build succeeds without errors"

    machine_verifiable:
      - static_analysis: "Zero critical/high issues"
      - type_check: "Zero type errors"
      - linting: "Zero blocking violations"
      - coverage: "Unit >= 80%, integration 100% pass"

    spec_compliance:
      - api_matches_spec: "OpenAPI spec validated"
      - behavior_matches_requirements: "Acceptance criteria satisfied"

  anti_patterns:
    - "Checking transcript for success phrases instead of actual state"
    - "Verifying specific tool call sequences instead of outcomes"
    - "Trusting agent's claim of completion without inspection"
```

### Layer 2: Process Verification (Quality Gates)

**Principle:** Task completion with policy violations is failure, even if outcome achieved.

```yaml
process_verification:
  description: "Verify quality gates passed and policies followed"

  quality_gates:                    # All 7 must pass
    1_input_guardrails:
      - scope_validation: "Task within project bounds"
      - injection_detection: "No prompt injection"
      - constraint_check: "Resource limits respected"

    2_static_analysis:
      - codeql: "Zero critical findings"
      - eslint_pylint: "Zero errors"
      - type_check: "Zero errors"

    3_blind_review:
      - reviewers: 3
      - parallel: true
      - aspects: ["code_quality", "business_logic", "security"]

    4_anti_sycophancy:
      - trigger: "Unanimous approval"
      - action: "Devil's Advocate review"
      - purpose: "Catch groupthink failures"

    5_output_guardrails:
      - code_quality: "Validated"
      - spec_compliance: "Verified"
      - no_secrets: "Confirmed"

    6_severity_blocking:
      - critical: "BLOCK - cannot be done"
      - high: "BLOCK - cannot be done"
      - medium: "BLOCK - cannot be done"
      - low: "PASS with TODO comment"
      - cosmetic: "PASS with FIXME comment"

    7_test_coverage:
      - unit_pass: "100%"
      - unit_coverage: ">= 80%"
      - integration_pass: "100%"

  policy_adherence:
    - pre_policy_checks: "Consulted guidance before acting"
    - diagnostic_before_action: "Ran diagnostics first"
    - atomic_commits: "Each task has checkpoint"
    - decision_documentation: "WHY/WHAT/TRADE-OFFS recorded"
```

### Layer 3: Consistency Verification (Reliability)

**Principle:** A task that passes once but would fail on re-run is not truly done.

```yaml
consistency_verification:
  description: "Verify task would pass again under similar conditions"

  metrics:
    pass_at_k:
      description: "Probability of at least one success in k attempts"
      formula: "P(success >= 1 in k trials)"
      minimum: "pass@3 >= 90%"

    pass_to_k:
      description: "Probability ALL k trials succeed"
      formula: "P(all k trials succeed)"
      minimum: "pass^3 >= 80%"
      note: "More stringent - measures true reliability"

  verification_approach:
    - deterministic_tests: "Same inputs produce same outputs"
    - idempotent_operations: "Re-running doesn't break state"
    - environment_isolation: "No shared state contamination"
    - seed_fixed_randomness: "Stochastic elements controlled"

  red_flags:
    - "Task passes on retry but not first attempt"
    - "Task only passes with specific timing"
    - "Task depends on external service availability"
    - "Task leaves side effects that affect future runs"
```

---

## Task Completion Checklist

### Mandatory (All Tasks)

Every task MUST satisfy these criteria to be marked complete:

```
[ ] OUTCOME: Intended state change verified in environment
[ ] TESTS: All automated tests pass (unit, integration, E2E)
[ ] BUILD: Code compiles/builds without errors
[ ] STATIC: Zero critical/high/medium severity issues
[ ] COMMIT: Atomic git checkpoint created
[ ] REPORT: Decision report generated (WHY/WHAT/TRADE-OFFS/RISKS/TESTS)
[ ] MEMORY: CONTINUITY.md updated with outcome
```

### Quality-Dependent (By Task Type)

#### Code Implementation Tasks

```
[ ] Type check passes (zero errors)
[ ] Linting passes (zero blocking violations)
[ ] Unit test coverage >= 80%
[ ] Integration tests pass 100%
[ ] API matches OpenAPI spec (if applicable)
[ ] No secrets in code or commits
[ ] Security scan clean (CodeQL/SAST)
```

#### Bug Fix Tasks

```
[ ] Root cause identified and documented
[ ] Fix addresses root cause (not symptoms)
[ ] Regression test added
[ ] Original failing test now passes
[ ] No new test failures introduced
[ ] Similar patterns checked elsewhere
```

#### Feature Tasks

```
[ ] Acceptance criteria explicitly satisfied
[ ] Feature flag or gradual rollout considered
[ ] Documentation updated (if user-facing)
[ ] Performance impact assessed
[ ] Backward compatibility maintained (or migration provided)
```

#### Refactoring Tasks

```
[ ] Behavior unchanged (verified by tests)
[ ] No new dependencies added
[ ] Performance not degraded
[ ] All existing tests still pass
[ ] Code review completed
```

---

## Decision Report Schema (Required for Completion)

From [references/quality-control.md](quality-control.md):

```json
{
  "taskId": "task-123",
  "completedAt": "2025-02-05T10:30:00Z",
  "status": "completed",
  "decisionReport": {
    "WHY": {
      "problem": "What was broken/missing/suboptimal",
      "rootCause": "Why it happened",
      "solutionChosen": "What we implemented",
      "alternativesConsidered": ["Option A (rejected: too complex)", "Option B (rejected: perf impact)"]
    },
    "WHAT": {
      "filesModified": [
        {"path": "src/auth.ts", "lines": "45-67", "purpose": "Added token refresh logic"}
      ],
      "apisChanged": {"breaking": false, "additions": ["GET /refresh"]},
      "behaviorChanges": "Users now auto-refresh tokens 5min before expiry",
      "dependencies": {"added": [], "removed": []}
    },
    "TRADE_OFFS": {
      "gained": ["Seamless auth experience", "Reduced 401 errors"],
      "cost": ["5KB bundle increase", "Additional API call every 55min"],
      "neutral": ["No DB schema changes"]
    },
    "RISKS": [
      {"risk": "Race condition in concurrent refresh", "mitigation": "Added mutex lock"}
    ],
    "TESTS": {
      "unit": {"passed": 45, "total": 45, "coverage": "87%"},
      "integration": {"passed": 12, "total": 12},
      "e2e": {"passed": 3, "total": 3}
    },
    "NEXT_STEPS": ["Monitor refresh failure rate in production"]
  },
  "gitCommitSha": "abc123def456"
}
```

---

## Severity-Based Completion Rules

| Severity | Can Mark Complete? | Required Action |
|----------|-------------------|-----------------|
| **Critical** | NO | Fix immediately before any other work |
| **High** | NO | Fix before proceeding to next task |
| **Medium** | NO | Fix before marking task complete |
| **Low** | YES | Add `// TODO:` comment with issue reference |
| **Cosmetic** | YES | Add `// FIXME:` comment (optional) |

---

## Anti-Patterns (What "Done" is NOT)

### Transcript-Based Verification

```
BAD: "Agent said 'Task complete' so it must be done"
GOOD: "Verified file exists, tests pass, build succeeds"
```

### Process-Based Verification

```
BAD: "Agent called the right tools in the right order"
GOOD: "Outcome achieved regardless of tool sequence"
```

### Single-Run Verification

```
BAD: "It worked once, ship it"
GOOD: "Verified pass@3 consistency >= 80%"
```

### Claim-Based Verification

```
BAD: "Agent claims all tests pass"
GOOD: "Ran tests independently, verified output"
```

### Overspecified Verification

```
BAD: "Must use exactly these 5 tool calls in this order"
GOOD: "Outcome achieved with any valid approach"
```

---

## Verification Script Template

```python
#!/usr/bin/env python3
"""
Task completion verification script.
Returns 0 if done, non-zero with specific error otherwise.
"""

import subprocess
import json
import sys
from pathlib import Path

def verify_outcome(task: dict) -> tuple[bool, str]:
    """Layer 1: Verify intended state change exists."""

    # Check file system state
    for expected_file in task.get("expected_files", []):
        if not Path(expected_file["path"]).exists():
            return False, f"Missing file: {expected_file['path']}"
        # Optionally verify content
        if "contains" in expected_file:
            content = Path(expected_file["path"]).read_text()
            if expected_file["contains"] not in content:
                return False, f"File missing expected content: {expected_file['path']}"

    # Run tests
    result = subprocess.run(["npm", "test"], capture_output=True)
    if result.returncode != 0:
        return False, f"Tests failed: {result.stderr.decode()}"

    # Check build
    result = subprocess.run(["npm", "run", "build"], capture_output=True)
    if result.returncode != 0:
        return False, f"Build failed: {result.stderr.decode()}"

    return True, "Outcome verified"

def verify_process(task: dict) -> tuple[bool, str]:
    """Layer 2: Verify quality gates passed."""

    # Check static analysis
    result = subprocess.run(["npm", "run", "lint"], capture_output=True)
    if result.returncode != 0:
        return False, f"Linting failed: {result.stderr.decode()}"

    # Check type errors
    result = subprocess.run(["npm", "run", "typecheck"], capture_output=True)
    if result.returncode != 0:
        return False, f"Type check failed: {result.stderr.decode()}"

    # Check git commit exists
    if "gitCommitSha" not in task or not task["gitCommitSha"]:
        return False, "Missing git commit checkpoint"

    # Check decision report
    if "decisionReport" not in task:
        return False, "Missing decision report"

    required_fields = ["WHY", "WHAT", "TRADE_OFFS", "RISKS", "TESTS"]
    for field in required_fields:
        if field not in task["decisionReport"]:
            return False, f"Decision report missing: {field}"

    return True, "Process verified"

def verify_consistency(task: dict, runs: int = 3) -> tuple[bool, str]:
    """Layer 3: Verify task would pass again."""

    # For deterministic tasks, verify idempotency
    successes = 0
    for i in range(runs):
        outcome_ok, _ = verify_outcome(task)
        if outcome_ok:
            successes += 1

    pass_rate = successes / runs
    if pass_rate < 0.8:  # pass@3 >= 80%
        return False, f"Consistency check failed: {pass_rate*100:.0f}% pass rate"

    return True, f"Consistency verified: {pass_rate*100:.0f}% pass rate"

def main():
    if len(sys.argv) < 2:
        print("Usage: verify_done.py <task.json>")
        sys.exit(1)

    task = json.loads(Path(sys.argv[1]).read_text())

    # Layer 1: Outcome
    ok, msg = verify_outcome(task)
    if not ok:
        print(f"OUTCOME VERIFICATION FAILED: {msg}")
        sys.exit(1)
    print(f"Layer 1 PASS: {msg}")

    # Layer 2: Process
    ok, msg = verify_process(task)
    if not ok:
        print(f"PROCESS VERIFICATION FAILED: {msg}")
        sys.exit(2)
    print(f"Layer 2 PASS: {msg}")

    # Layer 3: Consistency (optional for speed)
    if task.get("verify_consistency", False):
        ok, msg = verify_consistency(task)
        if not ok:
            print(f"CONSISTENCY VERIFICATION FAILED: {msg}")
            sys.exit(3)
        print(f"Layer 3 PASS: {msg}")

    print("TASK COMPLETE: All verification layers passed")
    sys.exit(0)

if __name__ == "__main__":
    main()
```

---

## Integration with RARV Cycle

The VERIFY step of RARV maps directly to the three-layer DoD:

```
VERIFY: Run tests. Check build. Validate against spec.
   |
   +---> Layer 1: Outcome Verification
   |     - Tests pass?
   |     - Build succeeds?
   |     - Files/state correct?
   |
   +---> Layer 2: Process Verification
   |     - Quality gates passed?
   |     - Decision report complete?
   |     - Git checkpoint created?
   |
   +---> Layer 3: Consistency Verification
         - Would pass again?
         - No flaky behavior?
   |
   +--[ALL PASS]--> Mark task complete. Return to REASON.
   |
   +--[ANY FAIL]--> Capture error in "Mistakes & Learnings".
                   Rollback if needed. Retry with approach.
```

---

## Acceptance Criteria vs Definition of Done

| Aspect | Acceptance Criteria | Definition of Done |
|--------|--------------------|--------------------|
| **Scope** | Item-specific conditions | Organizational quality standard |
| **Who Defines** | Product Owner / Requirements | Development Team / Architecture |
| **When Checked** | Per item completion | Every item completion |
| **Examples** | "User can reset password via email" | "All tests pass, no critical issues" |
| **Analogy** | "What to build" | "How to know it's built correctly" |

**Both must be satisfied for task completion:**
- Acceptance Criteria: Specific requirements for THIS task
- Definition of Done: Universal quality bar for ALL tasks

---

## Time Horizon Considerations

From [METR Research](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/):

| Human Time Equivalent | Agent Success Rate | DoD Adjustment |
|----------------------|-------------------|----------------|
| < 4 minutes | ~100% | Standard DoD |
| 4 min - 1 hour | ~50% | Add explicit checkpoints |
| 1 - 4 hours | ~25% | Require incremental verification |
| > 4 hours | < 10% | Decompose into smaller tasks |

**Implication:** For complex tasks, the DoD should include intermediate checkpoints, not just final verification.

---

## Research Sources

- [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Beyond Accuracy: CLEAR Framework (arXiv 2511.14136)](https://arxiv.org/abs/2511.14136)
- [Beyond Task Completion: Assessment Framework (arXiv 2512.12791)](https://arxiv.org/abs/2512.12791)
- [METR: Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)
- [GOALIATH: Theory of Goal-Directed Behavior](https://link.springer.com/article/10.1007/s00426-021-01563-w)
- [Devin AI: Agents 101](https://devin.ai/agents101)
- [Scrum.org: DoD vs Acceptance Criteria](https://www.scrum.org/resources/blog/what-difference-between-definition-done-and-acceptance-criteria)

---

## Version History

- v1.0.0 (2025-02-05): Initial framework based on comprehensive research
