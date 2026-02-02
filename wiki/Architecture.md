# Architecture

State machines and component diagrams for Loki Mode.

---

## Session State Machine

```
                              +-------------+
                              |    IDLE     |
                              +------+------+
                                     |
                                     | loki start
                                     v
                              +------+------+
                              | INITIALIZING|
                              +------+------+
                                     |
                                     | PRD loaded
                                     v
+-------------+              +-------+-------+
|   PAUSED    |<-------------+   RUNNING     |<-----------+
+------+------+ loki pause   +-------+-------+            |
       |                             |                    |
       | loki resume                 |                    |
       +-------------------->+       | Phase complete     |
                             |       v                    |
                             | +-----+------+             |
                             | |  PHASE_N   |-------------+
                             | +-----+------+   Next phase
                             |       |
                             |       | All phases done
                             |       v
                             | +-----+------+
                             | | COMPLETING |
                             | +-----+------+
                             |       |
                             |       | Cleanup done
                             |       v
                             | +-----+------+
                             +>| COMPLETED  |
                               +------------+

Error states:
  RUNNING/PHASE_N --[error]--> FAILED --[reset]--> IDLE
  RUNNING/PHASE_N --[max retries]--> MAX_RETRIES_EXCEEDED --[reset]--> IDLE
  ANY --[loki stop]--> STOPPED --[reset]--> IDLE
```

---

## Task Queue State Machine

```
+------------+     queue      +------------+     pick      +------------+
|  PENDING   +--------------->|   QUEUED   +-------------->| IN_PROGRESS|
+------------+                +-----+------+               +------+-----+
                                    |                             |
                                    | timeout                     |
                                    v                             |
                              +-----+------+                      |
                              |  STALLED   |                      |
                              +-----+------+                      |
                                    |                             |
                                    | retry                       | complete
                                    v                             v
                              +-----+------+               +------+-----+
                              |  RETRYING  |               |  COMPLETED |
                              +-----+------+               +------------+
                                    |
                                    | max retries (5)
                                    v
                              +-----+------+
                              | DEAD_LETTER|
                              +------------+

Queue files:
  .loki/queue/pending.json     - Tasks waiting
  .loki/queue/current-task.json - Active task
  .loki/queue/dead-letter.json - Failed tasks
```

---

## SDLC Phase Flow

```
+------------------+
|   REQUIREMENTS   |
| - Parse PRD      |
| - Extract tasks  |
+--------+---------+
         |
         v
+--------+---------+
|     PLANNING     |
| - Architecture   |
| - Task breakdown |
+--------+---------+
         |
         v
+--------+---------+
|   DEVELOPMENT    |
| - Implement code |
| - Unit tests     |
+--------+---------+
         |
         v
+--------+---------+
|     TESTING      |
| - Integration    |
| - E2E tests      |
+--------+---------+
         |
         v
+--------+---------+
|   CODE REVIEW    |
| - 3 reviewers    |
| - Devil's adv.   |
+--------+---------+
         |
         v
+--------+---------+
|   DEPLOYMENT     |
| - Build          |
| - Deploy         |
+--------+---------+
         |
         v
+--------+---------+
|   VERIFICATION   |
| - Smoke tests    |
| - Monitoring     |
+--------+---------+

Complexity tiers:
  Simple:   3 phases (Requirements -> Development -> Testing)
  Standard: 6 phases (+ Planning, Review, Deployment)
  Complex:  8 phases (+ Security, Performance, Accessibility)
```

---

## Agent Lifecycle

```
                    +------------+
                    |   SPAWN    |
                    +-----+------+
                          |
                          | Initialize
                          v
                    +-----+------+
                    |   READY    |
                    +-----+------+
                          |
                          | Receive task
                          v
+------------+      +-----+------+
|   ERROR    |<-----|  WORKING   |
+-----+------+      +-----+------+
      |                   |
      | Retry             | Complete
      v                   v
+-----+------+      +-----+------+
|  RETRYING  |----->| REPORTING  |
+------------+      +-----+------+
                          |
                          | Report sent
                          v
                    +-----+------+
                    | TERMINATED |
                    +------------+

Agent types:
  - Planning agents (Opus)
  - Development agents (Sonnet)
  - Testing agents (Haiku/Sonnet)
  - Review agents (Sonnet)
  - Documentation agents (Haiku)
```

---

## Parallel Workflow Streams

```
                         +----------------+
                         |   MAIN BRANCH  |
                         +-------+--------+
                                 |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
+--------+--------+    +--------+--------+    +--------+--------+
|  FEATURE STREAM |    |  TESTING STREAM |    |   DOCS STREAM   |
|  (worktree-feat)|    |  (worktree-test)|    |  (worktree-docs)|
+--------+--------+    +--------+--------+    +--------+--------+
         |                       |                       |
         | Develop               | Write tests           | Generate docs
         v                       v                       v
+--------+--------+    +--------+--------+    +--------+--------+
|  FEATURE DONE   |    |   TESTS DONE    |    |    DOCS DONE    |
+--------+--------+    +--------+--------+    +--------+--------+
         |                       |                       |
         +-----------+-----------+-----------+-----------+
                     |
                     v
              +------+------+
              |  AUTO-MERGE |
              +------+------+
                     |
                     v
              +------+------+
              |  MAIN BRANCH|
              +-------------+

Environment variables:
  LOKI_PARALLEL_MODE=true
  LOKI_MAX_WORKTREES=5
  LOKI_AUTO_MERGE=true
```

