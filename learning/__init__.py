"""
Loki Mode Learning System

This package provides cross-tool learning capabilities:
- Signal types for different learning patterns
- Signal emission and storage
- Signal aggregation for pattern detection
- Learning-based suggestions
- Integration with the event bus for cross-component notification

Usage:
    from learning import (
        SignalType,
        SignalSource,
        Outcome,
        LearningSignal,
        emit_signal,
        emit_user_preference,
        emit_error_pattern,
        emit_success_pattern,
        emit_tool_efficiency,
        emit_workflow_pattern,
        emit_context_relevance,
        get_signals,
        # Aggregation
        LearningAggregator,
        run_aggregation,
        # Suggestions
        LearningSuggestions,
        Suggestion,
        SuggestionType,
        SuggestionContext,
        get_suggestions,
    )

See docs/SYNERGY-ROADMAP.md for full architecture documentation.
"""

from .signals import (
    # Enums
    SignalType,
    SignalSource,
    Outcome,
    # Base class
    LearningSignal,
    # Specialized signals
    UserPreferenceSignal,
    ErrorPatternSignal,
    SuccessPatternSignal,
    ToolEfficiencySignal,
    WorkflowPatternSignal,
    ContextRelevanceSignal,
    # Factory
    signal_from_dict,
)

from .emitter import (
    # Core function
    emit_signal,
    # Convenience functions
    emit_user_preference,
    emit_error_pattern,
    emit_success_pattern,
    emit_tool_efficiency,
    emit_workflow_pattern,
    emit_context_relevance,
    # Retrieval
    get_signals,
    get_signal_by_id,
    clear_signals,
    # Config
    get_signals_dir,
)

from .aggregator import (
    # Main class
    LearningAggregator,
    # Helper functions
    run_aggregation,
    print_aggregation_summary,
    # Aggregated data types
    AggregatedPreference,
    AggregatedErrorPattern,
    AggregatedSuccessPattern,
    AggregatedToolEfficiency,
    AggregatedContextRelevance,
    AggregationResult,
)

from .suggestions import (
    # Main class
    LearningSuggestions,
    # Data types
    Suggestion,
    SuggestionType,
    SuggestionPriority,
    SuggestionContext,
    # Helper functions
    get_suggestions,
    print_suggestions,
    get_startup_tips,
)

__all__ = [
    # Enums
    'SignalType',
    'SignalSource',
    'Outcome',
    # Base class
    'LearningSignal',
    # Specialized signals
    'UserPreferenceSignal',
    'ErrorPatternSignal',
    'SuccessPatternSignal',
    'ToolEfficiencySignal',
    'WorkflowPatternSignal',
    'ContextRelevanceSignal',
    # Factory
    'signal_from_dict',
    # Core function
    'emit_signal',
    # Convenience functions
    'emit_user_preference',
    'emit_error_pattern',
    'emit_success_pattern',
    'emit_tool_efficiency',
    'emit_workflow_pattern',
    'emit_context_relevance',
    # Retrieval
    'get_signals',
    'get_signal_by_id',
    'clear_signals',
    # Config
    'get_signals_dir',
    # Aggregator
    'LearningAggregator',
    'run_aggregation',
    'print_aggregation_summary',
    # Aggregated data types
    'AggregatedPreference',
    'AggregatedErrorPattern',
    'AggregatedSuccessPattern',
    'AggregatedToolEfficiency',
    'AggregatedContextRelevance',
    'AggregationResult',
    # Suggestions
    'LearningSuggestions',
    'Suggestion',
    'SuggestionType',
    'SuggestionPriority',
    'SuggestionContext',
    'get_suggestions',
    'print_suggestions',
    'get_startup_tips',
]

__version__ = '1.2.0'
