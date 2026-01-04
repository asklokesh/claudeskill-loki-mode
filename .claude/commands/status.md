# Loki Mode Status

Check current Loki Mode status and progress.

## Check
1. Read `.loki/state/orchestrator.json` - current phase
2. Read `.loki/queue/pending.json` - pending tasks count
3. Read `.loki/queue/in-progress.json` - active tasks
4. Read `.loki/queue/completed.json` - completed count
5. Read `.loki/CONTINUITY.md` - working memory

## Report
Provide a concise status update:
- Current phase
- Tasks: X pending, Y in-progress, Z completed
- Current focus
- Next actions
