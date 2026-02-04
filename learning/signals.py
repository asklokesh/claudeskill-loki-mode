"""
Loki Mode Learning System - Signal Types and Data Classes

This module defines the learning signal types for cross-tool learning:
- SignalType: Categories of learning signals
- SignalSource: Origins of learning signals
- LearningSignal: Base dataclass for all signals
- Specialized signal subclasses for different learning patterns

See docs/SYNERGY-ROADMAP.md for full architecture documentation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


# -----------------------------------------------------------------------------
# Enums
# -----------------------------------------------------------------------------


class SignalType(str, Enum):
    """
    Categories of learning signals.

    These represent different types of learnable patterns that
    can be captured and used to improve system behavior.
    """
    USER_PREFERENCE = 'user_preference'       # User likes/dislikes, choices
    ERROR_PATTERN = 'error_pattern'           # Errors and their resolutions
    SUCCESS_PATTERN = 'success_pattern'       # Successful action sequences
    TOOL_EFFICIENCY = 'tool_efficiency'       # Tool performance metrics
    WORKFLOW_PATTERN = 'workflow_pattern'     # Multi-step workflow patterns
    CONTEXT_RELEVANCE = 'context_relevance'   # Context retrieval feedback


class SignalSource(str, Enum):
    """
    Sources that can emit learning signals.

    Each source represents a different entry point or component
    that can generate learnable observations.
    """
    CLI = 'cli'               # Command-line interface
    API = 'api'               # REST API
    VSCODE = 'vscode'         # VS Code extension
    MCP = 'mcp'               # MCP server integration
    MEMORY = 'memory'         # Memory system
    DASHBOARD = 'dashboard'   # Web dashboard


class Outcome(str, Enum):
    """Outcome states for learning signals."""
    SUCCESS = 'success'
    FAILURE = 'failure'
    PARTIAL = 'partial'
    UNKNOWN = 'unknown'


# -----------------------------------------------------------------------------
# Base Signal Class
# -----------------------------------------------------------------------------


@dataclass
class LearningSignal:
    """
    Base class for all learning signals.

    A learning signal represents an observation that can be used
    to improve system behavior over time.

    Attributes:
        id: Unique identifier (e.g., "sig-abc12345")
        type: Category of signal (SignalType)
        source: Origin of the signal (SignalSource)
        action: The action or event that triggered the signal
        context: Contextual information about the signal
        outcome: Result of the action (success, failure, partial, unknown)
        confidence: Confidence in the signal's reliability (0.0-1.0)
        timestamp: When the signal was created
        metadata: Additional signal-specific data
    """
    type: SignalType
    source: SignalSource
    action: str
    context: Dict[str, Any]
    outcome: Outcome = Outcome.UNKNOWN
    confidence: float = 0.8
    id: str = ''
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Generate ID if not provided."""
        if not self.id:
            unique_id = str(uuid.uuid4())[:8]
            self.id = f"sig-{unique_id}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'type': self.type.value if isinstance(self.type, SignalType) else self.type,
            'source': self.source.value if isinstance(self.source, SignalSource) else self.source,
            'action': self.action,
            'context': self.context,
            'outcome': self.outcome.value if isinstance(self.outcome, Outcome) else self.outcome,
            'confidence': self.confidence,
            'timestamp': self.timestamp.isoformat() + 'Z' if isinstance(self.timestamp, datetime) else self.timestamp,
            'metadata': self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> LearningSignal:
        """Create from dictionary."""
        # Parse timestamp
        timestamp = data.get('timestamp')
        if isinstance(timestamp, str):
            if timestamp.endswith('Z'):
                timestamp = timestamp[:-1]
            timestamp = datetime.fromisoformat(timestamp)
        elif timestamp is None:
            timestamp = datetime.now(timezone.utc)

        return cls(
            id=data.get('id', ''),
            type=SignalType(data['type']) if data.get('type') else SignalType.SUCCESS_PATTERN,
            source=SignalSource(data['source']) if data.get('source') else SignalSource.CLI,
            action=data.get('action', ''),
            context=data.get('context', {}),
            outcome=Outcome(data['outcome']) if data.get('outcome') else Outcome.UNKNOWN,
            confidence=data.get('confidence', 0.8),
            timestamp=timestamp,
            metadata=data.get('metadata', {}),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = []
        if not self.id:
            errors.append("LearningSignal.id is required")
        if not self.action or not self.action.strip():
            errors.append("LearningSignal.action is required")
        if not 0.0 <= self.confidence <= 1.0:
            errors.append("LearningSignal.confidence must be between 0.0 and 1.0")
        return errors


# -----------------------------------------------------------------------------
# Specialized Signal Classes
# -----------------------------------------------------------------------------


@dataclass
class UserPreferenceSignal(LearningSignal):
    """
    Signal for user preference learning.

    Captures user choices, likes/dislikes, and explicit feedback
    that indicates preferences.

    Additional Attributes:
        preference_key: The preference being expressed (e.g., "code_style")
        preference_value: The preferred value or option
        alternatives_rejected: Other options that were not chosen
    """
    preference_key: str = ''
    preference_value: Any = None
    alternatives_rejected: List[Any] = field(default_factory=list)

    def __post_init__(self):
        super().__post_init__()
        if self.type != SignalType.USER_PREFERENCE:
            self.type = SignalType.USER_PREFERENCE

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data['preference_key'] = self.preference_key
        data['preference_value'] = self.preference_value
        data['alternatives_rejected'] = self.alternatives_rejected
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> UserPreferenceSignal:
        """Create from dictionary."""
        base = LearningSignal.from_dict(data)
        return cls(
            id=base.id,
            type=SignalType.USER_PREFERENCE,
            source=base.source,
            action=base.action,
            context=base.context,
            outcome=base.outcome,
            confidence=base.confidence,
            timestamp=base.timestamp,
            metadata=base.metadata,
            preference_key=data.get('preference_key', ''),
            preference_value=data.get('preference_value'),
            alternatives_rejected=data.get('alternatives_rejected', []),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = super().validate()
        if not self.preference_key:
            errors.append("UserPreferenceSignal.preference_key is required")
        return errors


@dataclass
class ErrorPatternSignal(LearningSignal):
    """
    Signal for error pattern learning.

    Captures errors encountered during execution and their resolutions,
    enabling the system to avoid or quickly resolve similar errors.

    Additional Attributes:
        error_type: Category of error (e.g., "TypeScript compilation")
        error_message: The error message
        resolution: How the error was resolved (if known)
        stack_trace: Optional stack trace or error details
        recovery_steps: Steps taken to recover from the error
    """
    error_type: str = ''
    error_message: str = ''
    resolution: str = ''
    stack_trace: Optional[str] = None
    recovery_steps: List[str] = field(default_factory=list)

    def __post_init__(self):
        super().__post_init__()
        if self.type != SignalType.ERROR_PATTERN:
            self.type = SignalType.ERROR_PATTERN

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data['error_type'] = self.error_type
        data['error_message'] = self.error_message
        data['resolution'] = self.resolution
        if self.stack_trace:
            data['stack_trace'] = self.stack_trace
        data['recovery_steps'] = self.recovery_steps
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ErrorPatternSignal:
        """Create from dictionary."""
        base = LearningSignal.from_dict(data)
        return cls(
            id=base.id,
            type=SignalType.ERROR_PATTERN,
            source=base.source,
            action=base.action,
            context=base.context,
            outcome=base.outcome,
            confidence=base.confidence,
            timestamp=base.timestamp,
            metadata=base.metadata,
            error_type=data.get('error_type', ''),
            error_message=data.get('error_message', ''),
            resolution=data.get('resolution', ''),
            stack_trace=data.get('stack_trace'),
            recovery_steps=data.get('recovery_steps', []),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = super().validate()
        if not self.error_type:
            errors.append("ErrorPatternSignal.error_type is required")
        if not self.error_message:
            errors.append("ErrorPatternSignal.error_message is required")
        return errors


@dataclass
class SuccessPatternSignal(LearningSignal):
    """
    Signal for success pattern learning.

    Captures successful action sequences that can be replicated
    for similar future tasks.

    Additional Attributes:
        pattern_name: Human-readable name for the pattern
        action_sequence: Ordered list of actions that led to success
        preconditions: Conditions that were true before success
        postconditions: Conditions that were true after success
        duration_seconds: How long the successful sequence took
    """
    pattern_name: str = ''
    action_sequence: List[str] = field(default_factory=list)
    preconditions: List[str] = field(default_factory=list)
    postconditions: List[str] = field(default_factory=list)
    duration_seconds: int = 0

    def __post_init__(self):
        super().__post_init__()
        if self.type != SignalType.SUCCESS_PATTERN:
            self.type = SignalType.SUCCESS_PATTERN

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data['pattern_name'] = self.pattern_name
        data['action_sequence'] = self.action_sequence
        data['preconditions'] = self.preconditions
        data['postconditions'] = self.postconditions
        data['duration_seconds'] = self.duration_seconds
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SuccessPatternSignal:
        """Create from dictionary."""
        base = LearningSignal.from_dict(data)
        return cls(
            id=base.id,
            type=SignalType.SUCCESS_PATTERN,
            source=base.source,
            action=base.action,
            context=base.context,
            outcome=base.outcome,
            confidence=base.confidence,
            timestamp=base.timestamp,
            metadata=base.metadata,
            pattern_name=data.get('pattern_name', ''),
            action_sequence=data.get('action_sequence', []),
            preconditions=data.get('preconditions', []),
            postconditions=data.get('postconditions', []),
            duration_seconds=data.get('duration_seconds', 0),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = super().validate()
        if not self.pattern_name:
            errors.append("SuccessPatternSignal.pattern_name is required")
        if not self.action_sequence:
            errors.append("SuccessPatternSignal.action_sequence must have at least one action")
        if self.duration_seconds < 0:
            errors.append("SuccessPatternSignal.duration_seconds must be non-negative")
        return errors


@dataclass
class ToolEfficiencySignal(LearningSignal):
    """
    Signal for tool efficiency learning.

    Captures metrics about tool usage to optimize tool selection
    and invocation patterns.

    Additional Attributes:
        tool_name: Name of the tool
        tokens_used: Number of tokens consumed
        execution_time_ms: Execution time in milliseconds
        success_rate: Historical success rate for this tool (0.0-1.0)
        alternative_tools: Other tools that could have been used
    """
    tool_name: str = ''
    tokens_used: int = 0
    execution_time_ms: int = 0
    success_rate: float = 1.0
    alternative_tools: List[str] = field(default_factory=list)

    def __post_init__(self):
        super().__post_init__()
        if self.type != SignalType.TOOL_EFFICIENCY:
            self.type = SignalType.TOOL_EFFICIENCY

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data['tool_name'] = self.tool_name
        data['tokens_used'] = self.tokens_used
        data['execution_time_ms'] = self.execution_time_ms
        data['success_rate'] = self.success_rate
        data['alternative_tools'] = self.alternative_tools
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ToolEfficiencySignal:
        """Create from dictionary."""
        base = LearningSignal.from_dict(data)
        return cls(
            id=base.id,
            type=SignalType.TOOL_EFFICIENCY,
            source=base.source,
            action=base.action,
            context=base.context,
            outcome=base.outcome,
            confidence=base.confidence,
            timestamp=base.timestamp,
            metadata=base.metadata,
            tool_name=data.get('tool_name', ''),
            tokens_used=data.get('tokens_used', 0),
            execution_time_ms=data.get('execution_time_ms', 0),
            success_rate=data.get('success_rate', 1.0),
            alternative_tools=data.get('alternative_tools', []),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = super().validate()
        if not self.tool_name:
            errors.append("ToolEfficiencySignal.tool_name is required")
        if self.tokens_used < 0:
            errors.append("ToolEfficiencySignal.tokens_used must be non-negative")
        if self.execution_time_ms < 0:
            errors.append("ToolEfficiencySignal.execution_time_ms must be non-negative")
        if not 0.0 <= self.success_rate <= 1.0:
            errors.append("ToolEfficiencySignal.success_rate must be between 0.0 and 1.0")
        return errors


@dataclass
class WorkflowPatternSignal(LearningSignal):
    """
    Signal for workflow pattern learning.

    Captures multi-step workflow patterns including branching
    and parallel execution paths.

    Additional Attributes:
        workflow_name: Human-readable name for the workflow
        steps: Ordered list of workflow steps
        parallel_steps: Steps that can run in parallel (list of step groups)
        branching_conditions: Conditions that determine workflow branches
        total_duration_seconds: Total workflow execution time
    """
    workflow_name: str = ''
    steps: List[str] = field(default_factory=list)
    parallel_steps: List[List[str]] = field(default_factory=list)
    branching_conditions: Dict[str, str] = field(default_factory=dict)
    total_duration_seconds: int = 0

    def __post_init__(self):
        super().__post_init__()
        if self.type != SignalType.WORKFLOW_PATTERN:
            self.type = SignalType.WORKFLOW_PATTERN

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data['workflow_name'] = self.workflow_name
        data['steps'] = self.steps
        data['parallel_steps'] = self.parallel_steps
        data['branching_conditions'] = self.branching_conditions
        data['total_duration_seconds'] = self.total_duration_seconds
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> WorkflowPatternSignal:
        """Create from dictionary."""
        base = LearningSignal.from_dict(data)
        return cls(
            id=base.id,
            type=SignalType.WORKFLOW_PATTERN,
            source=base.source,
            action=base.action,
            context=base.context,
            outcome=base.outcome,
            confidence=base.confidence,
            timestamp=base.timestamp,
            metadata=base.metadata,
            workflow_name=data.get('workflow_name', ''),
            steps=data.get('steps', []),
            parallel_steps=data.get('parallel_steps', []),
            branching_conditions=data.get('branching_conditions', {}),
            total_duration_seconds=data.get('total_duration_seconds', 0),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = super().validate()
        if not self.workflow_name:
            errors.append("WorkflowPatternSignal.workflow_name is required")
        if not self.steps:
            errors.append("WorkflowPatternSignal.steps must have at least one step")
        if self.total_duration_seconds < 0:
            errors.append("WorkflowPatternSignal.total_duration_seconds must be non-negative")
        return errors


@dataclass
class ContextRelevanceSignal(LearningSignal):
    """
    Signal for context relevance learning.

    Captures feedback about context retrieval quality to improve
    future context selection.

    Additional Attributes:
        query: The query used to retrieve context
        retrieved_context_ids: IDs of retrieved context items
        relevant_ids: IDs marked as relevant by the user/system
        irrelevant_ids: IDs marked as irrelevant
        precision: Precision of retrieval (relevant/retrieved)
        recall: Recall of retrieval (relevant/total_relevant)
    """
    query: str = ''
    retrieved_context_ids: List[str] = field(default_factory=list)
    relevant_ids: List[str] = field(default_factory=list)
    irrelevant_ids: List[str] = field(default_factory=list)
    precision: float = 0.0
    recall: float = 0.0

    def __post_init__(self):
        super().__post_init__()
        if self.type != SignalType.CONTEXT_RELEVANCE:
            self.type = SignalType.CONTEXT_RELEVANCE

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = super().to_dict()
        data['query'] = self.query
        data['retrieved_context_ids'] = self.retrieved_context_ids
        data['relevant_ids'] = self.relevant_ids
        data['irrelevant_ids'] = self.irrelevant_ids
        data['precision'] = self.precision
        data['recall'] = self.recall
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ContextRelevanceSignal:
        """Create from dictionary."""
        base = LearningSignal.from_dict(data)
        return cls(
            id=base.id,
            type=SignalType.CONTEXT_RELEVANCE,
            source=base.source,
            action=base.action,
            context=base.context,
            outcome=base.outcome,
            confidence=base.confidence,
            timestamp=base.timestamp,
            metadata=base.metadata,
            query=data.get('query', ''),
            retrieved_context_ids=data.get('retrieved_context_ids', []),
            relevant_ids=data.get('relevant_ids', []),
            irrelevant_ids=data.get('irrelevant_ids', []),
            precision=data.get('precision', 0.0),
            recall=data.get('recall', 0.0),
        )

    def validate(self) -> List[str]:
        """Validate the signal. Returns list of error messages."""
        errors = super().validate()
        if not self.query:
            errors.append("ContextRelevanceSignal.query is required")
        if not 0.0 <= self.precision <= 1.0:
            errors.append("ContextRelevanceSignal.precision must be between 0.0 and 1.0")
        if not 0.0 <= self.recall <= 1.0:
            errors.append("ContextRelevanceSignal.recall must be between 0.0 and 1.0")
        return errors


# -----------------------------------------------------------------------------
# Signal Factory
# -----------------------------------------------------------------------------


def signal_from_dict(data: Dict[str, Any]) -> LearningSignal:
    """
    Factory function to create the appropriate signal subclass from a dict.

    Args:
        data: Dictionary representation of a signal

    Returns:
        Appropriate LearningSignal subclass instance
    """
    signal_type = data.get('type')

    if signal_type == SignalType.USER_PREFERENCE.value:
        return UserPreferenceSignal.from_dict(data)
    elif signal_type == SignalType.ERROR_PATTERN.value:
        return ErrorPatternSignal.from_dict(data)
    elif signal_type == SignalType.SUCCESS_PATTERN.value:
        return SuccessPatternSignal.from_dict(data)
    elif signal_type == SignalType.TOOL_EFFICIENCY.value:
        return ToolEfficiencySignal.from_dict(data)
    elif signal_type == SignalType.WORKFLOW_PATTERN.value:
        return WorkflowPatternSignal.from_dict(data)
    elif signal_type == SignalType.CONTEXT_RELEVANCE.value:
        return ContextRelevanceSignal.from_dict(data)
    else:
        return LearningSignal.from_dict(data)
