"""
Loki Mode Memory System - Core Data Schemas

This module defines the dataclasses for the memory system:
- EpisodeTrace: Specific interaction traces (episodic memory)
- SemanticPattern: Generalized patterns (semantic memory)
- ProceduralSkill: Reusable skills (procedural memory)

See references/memory-system.md for full documentation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any


# -----------------------------------------------------------------------------
# Supporting Types
# -----------------------------------------------------------------------------


@dataclass
class ActionEntry:
    """
    A single action taken during task execution.

    Attributes:
        tool: The tool or action type used (e.g., "read_file", "write_file")
        input: The input parameters for the action
        output: The result or output of the action
        timestamp: When the action occurred (relative seconds from start)
    """
    tool: str
    input: str
    output: str
    timestamp: int  # Relative seconds from episode start

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "t": self.timestamp,
            "action": self.tool,
            "target": self.input,
            "result": self.output,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ActionEntry:
        """Create from dictionary."""
        return cls(
            tool=data.get("action", data.get("tool", "")),
            input=data.get("target", data.get("input", "")),
            output=data.get("result", data.get("output", "")),
            timestamp=data.get("t", data.get("timestamp", 0)),
        )

    def validate(self) -> List[str]:
        """Validate the entry. Returns list of error messages."""
        errors = []
        if not self.tool:
            errors.append("ActionEntry.tool is required")
        if self.timestamp < 0:
            errors.append("ActionEntry.timestamp must be non-negative")
        return errors


@dataclass
class ErrorEntry:
    """
    An error encountered during task execution.

    Attributes:
        error_type: Category of error (e.g., "TypeScript compilation")
        message: The error message
        resolution: How the error was resolved
    """
    error_type: str
    message: str
    resolution: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "type": self.error_type,
            "message": self.message,
            "resolution": self.resolution,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ErrorEntry:
        """Create from dictionary."""
        return cls(
            error_type=data.get("type", data.get("error_type", "")),
            message=data.get("message", ""),
            resolution=data.get("resolution", ""),
        )

    def validate(self) -> List[str]:
        """Validate the entry. Returns list of error messages."""
        errors = []
        if not self.error_type:
            errors.append("ErrorEntry.error_type is required")
        if not self.message:
            errors.append("ErrorEntry.message is required")
        return errors


@dataclass
class Link:
    """
    A Zettelkasten-style link between memory entries.

    Attributes:
        to_id: ID of the linked memory entry
        relation: Type of relationship (derived_from, related_to, contradicts,
                  elaborates, example_of, supersedes, superseded_by)
        strength: Strength of the link (0.0 to 1.0)
    """
    to_id: str
    relation: str
    strength: float = 1.0

    VALID_RELATIONS = [
        "derived_from",
        "related_to",
        "contradicts",
        "elaborates",
        "example_of",
        "supersedes",
        "superseded_by",
        "supports",
    ]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "to": self.to_id,
            "relation": self.relation,
            "strength": self.strength,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Link:
        """Create from dictionary."""
        return cls(
            to_id=data.get("to", data.get("to_id", "")),
            relation=data.get("relation", ""),
            strength=data.get("strength", 1.0),
        )

    def validate(self) -> List[str]:
        """Validate the link. Returns list of error messages."""
        errors = []
        if not self.to_id:
            errors.append("Link.to_id is required")
        if self.relation not in self.VALID_RELATIONS:
            errors.append(
                f"Link.relation must be one of: {', '.join(self.VALID_RELATIONS)}"
            )
        if not 0.0 <= self.strength <= 1.0:
            errors.append("Link.strength must be between 0.0 and 1.0")
        return errors


@dataclass
class ErrorFix:
    """
    A common error and its fix for procedural skills.

    Attributes:
        error: Description of the error
        fix: How to fix it
    """
    error: str
    fix: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "error": self.error,
            "fix": self.fix,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ErrorFix:
        """Create from dictionary."""
        return cls(
            error=data.get("error", ""),
            fix=data.get("fix", ""),
        )

    def validate(self) -> List[str]:
        """Validate the entry. Returns list of error messages."""
        errors = []
        if not self.error:
            errors.append("ErrorFix.error is required")
        if not self.fix:
            errors.append("ErrorFix.fix is required")
        return errors


@dataclass
class TaskContext:
    """
    Context for a task execution.

    Attributes:
        goal: What the task is trying to accomplish
        phase: Current RARV phase (REASON, ACT, REFLECT, VERIFY)
        files: Files involved in the task
        constraints: Any constraints on the task
    """
    goal: str
    phase: str
    files: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)

    VALID_PHASES = ["REASON", "ACT", "REFLECT", "VERIFY"]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "goal": self.goal,
            "phase": self.phase,
            "files_involved": self.files,
            "constraints": self.constraints,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TaskContext:
        """Create from dictionary."""
        return cls(
            goal=data.get("goal", ""),
            phase=data.get("phase", ""),
            files=data.get("files_involved", data.get("files", [])),
            constraints=data.get("constraints", []),
        )

    def validate(self) -> List[str]:
        """Validate the context. Returns list of error messages."""
        errors = []
        if not self.goal:
            errors.append("TaskContext.goal is required")
        if self.phase and self.phase not in self.VALID_PHASES:
            errors.append(
                f"TaskContext.phase must be one of: {', '.join(self.VALID_PHASES)}"
            )
        return errors


# -----------------------------------------------------------------------------
# Main Memory Types
# -----------------------------------------------------------------------------


@dataclass
class EpisodeTrace:
    """
    A specific interaction trace (episodic memory).

    Represents a complete record of a task execution, including
    all actions taken, errors encountered, and artifacts produced.

    Attributes:
        id: Unique identifier (e.g., "ep-2026-01-06-001")
        task_id: Reference to the task being executed
        timestamp: When the episode started
        duration_seconds: How long the episode took
        agent: Agent type that executed the task
        phase: RARV phase (REASON, ACT, REFLECT, VERIFY)
        goal: What the task was trying to accomplish
        action_log: List of actions taken
        outcome: Result of the task (success, failure, partial)
        errors_encountered: List of errors encountered
        artifacts_produced: List of files created
        git_commit: Git commit hash if applicable
        tokens_used: Number of tokens consumed
        files_read: List of files read during execution
        files_modified: List of files modified during execution
        importance: Importance score (0.0-1.0), decays over time
        last_accessed: When the memory was last accessed
        access_count: Number of times this memory has been accessed
    """
    id: str
    task_id: str
    timestamp: datetime
    duration_seconds: int
    agent: str
    phase: str
    goal: str
    action_log: List[ActionEntry] = field(default_factory=list)
    outcome: str = "success"
    errors_encountered: List[ErrorEntry] = field(default_factory=list)
    artifacts_produced: List[str] = field(default_factory=list)
    git_commit: Optional[str] = None
    tokens_used: int = 0
    files_read: List[str] = field(default_factory=list)
    files_modified: List[str] = field(default_factory=list)
    importance: float = 0.5
    last_accessed: Optional[datetime] = None
    access_count: int = 0

    VALID_OUTCOMES = ["success", "failure", "partial"]
    VALID_PHASES = ["REASON", "ACT", "REFLECT", "VERIFY"]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "id": self.id,
            "task_id": self.task_id,
            "timestamp": self.timestamp.isoformat() + "Z",
            "duration_seconds": self.duration_seconds,
            "agent": self.agent,
            "context": {
                "phase": self.phase,
                "goal": self.goal,
                "files_involved": list(set(self.files_read + self.files_modified)),
            },
            "action_log": [a.to_dict() for a in self.action_log],
            "outcome": self.outcome,
            "errors_encountered": [e.to_dict() for e in self.errors_encountered],
            "artifacts_produced": self.artifacts_produced,
            "git_commit": self.git_commit,
            "tokens_used": self.tokens_used,
            "files_read": self.files_read,
            "files_modified": self.files_modified,
            "importance": self.importance,
            "access_count": self.access_count,
        }
        if self.last_accessed:
            result["last_accessed"] = self.last_accessed.isoformat() + "Z"
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> EpisodeTrace:
        """Create from dictionary."""
        context = data.get("context", {})
        timestamp_str = data.get("timestamp", "")
        if isinstance(timestamp_str, str):
            # Handle ISO format with Z suffix
            if timestamp_str.endswith("Z"):
                timestamp_str = timestamp_str[:-1]
            timestamp = datetime.fromisoformat(timestamp_str)
        else:
            timestamp = timestamp_str

        # Parse last_accessed datetime
        last_accessed = None
        last_accessed_str = data.get("last_accessed")
        if last_accessed_str:
            if isinstance(last_accessed_str, str):
                if last_accessed_str.endswith("Z"):
                    last_accessed_str = last_accessed_str[:-1]
                last_accessed = datetime.fromisoformat(last_accessed_str)
            else:
                last_accessed = last_accessed_str

        return cls(
            id=data.get("id", ""),
            task_id=data.get("task_id", ""),
            timestamp=timestamp,
            duration_seconds=data.get("duration_seconds", 0),
            agent=data.get("agent", ""),
            phase=context.get("phase", data.get("phase", "")),
            goal=context.get("goal", data.get("goal", "")),
            action_log=[
                ActionEntry.from_dict(a) for a in data.get("action_log", [])
            ],
            outcome=data.get("outcome", "success"),
            errors_encountered=[
                ErrorEntry.from_dict(e) for e in data.get("errors_encountered", [])
            ],
            artifacts_produced=data.get("artifacts_produced", []),
            git_commit=data.get("git_commit"),
            tokens_used=data.get("tokens_used", 0),
            files_read=data.get("files_read", context.get("files_involved", [])),
            files_modified=data.get("files_modified", []),
            importance=data.get("importance", 0.5),
            last_accessed=last_accessed,
            access_count=data.get("access_count", 0),
        )

    def validate(self) -> List[str]:
        """Validate the episode trace. Returns list of error messages."""
        errors = []
        if not self.id:
            errors.append("EpisodeTrace.id is required")
        if not self.task_id:
            errors.append("EpisodeTrace.task_id is required")
        if not self.agent:
            errors.append("EpisodeTrace.agent is required")
        if not self.goal:
            errors.append("EpisodeTrace.goal is required")
        if self.phase and self.phase not in self.VALID_PHASES:
            errors.append(
                f"EpisodeTrace.phase must be one of: {', '.join(self.VALID_PHASES)}"
            )
        if self.outcome not in self.VALID_OUTCOMES:
            errors.append(
                f"EpisodeTrace.outcome must be one of: {', '.join(self.VALID_OUTCOMES)}"
            )
        if self.duration_seconds < 0:
            errors.append("EpisodeTrace.duration_seconds must be non-negative")
        if self.tokens_used < 0:
            errors.append("EpisodeTrace.tokens_used must be non-negative")
        if not 0.0 <= self.importance <= 1.0:
            errors.append("EpisodeTrace.importance must be between 0.0 and 1.0")
        if self.access_count < 0:
            errors.append("EpisodeTrace.access_count must be non-negative")

        # Validate nested entries
        for i, action in enumerate(self.action_log):
            action_errors = action.validate()
            for err in action_errors:
                errors.append(f"action_log[{i}]: {err}")

        for i, error in enumerate(self.errors_encountered):
            error_errors = error.validate()
            for err in error_errors:
                errors.append(f"errors_encountered[{i}]: {err}")

        return errors

    @classmethod
    def create(
        cls,
        task_id: str,
        agent: str,
        goal: str,
        phase: str = "ACT",
        id_prefix: str = "ep",
    ) -> EpisodeTrace:
        """Factory method to create a new episode trace with defaults."""
        now = datetime.now(timezone.utc)
        date_part = now.strftime("%Y-%m-%d")
        unique_id = str(uuid.uuid4())[:8]
        episode_id = f"{id_prefix}-{date_part}-{unique_id}"

        return cls(
            id=episode_id,
            task_id=task_id,
            timestamp=now,
            duration_seconds=0,
            agent=agent,
            phase=phase,
            goal=goal,
        )


@dataclass
class SemanticPattern:
    """
    A generalized pattern extracted from episodic memory (semantic memory).

    Represents knowledge that has been abstracted from specific experiences
    into reusable patterns.

    Attributes:
        id: Unique identifier (e.g., "sem-001")
        pattern: Description of the pattern
        category: Category (e.g., "error-handling", "testing", "architecture")
        conditions: When this pattern applies
        correct_approach: The right way to do it
        incorrect_approach: The anti-pattern to avoid
        confidence: How confident we are in this pattern (0-1)
        source_episodes: Episode IDs that contributed to this pattern
        usage_count: How many times this pattern has been used
        last_used: When the pattern was last applied
        links: Zettelkasten-style links to related patterns
        importance: Importance score (0.0-1.0), decays over time
        last_accessed: When the memory was last accessed
        access_count: Number of times this memory has been accessed
    """
    id: str
    pattern: str
    category: str
    conditions: List[str] = field(default_factory=list)
    correct_approach: str = ""
    incorrect_approach: str = ""
    confidence: float = 0.8
    source_episodes: List[str] = field(default_factory=list)
    usage_count: int = 0
    last_used: Optional[datetime] = None
    links: List[Link] = field(default_factory=list)
    importance: float = 0.5
    last_accessed: Optional[datetime] = None
    access_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "id": self.id,
            "pattern": self.pattern,
            "category": self.category,
            "conditions": self.conditions,
            "correct_approach": self.correct_approach,
            "incorrect_approach": self.incorrect_approach,
            "confidence": self.confidence,
            "source_episodes": self.source_episodes,
            "usage_count": self.usage_count,
            "links": [link.to_dict() for link in self.links],
            "importance": self.importance,
            "access_count": self.access_count,
        }
        if self.last_used:
            result["last_used"] = self.last_used.isoformat() + "Z"
        if self.last_accessed:
            result["last_accessed"] = self.last_accessed.isoformat() + "Z"
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SemanticPattern:
        """Create from dictionary."""
        last_used = None
        if data.get("last_used"):
            last_used_str = data["last_used"]
            if isinstance(last_used_str, str):
                if last_used_str.endswith("Z"):
                    last_used_str = last_used_str[:-1]
                last_used = datetime.fromisoformat(last_used_str)

        last_accessed = None
        if data.get("last_accessed"):
            last_accessed_str = data["last_accessed"]
            if isinstance(last_accessed_str, str):
                if last_accessed_str.endswith("Z"):
                    last_accessed_str = last_accessed_str[:-1]
                last_accessed = datetime.fromisoformat(last_accessed_str)

        return cls(
            id=data.get("id", ""),
            pattern=data.get("pattern", ""),
            category=data.get("category", ""),
            conditions=data.get("conditions", []),
            correct_approach=data.get("correct_approach", ""),
            incorrect_approach=data.get("incorrect_approach", ""),
            confidence=data.get("confidence", 0.8),
            source_episodes=data.get("source_episodes", []),
            usage_count=data.get("usage_count", 0),
            last_used=last_used,
            links=[Link.from_dict(link) for link in data.get("links", [])],
            importance=data.get("importance", 0.5),
            last_accessed=last_accessed,
            access_count=data.get("access_count", 0),
        )

    def validate(self) -> List[str]:
        """Validate the pattern. Returns list of error messages."""
        errors = []
        if not self.id:
            errors.append("SemanticPattern.id is required")
        if not self.pattern:
            errors.append("SemanticPattern.pattern is required")
        if not self.category:
            errors.append("SemanticPattern.category is required")
        if not 0.0 <= self.confidence <= 1.0:
            errors.append("SemanticPattern.confidence must be between 0.0 and 1.0")
        if self.usage_count < 0:
            errors.append("SemanticPattern.usage_count must be non-negative")
        if not 0.0 <= self.importance <= 1.0:
            errors.append("SemanticPattern.importance must be between 0.0 and 1.0")
        if self.access_count < 0:
            errors.append("SemanticPattern.access_count must be non-negative")

        # Validate links
        for i, link in enumerate(self.links):
            link_errors = link.validate()
            for err in link_errors:
                errors.append(f"links[{i}]: {err}")

        return errors

    @classmethod
    def create(
        cls,
        pattern: str,
        category: str,
        conditions: Optional[List[str]] = None,
        correct_approach: str = "",
        incorrect_approach: str = "",
        id_prefix: str = "sem",
    ) -> SemanticPattern:
        """Factory method to create a new semantic pattern."""
        unique_id = str(uuid.uuid4())[:8]
        pattern_id = f"{id_prefix}-{unique_id}"

        return cls(
            id=pattern_id,
            pattern=pattern,
            category=category,
            conditions=conditions or [],
            correct_approach=correct_approach,
            incorrect_approach=incorrect_approach,
            confidence=0.8,
            last_used=datetime.now(timezone.utc),
        )

    def increment_usage(self) -> None:
        """Record that this pattern was used."""
        self.usage_count += 1
        self.last_used = datetime.now(timezone.utc)

    def add_link(self, to_id: str, relation: str, strength: float = 1.0) -> None:
        """Add a Zettelkasten link to another pattern."""
        link = Link(to_id=to_id, relation=relation, strength=strength)
        link_errors = link.validate()
        if link_errors:
            raise ValueError(f"Invalid link: {'; '.join(link_errors)}")
        self.links.append(link)


@dataclass
class ProceduralSkill:
    """
    A reusable skill (procedural memory).

    Represents learned action sequences that can be reused
    across similar tasks.

    Attributes:
        id: Unique identifier (e.g., "skill-api-impl")
        name: Human-readable name of the skill
        description: What this skill does
        prerequisites: What must be true before using this skill
        steps: Ordered list of steps to execute
        common_errors: Errors that commonly occur and their fixes
        exit_criteria: How to know the skill completed successfully
        example_usage: Optional example of using this skill
        importance: Importance score (0.0-1.0), decays over time
        last_accessed: When the memory was last accessed
        access_count: Number of times this memory has been accessed
    """
    id: str
    name: str
    description: str
    prerequisites: List[str] = field(default_factory=list)
    steps: List[str] = field(default_factory=list)
    common_errors: List[ErrorFix] = field(default_factory=list)
    exit_criteria: List[str] = field(default_factory=list)
    example_usage: Optional[str] = None
    importance: float = 0.5
    last_accessed: Optional[datetime] = None
    access_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "prerequisites": self.prerequisites,
            "steps": self.steps,
            "common_errors": [e.to_dict() for e in self.common_errors],
            "exit_criteria": self.exit_criteria,
            "importance": self.importance,
            "access_count": self.access_count,
        }
        if self.example_usage:
            result["example_usage"] = self.example_usage
        if self.last_accessed:
            result["last_accessed"] = self.last_accessed.isoformat() + "Z"
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> ProceduralSkill:
        """Create from dictionary."""
        last_accessed = None
        if data.get("last_accessed"):
            last_accessed_str = data["last_accessed"]
            if isinstance(last_accessed_str, str):
                if last_accessed_str.endswith("Z"):
                    last_accessed_str = last_accessed_str[:-1]
                last_accessed = datetime.fromisoformat(last_accessed_str)

        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            prerequisites=data.get("prerequisites", []),
            steps=data.get("steps", []),
            common_errors=[
                ErrorFix.from_dict(e) for e in data.get("common_errors", [])
            ],
            exit_criteria=data.get("exit_criteria", []),
            example_usage=data.get("example_usage"),
            importance=data.get("importance", 0.5),
            last_accessed=last_accessed,
            access_count=data.get("access_count", 0),
        )

    def validate(self) -> List[str]:
        """Validate the skill. Returns list of error messages."""
        errors = []
        if not self.id:
            errors.append("ProceduralSkill.id is required")
        if not self.name:
            errors.append("ProceduralSkill.name is required")
        if not self.description:
            errors.append("ProceduralSkill.description is required")
        if not self.steps:
            errors.append("ProceduralSkill.steps must have at least one step")
        if not 0.0 <= self.importance <= 1.0:
            errors.append("ProceduralSkill.importance must be between 0.0 and 1.0")
        if self.access_count < 0:
            errors.append("ProceduralSkill.access_count must be non-negative")

        # Validate common_errors
        for i, error_fix in enumerate(self.common_errors):
            ef_errors = error_fix.validate()
            for err in ef_errors:
                errors.append(f"common_errors[{i}]: {err}")

        return errors

    @classmethod
    def create(
        cls,
        name: str,
        description: str,
        steps: List[str],
        id_prefix: str = "skill",
    ) -> ProceduralSkill:
        """Factory method to create a new procedural skill."""
        # Generate ID from name: "API Implementation" -> "skill-api-implementation"
        slug = name.lower().replace(" ", "-").replace("_", "-")
        # Remove non-alphanumeric chars except hyphens
        slug = "".join(c for c in slug if c.isalnum() or c == "-")
        skill_id = f"{id_prefix}-{slug}"

        return cls(
            id=skill_id,
            name=name,
            description=description,
            steps=steps,
        )

    def add_error_fix(self, error: str, fix: str) -> None:
        """Add a common error and its fix."""
        self.common_errors.append(ErrorFix(error=error, fix=fix))


# -----------------------------------------------------------------------------
# Definition of Done (DoD) Schemas
# -----------------------------------------------------------------------------


@dataclass
class DecisionReport:
    """
    Decision report documenting why and how a task was completed.

    Based on references/definition-of-done.md and references/quality-control.md.
    Required for every completed task per the three-layer DoD model.

    Attributes:
        why: Problem, root cause, solution chosen, alternatives considered
        what: Files modified, APIs changed, behavior changes, dependencies
        trade_offs: What was gained, cost, and neutral areas
        risks: Identified risks and mitigations
        tests: Test results summary
        next_steps: Follow-up actions if any
    """
    why: Dict[str, Any] = field(default_factory=dict)
    what: Dict[str, Any] = field(default_factory=dict)
    trade_offs: Dict[str, Any] = field(default_factory=dict)
    risks: List[Dict[str, str]] = field(default_factory=list)
    tests: Dict[str, Any] = field(default_factory=dict)
    next_steps: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "WHY": self.why,
            "WHAT": self.what,
            "TRADE_OFFS": self.trade_offs,
            "RISKS": self.risks,
            "TESTS": self.tests,
            "NEXT_STEPS": self.next_steps,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> DecisionReport:
        """Create from dictionary."""
        return cls(
            why=data.get("WHY", data.get("why", {})),
            what=data.get("WHAT", data.get("what", {})),
            trade_offs=data.get("TRADE_OFFS", data.get("trade_offs", {})),
            risks=data.get("RISKS", data.get("risks", [])),
            tests=data.get("TESTS", data.get("tests", {})),
            next_steps=data.get("NEXT_STEPS", data.get("next_steps", [])),
        )

    def validate(self) -> List[str]:
        """Validate the decision report. Returns list of error messages."""
        errors = []
        if not self.why:
            errors.append("DecisionReport.why is required")
        if not self.what:
            errors.append("DecisionReport.what is required")
        if not self.tests:
            errors.append("DecisionReport.tests is required")
        return errors

    def is_complete(self) -> bool:
        """Check if the decision report has all required fields."""
        return bool(self.why and self.what and self.tests)


@dataclass
class QualityGateResult:
    """
    Result of a single quality gate check.

    Attributes:
        gate_name: Name of the quality gate
        passed: Whether the gate passed
        severity: Severity if failed (critical, high, medium, low, cosmetic)
        message: Description of result or failure reason
        details: Additional details about the check
    """
    gate_name: str
    passed: bool
    severity: str = ""
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)

    VALID_SEVERITIES = ["critical", "high", "medium", "low", "cosmetic", ""]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "gate": self.gate_name,
            "passed": self.passed,
            "severity": self.severity,
            "message": self.message,
            "details": self.details,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> QualityGateResult:
        """Create from dictionary."""
        return cls(
            gate_name=data.get("gate", data.get("gate_name", "")),
            passed=data.get("passed", False),
            severity=data.get("severity", ""),
            message=data.get("message", ""),
            details=data.get("details", {}),
        )

    def validate(self) -> List[str]:
        """Validate the result. Returns list of error messages."""
        errors = []
        if not self.gate_name:
            errors.append("QualityGateResult.gate_name is required")
        if self.severity and self.severity not in self.VALID_SEVERITIES:
            errors.append(
                f"QualityGateResult.severity must be one of: {', '.join(self.VALID_SEVERITIES)}"
            )
        return errors

    def blocks_completion(self) -> bool:
        """Check if this result blocks task completion."""
        if self.passed:
            return False
        # Critical, high, and medium severity issues block completion
        return self.severity in ["critical", "high", "medium"]


@dataclass
class TaskCompletionCriteria:
    """
    Complete Definition of Done (DoD) criteria for a task.

    Implements the three-layer DoD model from references/definition-of-done.md:
    - Layer 1: Outcome Verification (state change exists)
    - Layer 2: Process Verification (quality gates passed)
    - Layer 3: Consistency Verification (would pass again)

    Attributes:
        task_id: Unique task identifier
        completed_at: When the task was completed
        status: Final status (completed, failed, partial)

        # Layer 1: Outcome Verification
        outcome_verified: Whether intended state change was verified
        tests_passed: Whether all tests pass
        build_succeeded: Whether build/compile succeeded
        files_created: List of files that should exist
        state_changes: Description of environment state changes

        # Layer 2: Process Verification
        quality_gates: Results of all 7 quality gates
        decision_report: Required decision documentation
        git_commit_sha: Atomic git checkpoint
        continuity_updated: Whether CONTINUITY.md was updated

        # Layer 3: Consistency Verification
        pass_at_k: Probability of success in k attempts
        consistency_runs: Number of consistency verification runs
        consistency_passed: Number of successful consistency runs

        # Acceptance Criteria (item-specific)
        acceptance_criteria: List of item-specific requirements
        acceptance_met: Which acceptance criteria were satisfied
    """
    task_id: str
    completed_at: Optional[datetime] = None
    status: str = "pending"

    # Layer 1: Outcome Verification
    outcome_verified: bool = False
    tests_passed: bool = False
    build_succeeded: bool = False
    files_created: List[str] = field(default_factory=list)
    state_changes: Dict[str, Any] = field(default_factory=dict)

    # Layer 2: Process Verification
    quality_gates: List[QualityGateResult] = field(default_factory=list)
    decision_report: Optional[DecisionReport] = None
    git_commit_sha: Optional[str] = None
    continuity_updated: bool = False

    # Layer 3: Consistency Verification
    pass_at_k: float = 0.0
    consistency_runs: int = 0
    consistency_passed: int = 0

    # Acceptance Criteria (item-specific)
    acceptance_criteria: List[str] = field(default_factory=list)
    acceptance_met: List[str] = field(default_factory=list)

    VALID_STATUSES = ["pending", "in_progress", "completed", "failed", "partial"]
    REQUIRED_GATES = [
        "input_guardrails",
        "static_analysis",
        "blind_review",
        "anti_sycophancy",
        "output_guardrails",
        "severity_blocking",
        "test_coverage",
    ]

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "taskId": self.task_id,
            "status": self.status,
            "layer1_outcome": {
                "outcome_verified": self.outcome_verified,
                "tests_passed": self.tests_passed,
                "build_succeeded": self.build_succeeded,
                "files_created": self.files_created,
                "state_changes": self.state_changes,
            },
            "layer2_process": {
                "quality_gates": [g.to_dict() for g in self.quality_gates],
                "decision_report": self.decision_report.to_dict() if self.decision_report else None,
                "git_commit_sha": self.git_commit_sha,
                "continuity_updated": self.continuity_updated,
            },
            "layer3_consistency": {
                "pass_at_k": self.pass_at_k,
                "consistency_runs": self.consistency_runs,
                "consistency_passed": self.consistency_passed,
            },
            "acceptance": {
                "criteria": self.acceptance_criteria,
                "met": self.acceptance_met,
            },
        }
        if self.completed_at:
            result["completedAt"] = self.completed_at.isoformat() + "Z"
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TaskCompletionCriteria:
        """Create from dictionary."""
        completed_at = None
        if data.get("completedAt"):
            completed_at_str = data["completedAt"]
            if isinstance(completed_at_str, str):
                if completed_at_str.endswith("Z"):
                    completed_at_str = completed_at_str[:-1]
                completed_at = datetime.fromisoformat(completed_at_str)

        layer1 = data.get("layer1_outcome", {})
        layer2 = data.get("layer2_process", {})
        layer3 = data.get("layer3_consistency", {})
        acceptance = data.get("acceptance", {})

        decision_report = None
        if layer2.get("decision_report"):
            decision_report = DecisionReport.from_dict(layer2["decision_report"])

        return cls(
            task_id=data.get("taskId", data.get("task_id", "")),
            completed_at=completed_at,
            status=data.get("status", "pending"),
            outcome_verified=layer1.get("outcome_verified", False),
            tests_passed=layer1.get("tests_passed", False),
            build_succeeded=layer1.get("build_succeeded", False),
            files_created=layer1.get("files_created", []),
            state_changes=layer1.get("state_changes", {}),
            quality_gates=[
                QualityGateResult.from_dict(g)
                for g in layer2.get("quality_gates", [])
            ],
            decision_report=decision_report,
            git_commit_sha=layer2.get("git_commit_sha"),
            continuity_updated=layer2.get("continuity_updated", False),
            pass_at_k=layer3.get("pass_at_k", 0.0),
            consistency_runs=layer3.get("consistency_runs", 0),
            consistency_passed=layer3.get("consistency_passed", 0),
            acceptance_criteria=acceptance.get("criteria", []),
            acceptance_met=acceptance.get("met", []),
        )

    def validate(self) -> List[str]:
        """Validate the criteria. Returns list of error messages."""
        errors = []
        if not self.task_id:
            errors.append("TaskCompletionCriteria.task_id is required")
        if self.status not in self.VALID_STATUSES:
            errors.append(
                f"TaskCompletionCriteria.status must be one of: {', '.join(self.VALID_STATUSES)}"
            )
        if not 0.0 <= self.pass_at_k <= 1.0:
            errors.append("TaskCompletionCriteria.pass_at_k must be between 0.0 and 1.0")

        # Validate nested objects
        for i, gate in enumerate(self.quality_gates):
            gate_errors = gate.validate()
            for err in gate_errors:
                errors.append(f"quality_gates[{i}]: {err}")

        if self.decision_report:
            report_errors = self.decision_report.validate()
            for err in report_errors:
                errors.append(f"decision_report: {err}")

        return errors

    def check_layer1_outcome(self) -> tuple[bool, List[str]]:
        """
        Check Layer 1: Outcome Verification.
        Returns (passed, list of failure reasons).
        """
        failures = []

        if not self.outcome_verified:
            failures.append("Intended state change not verified in environment")

        if not self.tests_passed:
            failures.append("Not all tests pass")

        if not self.build_succeeded:
            failures.append("Build/compile did not succeed")

        return len(failures) == 0, failures

    def check_layer2_process(self) -> tuple[bool, List[str]]:
        """
        Check Layer 2: Process Verification (quality gates).
        Returns (passed, list of failure reasons).
        """
        failures = []

        # Check all required gates are present
        present_gates = {g.gate_name for g in self.quality_gates}
        missing_gates = set(self.REQUIRED_GATES) - present_gates
        for gate in missing_gates:
            failures.append(f"Missing quality gate: {gate}")

        # Check for blocking failures
        for gate in self.quality_gates:
            if gate.blocks_completion():
                failures.append(f"Quality gate '{gate.gate_name}' failed with {gate.severity} severity: {gate.message}")

        # Check decision report
        if not self.decision_report:
            failures.append("Missing decision report (WHY/WHAT/TRADE-OFFS/RISKS/TESTS)")
        elif not self.decision_report.is_complete():
            failures.append("Decision report incomplete")

        # Check git commit
        if not self.git_commit_sha:
            failures.append("Missing git commit checkpoint")

        # Check continuity update
        if not self.continuity_updated:
            failures.append("CONTINUITY.md not updated with outcome")

        return len(failures) == 0, failures

    def check_layer3_consistency(self, threshold: float = 0.8) -> tuple[bool, List[str]]:
        """
        Check Layer 3: Consistency Verification (pass@k reliability).
        Returns (passed, list of failure reasons).

        Args:
            threshold: Minimum pass@k rate required (default 0.8 = 80%)
        """
        failures = []

        if self.consistency_runs == 0:
            # No consistency verification performed - this is optional
            return True, []

        actual_pass_rate = self.consistency_passed / self.consistency_runs
        if actual_pass_rate < threshold:
            failures.append(
                f"Consistency verification failed: {actual_pass_rate*100:.0f}% pass rate "
                f"(requires {threshold*100:.0f}%)"
            )

        return len(failures) == 0, failures

    def check_acceptance_criteria(self) -> tuple[bool, List[str]]:
        """
        Check if all acceptance criteria are met.
        Returns (passed, list of unmet criteria).
        """
        if not self.acceptance_criteria:
            # No item-specific acceptance criteria defined
            return True, []

        unmet = [ac for ac in self.acceptance_criteria if ac not in self.acceptance_met]
        return len(unmet) == 0, unmet

    def is_done(self, require_consistency: bool = False, consistency_threshold: float = 0.8) -> tuple[bool, Dict[str, Any]]:
        """
        Check if the task meets all Definition of Done criteria.

        Args:
            require_consistency: Whether to require Layer 3 consistency verification
            consistency_threshold: Minimum pass@k rate if consistency is required

        Returns:
            Tuple of (is_done: bool, report: dict with layer results)
        """
        layer1_passed, layer1_failures = self.check_layer1_outcome()
        layer2_passed, layer2_failures = self.check_layer2_process()
        layer3_passed, layer3_failures = self.check_layer3_consistency(consistency_threshold)
        ac_passed, ac_failures = self.check_acceptance_criteria()

        # Layer 3 is optional unless explicitly required
        if not require_consistency:
            layer3_passed = True
            layer3_failures = []

        is_done = layer1_passed and layer2_passed and layer3_passed and ac_passed

        return is_done, {
            "is_done": is_done,
            "layer1_outcome": {
                "passed": layer1_passed,
                "failures": layer1_failures,
            },
            "layer2_process": {
                "passed": layer2_passed,
                "failures": layer2_failures,
            },
            "layer3_consistency": {
                "passed": layer3_passed,
                "failures": layer3_failures,
                "required": require_consistency,
            },
            "acceptance_criteria": {
                "passed": ac_passed,
                "unmet": ac_failures,
            },
        }

    @classmethod
    def create_minimal(cls, task_id: str) -> TaskCompletionCriteria:
        """Create a new TaskCompletionCriteria with minimal defaults."""
        return cls(task_id=task_id)

    def mark_complete(
        self,
        git_commit_sha: str,
        decision_report: DecisionReport,
        quality_gates: List[QualityGateResult],
    ) -> None:
        """
        Mark the task as complete with required artifacts.

        This is a convenience method that sets all required Layer 2 fields.
        """
        self.completed_at = datetime.now(timezone.utc)
        self.status = "completed"
        self.git_commit_sha = git_commit_sha
        self.decision_report = decision_report
        self.quality_gates = quality_gates
        self.continuity_updated = True
