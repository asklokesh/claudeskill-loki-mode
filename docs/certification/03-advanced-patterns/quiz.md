# Module 3 Quiz: Advanced Patterns

Answer each question by selecting the best option (A, B, C, or D).

---

**Question 1:** What are the four required sections in a structured agent prompt?

A) Task, Input, Process, Output
B) Goal, Constraints, Context, Output
C) Objective, Scope, Resources, Deliverables
D) Summary, Details, Requirements, Acceptance

---

**Question 2:** In confidence-based routing, what happens when a task's confidence score is below 0.40?

A) The task is executed with the cheapest model
B) The task is automatically retried 3 times
C) The task is flagged for human decision
D) The task is split into smaller subtasks

---

**Question 3:** What is the critical feature of Step 3 (Execute) in the Chain-of-Verification process?

A) All verifications run sequentially in the same context
B) The verifier has full access to the original response for comparison
C) Each verification runs independently with NO access to the original response
D) A human must approve each verification question

---

**Question 4:** In the specialist review pool, what is the tie-breaker priority order?

A) performance-oracle > dependency-analyst > security-sentinel > test-coverage-auditor
B) security-sentinel > test-coverage-auditor > performance-oracle > dependency-analyst
C) test-coverage-auditor > security-sentinel > dependency-analyst > performance-oracle
D) dependency-analyst > performance-oracle > test-coverage-auditor > security-sentinel

---

**Question 5:** Why is code review split into two stages (spec compliance and code quality)?

A) To reduce the number of reviewers needed
B) To prevent approving well-written code that implements the wrong feature
C) To allow junior developers to handle Stage 1
D) To make the review process faster

---

**Question 6:** What triggers the compound learning knowledge extraction phase?

A) Every task completion regardless of outcome
B) Only when a task produces a novel insight (bug fix, non-obvious solution, reusable pattern)
C) Only when the project reaches the DEPLOYMENT phase
D) Only when manually invoked with `loki compound run`

---

**Question 7:** Which agent is ALWAYS included in the deepen-plan research phase?

A) There are no fixed agents; all 4 are selected dynamically
B) The security risk assessor
C) All 4 research agents always run in parallel
D) Only the technical feasibility researcher

---

**Question 8:** What is the purpose of the `on_file_write` hook trigger?

A) To back up files before they are modified
B) To run lint, typecheck, and secrets scanning immediately after a file is written
C) To log all file changes to the audit trail
D) To prevent agents from writing to protected files

---

**Question 9:** In the two-stage review protocol, what happens if Stage 1 (spec compliance) fails?

A) The code goes directly to Stage 2 for quality feedback
B) The review is cancelled and a new agent is assigned
C) The code returns to implementation; Stage 2 is NOT started
D) Both stages run in parallel anyway to save time

---

**Question 10:** What information is included in a structured agent handoff?

A) Only the list of files modified
B) Completed work, files modified, decisions made, open questions, and mistakes learned
C) Only the task ID and completion status
D) A full copy of the agent's conversation history
