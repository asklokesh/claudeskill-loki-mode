"""
Loki Mode Learning System - Signal Emitter

This module provides functions to emit learning signals:
- emit_signal(): Write signals to .loki/learning/signals/
- Integration with events/bus.py for cross-component notification

See docs/SYNERGY-ROADMAP.md for full architecture documentation.
"""

from __future__ import annotations

import fcntl
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Import signal types
from .signals import (
    LearningSignal,
    SignalType,
    SignalSource,
    Outcome,
    UserPreferenceSignal,
    ErrorPatternSignal,
    SuccessPatternSignal,
    ToolEfficiencySignal,
    WorkflowPatternSignal,
    ContextRelevanceSignal,
    signal_from_dict,
)

# Import event bus for cross-component notification
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from events.bus import EventBus, EventType, EventSource as BusEventSource, LokiEvent


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------


def get_signals_dir(loki_dir: Optional[Path] = None) -> Path:
    """
    Get the signals directory path.

    Args:
        loki_dir: Path to .loki directory. Defaults to ./.loki

    Returns:
        Path to signals directory
    """
    base = loki_dir or Path('.loki')
    signals_dir = base / 'learning' / 'signals'
    signals_dir.mkdir(parents=True, exist_ok=True)
    return signals_dir


# -----------------------------------------------------------------------------
# Core Emit Function
# -----------------------------------------------------------------------------


def emit_signal(
    signal: LearningSignal,
    loki_dir: Optional[Path] = None,
    broadcast: bool = True
) -> str:
    """
    Emit a learning signal.

    Writes the signal to .loki/learning/signals/ and optionally
    broadcasts it via the event bus.

    Args:
        signal: The learning signal to emit
        loki_dir: Path to .loki directory. Defaults to ./.loki
        broadcast: Whether to broadcast via event bus (default True)

    Returns:
        The signal ID

    Raises:
        ValueError: If signal validation fails
        RuntimeError: If file write fails
    """
    # Validate signal
    errors = signal.validate()
    if errors:
        raise ValueError(f"Invalid signal: {'; '.join(errors)}")

    # Get signals directory
    signals_dir = get_signals_dir(loki_dir)

    # Generate filename with timestamp for sorting
    timestamp_str = signal.timestamp.isoformat().replace(':', '-')
    if isinstance(signal.timestamp, datetime):
        timestamp_str = signal.timestamp.strftime('%Y-%m-%dT%H-%M-%S')
    signal_file = signals_dir / f"{timestamp_str}_{signal.id}.json"

    # Write signal to file with locking
    try:
        with open(signal_file, 'w') as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            json.dump(signal.to_dict(), f, indent=2)
            fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except IOError as e:
        raise RuntimeError(f"Failed to write signal: {e}")

    # Broadcast via event bus if enabled
    if broadcast:
        try:
            bus = EventBus(loki_dir)
            bus.emit_simple(
                event_type=EventType.MEMORY,
                source=_map_signal_source_to_event_source(signal.source),
                action='learning_signal',
                signal_id=signal.id,
                signal_type=signal.type.value,
                outcome=signal.outcome.value,
            )
        except Exception:
            # Don't fail signal emission if event broadcast fails
            pass

    return signal.id


def _map_signal_source_to_event_source(source: SignalSource) -> BusEventSource:
    """Map SignalSource to EventSource."""
    mapping = {
        SignalSource.CLI: BusEventSource.CLI,
        SignalSource.API: BusEventSource.API,
        SignalSource.VSCODE: BusEventSource.VSCODE,
        SignalSource.MCP: BusEventSource.MCP,
        SignalSource.MEMORY: BusEventSource.MEMORY,
        SignalSource.DASHBOARD: BusEventSource.DASHBOARD,
    }
    return mapping.get(source, BusEventSource.CLI)


# -----------------------------------------------------------------------------
# Convenience Functions
# -----------------------------------------------------------------------------


def emit_user_preference(
    source: SignalSource,
    action: str,
    preference_key: str,
    preference_value: Any,
    context: Optional[Dict[str, Any]] = None,
    alternatives_rejected: Optional[List[Any]] = None,
    confidence: float = 0.9,
    loki_dir: Optional[Path] = None,
) -> str:
    """
    Emit a user preference learning signal.

    Args:
        source: Origin of the signal
        action: The action that revealed the preference
        preference_key: The preference being expressed
        preference_value: The preferred value
        context: Additional context
        alternatives_rejected: Other options not chosen
        confidence: Confidence in the signal
        loki_dir: Path to .loki directory

    Returns:
        The signal ID
    """
    signal = UserPreferenceSignal(
        type=SignalType.USER_PREFERENCE,
        source=source,
        action=action,
        context=context or {},
        outcome=Outcome.SUCCESS,
        confidence=confidence,
        preference_key=preference_key,
        preference_value=preference_value,
        alternatives_rejected=alternatives_rejected or [],
    )
    return emit_signal(signal, loki_dir)


