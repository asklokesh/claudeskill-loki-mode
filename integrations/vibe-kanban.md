# Vibe Kanban Integration

Loki Mode can optionally integrate with [Vibe Kanban](https://github.com/BloopAI/vibe-kanban) to provide a visual dashboard for monitoring autonomous execution.

## Why Use Vibe Kanban with Loki Mode?

| Feature | Loki Mode Alone | + Vibe Kanban |
|---------|-----------------|---------------|
| Task visualization | File-based queues | Visual kanban board |
| Progress monitoring | Log files | Real-time dashboard |
| Manual intervention | Edit queue files | Drag-and-drop tasks |
| Code review | Automated 3-reviewer | + Visual diff review |
| Parallel agents | Background subagents | Isolated git worktrees |

## Setup

### Quick Start (2 Terminals - Recommended)

The simplest way to use Vibe Kanban with Loki Mode:

```bash
# Terminal 1: Start Vibe Kanban
npx vibe-kanban

# Terminal 2: Run Loki Mode with automatic sync
export LOKI_VIBE_KANBAN=true
./autonomy/run.sh ./prd.md
```

That's it! Tasks will automatically appear in Vibe Kanban as Loki Mode progresses.

### Manual Export (Alternative)

If you prefer manual control over when tasks are exported:

```bash
# Terminal 1: Start Vibe Kanban
npx vibe-kanban

# Terminal 2: Run Loki Mode
./autonomy/run.sh ./prd.md

# Terminal 3: Export tasks manually when needed
./scripts/export-to-vibe-kanban.sh
```

### Advanced: Custom Sync Settings

You can customize the sync behavior with environment variables:

```bash
export LOKI_VIBE_KANBAN=true           # Enable automatic sync
export VIBE_KANBAN_DIR=~/.vibe-kanban/loki-tasks  # Export directory
export VIBE_SYNC_INTERVAL=5            # Minimum seconds between exports
./autonomy/run.sh ./prd.md
```

## How It Works

### Task Sync Flow

```
Loki Mode                          Vibe Kanban
    │                                   │
    ├─ Creates task ──────────────────► Task appears on board
    │                                   │
    ├─ Agent claims task ─────────────► Status: "In Progress"
    │                                   │
    │ ◄─────────────────── User pauses ─┤ (optional intervention)
    │                                   │
    ├─ Task completes ────────────────► Status: "Done"
    │                                   │
    └─ Review results ◄─────────────── User reviews diffs
```

### Task Export Format

Loki Mode exports tasks in Vibe Kanban compatible format:

```json
{
  "id": "loki-task-eng-frontend-001",
  "title": "Implement user authentication UI",
  "description": "Create login/signup forms with validation",
  "status": "todo",
  "agent": "claude-code",
  "tags": ["eng-frontend", "phase-4", "priority-high"],
  "metadata": {
    "lokiPhase": "DEVELOPMENT",
    "lokiSwarm": "engineering",
    "lokiAgent": "eng-frontend",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

### Mapping Loki Phases to Kanban Columns

| Loki Phase | Kanban Column |
|------------|---------------|
| BOOTSTRAP | Backlog |
| DISCOVERY | Planning |
| ARCHITECTURE | Planning |
| INFRASTRUCTURE | In Progress |
| DEVELOPMENT | In Progress |
| QA | Review |
| DEPLOYMENT | Deploying |
| BUSINESS_OPS | Done |
| GROWTH | Done |

## Export Script

Add this to export Loki Mode tasks to Vibe Kanban:

```bash
#!/bin/bash
# scripts/export-to-vibe-kanban.sh

LOKI_DIR=".loki"
EXPORT_DIR="${VIBE_KANBAN_DIR:-~/.vibe-kanban/loki-tasks}"

mkdir -p "$EXPORT_DIR"

# Export pending tasks
if [ -f "$LOKI_DIR/queue/pending.json" ]; then
    python3 << EOF
import json
import os

with open("$LOKI_DIR/queue/pending.json") as f:
    tasks = json.load(f)

export_dir = os.path.expanduser("$EXPORT_DIR")

for task in tasks:
    vibe_task = {
        "id": f"loki-{task['id']}",
        "title": task.get('payload', {}).get('description', task['type']),
        "description": json.dumps(task.get('payload', {}), indent=2),
        "status": "todo",
        "agent": "claude-code",
        "tags": [task['type'], f"priority-{task.get('priority', 5)}"],
        "metadata": {
            "lokiTaskId": task['id'],
            "lokiType": task['type'],
            "createdAt": task.get('createdAt', '')
        }
    }

    with open(f"{export_dir}/{task['id']}.json", 'w') as out:
        json.dump(vibe_task, out, indent=2)

print(f"Exported {len(tasks)} tasks to {export_dir}")
EOF
fi
```

## How Automatic Sync Works

When you set `LOKI_VIBE_KANBAN=true`, the autonomy runner automatically starts a background watcher process (`scripts/vibe-sync-watcher.sh`) that:

1. Monitors `.loki/queue/` for task changes
2. Monitors `.loki/state/orchestrator.json` for phase changes
3. Automatically exports tasks to Vibe Kanban when changes are detected
4. Rate-limits exports (default: maximum once per 5 seconds)
5. Logs all activity to `.loki/logs/vibe-kanban.log`

The watcher uses the best available file monitoring tool:
- **macOS**: `fswatch` (install with `brew install fswatch`)
- **Linux**: `inotifywait` (install with `apt install inotify-tools`)
- **Fallback**: Polling mode (works everywhere, but less efficient)

You can monitor the sync activity:
```bash
tail -f .loki/logs/vibe-kanban.log
```

## Benefits of Combined Usage

### 1. Visual Progress Tracking
See all active Loki agents as tasks moving across your kanban board.

### 2. Safe Isolation
Vibe Kanban runs each agent in isolated git worktrees, perfect for Loki's parallel development.

### 3. Human-in-the-Loop Option
Pause autonomous execution, review changes visually, then resume.

### 4. Multi-Project Dashboard
If running Loki Mode on multiple projects, see all in one Vibe Kanban instance.

## Comparison: When to Use What

| Scenario | Recommendation |
|----------|----------------|
| Fully autonomous, no monitoring | Loki Mode + Wrapper only |
| Need visual progress dashboard | Add Vibe Kanban |
| Want manual task prioritization | Use Vibe Kanban to reorder |
| Code review before merge | Use Vibe Kanban's diff viewer |
| Multiple concurrent PRDs | Vibe Kanban for project switching |

## Troubleshooting

### "Exported 0 tasks total"

This usually means:
1. Loki Mode hasn't created any tasks yet (queue files are empty)
2. You're exporting before Loki Mode has initialized the `.loki/` directory

**Solution**: Wait for Loki Mode to start processing, then run the export script.

### Tasks not appearing in Vibe Kanban

Check these items:
1. Is Vibe Kanban running? (`npx vibe-kanban` should be active)
2. Are tasks being exported? Check `.loki/logs/vibe-kanban.log`
3. Is the export directory correct? Check `~/.vibe-kanban/loki-tasks/`
4. Are there task JSON files in the export directory? `ls ~/.vibe-kanban/loki-tasks/`

### AttributeError: 'str' object has no attribute 'get'

This was a bug in older versions where payload could be a string instead of a dict. This is now fixed in the export script. If you still see this error, make sure you're using the latest version.

### Watcher not starting

If `LOKI_VIBE_KANBAN=true` but the watcher doesn't start:
1. Check that `scripts/vibe-sync-watcher.sh` exists and is executable
2. Look for errors in `.loki/logs/vibe-kanban.log`
3. Try manual export first: `./scripts/export-to-vibe-kanban.sh`

### No file watcher available (fswatch/inotifywait)

The watcher will fall back to polling mode, which works but is less efficient. For better performance:
- **macOS**: `brew install fswatch`
- **Linux**: `sudo apt install inotify-tools`

## Future Integration Ideas

- [ ] Bidirectional sync (Vibe → Loki)
- [ ] Vibe Kanban MCP server for agent communication
- [ ] Shared agent profiles between tools
- [ ] Unified logging dashboard
