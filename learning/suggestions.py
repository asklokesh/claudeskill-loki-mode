"""
Loki Mode Learning System - Learning-Based Suggestions

This module provides context-aware suggestions based on aggregated learnings:
- LearningSuggestions: Main class for generating suggestions
- Command suggestions based on user preferences
- Error prevention based on error patterns
- Best practices based on success patterns
- Tool recommendations based on efficiency data

See docs/SYNERGY-ROADMAP.md for full architecture documentation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .aggregator import (
    LearningAggregator,
    AggregatedPreference,
    AggregatedErrorPattern,
    AggregatedSuccessPattern,
    AggregatedToolEfficiency,
    AggregatedContextRelevance,
    AggregationResult,
)


# -----------------------------------------------------------------------------
# Suggestion Types
# -----------------------------------------------------------------------------


class SuggestionType(str, Enum):
    """Types of suggestions that can be generated."""
    COMMAND = 'command'         # Command/action suggestions based on preferences
    ERROR_PREVENTION = 'error'  # Warnings about potential errors
    BEST_PRACTICE = 'practice'  # Recommended patterns/workflows
    TOOL = 'tool'               # Tool recommendations


class SuggestionPriority(str, Enum):
    """Priority levels for suggestions."""
    HIGH = 'high'
    MEDIUM = 'medium'
    LOW = 'low'


# -----------------------------------------------------------------------------
# Suggestion Data Classes
# -----------------------------------------------------------------------------


@dataclass
class Suggestion:
    """
    A single learning-based suggestion.

    Attributes:
        id: Unique identifier
        type: Category of suggestion
        priority: Importance level
        title: Short summary
        description: Detailed explanation
        action: Recommended action to take
        confidence: Confidence in the suggestion (0.0-1.0)
        relevance_score: How relevant to current context (0.0-1.0)
        source: Learning pattern that generated this
        metadata: Additional suggestion-specific data
    """
    id: str
    type: SuggestionType
    priority: SuggestionPriority
    title: str
    description: str
    action: str
    confidence: float
    relevance_score: float
    source: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'type': self.type.value,
            'priority': self.priority.value,
            'title': self.title,
            'description': self.description,
            'action': self.action,
            'confidence': self.confidence,
            'relevance_score': self.relevance_score,
            'source': self.source,
            'metadata': self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Suggestion:
        """Create from dictionary."""
        return cls(
            id=data.get('id', ''),
            type=SuggestionType(data.get('type', 'practice')),
            priority=SuggestionPriority(data.get('priority', 'medium')),
            title=data.get('title', ''),
            description=data.get('description', ''),
            action=data.get('action', ''),
            confidence=data.get('confidence', 0.5),
            relevance_score=data.get('relevance_score', 0.5),
            source=data.get('source', ''),
            metadata=data.get('metadata', {}),
        )

    @property
    def combined_score(self) -> float:
        """Combined score for ranking (confidence * relevance)."""
        return self.confidence * self.relevance_score


@dataclass
class SuggestionContext:
    """
    Context for generating suggestions.

    Attributes:
        current_task: Description of current task or goal
        task_type: Type of task (debugging, implementation, etc.)
        current_file: Current file being edited (if any)
        recent_commands: Recent commands executed
        recent_errors: Recent errors encountered
        keywords: Keywords extracted from context
    """
    current_task: str = ''
    task_type: str = ''
    current_file: str = ''
    recent_commands: List[str] = field(default_factory=list)
    recent_errors: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'current_task': self.current_task,
            'task_type': self.task_type,
            'current_file': self.current_file,
            'recent_commands': self.recent_commands,
            'recent_errors': self.recent_errors,
            'keywords': self.keywords,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SuggestionContext:
        """Create from dictionary."""
        return cls(
            current_task=data.get('current_task', ''),
            task_type=data.get('task_type', ''),
            current_file=data.get('current_file', ''),
            recent_commands=data.get('recent_commands', []),
            recent_errors=data.get('recent_errors', []),
            keywords=data.get('keywords', []),
        )

    def extract_keywords(self) -> List[str]:
        """Extract keywords from the context for matching."""
        keywords = list(self.keywords)

        # Extract from current task
        if self.current_task:
            words = self.current_task.lower().split()
            keywords.extend([w for w in words if len(w) > 3])

        # Extract from task type
        if self.task_type:
            keywords.append(self.task_type.lower())

        # Extract from file path
        if self.current_file:
            parts = self.current_file.replace('/', ' ').replace('.', ' ').split()
            keywords.extend([p for p in parts if len(p) > 2])

        return list(set(keywords))


# -----------------------------------------------------------------------------
# Learning Suggestions Class
# -----------------------------------------------------------------------------


class LearningSuggestions:
    """
    Generate context-aware suggestions based on aggregated learnings.

    Uses aggregated patterns from the learning system to provide:
    - Command suggestions based on user preferences
    - Error prevention based on error patterns
    - Best practices based on success patterns
    - Tool recommendations based on efficiency data
    """

    def __init__(
        self,
        loki_dir: Optional[Path] = None,
        max_suggestions: int = 10,
        min_confidence: float = 0.3,
    ):
        """
        Initialize the suggestions generator.

        Args:
            loki_dir: Path to .loki directory. Defaults to ./.loki
            max_suggestions: Maximum number of suggestions to return
            min_confidence: Minimum confidence score for suggestions
        """
        self.loki_dir = loki_dir or Path('.loki')
        self.max_suggestions = max_suggestions
        self.min_confidence = min_confidence

        # Initialize aggregator for fetching learnings
        self.aggregator = LearningAggregator(loki_dir=self.loki_dir)

        # Cache for aggregation result
        self._cached_result: Optional[AggregationResult] = None
        self._cache_time: Optional[datetime] = None
        self._cache_ttl = timedelta(minutes=5)

    def _get_aggregation(self, force_refresh: bool = False) -> Optional[AggregationResult]:
        """
        Get the latest aggregation result, using cache if available.

        Args:
            force_refresh: Force a fresh fetch, ignoring cache

        Returns:
            The latest aggregation result or None
        """
        now = datetime.now(timezone.utc)

        # Check if cache is valid
        if (
            not force_refresh
            and self._cached_result is not None
            and self._cache_time is not None
            and (now - self._cache_time) < self._cache_ttl
        ):
            return self._cached_result

        # Fetch latest aggregation
        result = self.aggregator.get_latest_aggregation()

        if result:
            self._cached_result = result
            self._cache_time = now

        return result

    def _calculate_relevance(
        self,
        context: SuggestionContext,
        keywords_to_match: List[str],
    ) -> float:
        """
        Calculate relevance score based on keyword overlap.

        Args:
            context: The suggestion context
            keywords_to_match: Keywords from the learning pattern

        Returns:
            Relevance score between 0.0 and 1.0
        """
        if not keywords_to_match:
            return 0.5  # Default relevance if no keywords

        context_keywords = set(context.extract_keywords())
        pattern_keywords = set(k.lower() for k in keywords_to_match)

        if not context_keywords:
            return 0.5  # Default if no context keywords

        # Calculate Jaccard-like similarity
        overlap = len(context_keywords & pattern_keywords)
        total = len(context_keywords | pattern_keywords)

        if total == 0:
            return 0.5

        return overlap / total

    def _generate_command_suggestions(
        self,
        context: SuggestionContext,
        preferences: List[AggregatedPreference],
    ) -> List[Suggestion]:
        """
        Generate command suggestions from user preferences.

        Args:
            context: The suggestion context
            preferences: Aggregated user preferences

        Returns:
            List of command suggestions
        """
        suggestions = []

        for i, pref in enumerate(preferences):
            # Extract keywords from preference
            keywords = [
                pref.preference_key,
                str(pref.preferred_value),
            ]
            keywords.extend(pref.sources)

            relevance = self._calculate_relevance(context, keywords)

            # Determine priority based on frequency and confidence
            if pref.frequency >= 5 and pref.confidence >= 0.8:
                priority = SuggestionPriority.HIGH
            elif pref.frequency >= 3 or pref.confidence >= 0.6:
                priority = SuggestionPriority.MEDIUM
            else:
                priority = SuggestionPriority.LOW

            suggestion = Suggestion(
                id=f"cmd-{i:03d}",
                type=SuggestionType.COMMAND,
                priority=priority,
                title=f"Use {pref.preferred_value} for {pref.preference_key}",
                description=(
                    f"Based on {pref.frequency} previous choices, "
                    f"you prefer {pref.preferred_value} for {pref.preference_key}."
                ),
                action=f"Set {pref.preference_key}={pref.preferred_value}",
                confidence=pref.confidence,
                relevance_score=relevance,
                source=f"preference:{pref.preference_key}",
                metadata={
                    'frequency': pref.frequency,
                    'alternatives': pref.alternatives_rejected[:3],
                    'sources': pref.sources,
                },
            )
            suggestions.append(suggestion)

        return suggestions

    def _generate_error_prevention_suggestions(
        self,
        context: SuggestionContext,
        error_patterns: List[AggregatedErrorPattern],
    ) -> List[Suggestion]:
        """
        Generate error prevention suggestions from error patterns.

        Args:
            context: The suggestion context
            error_patterns: Aggregated error patterns

        Returns:
            List of error prevention suggestions
        """
        suggestions = []

        for i, err in enumerate(error_patterns):
            # Extract keywords from error pattern
            keywords = [
                err.error_type,
            ]
            keywords.extend(err.common_messages[:2])
            keywords.extend(err.sources)

            # Boost relevance if context has recent errors
            base_relevance = self._calculate_relevance(context, keywords)

            # Check if any recent errors match this pattern
            error_match_boost = 0.0
            for recent_error in context.recent_errors:
                if err.error_type.lower() in recent_error.lower():
                    error_match_boost = 0.3
                    break

            relevance = min(1.0, base_relevance + error_match_boost)

            # Higher frequency errors get higher priority
            if err.frequency >= 5:
                priority = SuggestionPriority.HIGH
            elif err.frequency >= 3:
                priority = SuggestionPriority.MEDIUM
            else:
                priority = SuggestionPriority.LOW

            # Build action from resolutions
            if err.resolutions:
                action = f"To resolve: {err.resolutions[0]}"
            elif err.recovery_steps and err.recovery_steps[0]:
                action = f"Recovery steps: {', '.join(err.recovery_steps[0][:3])}"
            else:
                action = f"Watch for {err.error_type} errors"

            suggestion = Suggestion(
                id=f"err-{i:03d}",
                type=SuggestionType.ERROR_PREVENTION,
                priority=priority,
                title=f"Avoid {err.error_type} errors",
                description=(
                    f"This error has occurred {err.frequency} times. "
                    f"Resolution rate: {err.resolution_rate:.0%}. "
                    f"Common message: {err.common_messages[0][:80] if err.common_messages else 'N/A'}..."
                ),
                action=action,
                confidence=err.confidence,
                relevance_score=relevance,
                source=f"error:{err.error_type}",
                metadata={
                    'frequency': err.frequency,
                    'resolution_rate': err.resolution_rate,
                    'resolutions': err.resolutions[:3],
                    'common_messages': err.common_messages[:2],
                },
            )
            suggestions.append(suggestion)

        return suggestions

    def _generate_best_practice_suggestions(
        self,
        context: SuggestionContext,
        success_patterns: List[AggregatedSuccessPattern],
    ) -> List[Suggestion]:
        """
        Generate best practice suggestions from success patterns.

        Args:
            context: The suggestion context
            success_patterns: Aggregated success patterns

        Returns:
            List of best practice suggestions
        """
        suggestions = []

        for i, pattern in enumerate(success_patterns):
            # Extract keywords from success pattern
            keywords = [
                pattern.pattern_name,
            ]
            keywords.extend(pattern.common_actions)
            keywords.extend(pattern.preconditions)
            keywords.extend(pattern.sources)

            relevance = self._calculate_relevance(context, keywords)

            # Determine priority
            if pattern.frequency >= 5 and pattern.confidence >= 0.8:
                priority = SuggestionPriority.HIGH
            elif pattern.frequency >= 3 or pattern.confidence >= 0.6:
                priority = SuggestionPriority.MEDIUM
            else:
                priority = SuggestionPriority.LOW

            # Format action sequence
            actions_str = " -> ".join(pattern.common_actions[:5])

            suggestion = Suggestion(
                id=f"prc-{i:03d}",
                type=SuggestionType.BEST_PRACTICE,
                priority=priority,
                title=f"Follow {pattern.pattern_name} pattern",
                description=(
                    f"This pattern has succeeded {pattern.frequency} times "
                    f"with avg duration of {pattern.avg_duration_seconds:.0f}s. "
                    f"Actions: {actions_str}"
                ),
                action=f"Apply pattern: {pattern.common_actions[0] if pattern.common_actions else 'N/A'}",
                confidence=pattern.confidence,
                relevance_score=relevance,
                source=f"success:{pattern.pattern_name}",
                metadata={
                    'frequency': pattern.frequency,
                    'avg_duration': pattern.avg_duration_seconds,
                    'actions': pattern.common_actions,
                    'preconditions': pattern.preconditions,
                    'postconditions': pattern.postconditions,
                },
            )
            suggestions.append(suggestion)

        return suggestions

    def _generate_tool_suggestions(
        self,
        context: SuggestionContext,
        tool_efficiencies: List[AggregatedToolEfficiency],
    ) -> List[Suggestion]:
        """
        Generate tool recommendations from efficiency data.

        Args:
            context: The suggestion context
            tool_efficiencies: Aggregated tool efficiency data

        Returns:
            List of tool suggestions
        """
        suggestions = []

        for i, tool in enumerate(tool_efficiencies):
            # Extract keywords from tool data
            keywords = [
                tool.tool_name,
            ]
            keywords.extend(tool.alternative_tools)
            keywords.extend(tool.sources)

            relevance = self._calculate_relevance(context, keywords)

            # Determine priority based on efficiency score
            if tool.efficiency_score >= 0.8:
                priority = SuggestionPriority.HIGH
            elif tool.efficiency_score >= 0.5:
                priority = SuggestionPriority.MEDIUM
            else:
                priority = SuggestionPriority.LOW

            suggestion = Suggestion(
                id=f"tool-{i:03d}",
                type=SuggestionType.TOOL,
                priority=priority,
                title=f"Use {tool.tool_name} for efficiency",
                description=(
                    f"Success rate: {tool.success_rate:.0%}, "
                    f"avg time: {tool.avg_execution_time_ms:.0f}ms, "
                    f"efficiency score: {tool.efficiency_score:.2f}. "
                    f"Used {tool.usage_count} times."
                ),
                action=f"Consider using {tool.tool_name}",
                confidence=tool.confidence,
                relevance_score=relevance,
                source=f"tool:{tool.tool_name}",
                metadata={
                    'usage_count': tool.usage_count,
                    'success_rate': tool.success_rate,
                    'efficiency_score': tool.efficiency_score,
                    'avg_execution_time_ms': tool.avg_execution_time_ms,
                    'alternatives': tool.alternative_tools,
                },
            )
            suggestions.append(suggestion)

        return suggestions

    def get_suggestions(
        self,
        context: Optional[SuggestionContext] = None,
        types: Optional[List[SuggestionType]] = None,
        limit: Optional[int] = None,
    ) -> List[Suggestion]:
        """
        Get context-aware suggestions from aggregated learnings.

        Args:
            context: Optional context for relevance scoring
            types: Filter to specific suggestion types
            limit: Maximum number of suggestions to return

        Returns:
            List of suggestions sorted by combined score
        """
        # Use default context if none provided
        if context is None:
            context = SuggestionContext()

        # Get aggregated learnings
        aggregation = self._get_aggregation()

        if aggregation is None:
            return []

        # Generate all suggestions
        all_suggestions: List[Suggestion] = []

        # Include all types by default
        include_types = types or list(SuggestionType)

        if SuggestionType.COMMAND in include_types:
            all_suggestions.extend(
                self._generate_command_suggestions(context, aggregation.preferences)
            )

        if SuggestionType.ERROR_PREVENTION in include_types:
            all_suggestions.extend(
                self._generate_error_prevention_suggestions(context, aggregation.error_patterns)
            )

        if SuggestionType.BEST_PRACTICE in include_types:
            all_suggestions.extend(
                self._generate_best_practice_suggestions(context, aggregation.success_patterns)
            )

        if SuggestionType.TOOL in include_types:
            all_suggestions.extend(
                self._generate_tool_suggestions(context, aggregation.tool_efficiencies)
            )

        # Filter by minimum confidence
        filtered = [s for s in all_suggestions if s.confidence >= self.min_confidence]

        # Sort by combined score (descending)
        sorted_suggestions = sorted(filtered, key=lambda s: -s.combined_score)

        # Apply limit
        max_count = limit or self.max_suggestions
        return sorted_suggestions[:max_count]

    def get_suggestions_by_type(
        self,
        suggestion_type: SuggestionType,
        context: Optional[SuggestionContext] = None,
        limit: Optional[int] = None,
    ) -> List[Suggestion]:
        """
        Get suggestions filtered by a specific type.

        Args:
            suggestion_type: Type of suggestions to retrieve
            context: Optional context for relevance scoring
            limit: Maximum number of suggestions

        Returns:
            List of suggestions of the specified type
        """
        return self.get_suggestions(
            context=context,
            types=[suggestion_type],
            limit=limit,
        )

    def get_startup_suggestions(self, limit: int = 5) -> List[Suggestion]:
        """
        Get suggestions suitable for CLI startup display.

        Returns high-confidence, high-priority suggestions.

        Args:
            limit: Maximum number of suggestions

        Returns:
            List of startup-appropriate suggestions
        """
        suggestions = self.get_suggestions(limit=limit * 2)

        # Filter to high-confidence suggestions
        startup_suggestions = [
            s for s in suggestions
            if s.confidence >= 0.6 and s.priority in [SuggestionPriority.HIGH, SuggestionPriority.MEDIUM]
        ]

        return startup_suggestions[:limit]

    def format_suggestions_text(
        self,
        suggestions: List[Suggestion],
        verbose: bool = False,
    ) -> str:
        """
        Format suggestions for text display.

        Args:
            suggestions: List of suggestions to format
            verbose: Include detailed information

        Returns:
            Formatted text string
        """
        if not suggestions:
            return "No suggestions available. Run 'loki learn aggregate' to generate learnings."

        lines = []
        lines.append("Learning-Based Suggestions")
        lines.append("=" * 40)
        lines.append("")

        # Group by type
        by_type: Dict[SuggestionType, List[Suggestion]] = {}
        for s in suggestions:
            if s.type not in by_type:
                by_type[s.type] = []
            by_type[s.type].append(s)

        type_headers = {
            SuggestionType.COMMAND: "Command Suggestions",
            SuggestionType.ERROR_PREVENTION: "Error Prevention",
            SuggestionType.BEST_PRACTICE: "Best Practices",
            SuggestionType.TOOL: "Tool Recommendations",
        }

        for stype, type_suggestions in by_type.items():
            lines.append(f"{type_headers.get(stype, stype.value)}:")
            lines.append("-" * 30)

            for s in type_suggestions:
                priority_marker = {
                    SuggestionPriority.HIGH: "[HIGH]",
                    SuggestionPriority.MEDIUM: "[MED]",
                    SuggestionPriority.LOW: "[LOW]",
                }.get(s.priority, "")

                lines.append(f"  {priority_marker} {s.title}")

                if verbose:
                    lines.append(f"      {s.description}")
                    lines.append(f"      Action: {s.action}")
                    lines.append(f"      Confidence: {s.confidence:.0%}, Relevance: {s.relevance_score:.0%}")
                else:
                    lines.append(f"      -> {s.action}")

                lines.append("")

            lines.append("")

        return "\n".join(lines)

    def to_json(
        self,
        suggestions: List[Suggestion],
        context: Optional[SuggestionContext] = None,
    ) -> str:
        """
        Convert suggestions to JSON format.

        Args:
            suggestions: List of suggestions
            context: Optional context used for generation

        Returns:
            JSON string
        """
        data = {
            'suggestions': [s.to_dict() for s in suggestions],
            'count': len(suggestions),
            'timestamp': datetime.now(timezone.utc).isoformat() + 'Z',
        }

        if context:
            data['context'] = context.to_dict()

        return json.dumps(data, indent=2)


# -----------------------------------------------------------------------------
# CLI Helper Functions
# -----------------------------------------------------------------------------


def get_suggestions(
    loki_dir: Optional[Path] = None,
    context: Optional[SuggestionContext] = None,
    types: Optional[List[str]] = None,
    limit: int = 10,
    min_confidence: float = 0.3,
) -> List[Suggestion]:
    """
    Get learning-based suggestions.

    Args:
        loki_dir: Path to .loki directory
        context: Suggestion context
        types: Filter by suggestion types (command, error, practice, tool)
        limit: Maximum number of suggestions
        min_confidence: Minimum confidence threshold

    Returns:
        List of suggestions
    """
    suggestions = LearningSuggestions(
        loki_dir=loki_dir,
        max_suggestions=limit,
        min_confidence=min_confidence,
    )

    # Convert string types to enum
    type_filter = None
    if types:
        type_map = {
            'command': SuggestionType.COMMAND,
            'error': SuggestionType.ERROR_PREVENTION,
            'practice': SuggestionType.BEST_PRACTICE,
            'tool': SuggestionType.TOOL,
        }
        type_filter = [type_map[t] for t in types if t in type_map]

    return suggestions.get_suggestions(
        context=context,
        types=type_filter,
        limit=limit,
    )


def print_suggestions(
    suggestions: List[Suggestion],
    verbose: bool = False,
) -> None:
    """
    Print suggestions to stdout.

    Args:
        suggestions: List of suggestions
        verbose: Include detailed information
    """
    gen = LearningSuggestions()
    print(gen.format_suggestions_text(suggestions, verbose=verbose))


def get_startup_tips(
    loki_dir: Optional[Path] = None,
    limit: int = 3,
) -> List[str]:
    """
    Get brief startup tips for CLI display.

    Args:
        loki_dir: Path to .loki directory
        limit: Maximum number of tips

    Returns:
        List of tip strings
    """
    suggestions = LearningSuggestions(loki_dir=loki_dir)
    startup = suggestions.get_startup_suggestions(limit=limit)

    tips = []
    for s in startup:
        tips.append(f"[TIP] {s.title}: {s.action}")

    return tips
