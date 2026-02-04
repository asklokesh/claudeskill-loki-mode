"""
Loki Mode MCP Resources

Resource definitions and helpers for MCP resource endpoints.
Resources provide read-only access to Loki Mode data.
Uses StateManager for centralized state access with caching.
"""

import os
import sys
import json
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add parent directory to path for state manager import
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import StateManager for centralized state access
try:
    from state.manager import StateManager, ManagedFile, get_state_manager
    HAS_STATE_MANAGER = True
except ImportError:
    HAS_STATE_MANAGER = False
    StateManager = None
    ManagedFile = None
    get_state_manager = None


def get_loki_base_path() -> str:
    """Get the base .loki directory path."""
    return os.path.join(os.getcwd(), '.loki')


# Initialize a module-level StateManager instance
_state_manager = None


def _get_state_manager() -> Optional['StateManager']:
    """Get or create the StateManager instance."""
    global _state_manager
    if not HAS_STATE_MANAGER:
        return None
    if _state_manager is None:
        _state_manager = get_state_manager(
            loki_dir=get_loki_base_path(),
            enable_watch=False,  # MCP resources don't need watching
            enable_events=False
        )
    return _state_manager


# ============================================================
# Continuity Resources
# ============================================================

def read_continuity() -> str:
    """Read the CONTINUITY.md file content."""
    continuity_path = os.path.join(get_loki_base_path(), 'CONTINUITY.md')
    if os.path.exists(continuity_path):
        with open(continuity_path, 'r') as f:
            return f.read()
    return ""


def get_continuity_summary() -> Dict[str, Any]:
    """Get a summary of the continuity state."""
    content = read_continuity()
    if not content:
        return {"exists": False, "sections": []}

    # Parse sections from markdown
    sections = []
    current_section = None
    for line in content.split('\n'):
        if line.startswith('## '):
            if current_section:
                sections.append(current_section)
            current_section = {"title": line[3:].strip(), "content": []}
        elif current_section and line.strip():
            current_section["content"].append(line.strip())

    if current_section:
        sections.append(current_section)

    return {
        "exists": True,
        "sections": [s["title"] for s in sections],
        "line_count": len(content.split('\n'))
    }


# ============================================================
# Memory Resources
# ============================================================

def read_memory_index() -> Dict[str, Any]:
    """Read the memory index file using StateManager."""
    manager = _get_state_manager()
    if manager:
        result = manager.get_state(ManagedFile.MEMORY_INDEX)
        if result:
            return result
    # Fallback to direct file read if StateManager not available
    index_path = os.path.join(get_loki_base_path(), 'memory', 'index.json')
    if os.path.exists(index_path):
        with open(index_path, 'r') as f:
            return json.load(f)
    return {"topics": [], "message": "Index not initialized"}


def get_memory_stats() -> Dict[str, Any]:
    """Get statistics about the memory system."""
    memory_path = os.path.join(get_loki_base_path(), 'memory')
    if not os.path.exists(memory_path):
        return {"initialized": False}

    stats = {
        "initialized": True,
        "episodic_count": 0,
        "semantic_count": 0,
        "skill_count": 0
    }

    # Count episodic memories
    episodic_path = os.path.join(memory_path, 'episodic')
    if os.path.exists(episodic_path):
        stats["episodic_count"] = len([
            f for f in os.listdir(episodic_path)
            if f.endswith('.json')
        ])

    # Count semantic patterns
    semantic_path = os.path.join(memory_path, 'semantic')
    if os.path.exists(semantic_path):
        stats["semantic_count"] = len([
            f for f in os.listdir(semantic_path)
            if f.endswith('.json')
        ])

    # Count skills
    skills_path = os.path.join(memory_path, 'skills')
    if os.path.exists(skills_path):
        stats["skill_count"] = len([
            f for f in os.listdir(skills_path)
            if f.endswith('.json')
        ])

    return stats


def list_recent_episodes(limit: int = 10) -> List[Dict[str, Any]]:
    """List recent episodic memories."""
    episodic_path = os.path.join(get_loki_base_path(), 'memory', 'episodic')
    if not os.path.exists(episodic_path):
        return []

    episodes = []
    for filename in sorted(os.listdir(episodic_path), reverse=True)[:limit]:
        if filename.endswith('.json'):
            filepath = os.path.join(episodic_path, filename)
            try:
                with open(filepath, 'r') as f:
                    episode = json.load(f)
                    episodes.append({
                        "id": episode.get("id", filename[:-5]),
                        "timestamp": episode.get("timestamp"),
                        "task_type": episode.get("task_type"),
                        "outcome": episode.get("outcome")
                    })
            except (json.JSONDecodeError, IOError):
                continue

    return episodes


