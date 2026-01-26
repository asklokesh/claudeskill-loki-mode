# Quality Gates

**Never ship code without passing all quality gates.**

## The 7 Quality Gates

1. **Input Guardrails** - Validate scope, detect injection, check constraints (OpenAI SDK)
2. **Static Analysis** - CodeQL, ESLint/Pylint, type checking
3. **Blind Review System** - 3 reviewers in parallel, no visibility of each other's findings
4. **Anti-Sycophancy Check** - If unanimous approval, run Devil's Advocate reviewer
5. **Output Guardrails** - Validate code quality, spec compliance, no secrets (tripwire on fail)
6. **Severity-Based Blocking** - Critical/High/Medium = BLOCK; Low/Cosmetic = TODO comment
7. **Test Coverage Gates** - Unit: 100% pass, >80% coverage; Integration: 100% pass

## Guardrails Execution Modes

- **Blocking**: Guardrail completes before agent starts (use for expensive operations)
- **Parallel**: Guardrail runs with agent (use for fast checks, accept token loss risk)

**Research:** Blind review + Devil's Advocate reduces false positives by 30% (CONSENSAGENT, 2025)

---

## Chain-of-Verification (CoVe) Protocol

**Research:** arXiv 2309.11495 - "Chain-of-Verification Reduces Hallucination in Large Language Models"

### Core Insight

Factored, decoupled verification mitigates error propagation. Each verification is computed independently without access to the original response, preventing the model from rationalizing its initial mistakes.

### The 4-Step CoVe Process

```
Step 1: DRAFT          Step 2: PLAN           Step 3: EXECUTE        Step 4: REVISE
+-------------+        +---------------+      +-----------------+    +----------------+
| Generate    |  --->  | Self-generate |  --> | Answer each     | -> | Incorporate    |
| initial     |        | verification  |      | question        |    | corrections    |
| response    |        | questions     |      | INDEPENDENTLY   |    | into final     |
+-------------+        +---------------+      +-----------------+    +----------------+
                       "What claims     |      (factored exec)
                        did I make?     |      No access to
                        What could be   |      original response
                        wrong?"
```

### Step-by-Step Implementation

**Step 1: Draft Initial Response**
```yaml
draft_phase:
  action: "Generate initial code/response"
  model: "sonnet"  # Fast drafting
  output: "baseline_response"
```

**Step 2: Plan Verification Questions**
```yaml
verification_planning:
  prompt: |
    Review the response above. Generate verification questions:
    1. What factual claims did I make?
    2. What assumptions did I rely on?
    3. What could be incorrect or incomplete?
    4. What edge cases did I miss?
  output: "verification_questions[]"
```

**Step 3: Execute Verifications INDEPENDENTLY (Critical)**
```yaml
factored_execution:
  critical: "Each verification runs in isolation"
  rule: "Verifier has NO access to original response"

  # Launch in parallel - each is independent
  verifications:
    - question: "Does the function handle null inputs?"
      context: "Function signature and spec only"  # NOT the implementation
      verifier: "sonnet"
    - question: "Is the SQL query injection-safe?"
      context: "Query requirements only"
      verifier: "sonnet"
    - question: "Does the API match the documented spec?"
      context: "API spec only"
      verifier: "sonnet"
```

**Step 4: Generate Final Verified Response**
```yaml
revision_phase:
  inputs:
    - original_response
    - verification_results[]
  action: "Revise response incorporating all corrections"
  output: "verified_response"
```

### Factor+Revise Variant (Longform Code Generation)

For complex code generation, use the enhanced Factor+Revise pattern. The key difference from basic Factored execution is an **explicit cross-check step** where the model compares original claims against verification results before revision.

```yaml
factor_revise_pattern:
  step_1_draft:
    action: "Generate complete implementation"
    output: "draft_code"

  step_2_factor:
    action: "Decompose into verifiable claims"
    outputs:
      - "Function X handles error case Y"
      - "Loop invariant: Z holds at each iteration"
      - "API call returns type T"
      - "Memory is freed in all paths"

  step_3_independent_verify:
    # CRITICAL: Each runs with ONLY the claim + minimal context
    # No access to full draft code
    parallel_tasks:
      - verify: "Function X handles error case Y"
        context: "Function signature + error spec"
        result: "PASS|FAIL + evidence"
      - verify: "Loop invariant holds"
        context: "Loop structure only"
        result: "PASS|FAIL + evidence"

  step_3b_cross_check:
    # KEY DIFFERENCE: Explicit consistency check before revision
    action: "Compare original claims against verification results"
    prompt: "Identify which facts from the draft are CONSISTENT vs INCONSISTENT with verifications"
    output: "consistency_report"

  step_4_revise:
    inputs: [draft_code, verification_results, consistency_report]
    action: "Discard inconsistent facts, use consistent facts to regenerate"
    output: "verified_code"
```