---

## Notification Flow

```
+------------+     Event      +-------------+
|   SESSION  +--------------->| NOTIFY_SH   |
+------------+                +------+------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+--------+--------+        +---------+-------+        +----------+-------+
|  _notify_slack  |        | _notify_discord |        | _notify_webhook  |
+--------+--------+        +---------+-------+        +----------+-------+
         |                           |                           |
         | curl (background)         | curl (background)         | curl (background)
         v                           v                           v
+--------+--------+        +---------+-------+        +----------+-------+
|  SLACK WEBHOOK  |        | DISCORD WEBHOOK |        | CUSTOM ENDPOINT  |
+-----------------+        +-----------------+        +------------------+

Event types:
  - session_start (blue)
  - session_end (green)
  - task_complete (green)
  - milestone (purple)
  - error (red)
  - warning (orange)
```

---

## Memory System Architecture

```
+------------------+
|    SESSION END   |
+--------+---------+
         |
         | Extract learnings
         v
+--------+---------+
|  CONTINUITY.MD   |
+--------+---------+
         |
         +------------+------------+------------+
         |            |            |            |
         v            v            v            |
+--------+---+ +------+-----+ +----+-------+    |
|  PATTERNS  | |  MISTAKES  | |  SUCCESSES |    |
| (semantic) | | (episodic) | | (episodic) |    |
+-----+------+ +-----+------+ +-----+------+    |
      |              |              |           |
      +-------+------+-------+------+           |
              |                                 |
              v                                 |
      +-------+-------+                         |
      |  DEDUPLICATION|  (MD5 hash)             |
      +-------+-------+                         |
              |                                 |
              v                                 v
      +-------+-------+                 +-------+-------+
      | ~/.loki/      |                 | .loki/memory/ |
      | learnings/    |                 | (project)     |
      +---------------+                 +---------------+

Storage format: JSONL (append-only)
Deduplication: MD5 hash prevents 71% duplicates
```

---

## Enterprise Authentication Flow

```
+------------+     Request      +-------------+
|   CLIENT   +----------------->|  API SERVER |
+------------+                  +------+------+
                                       |
                                       | Check header
                                       v
                               +-------+-------+
                               | Authorization |
                               |    Header?    |
                               +-------+-------+
                                  |         |
                                  | No      | Yes
                                  v         v
                            +-----+---+ +---+--------+
                            |  401    | | VALIDATE   |
                            | UNAUTH  | |   TOKEN    |
                            +---------+ +---+--------+
                                            |
                            +---------------+---------------+
                            |               |               |
                            v               v               v
                      +-----+-----+   +-----+-----+   +-----+-----+
                      |  INVALID  |   |  EXPIRED  |   |   VALID   |
                      +-----+-----+   +-----+-----+   +-----+-----+
                            |               |               |
                            v               v               v
                      +-----+-----+   +-----+-----+   +-----+-----+
                      | 401 ERROR |   | 401 ERROR |   |  PROCESS  |
                      +-----------+   +-----------+   |  REQUEST  |
                                                      +-----+-----+
                                                            |
                                                            | Log to audit
                                                            v
                                                      +-----+-----+
                                                      |  RESPONSE |
                                                      +-----------+

Token storage: ~/.loki/dashboard/tokens.json
Hash: SHA256 (constant-time compare)
Audit: ~/.loki/dashboard/audit/*.jsonl
```

---

## Provider Selection Logic

```
                         +----------------+
                         | LOKI_PROVIDER  |
                         | environment    |
                         +-------+--------+
                                 |
                                 | or
                                 v
                         +-------+--------+
                         |  --provider    |
                         |  CLI flag      |
                         +-------+--------+
                                 |
                                 | or
                                 v
                         +-------+--------+
                         |  config.yaml   |
                         +-------+--------+
                                 |
                                 | or
                                 v
                         +-------+--------+
                         |   DEFAULT      |
                         |   (claude)     |
                         +-------+--------+
                                 |
         +-----------------------+-----------------------+
         |                       |                       |
         v                       v                       v
+--------+--------+    +--------+--------+    +--------+--------+
|     CLAUDE      |    |     CODEX       |    |     GEMINI      |
| Full features   |    | Degraded mode   |    | Degraded mode   |
| - Task tool     |    | - Sequential    |    | - Sequential    |
| - Parallel      |    | - No subagents  |    | - No subagents  |
| - MCP           |    | - No MCP        |    | - No MCP        |
+-----------------+    +-----------------+    +-----------------+
```

---

*These diagrams are auto-generated and updated with each release.*