def emit_error_pattern(
    source: SignalSource,
    action: str,
    error_type: str,
    error_message: str,
    context: Optional[Dict[str, Any]] = None,
    resolution: str = '',
    stack_trace: Optional[str] = None,
    recovery_steps: Optional[List[str]] = None,
    confidence: float = 0.8,
    loki_dir: Optional[Path] = None,
) -> str:
    """
    Emit an error pattern learning signal.

    Args:
        source: Origin of the signal
        action: The action that caused the error
        error_type: Category of error
        error_message: The error message
        context: Additional context
        resolution: How the error was resolved
        stack_trace: Optional stack trace
        recovery_steps: Steps taken to recover
        confidence: Confidence in the signal
        loki_dir: Path to .loki directory

    Returns:
        The signal ID
    """
    signal = ErrorPatternSignal(
        type=SignalType.ERROR_PATTERN,
        source=source,
        action=action,
        context=context or {},
        outcome=Outcome.FAILURE if not resolution else Outcome.SUCCESS,
        confidence=confidence,
        error_type=error_type,
        error_message=error_message,
        resolution=resolution,
        stack_trace=stack_trace,
        recovery_steps=recovery_steps or [],
    )
    return emit_signal(signal, loki_dir)


def emit_success_pattern(
    source: SignalSource,
    action: str,
    pattern_name: str,
    action_sequence: List[str],
    context: Optional[Dict[str, Any]] = None,
    preconditions: Optional[List[str]] = None,
    postconditions: Optional[List[str]] = None,
    duration_seconds: int = 0,
    confidence: float = 0.85,
    loki_dir: Optional[Path] = None,
) -> str:
    """
    Emit a success pattern learning signal.

    Args:
        source: Origin of the signal
        action: The action that succeeded
        pattern_name: Human-readable name for the pattern
        action_sequence: Ordered list of successful actions
        context: Additional context
        preconditions: Conditions before success
        postconditions: Conditions after success
        duration_seconds: How long it took
        confidence: Confidence in the signal
        loki_dir: Path to .loki directory

    Returns:
        The signal ID
    """
    signal = SuccessPatternSignal(
        type=SignalType.SUCCESS_PATTERN,
        source=source,
        action=action,
        context=context or {},
        outcome=Outcome.SUCCESS,
        confidence=confidence,
        pattern_name=pattern_name,
        action_sequence=action_sequence,
        preconditions=preconditions or [],
        postconditions=postconditions or [],
        duration_seconds=duration_seconds,
    )
    return emit_signal(signal, loki_dir)


def emit_tool_efficiency(
    source: SignalSource,
    action: str,
    tool_name: str,
    context: Optional[Dict[str, Any]] = None,
    tokens_used: int = 0,
    execution_time_ms: int = 0,
    success_rate: float = 1.0,
    alternative_tools: Optional[List[str]] = None,
    outcome: Outcome = Outcome.SUCCESS,
    confidence: float = 0.9,
    loki_dir: Optional[Path] = None,
) -> str:
    """
    Emit a tool efficiency learning signal.

    Args:
        source: Origin of the signal
        action: The action performed by the tool
        tool_name: Name of the tool
        context: Additional context
        tokens_used: Tokens consumed
        execution_time_ms: Execution time in ms
        success_rate: Historical success rate
        alternative_tools: Other tools that could be used
        outcome: Result of the tool use
        confidence: Confidence in the signal
        loki_dir: Path to .loki directory

    Returns:
        The signal ID
    """
    signal = ToolEfficiencySignal(
        type=SignalType.TOOL_EFFICIENCY,
        source=source,
        action=action,
        context=context or {},
        outcome=outcome,
        confidence=confidence,
        tool_name=tool_name,
        tokens_used=tokens_used,
        execution_time_ms=execution_time_ms,
        success_rate=success_rate,
        alternative_tools=alternative_tools or [],
    )
    return emit_signal(signal, loki_dir)


def emit_workflow_pattern(
    source: SignalSource,
    action: str,
    workflow_name: str,
    steps: List[str],
    context: Optional[Dict[str, Any]] = None,
    parallel_steps: Optional[List[List[str]]] = None,
    branching_conditions: Optional[Dict[str, str]] = None,
    total_duration_seconds: int = 0,
    outcome: Outcome = Outcome.SUCCESS,
    confidence: float = 0.85,
    loki_dir: Optional[Path] = None,
) -> str:
    """
    Emit a workflow pattern learning signal.

    Args:
        source: Origin of the signal
        action: The workflow action
        workflow_name: Human-readable name
        steps: Ordered list of steps
        context: Additional context
        parallel_steps: Steps that run in parallel
        branching_conditions: Conditions for branches
        total_duration_seconds: Total execution time
        outcome: Result of the workflow
        confidence: Confidence in the signal
        loki_dir: Path to .loki directory

    Returns:
        The signal ID
    """
    signal = WorkflowPatternSignal(
        type=SignalType.WORKFLOW_PATTERN,
        source=source,
        action=action,
        context=context or {},
        outcome=outcome,
        confidence=confidence,
        workflow_name=workflow_name,
        steps=steps,
        parallel_steps=parallel_steps or [],
        branching_conditions=branching_conditions or {},
        total_duration_seconds=total_duration_seconds,
    )
    return emit_signal(signal, loki_dir)