### Why Factored Execution Matters

The paper tested 4 execution variants:
- **Joint**: Questions and answers in one prompt (worst - repeats hallucinations)
- **2-Step**: Separate prompts for questions vs answers (better)
- **Factored**: Each question answered separately (recommended)
- **Factor+Revise**: Factored + explicit cross-check step (best for longform)

Without factoring (naive verification):
```
Model: "Here's the code"
Model: "Let me check my code... looks correct!"  # Confirmation bias
```

With factored verification:
```
Model: "Here's the code"
Model: "Question: Does function handle nulls?"
[New context, no code visible]
Model: "Given a function that takes X, null handling requires..."  # Independent reasoning
```

**Key principle from the paper:** The verifier cannot see the original response, only the verification question and minimal context. This prevents rationalization of errors and breaks the chain of hallucination propagation.

### CoVe Integration with Blind Review

CoVe operates BEFORE blind review as a self-correction step:

```
Developer Code --> CoVe (self-verification) --> Blind Review (3 parallel)
                          |                            |
                   Catches errors early         Catches remaining
                   via factored checking        issues independently
```

**Combined workflow:**
```yaml
quality_pipeline:
  phase_1_cove:
    # Developer runs CoVe on their own code
    draft: "Initial implementation"
    verify: "Self-generated questions, factored execution"
    revise: "Corrected implementation"

  phase_2_blind_review:
    # 3 independent reviewers (no access to CoVe results)
    reviewers:
      - focus: "correctness"
      - focus: "security"
      - focus: "performance"
    # Reviewers see verified code but don't know what was corrected

  phase_3_aggregate:
    if: "unanimous approval"
    then: "Devil's Advocate review"
```

### Metrics

Track CoVe effectiveness:
```
.loki/metrics/cove/
+-- corrections.json     # Issues caught by CoVe before review
+-- false_positives.json # CoVe flags that were actually correct
+-- review_reduction.json # Reviewer findings before/after CoVe adoption
```

---

## Velocity-Quality Feedback Loop (CRITICAL)

**Research from arXiv 2511.04427v2 - empirical study of 807 repositories.**

### Key Findings

| Metric | Finding | Implication |
|--------|---------|-------------|
| Initial Velocity | +281% lines added | Impressive but TRANSIENT |
| Quality Degradation | +30% static warnings, +41% complexity | PERSISTENT problem |
| Cancellation Point | 3.28x complexity OR 4.94x warnings | Completely negates velocity gains |

### The Trap to Avoid

```
Initial excitement -> Velocity spike -> Quality degradation accumulates
                                               |
                                               v
                               Complexity cancels velocity gains
                                               |
                                               v
                               Frustration -> Abandonment cycle
```

**CRITICAL RULE:** Every velocity gain MUST be accompanied by quality verification.

### Mandatory Quality Checks (Per Task)

```yaml
velocity_quality_balance:
  before_commit:
    - static_analysis: "Run ESLint/Pylint/CodeQL - warnings must not increase"
    - complexity_check: "Cyclomatic complexity must not increase >10%"
    - test_coverage: "Coverage must not decrease"

  thresholds:
    max_new_warnings: 0  # Zero tolerance for new warnings
    max_complexity_increase: 10%  # Per file, per commit
    min_coverage: 80%  # Never drop below

  if_threshold_violated:
    action: "BLOCK commit, fix before proceeding"
    reason: "Velocity gains without quality are net negative"
```

### Metrics to Track

```
.loki/metrics/quality/
+-- warnings.json      # Static analysis warning count over time
+-- complexity.json    # Cyclomatic complexity per file
+-- coverage.json      # Test coverage percentage
+-- velocity.json      # Lines added/commits per hour
+-- ratio.json         # Quality/Velocity ratio (must stay positive)
```

---

## Blind Review System

**Launch 3 reviewers in parallel in a single message:**

```python
# ALWAYS launch all 3 in ONE message
Task(model="sonnet", description="Code review: correctness", prompt="Review for bugs...")
Task(model="sonnet", description="Code review: security", prompt="Review for vulnerabilities...")
Task(model="sonnet", description="Code review: performance", prompt="Review for efficiency...")
```

**Rules:**
- ALWAYS use sonnet for reviews (balanced quality/cost)
- NEVER aggregate before all 3 complete
- ALWAYS re-run ALL 3 after fixes
- If unanimous approval -> run Devil's Advocate

---

## Two-Stage Review Protocol

**Source:** Superpowers (obra) - 35K+ stars GitHub project

**CRITICAL: Never mix spec compliance and code quality review. They are separate stages.**

### Why Separate Stages Matter

