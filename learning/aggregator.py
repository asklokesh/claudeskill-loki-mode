"""
Loki Mode Learning System - Signal Aggregator

This module provides aggregation of learning signals to identify patterns:
- LearningAggregator: Main class for aggregating signals
- Pattern detection for user preferences, errors, successes, tools, contexts
- Time-windowed aggregation with confidence scoring

See docs/SYNERGY-ROADMAP.md for full architecture documentation.
"""

from __future__ import annotations

import json
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

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
from .emitter import get_signals, get_signals_dir


# -----------------------------------------------------------------------------
# Aggregated Learning Data Classes
# -----------------------------------------------------------------------------


@dataclass
class AggregatedPreference:
    """Aggregated user preference pattern."""
    preference_key: str
    preferred_value: Any
    frequency: int
    confidence: float
    sources: List[str]
    alternatives_rejected: List[Any]
    first_seen: datetime
    last_seen: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'type': 'preference',
            'preference_key': self.preference_key,
            'preferred_value': self.preferred_value,
            'frequency': self.frequency,
            'confidence': self.confidence,
            'sources': self.sources,
            'alternatives_rejected': self.alternatives_rejected,
            'first_seen': self.first_seen.isoformat() + 'Z',
            'last_seen': self.last_seen.isoformat() + 'Z',
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AggregatedPreference:
        """Create from dictionary."""
        first_seen = data.get('first_seen', '')
        if isinstance(first_seen, str):
            if first_seen.endswith('Z'):
                first_seen = first_seen[:-1]
            first_seen = datetime.fromisoformat(first_seen)

        last_seen = data.get('last_seen', '')
        if isinstance(last_seen, str):
            if last_seen.endswith('Z'):
                last_seen = last_seen[:-1]
            last_seen = datetime.fromisoformat(last_seen)

        return cls(
            preference_key=data.get('preference_key', ''),
            preferred_value=data.get('preferred_value'),
            frequency=data.get('frequency', 0),
            confidence=data.get('confidence', 0.0),
            sources=data.get('sources', []),
            alternatives_rejected=data.get('alternatives_rejected', []),
            first_seen=first_seen,
            last_seen=last_seen,
        )


@dataclass
class AggregatedErrorPattern:
    """Aggregated error pattern."""
    error_type: str
    common_messages: List[str]
    frequency: int
    confidence: float
    sources: List[str]
    resolutions: List[str]
    recovery_steps: List[List[str]]
    resolution_rate: float
    first_seen: datetime
    last_seen: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'type': 'error_pattern',
            'error_type': self.error_type,
            'common_messages': self.common_messages,
            'frequency': self.frequency,
            'confidence': self.confidence,
            'sources': self.sources,
            'resolutions': self.resolutions,
            'recovery_steps': self.recovery_steps,
            'resolution_rate': self.resolution_rate,
            'first_seen': self.first_seen.isoformat() + 'Z',
            'last_seen': self.last_seen.isoformat() + 'Z',
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AggregatedErrorPattern:
        """Create from dictionary."""
        first_seen = data.get('first_seen', '')
        if isinstance(first_seen, str):
            if first_seen.endswith('Z'):
                first_seen = first_seen[:-1]
            first_seen = datetime.fromisoformat(first_seen)

        last_seen = data.get('last_seen', '')
        if isinstance(last_seen, str):
            if last_seen.endswith('Z'):
                last_seen = last_seen[:-1]
            last_seen = datetime.fromisoformat(last_seen)

        return cls(
            error_type=data.get('error_type', ''),
            common_messages=data.get('common_messages', []),
            frequency=data.get('frequency', 0),
            confidence=data.get('confidence', 0.0),
            sources=data.get('sources', []),
            resolutions=data.get('resolutions', []),
            recovery_steps=data.get('recovery_steps', []),
            resolution_rate=data.get('resolution_rate', 0.0),
            first_seen=first_seen,
            last_seen=last_seen,
        )