def list_semantic_patterns(category: Optional[str] = None) -> List[Dict[str, Any]]:
    """List semantic patterns, optionally filtered by category."""
    semantic_path = os.path.join(get_loki_base_path(), 'memory', 'semantic')
    if not os.path.exists(semantic_path):
        return []

    patterns = []
    for filename in os.listdir(semantic_path):
        if filename.endswith('.json'):
            filepath = os.path.join(semantic_path, filename)
            try:
                with open(filepath, 'r') as f:
                    pattern = json.load(f)
                    if category is None or pattern.get("category") == category:
                        patterns.append({
                            "id": pattern.get("id", filename[:-5]),
                            "pattern": pattern.get("pattern"),
                            "category": pattern.get("category"),
                            "confidence": pattern.get("confidence"),
                            "usage_count": pattern.get("usage_count", 0)
                        })
            except (json.JSONDecodeError, IOError):
                continue

    return patterns


# ============================================================
# Task Queue Resources
# ============================================================

def read_task_queue() -> Dict[str, Any]:
    """Read the full task queue using StateManager."""
    manager = _get_state_manager()
    if manager:
        # Task queue is stored in state/task-queue.json, but we can use a custom path
        result = manager.get_state("state/task-queue.json")
        if result:
            return result
    # Fallback to direct file read if StateManager not available
    queue_path = os.path.join(get_loki_base_path(), 'state', 'task-queue.json')
    if os.path.exists(queue_path):
        with open(queue_path, 'r') as f:
            return json.load(f)
    return {"tasks": [], "version": "1.0"}


def get_pending_tasks() -> List[Dict[str, Any]]:
    """Get all pending tasks."""
    queue = read_task_queue()
    return [t for t in queue.get("tasks", []) if t.get("status") == "pending"]


def get_in_progress_tasks() -> List[Dict[str, Any]]:
    """Get all in-progress tasks."""
    queue = read_task_queue()
    return [t for t in queue.get("tasks", []) if t.get("status") == "in_progress"]


def get_blocked_tasks() -> List[Dict[str, Any]]:
    """Get all blocked tasks."""
    queue = read_task_queue()
    return [t for t in queue.get("tasks", []) if t.get("status") == "blocked"]


def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """Get a specific task by ID."""
    queue = read_task_queue()
    for task in queue.get("tasks", []):
        if task.get("id") == task_id:
            return task
    return None


# ============================================================
# State Resources
# ============================================================

def read_autonomy_state() -> Dict[str, Any]:
    """Read the autonomy state file using StateManager."""
    manager = _get_state_manager()
    if manager:
        result = manager.get_state(ManagedFile.AUTONOMY)
        if result:
            return result
    # Fallback to direct file read if StateManager not available
    state_path = os.path.join(get_loki_base_path(), 'state', 'autonomy-state.json')
    if os.path.exists(state_path):
        with open(state_path, 'r') as f:
            return json.load(f)
    return {}


def get_current_phase() -> str:
    """Get the current SDLC phase."""
    state = read_autonomy_state()
    return state.get("current_phase", "unknown")


def get_session_info() -> Dict[str, Any]:
    """Get information about the current session."""
    state = read_autonomy_state()
    return {
        "session_id": state.get("session_id"),
        "started_at": state.get("started_at"),
        "current_phase": state.get("current_phase"),
        "prd_path": state.get("prd_path"),
        "provider": state.get("provider", "claude")
    }


# ============================================================
# Metrics Resources
# ============================================================

def read_tool_metrics() -> Dict[str, Any]:
    """Read tool usage metrics."""
    metrics_path = os.path.join(get_loki_base_path(), 'metrics', 'tool-usage.jsonl')
    if not os.path.exists(metrics_path):
        return {"tool_calls": 0, "breakdown": {}}

    tool_counts = {}
    total_calls = 0

    with open(metrics_path, 'r') as f:
        for line in f:
            try:
                entry = json.loads(line)
                tool = entry.get("tool", "unknown")
                tool_counts[tool] = tool_counts.get(tool, 0) + 1
                total_calls += 1
            except json.JSONDecodeError:
                continue

    return {
        "tool_calls": total_calls,
        "breakdown": tool_counts
    }


def get_efficiency_metrics() -> Dict[str, Any]:
    """Get efficiency metrics for the current session."""
    metrics_path = os.path.join(get_loki_base_path(), 'metrics', 'efficiency')
    if not os.path.exists(metrics_path):
        return {"available": False}

    metrics = {"available": True}

    # Read token economics if available
    token_path = os.path.join(metrics_path, 'token-economics.json')
    if os.path.exists(token_path):
        with open(token_path, 'r') as f:
            metrics["token_economics"] = json.load(f)

    return metrics


def get_reward_signals() -> Dict[str, Any]:
    """Get reward signals for the current session."""
    rewards_path = os.path.join(get_loki_base_path(), 'metrics', 'rewards')
    if not os.path.exists(rewards_path):
        return {"available": False}

    signals = {"available": True, "rewards": []}

    # Read recent reward signals
    for filename in sorted(os.listdir(rewards_path), reverse=True)[:10]:
        if filename.endswith('.json'):
            filepath = os.path.join(rewards_path, filename)
            try:
                with open(filepath, 'r') as f:
                    signals["rewards"].append(json.load(f))
            except (json.JSONDecodeError, IOError):
                continue

    return signals
