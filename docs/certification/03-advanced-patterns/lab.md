# Module 3 Lab: Advanced Patterns

## Objective

Practice structured agent prompting, explore the specialist review configuration, and examine the compound learning system.

## Prerequisites

- Loki Mode installed (`npm install -g loki-mode`)
- Familiarity with Module 1 (core concepts) and Module 2 (enterprise features)
- `jq` installed for JSON inspection

## Step 1: Examine the Specialist Review Configuration

Read the quality gates documentation to understand how specialists are selected:

```bash
# Locate the skill file (path depends on your installation)
# If installed globally via npm:
SKILL_DIR=$(npm root -g)/loki-mode

# Read the specialist review pool configuration
cat "$SKILL_DIR/skills/quality-gates.md" | head -100
```

Key points to verify:
- 5 specialists defined with trigger keywords
- architecture-strategist is always selected
- Selection is based on keyword matching against the diff

## Step 2: Write a Structured Agent Prompt

Create a file called `structured-prompt-example.md` demonstrating the GOAL/CONSTRAINTS/CONTEXT/OUTPUT template:

```markdown
## GOAL
Implement a rate-limiting middleware for Express.js.
Success: Middleware limits requests to 100/minute per IP, returns 429 on excess.

## CONSTRAINTS
- No external rate-limiting libraries
- Use in-memory storage (Map with TTL cleanup)
- Must not block the event loop
- Response time overhead < 5ms

## CONTEXT
- Existing middleware pattern: src/middleware/auth.ts
- Express app entry point: src/app.ts
- No existing rate limiting in codebase

## OUTPUT
- [ ] Middleware implementation in src/middleware/rate-limit.ts
- [ ] Unit tests in tests/middleware/rate-limit.test.ts
- [ ] Integration into app.ts route chain
```

This is the format used when dispatching any agent via the Task tool. Each section serves a purpose: GOAL defines success criteria, CONSTRAINTS set boundaries, CONTEXT points to relevant files, and OUTPUT lists deliverables.

## Step 3: Explore Compound Learning

Examine the compound learning CLI commands:

```bash
# List extracted solutions (if any exist)
loki compound list

# View statistics
loki compound stats

# Search for solutions by keyword
loki compound search "authentication"
```

Solutions are stored in `~/.loki/solutions/{category}/{slug}.md` with YAML frontmatter containing title, tags, symptoms, root cause, and prevention guidance.

**Note:** Compound learning populates over time as Loki Mode completes tasks. A fresh installation will have no solutions until sessions have run and produced novel insights.

## Step 4: Examine the Memory Retrieval Weights

Review how task-aware memory retrieval works. The weight configurations are in `memory/engine.py`:

```bash
SKILL_DIR=$(npm root -g)/loki-mode

# View the task strategy weights
head -60 "$SKILL_DIR/memory/engine.py"
```

You should see weight configurations like:

| Task Type | Episodic | Semantic | Skills | Anti-patterns |
|-----------|----------|----------|--------|---------------|
| exploration | 0.6 | 0.3 | 0.1 | 0.0 |
| implementation | 0.15 | 0.5 | 0.35 | 0.0 |
| debugging | 0.4 | 0.2 | 0.0 | 0.4 |

This demonstrates how the system prioritizes different memory types based on what the agent is currently doing.

## Step 5: Understand the Event Bus

Loki Mode includes an event bus for inter-component communication. Examine the event emission helper:

```bash
SKILL_DIR=$(npm root -g)/loki-mode

# View the bash event emitter
cat "$SKILL_DIR/events/emit.sh" | head -30
```

Events are emitted during operations like memory loading, session start/stop, and task completion. The dashboard and OTEL bridge consume these events for real-time monitoring.

## Step 6: Review the Hooks System

The hooks system runs quality checks on file operations. Review the configuration in the testing skill:

```bash
SKILL_DIR=$(npm root -g)/loki-mode
cat "$SKILL_DIR/skills/testing.md"
```

Look for the `hooks_system` section which defines triggers for:
- `on_file_write` -- lint, typecheck, secrets scan
- `on_task_complete` -- contract tests, spec validation
- `on_phase_complete` -- memory consolidation, metrics, checkpoint

## Verification Checklist

- [ ] You can write a structured prompt with GOAL/CONSTRAINTS/CONTEXT/OUTPUT sections
- [ ] You understand how the 5 specialist reviewers are selected (keyword matching + architecture-strategist always included)
- [ ] You can use `loki compound` commands to explore extracted solutions
- [ ] You understand the task-aware memory retrieval weight system
- [ ] You know the three hook trigger points (file write, task complete, phase complete)

## Cleanup

```bash
rm -f structured-prompt-example.md
```