@dataclass
class AggregatedSuccessPattern:
    """Aggregated success pattern."""
    pattern_name: str
    common_actions: List[str]
    frequency: int
    confidence: float
    sources: List[str]
    avg_duration_seconds: float
    preconditions: List[str]
    postconditions: List[str]
    first_seen: datetime
    last_seen: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'type': 'success_pattern',
            'pattern_name': self.pattern_name,
            'common_actions': self.common_actions,
            'frequency': self.frequency,
            'confidence': self.confidence,
            'sources': self.sources,
            'avg_duration_seconds': self.avg_duration_seconds,
            'preconditions': self.preconditions,
            'postconditions': self.postconditions,
            'first_seen': self.first_seen.isoformat() + 'Z',
            'last_seen': self.last_seen.isoformat() + 'Z',
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AggregatedSuccessPattern:
        """Create from dictionary."""
        first_seen = data.get('first_seen', '')
        if isinstance(first_seen, str):
            if first_seen.endswith('Z'):
                first_seen = first_seen[:-1]
            first_seen = datetime.fromisoformat(first_seen)

        last_seen = data.get('last_seen', '')
        if isinstance(last_seen, str):
            if last_seen.endswith('Z'):
                last_seen = last_seen[:-1]
            last_seen = datetime.fromisoformat(last_seen)

        return cls(
            pattern_name=data.get('pattern_name', ''),
            common_actions=data.get('common_actions', []),
            frequency=data.get('frequency', 0),
            confidence=data.get('confidence', 0.0),
            sources=data.get('sources', []),
            avg_duration_seconds=data.get('avg_duration_seconds', 0.0),
            preconditions=data.get('preconditions', []),
            postconditions=data.get('postconditions', []),
            first_seen=first_seen,
            last_seen=last_seen,
        )


@dataclass
class AggregatedToolEfficiency:
    """Aggregated tool efficiency metrics."""
    tool_name: str
    usage_count: int
    success_count: int
    failure_count: int
    avg_execution_time_ms: float
    total_tokens_used: int
    success_rate: float
    efficiency_score: float
    confidence: float
    sources: List[str]
    alternative_tools: List[str]
    first_seen: datetime
    last_seen: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'type': 'tool_efficiency',
            'tool_name': self.tool_name,
            'usage_count': self.usage_count,
            'success_count': self.success_count,
            'failure_count': self.failure_count,
            'avg_execution_time_ms': self.avg_execution_time_ms,
            'total_tokens_used': self.total_tokens_used,
            'success_rate': self.success_rate,
            'efficiency_score': self.efficiency_score,
            'confidence': self.confidence,
            'sources': self.sources,
            'alternative_tools': self.alternative_tools,
            'first_seen': self.first_seen.isoformat() + 'Z',
            'last_seen': self.last_seen.isoformat() + 'Z',
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AggregatedToolEfficiency:
        """Create from dictionary."""
        first_seen = data.get('first_seen', '')
        if isinstance(first_seen, str):
            if first_seen.endswith('Z'):
                first_seen = first_seen[:-1]
            first_seen = datetime.fromisoformat(first_seen)

        last_seen = data.get('last_seen', '')
        if isinstance(last_seen, str):
            if last_seen.endswith('Z'):
                last_seen = last_seen[:-1]
            last_seen = datetime.fromisoformat(last_seen)

        return cls(
            tool_name=data.get('tool_name', ''),
            usage_count=data.get('usage_count', 0),
            success_count=data.get('success_count', 0),
            failure_count=data.get('failure_count', 0),
            avg_execution_time_ms=data.get('avg_execution_time_ms', 0.0),
            total_tokens_used=data.get('total_tokens_used', 0),
            success_rate=data.get('success_rate', 0.0),
            efficiency_score=data.get('efficiency_score', 0.0),
            confidence=data.get('confidence', 0.0),
            sources=data.get('sources', []),
            alternative_tools=data.get('alternative_tools', []),
            first_seen=first_seen,
            last_seen=last_seen,
        )