Mixing stages causes these problems:
- **"Technically correct but wrong feature"** - Code is clean, well-tested, maintainable, but doesn't implement what the spec requires
- **Spec drift goes undetected** - Quality reviewers approve beautiful code that solves the wrong problem
- **False confidence** - "3 reviewers approved" means nothing if none checked spec compliance

### Stage 1: Spec Compliance Review

**Question:** "Does this code implement what the spec requires?"

```
Review this implementation against the specification.

Specification:
{paste_spec_or_requirements}

Implementation:
{paste_code_or_diff}

Check ONLY the following:
1. Does the code implement ALL required features from the spec?
2. Does the code implement ONLY what the spec requires (no scope creep)?
3. Are edge cases from the spec handled?
4. Do the tests verify spec requirements?

DO NOT review code quality, style, or maintainability.
Output: PASS/FAIL with specific spec violations listed.
```

**Stage 1 must PASS before proceeding to Stage 2.**

### Stage 2: Code Quality Review

**Question:** "Is this code well-written, maintainable, secure?"

```
Review this code for quality. Spec compliance has already been verified.

Code:
{paste_code_or_diff}

Check the following:
1. Is the code readable and maintainable?
2. Are there security vulnerabilities?
3. Is error handling appropriate?
4. Are there performance concerns?
5. Does it follow project conventions?

DO NOT verify spec compliance (already done).
Output: PASS/FAIL with specific issues listed by severity.
```

### Implementation in Loki Mode

```yaml
two_stage_review:
  stage_1_spec:
    reviewer_count: 1  # Spec compliance is objective
    model: "sonnet"
    must_pass: true
    blocks: "stage_2"

  stage_2_quality:
    reviewer_count: 3  # Quality is subjective, use blind review
    model: "sonnet"
    must_pass: true
    follows: "stage_1"
    anti_sycophancy: true  # Devil's advocate on unanimous

  on_stage_1_fail:
    action: "Return to implementation, DO NOT proceed to Stage 2"
    reason: "Quality review of wrong feature wastes resources"

  on_stage_2_fail:
    action: "Fix quality issues, re-run Stage 2 only"
    reason: "Spec compliance already verified"
```

### Common Anti-Pattern

```
# WRONG - Mixed review
Task(prompt="Review for correctness, security, performance, and spec compliance...")

# RIGHT - Separate stages
Task(prompt="Stage 1: Check spec compliance ONLY...")
# Wait for pass
Task(prompt="Stage 2: Check code quality ONLY...")
```

---

## Severity-Based Blocking

| Severity | Action |
|----------|--------|
| Critical | BLOCK - fix immediately |
| High | BLOCK - fix before commit |
| Medium | BLOCK - fix before merge |
| Low | TODO comment, fix later |
| Cosmetic | Note, optional fix |

See `references/quality-control.md` for complete details.

---

## Scale Considerations

> **Source:** [Cursor Scaling Learnings](../references/cursor-learnings.md) - integrators became bottlenecks at 100+ agents

### Review Intensity Scaling

At high agent counts, full 3-reviewer blind review for every change creates bottlenecks.

```yaml
review_scaling:
  low_scale:  # <10 agents
    all_changes: "Full 3-reviewer blind review"
    rationale: "Quality critical, throughput acceptable"

  medium_scale:  # 10-50 agents
    high_risk: "Full 3-reviewer blind review"
    medium_risk: "2-reviewer review"
    low_risk: "1 reviewer + automated checks"
    rationale: "Balance quality and throughput"

  high_scale:  # 50+ agents
    critical_changes: "Full 3-reviewer blind review"
    standard_changes: "Automated checks + spot review"
    trivial_changes: "Automated checks only"
    rationale: "Trust workers, avoid bottlenecks"

risk_classification:
  high_risk:
    - Security-related changes
    - Authentication/authorization
    - Payment processing
    - Data migrations
    - API breaking changes
  medium_risk:
    - New features
    - Business logic changes
    - Database schema changes
  low_risk:
    - Bug fixes with tests
    - Refactoring with no behavior change
    - Documentation
    - Dependency updates (minor)
```

### Judge Agent Integration

Use judge agents to determine when full review is needed:

```yaml
judge_review_decision:
  inputs:
    - change_type: "feature|bugfix|refactor|docs"
    - files_changed: 5
    - lines_changed: 120
    - test_coverage: 85%
    - static_analysis: "0 new warnings"
  output:
    review_level: "full|partial|automated"
    rationale: "Medium-risk feature with good coverage"
```

### Cursor's Key Learning

> "Dedicated integrator/reviewer roles created more bottlenecks than they solved. Workers were already capable of handling conflicts themselves."

**Implication:** At scale, trust automated checks and worker judgment. Reserve full review for high-risk changes only.