def emit_context_relevance(
    source: SignalSource,
    action: str,
    query: str,
    retrieved_context_ids: List[str],
    context: Optional[Dict[str, Any]] = None,
    relevant_ids: Optional[List[str]] = None,
    irrelevant_ids: Optional[List[str]] = None,
    precision: float = 0.0,
    recall: float = 0.0,
    confidence: float = 0.8,
    loki_dir: Optional[Path] = None,
) -> str:
    """
    Emit a context relevance learning signal.

    Args:
        source: Origin of the signal
        action: The retrieval action
        query: The query used
        retrieved_context_ids: IDs of retrieved items
        context: Additional context
        relevant_ids: IDs marked as relevant
        irrelevant_ids: IDs marked as irrelevant
        precision: Retrieval precision
        recall: Retrieval recall
        confidence: Confidence in the signal
        loki_dir: Path to .loki directory

    Returns:
        The signal ID
    """
    # Calculate outcome based on precision
    if precision >= 0.8:
        outcome = Outcome.SUCCESS
    elif precision >= 0.5:
        outcome = Outcome.PARTIAL
    else:
        outcome = Outcome.FAILURE

    signal = ContextRelevanceSignal(
        type=SignalType.CONTEXT_RELEVANCE,
        source=source,
        action=action,
        context=context or {},
        outcome=outcome,
        confidence=confidence,
        query=query,
        retrieved_context_ids=retrieved_context_ids,
        relevant_ids=relevant_ids or [],
        irrelevant_ids=irrelevant_ids or [],
        precision=precision,
        recall=recall,
    )
    return emit_signal(signal, loki_dir)


# -----------------------------------------------------------------------------
# Signal Retrieval
# -----------------------------------------------------------------------------


def get_signals(
    loki_dir: Optional[Path] = None,
    signal_type: Optional[SignalType] = None,
    source: Optional[SignalSource] = None,
    since: Optional[datetime] = None,
    limit: int = 100,
) -> List[LearningSignal]:
    """
    Retrieve learning signals from storage.

    Args:
        loki_dir: Path to .loki directory
        signal_type: Filter by signal type
        source: Filter by signal source
        since: Only signals after this timestamp
        limit: Maximum number of signals to return

    Returns:
        List of LearningSignal instances
    """
    signals_dir = get_signals_dir(loki_dir)
    signals = []

    # Get all signal files, sorted by name (timestamp)
    signal_files = sorted(signals_dir.glob('*.json'), reverse=True)

    for signal_file in signal_files:
        if len(signals) >= limit:
            break

        try:
            with open(signal_file, 'r') as f:
                data = json.load(f)
                signal = signal_from_dict(data)

                # Filter by type
                if signal_type and signal.type != signal_type:
                    continue

                # Filter by source
                if source and signal.source != source:
                    continue

                # Filter by time
                if since and signal.timestamp < since:
                    continue

                signals.append(signal)
        except (json.JSONDecodeError, IOError):
            continue

    return signals


def get_signal_by_id(
    signal_id: str,
    loki_dir: Optional[Path] = None,
) -> Optional[LearningSignal]:
    """
    Retrieve a specific signal by ID.

    Args:
        signal_id: The signal ID to retrieve
        loki_dir: Path to .loki directory

    Returns:
        LearningSignal instance or None if not found
    """
    signals_dir = get_signals_dir(loki_dir)

    # Search for the signal file
    for signal_file in signals_dir.glob(f'*_{signal_id}.json'):
        try:
            with open(signal_file, 'r') as f:
                data = json.load(f)
                return signal_from_dict(data)
        except (json.JSONDecodeError, IOError):
            continue

    return None


def clear_signals(
    loki_dir: Optional[Path] = None,
    older_than_days: int = 30,
) -> int:
    """
    Clear old signals from storage.

    Args:
        loki_dir: Path to .loki directory
        older_than_days: Delete signals older than this

    Returns:
        Number of signals deleted
    """
    import time

    signals_dir = get_signals_dir(loki_dir)
    cutoff = time.time() - (older_than_days * 24 * 60 * 60)
    count = 0

    for signal_file in signals_dir.glob('*.json'):
        try:
            if signal_file.stat().st_mtime < cutoff:
                try:
                    signal_file.unlink()
                    count += 1
                except FileNotFoundError:
                    # File was deleted by another process
                    pass
        except IOError:
            pass

    return count