@dataclass
class AggregatedContextRelevance:
    """Aggregated context relevance metrics."""
    query_pattern: str
    retrieval_count: int
    avg_precision: float
    avg_recall: float
    confidence: float
    sources: List[str]
    commonly_relevant_ids: List[str]
    commonly_irrelevant_ids: List[str]
    first_seen: datetime
    last_seen: datetime

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'type': 'context_relevance',
            'query_pattern': self.query_pattern,
            'retrieval_count': self.retrieval_count,
            'avg_precision': self.avg_precision,
            'avg_recall': self.avg_recall,
            'confidence': self.confidence,
            'sources': self.sources,
            'commonly_relevant_ids': self.commonly_relevant_ids,
            'commonly_irrelevant_ids': self.commonly_irrelevant_ids,
            'first_seen': self.first_seen.isoformat() + 'Z',
            'last_seen': self.last_seen.isoformat() + 'Z',
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AggregatedContextRelevance:
        """Create from dictionary."""
        first_seen = data.get('first_seen', '')
        if isinstance(first_seen, str):
            if first_seen.endswith('Z'):
                first_seen = first_seen[:-1]
            first_seen = datetime.fromisoformat(first_seen)

        last_seen = data.get('last_seen', '')
        if isinstance(last_seen, str):
            if last_seen.endswith('Z'):
                last_seen = last_seen[:-1]
            last_seen = datetime.fromisoformat(last_seen)

        return cls(
            query_pattern=data.get('query_pattern', ''),
            retrieval_count=data.get('retrieval_count', 0),
            avg_precision=data.get('avg_precision', 0.0),
            avg_recall=data.get('avg_recall', 0.0),
            confidence=data.get('confidence', 0.0),
            sources=data.get('sources', []),
            commonly_relevant_ids=data.get('commonly_relevant_ids', []),
            commonly_irrelevant_ids=data.get('commonly_irrelevant_ids', []),
            first_seen=first_seen,
            last_seen=last_seen,
        )


@dataclass
class AggregationResult:
    """Result of a learning aggregation run."""
    id: str
    timestamp: datetime
    time_window_days: int
    total_signals_processed: int
    preferences: List[AggregatedPreference]
    error_patterns: List[AggregatedErrorPattern]
    success_patterns: List[AggregatedSuccessPattern]
    tool_efficiencies: List[AggregatedToolEfficiency]
    context_relevance: List[AggregatedContextRelevance]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() + 'Z',
            'time_window_days': self.time_window_days,
            'total_signals_processed': self.total_signals_processed,
            'preferences': [p.to_dict() for p in self.preferences],
            'error_patterns': [e.to_dict() for e in self.error_patterns],
            'success_patterns': [s.to_dict() for s in self.success_patterns],
            'tool_efficiencies': [t.to_dict() for t in self.tool_efficiencies],
            'context_relevance': [c.to_dict() for c in self.context_relevance],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AggregationResult:
        """Create from dictionary."""
        timestamp = data.get('timestamp', '')
        if isinstance(timestamp, str):
            if timestamp.endswith('Z'):
                timestamp = timestamp[:-1]
            timestamp = datetime.fromisoformat(timestamp)

        return cls(
            id=data.get('id', ''),
            timestamp=timestamp,
            time_window_days=data.get('time_window_days', 7),
            total_signals_processed=data.get('total_signals_processed', 0),
            preferences=[AggregatedPreference.from_dict(p) for p in data.get('preferences', [])],
            error_patterns=[AggregatedErrorPattern.from_dict(e) for e in data.get('error_patterns', [])],
            success_patterns=[AggregatedSuccessPattern.from_dict(s) for s in data.get('success_patterns', [])],
            tool_efficiencies=[AggregatedToolEfficiency.from_dict(t) for t in data.get('tool_efficiencies', [])],
            context_relevance=[AggregatedContextRelevance.from_dict(c) for c in data.get('context_relevance', [])],
        )

    def summary(self) -> Dict[str, Any]:
        """Get a summary of the aggregation result."""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() + 'Z',
            'time_window_days': self.time_window_days,
            'total_signals_processed': self.total_signals_processed,
            'counts': {
                'preferences': len(self.preferences),
                'error_patterns': len(self.error_patterns),
                'success_patterns': len(self.success_patterns),
                'tool_efficiencies': len(self.tool_efficiencies),
                'context_relevance': len(self.context_relevance),
            },
        }


# -----------------------------------------------------------------------------
# Learning Aggregator
# -----------------------------------------------------------------------------


class LearningAggregator:
    """
    Aggregates learning signals to identify patterns.

    Reads signals from .loki/learning/signals/ and produces
    aggregated learnings in .loki/learning/aggregated/.
    """

    def __init__(
        self,
        loki_dir: Optional[Path] = None,
        time_window_days: int = 7,
        min_frequency: int = 2,
        min_confidence: float = 0.5,
    ):
        """
        Initialize the learning aggregator.

        Args:
            loki_dir: Path to .loki directory. Defaults to ./.loki
            time_window_days: Number of days to include in aggregation
            min_frequency: Minimum frequency for a pattern to be included
            min_confidence: Minimum confidence score for patterns
        """
        self.loki_dir = loki_dir or Path('.loki')
        self.time_window_days = time_window_days
        self.min_frequency = min_frequency
        self.min_confidence = min_confidence

        # Ensure directories exist
        self.signals_dir = self.loki_dir / 'learning' / 'signals'
        self.aggregated_dir = self.loki_dir / 'learning' / 'aggregated'
        self.aggregated_dir.mkdir(parents=True, exist_ok=True)

    def _get_signals_in_window(self) -> List[LearningSignal]:
        """Get all signals within the time window."""
        since = datetime.now(timezone.utc) - timedelta(days=self.time_window_days)
        return get_signals(
            loki_dir=self.loki_dir,
            since=since,
            limit=10000,  # Process up to 10k signals
        )

    def _calculate_confidence(
        self,
        frequency: int,
        total: int,
        avg_signal_confidence: float,
    ) -> float:
        """
        Calculate confidence score for an aggregated pattern.

        Confidence is based on:
        - Frequency relative to total signals
        - Average confidence of contributing signals
        - Minimum sample size requirements

        For small sample sizes (< 10 signals), we use a more lenient calculation
        to allow patterns to be detected early.
        """
        if total == 0 or frequency < self.min_frequency:
            return 0.0

        # For small sample sizes, use simpler calculation
        if total < 10:
            # Base confidence on signal confidence and relative frequency
            freq_ratio = frequency / max(total, 1)
            confidence = avg_signal_confidence * (0.5 + 0.5 * freq_ratio)
            return min(1.0, max(0.0, confidence))

        # Frequency factor (capped at 1.0)
        freq_factor = min(1.0, frequency / max(5, total * 0.1))

        # Sample size factor (approaches 1.0 as frequency increases)
        sample_factor = 1.0 - (1.0 / (1.0 + frequency * 0.5))

        # Combine factors with signal confidence
        confidence = avg_signal_confidence * freq_factor * sample_factor

        return min(1.0, max(0.0, confidence))

    def aggregate_user_preferences(
        self,
        signals: List[LearningSignal],
    ) -> List[AggregatedPreference]:
        """
        Aggregate user preference signals to find common choices.

        Groups by preference_key and finds most common values.
        """
        # Filter to user preference signals
        pref_signals = [
            s for s in signals
            if s.type == SignalType.USER_PREFERENCE
        ]

        if not pref_signals:
            return []

        # Group by preference key
        by_key: Dict[str, List[UserPreferenceSignal]] = defaultdict(list)
        for s in pref_signals:
            if isinstance(s, UserPreferenceSignal):
                by_key[s.preference_key].append(s)

        results = []
        for key, key_signals in by_key.items():
            if not key:
                continue

            # Count values
            value_counts: Counter = Counter()
            value_confidences: Dict[Any, List[float]] = defaultdict(list)
            sources: set = set()
            all_rejected: List[Any] = []
            timestamps: List[datetime] = []

            for s in key_signals:
                # Use string representation for unhashable values
                val_str = json.dumps(s.preference_value, sort_keys=True)
                value_counts[val_str] += 1
                value_confidences[val_str].append(s.confidence)
                sources.add(s.source.value)
                all_rejected.extend(s.alternatives_rejected)
                timestamps.append(s.timestamp)

            # Get most common value
            if not value_counts:
                continue

            most_common_str, frequency = value_counts.most_common(1)[0]
            most_common = json.loads(most_common_str)

            # Calculate confidence
            avg_conf = sum(value_confidences[most_common_str]) / len(value_confidences[most_common_str])
            confidence = self._calculate_confidence(
                frequency=frequency,
                total=len(pref_signals),
                avg_signal_confidence=avg_conf,
            )

            if confidence >= self.min_confidence and frequency >= self.min_frequency:
                results.append(AggregatedPreference(
                    preference_key=key,
                    preferred_value=most_common,
                    frequency=frequency,
                    confidence=confidence,
                    sources=list(sources),
                    alternatives_rejected=list(set(str(r) for r in all_rejected))[:10],
                    first_seen=min(timestamps),
                    last_seen=max(timestamps),
                ))

        return sorted(results, key=lambda x: -x.confidence)

    def aggregate_error_patterns(
        self,
        signals: List[LearningSignal],
    ) -> List[AggregatedErrorPattern]:
        """
        Aggregate error pattern signals to find recurring errors.

        Groups by error_type and identifies common resolutions.
        """
        error_signals = [
            s for s in signals
            if s.type == SignalType.ERROR_PATTERN
        ]

        if not error_signals:
            return []

        # Group by error type
        by_type: Dict[str, List[ErrorPatternSignal]] = defaultdict(list)
        for s in error_signals:
            if isinstance(s, ErrorPatternSignal):
                by_type[s.error_type].append(s)

        results = []
        for error_type, type_signals in by_type.items():
            if not error_type:
                continue

            frequency = len(type_signals)
            if frequency < self.min_frequency:
                continue

            # Collect data
            messages: List[str] = []
            resolutions: List[str] = []
            recovery_steps: List[List[str]] = []
            sources: set = set()
            confidences: List[float] = []
            timestamps: List[datetime] = []
            resolved_count = 0

            for s in type_signals:
                messages.append(s.error_message)
                if s.resolution:
                    resolutions.append(s.resolution)
                    resolved_count += 1
                if s.recovery_steps:
                    recovery_steps.append(s.recovery_steps)
                sources.add(s.source.value)
                confidences.append(s.confidence)
                timestamps.append(s.timestamp)

            # Get most common messages (deduplicated)
            msg_counts = Counter(messages)
            common_messages = [msg for msg, _ in msg_counts.most_common(5)]

            # Get unique resolutions
            unique_resolutions = list(set(resolutions))[:5]

            # Calculate metrics
            resolution_rate = resolved_count / frequency if frequency > 0 else 0.0
            avg_conf = sum(confidences) / len(confidences)
            confidence = self._calculate_confidence(
                frequency=frequency,
                total=len(error_signals),
                avg_signal_confidence=avg_conf,
            )

            if confidence >= self.min_confidence:
                results.append(AggregatedErrorPattern(
                    error_type=error_type,
                    common_messages=common_messages,
                    frequency=frequency,
                    confidence=confidence,
                    sources=list(sources),
                    resolutions=unique_resolutions,
                    recovery_steps=recovery_steps[:5],
                    resolution_rate=resolution_rate,
                    first_seen=min(timestamps),
                    last_seen=max(timestamps),
                ))

        return sorted(results, key=lambda x: -x.frequency)

    def aggregate_success_patterns(
        self,
        signals: List[LearningSignal],
    ) -> List[AggregatedSuccessPattern]:
        """
        Aggregate success pattern signals to find what works.

        Groups by pattern_name and identifies common action sequences.
        """
        success_signals = [
            s for s in signals
            if s.type == SignalType.SUCCESS_PATTERN
        ]

        if not success_signals:
            return []

        # Group by pattern name
        by_name: Dict[str, List[SuccessPatternSignal]] = defaultdict(list)
        for s in success_signals:
            if isinstance(s, SuccessPatternSignal):
                by_name[s.pattern_name].append(s)

        results = []
        for pattern_name, name_signals in by_name.items():
            if not pattern_name:
                continue

            frequency = len(name_signals)
            if frequency < self.min_frequency:
                continue

            # Collect data
            all_actions: List[str] = []
            durations: List[int] = []
            all_preconditions: List[str] = []
            all_postconditions: List[str] = []
            sources: set = set()
            confidences: List[float] = []
            timestamps: List[datetime] = []

            for s in name_signals:
                all_actions.extend(s.action_sequence)
                durations.append(s.duration_seconds)
                all_preconditions.extend(s.preconditions)
                all_postconditions.extend(s.postconditions)
                sources.add(s.source.value)
                confidences.append(s.confidence)
                timestamps.append(s.timestamp)

            # Get most common actions
            action_counts = Counter(all_actions)
            common_actions = [action for action, _ in action_counts.most_common(10)]

            # Get common pre/post conditions
            pre_counts = Counter(all_preconditions)
            post_counts = Counter(all_postconditions)
            common_pre = [c for c, _ in pre_counts.most_common(5)]
            common_post = [c for c, _ in post_counts.most_common(5)]

            # Calculate metrics
            avg_duration = sum(durations) / len(durations) if durations else 0.0
            avg_conf = sum(confidences) / len(confidences)
            confidence = self._calculate_confidence(
                frequency=frequency,
                total=len(success_signals),
                avg_signal_confidence=avg_conf,
            )

            if confidence >= self.min_confidence:
                results.append(AggregatedSuccessPattern(
                    pattern_name=pattern_name,
                    common_actions=common_actions,
                    frequency=frequency,
                    confidence=confidence,
                    sources=list(sources),
                    avg_duration_seconds=avg_duration,
                    preconditions=common_pre,
                    postconditions=common_post,
                    first_seen=min(timestamps),
                    last_seen=max(timestamps),
                ))

        return sorted(results, key=lambda x: -x.confidence)

    def aggregate_tool_efficiency(
        self,
        signals: List[LearningSignal],
    ) -> List[AggregatedToolEfficiency]:
        """
        Aggregate tool efficiency signals to rank tools by performance.

        Groups by tool_name and calculates efficiency metrics.
        """
        tool_signals = [
            s for s in signals
            if s.type == SignalType.TOOL_EFFICIENCY
        ]

        if not tool_signals:
            return []

        # Group by tool name
        by_tool: Dict[str, List[ToolEfficiencySignal]] = defaultdict(list)
        for s in tool_signals:
            if isinstance(s, ToolEfficiencySignal):
                by_tool[s.tool_name].append(s)

        results = []
        for tool_name, tool_sigs in by_tool.items():
            if not tool_name:
                continue

            usage_count = len(tool_sigs)
            if usage_count < self.min_frequency:
                continue

            # Collect metrics
            success_count = 0
            failure_count = 0
            execution_times: List[int] = []
            total_tokens = 0
            all_alternatives: List[str] = []
            sources: set = set()
            confidences: List[float] = []
            timestamps: List[datetime] = []

            for s in tool_sigs:
                if s.outcome == Outcome.SUCCESS:
                    success_count += 1
                elif s.outcome == Outcome.FAILURE:
                    failure_count += 1

                execution_times.append(s.execution_time_ms)
                total_tokens += s.tokens_used
                all_alternatives.extend(s.alternative_tools)
                sources.add(s.source.value)
                confidences.append(s.confidence)
                timestamps.append(s.timestamp)

            # Calculate metrics
            avg_exec_time = sum(execution_times) / len(execution_times) if execution_times else 0.0
            success_rate = success_count / usage_count if usage_count > 0 else 0.0

            # Efficiency score: higher is better
            # Based on success rate and speed (normalized)
            speed_factor = 1.0 / (1.0 + avg_exec_time / 10000.0)  # Normalize to ~0-1
            efficiency_score = success_rate * 0.7 + speed_factor * 0.3

            avg_conf = sum(confidences) / len(confidences)
            confidence = self._calculate_confidence(
                frequency=usage_count,
                total=len(tool_signals),
                avg_signal_confidence=avg_conf,
            )

            # Get unique alternatives
            alt_counts = Counter(all_alternatives)
            unique_alts = [alt for alt, _ in alt_counts.most_common(5)]

            if confidence >= self.min_confidence:
                results.append(AggregatedToolEfficiency(
                    tool_name=tool_name,
                    usage_count=usage_count,
                    success_count=success_count,
                    failure_count=failure_count,
                    avg_execution_time_ms=avg_exec_time,
                    total_tokens_used=total_tokens,
                    success_rate=success_rate,
                    efficiency_score=efficiency_score,
                    confidence=confidence,
                    sources=list(sources),
                    alternative_tools=unique_alts,
                    first_seen=min(timestamps),
                    last_seen=max(timestamps),
                ))

        return sorted(results, key=lambda x: -x.efficiency_score)

    def aggregate_context_relevance(
        self,
        signals: List[LearningSignal],
    ) -> List[AggregatedContextRelevance]:
        """
        Aggregate context relevance signals to find useful contexts.

        Groups by query pattern and calculates relevance metrics.
        """
        context_signals = [
            s for s in signals
            if s.type == SignalType.CONTEXT_RELEVANCE
        ]

        if not context_signals:
            return []

        # Group by query (simplified grouping by first few words)
        by_query: Dict[str, List[ContextRelevanceSignal]] = defaultdict(list)
        for s in context_signals:
            if isinstance(s, ContextRelevanceSignal):
                # Simplify query to pattern (first 5 words)
                words = s.query.split()[:5]
                pattern = ' '.join(words) if words else 'unknown'
                by_query[pattern].append(s)

        results = []
        for query_pattern, query_sigs in by_query.items():
            retrieval_count = len(query_sigs)
            if retrieval_count < self.min_frequency:
                continue

            # Collect metrics
            precisions: List[float] = []
            recalls: List[float] = []
            all_relevant: List[str] = []
            all_irrelevant: List[str] = []
            sources: set = set()
            confidences: List[float] = []
            timestamps: List[datetime] = []

            for s in query_sigs:
                precisions.append(s.precision)
                recalls.append(s.recall)
                all_relevant.extend(s.relevant_ids)
                all_irrelevant.extend(s.irrelevant_ids)
                sources.add(s.source.value)
                confidences.append(s.confidence)
                timestamps.append(s.timestamp)

            # Calculate metrics
            avg_precision = sum(precisions) / len(precisions) if precisions else 0.0
            avg_recall = sum(recalls) / len(recalls) if recalls else 0.0

            avg_conf = sum(confidences) / len(confidences)
            confidence = self._calculate_confidence(
                frequency=retrieval_count,
                total=len(context_signals),
                avg_signal_confidence=avg_conf,
            )

            # Get commonly relevant/irrelevant IDs
            relevant_counts = Counter(all_relevant)
            irrelevant_counts = Counter(all_irrelevant)
            common_relevant = [id for id, _ in relevant_counts.most_common(10)]
            common_irrelevant = [id for id, _ in irrelevant_counts.most_common(10)]

            if confidence >= self.min_confidence:
                results.append(AggregatedContextRelevance(
                    query_pattern=query_pattern,
                    retrieval_count=retrieval_count,
                    avg_precision=avg_precision,
                    avg_recall=avg_recall,
                    confidence=confidence,
                    sources=list(sources),
                    commonly_relevant_ids=common_relevant,
                    commonly_irrelevant_ids=common_irrelevant,
                    first_seen=min(timestamps),
                    last_seen=max(timestamps),
                ))

        return sorted(results, key=lambda x: -x.avg_precision)

    def aggregate(self) -> AggregationResult:
        """
        Run full aggregation on all signals in the time window.

        Returns an AggregationResult containing all aggregated learnings.
        """
        # Get signals
        signals = self._get_signals_in_window()

        # Run all aggregations
        preferences = self.aggregate_user_preferences(signals)
        error_patterns = self.aggregate_error_patterns(signals)
        success_patterns = self.aggregate_success_patterns(signals)
        tool_efficiencies = self.aggregate_tool_efficiency(signals)
        context_relevance = self.aggregate_context_relevance(signals)

        # Create result
        result = AggregationResult(
            id=f"agg-{str(uuid.uuid4())[:8]}",
            timestamp=datetime.now(timezone.utc),
            time_window_days=self.time_window_days,
            total_signals_processed=len(signals),
            preferences=preferences,
            error_patterns=error_patterns,
            success_patterns=success_patterns,
            tool_efficiencies=tool_efficiencies,
            context_relevance=context_relevance,
        )

        return result

    def save_aggregation(self, result: AggregationResult) -> Path:
        """
        Save aggregation result to .loki/learning/aggregated/.

        Args:
            result: The aggregation result to save

        Returns:
            Path to the saved file
        """
        # Generate filename with timestamp
        timestamp_str = result.timestamp.strftime('%Y-%m-%dT%H-%M-%S')
        filename = f"{timestamp_str}_{result.id}.json"
        filepath = self.aggregated_dir / filename

        # Write to file
        with open(filepath, 'w') as f:
            json.dump(result.to_dict(), f, indent=2)

        return filepath

    def get_latest_aggregation(self) -> Optional[AggregationResult]:
        """
        Get the most recent aggregation result.

        Returns:
            The latest AggregationResult or None if none exist
        """
        if not self.aggregated_dir.exists():
            return None

        files = sorted(self.aggregated_dir.glob('*.json'), reverse=True)
        if not files:
            return None

        try:
            with open(files[0], 'r') as f:
                data = json.load(f)
                return AggregationResult.from_dict(data)
        except (json.JSONDecodeError, IOError):
            return None

    def list_aggregations(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        List recent aggregation summaries.

        Args:
            limit: Maximum number of aggregations to return

        Returns:
            List of aggregation summaries
        """
        if not self.aggregated_dir.exists():
            return []

        files = sorted(self.aggregated_dir.glob('*.json'), reverse=True)
        summaries = []

        for filepath in files[:limit]:
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    result = AggregationResult.from_dict(data)
                    summaries.append(result.summary())
            except (json.JSONDecodeError, IOError):
                continue

        return summaries


# -----------------------------------------------------------------------------
# CLI Helper Functions
# -----------------------------------------------------------------------------


def run_aggregation(
    loki_dir: Optional[Path] = None,
    time_window_days: int = 7,
    min_frequency: int = 2,
    min_confidence: float = 0.5,
    save: bool = True,
) -> AggregationResult:
    """
    Run aggregation and optionally save the result.

    Args:
        loki_dir: Path to .loki directory
        time_window_days: Number of days to include
        min_frequency: Minimum frequency for patterns
        min_confidence: Minimum confidence score
        save: Whether to save the result

    Returns:
        The aggregation result
    """
    aggregator = LearningAggregator(
        loki_dir=loki_dir,
        time_window_days=time_window_days,
        min_frequency=min_frequency,
        min_confidence=min_confidence,
    )

    result = aggregator.aggregate()

    if save:
        aggregator.save_aggregation(result)

    return result


def print_aggregation_summary(result: AggregationResult) -> None:
    """
    Print a human-readable summary of the aggregation.

    Args:
        result: The aggregation result to summarize
    """
    print(f"\nLearning Aggregation Summary")
    print(f"============================")
    print(f"ID: {result.id}")
    print(f"Time: {result.timestamp.isoformat()}")
    print(f"Window: {result.time_window_days} days")
    print(f"Signals processed: {result.total_signals_processed}")
    print()

    if result.preferences:
        print(f"User Preferences ({len(result.preferences)}):")
        for p in result.preferences[:5]:
            print(f"  - {p.preference_key}: {p.preferred_value} "
                  f"(freq={p.frequency}, conf={p.confidence:.2f})")
        print()

    if result.error_patterns:
        print(f"Error Patterns ({len(result.error_patterns)}):")
        for e in result.error_patterns[:5]:
            print(f"  - {e.error_type}: {e.frequency} occurrences "
                  f"(resolved={e.resolution_rate:.0%})")
        print()

    if result.success_patterns:
        print(f"Success Patterns ({len(result.success_patterns)}):")
        for s in result.success_patterns[:5]:
            print(f"  - {s.pattern_name}: {s.frequency} times "
                  f"(avg {s.avg_duration_seconds:.0f}s)")
        print()

    if result.tool_efficiencies:
        print(f"Tool Efficiency Rankings ({len(result.tool_efficiencies)}):")
        for t in result.tool_efficiencies[:5]:
            print(f"  - {t.tool_name}: {t.success_rate:.0%} success, "
                  f"{t.avg_execution_time_ms:.0f}ms avg (score={t.efficiency_score:.2f})")
        print()

    if result.context_relevance:
        print(f"Context Relevance ({len(result.context_relevance)}):")
        for c in result.context_relevance[:5]:
            print(f"  - \"{c.query_pattern}...\": precision={c.avg_precision:.0%}, "
                  f"recall={c.avg_recall:.0%}")
        print()

    if not any([result.preferences, result.error_patterns,
                result.success_patterns, result.tool_efficiencies,
                result.context_relevance]):
        print("No patterns found. Need more signals to aggregate.")
        print()
