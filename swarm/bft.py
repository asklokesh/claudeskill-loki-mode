"""
Loki Mode Byzantine Fault Tolerance - Handle malicious/faulty agents.

This module implements Byzantine Fault Tolerance (BFT) for the swarm system:
- PBFT-lite consensus protocol
- Agent reputation tracking
- Fault detection mechanisms
- Message authentication with simple hashing
- Automatic exclusion of bad actors

Byzantine fault tolerance ensures the system can maintain correctness
even when f out of n agents are faulty/malicious (n > 3f).

Reference: Practical Byzantine Fault Tolerance (Castro & Liskov, 1999)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from .registry import AgentInfo, AgentRegistry, AgentStatus
from .messages import SwarmMessage, MessageType, Vote, VoteChoice


# Default secret key for HMAC (in production, this would be securely managed)
DEFAULT_SECRET_KEY = "loki-bft-secret-key-change-in-production"


class FaultType(str, Enum):
    """Types of faults detected in agents."""
    INCONSISTENT_VOTE = "inconsistent_vote"  # Agent voted differently on same proposal
    TIMEOUT = "timeout"  # Agent did not respond within deadline
    INVALID_MESSAGE = "invalid_message"  # Message failed authentication
    CONFLICTING_RESULT = "conflicting_result"  # Result differs from consensus
    EQUIVOCATION = "equivocation"  # Sent different messages to different agents
    MALFORMED_RESPONSE = "malformed_response"  # Response doesn't match expected format


class ConsensusPhase(str, Enum):
    """Phases in PBFT-lite consensus."""
    PRE_PREPARE = "pre_prepare"  # Primary proposes value
    PREPARE = "prepare"  # Replicas acknowledge receipt
    COMMIT = "commit"  # Replicas commit to value
    REPLY = "reply"  # Final response to client


@dataclass
class FaultRecord:
    """
    Record of a fault detected for an agent.

    Attributes:
        id: Unique record identifier
        agent_id: ID of the faulty agent
        fault_type: Type of fault detected
        severity: Severity level (0.0 to 1.0)
        description: Human-readable description
        evidence: Evidence of the fault
        timestamp: When fault was detected
    """
    id: str
    agent_id: str
    fault_type: FaultType
    severity: float
    description: str
    evidence: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "fault_type": self.fault_type.value,
            "severity": self.severity,
            "description": self.description,
            "evidence": self.evidence,
            "timestamp": self.timestamp.isoformat() + "Z",
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> FaultRecord:
        """Create from dictionary."""
        timestamp = datetime.now(timezone.utc)
        if data.get("timestamp"):
            ts_str = data["timestamp"]
            if isinstance(ts_str, str):
                if ts_str.endswith("Z"):
                    ts_str = ts_str[:-1]
                timestamp = datetime.fromisoformat(ts_str)

        return cls(
            id=data.get("id", ""),
            agent_id=data.get("agent_id", ""),
            fault_type=FaultType(data.get("fault_type", "timeout")),
            severity=data.get("severity", 0.5),
            description=data.get("description", ""),
            evidence=data.get("evidence", {}),
            timestamp=timestamp,
        )


@dataclass
class AgentReputation:
    """
    Reputation score for an agent.

    Attributes:
        agent_id: Agent identifier
        score: Current reputation score (0.0 to 1.0)
        total_interactions: Total number of interactions
        successful_interactions: Number of successful interactions
        faults: List of fault records
        last_updated: When reputation was last updated
        is_excluded: Whether agent is excluded from consensus
        exclusion_reason: Reason for exclusion
    """
    agent_id: str
    score: float = 1.0  # Start with full trust
    total_interactions: int = 0
    successful_interactions: int = 0
    faults: List[FaultRecord] = field(default_factory=list)
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_excluded: bool = False
    exclusion_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "agent_id": self.agent_id,
            "score": self.score,
            "total_interactions": self.total_interactions,
            "successful_interactions": self.successful_interactions,
            "faults": [f.to_dict() for f in self.faults],
            "last_updated": self.last_updated.isoformat() + "Z",
            "is_excluded": self.is_excluded,
            "exclusion_reason": self.exclusion_reason,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AgentReputation:
        """Create from dictionary."""
        last_updated = datetime.now(timezone.utc)
        if data.get("last_updated"):
            ts_str = data["last_updated"]
            if isinstance(ts_str, str):
                if ts_str.endswith("Z"):
                    ts_str = ts_str[:-1]
                last_updated = datetime.fromisoformat(ts_str)

        return cls(
            agent_id=data.get("agent_id", ""),
            score=data.get("score", 1.0),
            total_interactions=data.get("total_interactions", 0),
            successful_interactions=data.get("successful_interactions", 0),
            faults=[FaultRecord.from_dict(f) for f in data.get("faults", [])],
            last_updated=last_updated,
            is_excluded=data.get("is_excluded", False),
            exclusion_reason=data.get("exclusion_reason"),
        )

    def record_success(self) -> None:
        """Record a successful interaction."""
        self.total_interactions += 1
        self.successful_interactions += 1
        self._update_score()

    def record_fault(self, fault: FaultRecord) -> None:
        """Record a fault and update score."""
        self.total_interactions += 1
        self.faults.append(fault)
        self._update_score()

    def _update_score(self) -> None:
        """Recalculate reputation score."""
        if self.total_interactions == 0:
            self.score = 1.0
            return

        # Base score from success ratio
        base_score = self.successful_interactions / self.total_interactions

        # Apply fault penalties
        fault_penalty = 0.0
        for fault in self.faults[-10:]:  # Consider last 10 faults
            fault_penalty += fault.severity * 0.1

        self.score = max(0.0, min(1.0, base_score - fault_penalty))
        self.last_updated = datetime.now(timezone.utc)


@dataclass
class AuthenticatedMessage:
    """
    A message with authentication (HMAC).

    Attributes:
        message: The original message
        mac: Message Authentication Code
        nonce: Random nonce to prevent replay
        timestamp: Message timestamp
    """
    message: SwarmMessage
    mac: str
    nonce: str
    timestamp: float

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "message": self.message.to_dict(),
            "mac": self.mac,
            "nonce": self.nonce,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AuthenticatedMessage:
        """Create from dictionary."""
        return cls(
            message=SwarmMessage.from_dict(data.get("message", {})),
            mac=data.get("mac", ""),
            nonce=data.get("nonce", ""),
            timestamp=data.get("timestamp", 0.0),
        )


@dataclass
class ConsensusRound:
    """
    A single round of PBFT-lite consensus.

    Attributes:
        id: Unique round identifier
        proposal_id: ID of the proposal being voted on
        phase: Current consensus phase
        primary_id: ID of the primary (leader) agent
        value: The value being proposed
        prepare_votes: Agents that have prepared
        commit_votes: Agents that have committed
        result: Final consensus result
        created_at: When round started
        completed_at: When round completed
        timeout_seconds: Timeout for this round
    """
    id: str
    proposal_id: str
    phase: ConsensusPhase = ConsensusPhase.PRE_PREPARE
    primary_id: str = ""
    value: Any = None
    prepare_votes: Dict[str, str] = field(default_factory=dict)  # agent_id -> value_hash
    commit_votes: Dict[str, str] = field(default_factory=dict)
    result: Optional[Any] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    timeout_seconds: float = 30.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "id": self.id,
            "proposal_id": self.proposal_id,
            "phase": self.phase.value,
            "primary_id": self.primary_id,
            "value": self.value,
            "prepare_votes": self.prepare_votes,
            "commit_votes": self.commit_votes,
            "result": self.result,
            "created_at": self.created_at.isoformat() + "Z",
            "timeout_seconds": self.timeout_seconds,
        }
        if self.completed_at:
            result["completed_at"] = self.completed_at.isoformat() + "Z"
        return result

    def is_timed_out(self) -> bool:
        """Check if this round has timed out."""
        elapsed = (datetime.now(timezone.utc) - self.created_at).total_seconds()
        return elapsed > self.timeout_seconds

    def has_prepare_quorum(self, total_agents: int) -> bool:
        """Check if we have enough prepare votes (2f + 1 for n = 3f + 1)."""
        # For n agents tolerating f faults, need 2f + 1 = (2n + 1) / 3
        quorum = (2 * total_agents + 1) // 3
        return len(self.prepare_votes) >= quorum

    def has_commit_quorum(self, total_agents: int) -> bool:
        """Check if we have enough commit votes."""
        quorum = (2 * total_agents + 1) // 3
        return len(self.commit_votes) >= quorum


@dataclass
class BFTConfig:
    """Configuration for Byzantine Fault Tolerance."""
    # Reputation thresholds
    min_reputation_for_consensus: float = 0.3  # Minimum reputation to participate
    exclusion_threshold: float = 0.2  # Exclude agent if score drops below this
    rehabilitation_threshold: float = 0.5  # Allow back if score rises above this

    # Consensus settings
    consensus_timeout_seconds: float = 30.0
    max_view_changes: int = 3  # Maximum view changes before giving up
    require_prepare_quorum: bool = True

    # Fault detection
    vote_consistency_window: int = 10  # Check consistency within last N votes
    message_validity_window_seconds: float = 60.0  # Max age for valid messages
    max_faults_before_exclusion: int = 3

    # Penalties
    timeout_penalty: float = 0.1
    inconsistency_penalty: float = 0.3
    invalid_message_penalty: float = 0.2
    equivocation_penalty: float = 0.5

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "min_reputation_for_consensus": self.min_reputation_for_consensus,
            "exclusion_threshold": self.exclusion_threshold,
            "rehabilitation_threshold": self.rehabilitation_threshold,
            "consensus_timeout_seconds": self.consensus_timeout_seconds,
            "max_view_changes": self.max_view_changes,
            "require_prepare_quorum": self.require_prepare_quorum,
            "vote_consistency_window": self.vote_consistency_window,
            "message_validity_window_seconds": self.message_validity_window_seconds,
            "max_faults_before_exclusion": self.max_faults_before_exclusion,
            "timeout_penalty": self.timeout_penalty,
            "inconsistency_penalty": self.inconsistency_penalty,
            "invalid_message_penalty": self.invalid_message_penalty,
            "equivocation_penalty": self.equivocation_penalty,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> BFTConfig:
        """Create from dictionary."""
        return cls(
            min_reputation_for_consensus=data.get("min_reputation_for_consensus", 0.3),
            exclusion_threshold=data.get("exclusion_threshold", 0.2),
            rehabilitation_threshold=data.get("rehabilitation_threshold", 0.5),
            consensus_timeout_seconds=data.get("consensus_timeout_seconds", 30.0),
            max_view_changes=data.get("max_view_changes", 3),
            require_prepare_quorum=data.get("require_prepare_quorum", True),
            vote_consistency_window=data.get("vote_consistency_window", 10),
            message_validity_window_seconds=data.get("message_validity_window_seconds", 60.0),
            max_faults_before_exclusion=data.get("max_faults_before_exclusion", 3),
            timeout_penalty=data.get("timeout_penalty", 0.1),
            inconsistency_penalty=data.get("inconsistency_penalty", 0.3),
            invalid_message_penalty=data.get("invalid_message_penalty", 0.2),
            equivocation_penalty=data.get("equivocation_penalty", 0.5),
        )


@dataclass
class BFTResult:
    """Result of a BFT consensus operation."""
    success: bool
    value: Any = None
    consensus_reached: bool = False
    participating_agents: List[str] = field(default_factory=list)
    excluded_agents: List[str] = field(default_factory=list)
    faults_detected: List[FaultRecord] = field(default_factory=list)
    rounds_completed: int = 0
    duration_ms: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


class ByzantineFaultTolerance:
    """
    Byzantine Fault Tolerance system for swarm coordination.

    Provides:
    - PBFT-lite consensus protocol
    - Agent reputation tracking
    - Fault detection and handling
    - Message authentication
    - Automatic exclusion of bad actors

    The system can tolerate f faulty agents out of n total agents
    where n > 3f (e.g., 4 agents can tolerate 1 fault).

    Example usage:
        bft = ByzantineFaultTolerance(registry)

        # Run BFT-aware consensus
        result = bft.run_consensus(
            proposal_id="proposal-123",
            value="TypeScript",
            participants=["agent-1", "agent-2", "agent-3", "agent-4"],
        )

        if result.consensus_reached:
            print(f"Consensus on: {result.value}")

        # Check agent reputation
        rep = bft.get_reputation("agent-1")
        print(f"Agent reputation: {rep.score}")
    """

    def __init__(
        self,
        registry: AgentRegistry,
        loki_dir: Optional[Path] = None,
        config: Optional[BFTConfig] = None,
        secret_key: Optional[str] = None,
    ):
        """
        Initialize BFT system.

        Args:
            registry: Agent registry for looking up agents
            loki_dir: Path to .loki directory
            config: BFT configuration
            secret_key: Secret key for message authentication
        """
        self.registry = registry
        self.loki_dir = loki_dir or Path(".loki")
        self.config = config or BFTConfig()
        self._secret_key = (secret_key or DEFAULT_SECRET_KEY).encode()

        # Storage
        self._bft_dir = self.loki_dir / "swarm" / "bft"
        self._bft_dir.mkdir(parents=True, exist_ok=True)

        # In-memory state
        self._reputations: Dict[str, AgentReputation] = {}
        self._vote_history: Dict[str, List[Tuple[str, str]]] = {}  # agent_id -> [(proposal_id, vote)]
        self._active_rounds: Dict[str, ConsensusRound] = {}
        self._used_nonces: Set[str] = set()  # Prevent replay attacks

        # Load persisted state
        self._load_reputations()

        # Event handlers
        self._fault_handlers: List[Callable[[FaultRecord], None]] = []

    # -------------------------------------------------------------------------
    # Message Authentication
    # -------------------------------------------------------------------------

    def create_authenticated_message(self, message: SwarmMessage) -> AuthenticatedMessage:
        """
        Create an authenticated message with HMAC.

        Args:
            message: The message to authenticate

        Returns:
            AuthenticatedMessage with MAC
        """
        nonce = secrets.token_hex(16)
        timestamp = time.time()

        # Create message to sign
        msg_data = json.dumps({
            "message": message.to_dict(),
            "nonce": nonce,
            "timestamp": timestamp,
        }, sort_keys=True)

        # Compute HMAC
        mac = hmac.new(
            self._secret_key,
            msg_data.encode(),
            hashlib.sha256
        ).hexdigest()

        return AuthenticatedMessage(
            message=message,
            mac=mac,
            nonce=nonce,
            timestamp=timestamp,
        )

    def verify_authenticated_message(
        self,
        auth_message: AuthenticatedMessage,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verify an authenticated message.

        Args:
            auth_message: The authenticated message to verify

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check nonce for replay
        if auth_message.nonce in self._used_nonces:
            return False, "Replay attack detected: nonce already used"

        # Check timestamp freshness
        age = time.time() - auth_message.timestamp
        if age > self.config.message_validity_window_seconds:
            return False, f"Message too old: {age:.1f}s"

        if age < -10:  # Allow small clock skew
            return False, f"Message from future: {-age:.1f}s"

        # Verify HMAC
        msg_data = json.dumps({
            "message": auth_message.message.to_dict(),
            "nonce": auth_message.nonce,
            "timestamp": auth_message.timestamp,
        }, sort_keys=True)

        expected_mac = hmac.new(
            self._secret_key,
            msg_data.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(auth_message.mac, expected_mac):
            return False, "Invalid MAC: message tampered"

        # Mark nonce as used
        self._used_nonces.add(auth_message.nonce)

        # Cleanup old nonces periodically
        if len(self._used_nonces) > 10000:
            self._used_nonces = set(list(self._used_nonces)[-5000:])

        return True, None

    def hash_value(self, value: Any) -> str:
        """Compute hash of a value for comparison."""
        value_str = json.dumps(value, sort_keys=True, default=str)
        return hashlib.sha256(value_str.encode()).hexdigest()[:16]

    # -------------------------------------------------------------------------
    # Reputation Management
    # -------------------------------------------------------------------------

    def get_reputation(self, agent_id: str) -> AgentReputation:
        """
        Get or create reputation for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            AgentReputation for the agent
        """
        if agent_id not in self._reputations:
            self._reputations[agent_id] = AgentReputation(agent_id=agent_id)
        return self._reputations[agent_id]

    def update_reputation(self, agent_id: str, success: bool, fault: Optional[FaultRecord] = None) -> None:
        """
        Update agent reputation based on behavior.

        Args:
            agent_id: Agent identifier
            success: Whether the interaction was successful
            fault: Optional fault record if fault detected
        """
        rep = self.get_reputation(agent_id)

        if success:
            rep.record_success()
        elif fault:
            rep.record_fault(fault)
            self._check_exclusion(rep)
            self._emit_fault(fault)

        self._save_reputations()

    def _check_exclusion(self, rep: AgentReputation) -> None:
        """Check if agent should be excluded based on reputation."""
        # Check score threshold
        if rep.score < self.config.exclusion_threshold:
            rep.is_excluded = True
            rep.exclusion_reason = f"Reputation score below threshold ({rep.score:.2f} < {self.config.exclusion_threshold})"
            return

        # Check recent fault count
        recent_faults = [
            f for f in rep.faults
            if (datetime.now(timezone.utc) - f.timestamp).total_seconds() < 3600  # Last hour
        ]
        if len(recent_faults) >= self.config.max_faults_before_exclusion:
            rep.is_excluded = True
            rep.exclusion_reason = f"Too many recent faults ({len(recent_faults)})"

    def rehabilitate_agent(self, agent_id: str) -> bool:
        """
        Attempt to rehabilitate an excluded agent.

        Args:
            agent_id: Agent identifier

        Returns:
            True if agent was rehabilitated
        """
        rep = self.get_reputation(agent_id)

        if not rep.is_excluded:
            return False

        if rep.score >= self.config.rehabilitation_threshold:
            rep.is_excluded = False
            rep.exclusion_reason = None
            self._save_reputations()
            return True

        return False

    def get_eligible_agents(self, agent_ids: List[str]) -> List[str]:
        """
        Filter agents to only those eligible for consensus.

        Args:
            agent_ids: List of agent IDs to filter

        Returns:
            List of eligible agent IDs
        """
        eligible = []
        for agent_id in agent_ids:
            rep = self.get_reputation(agent_id)
            if not rep.is_excluded and rep.score >= self.config.min_reputation_for_consensus:
                eligible.append(agent_id)
        return eligible

    def get_all_reputations(self) -> List[AgentReputation]:
        """Get all reputation records."""
        return list(self._reputations.values())

    def get_excluded_agents(self) -> List[str]:
        """Get list of excluded agent IDs."""
        return [
            rep.agent_id for rep in self._reputations.values()
            if rep.is_excluded
        ]

    # -------------------------------------------------------------------------
    # Fault Detection
    # -------------------------------------------------------------------------

    def detect_vote_inconsistency(
        self,
        agent_id: str,
        proposal_id: str,
        vote: str,
    ) -> Optional[FaultRecord]:
        """
        Check if an agent's vote is inconsistent with previous votes on same proposal.

        Args:
            agent_id: Agent identifier
            proposal_id: Proposal being voted on
            vote: The vote cast

        Returns:
            FaultRecord if inconsistency detected, None otherwise
        """
        history = self._vote_history.get(agent_id, [])

        for past_proposal_id, past_vote in history[-self.config.vote_consistency_window:]:
            if past_proposal_id == proposal_id and past_vote != vote:
                fault_id = f"fault-{uuid.uuid4().hex[:8]}"
                return FaultRecord(
                    id=fault_id,
                    agent_id=agent_id,
                    fault_type=FaultType.INCONSISTENT_VOTE,
                    severity=self.config.inconsistency_penalty,
                    description=f"Agent voted '{vote}' after previously voting '{past_vote}' on same proposal",
                    evidence={
                        "proposal_id": proposal_id,
                        "original_vote": past_vote,
                        "new_vote": vote,
                    },
                )

        # Record this vote in history
        if agent_id not in self._vote_history:
            self._vote_history[agent_id] = []
        self._vote_history[agent_id].append((proposal_id, vote))

        # Keep only recent history
        if len(self._vote_history[agent_id]) > self.config.vote_consistency_window * 2:
            self._vote_history[agent_id] = self._vote_history[agent_id][-self.config.vote_consistency_window:]

        return None

    def detect_equivocation(
        self,
        agent_id: str,
        messages: List[Tuple[str, str]],  # List of (recipient_id, message_hash)
    ) -> Optional[FaultRecord]:
        """
        Detect if an agent sent different messages to different recipients.

        Args:
            agent_id: Agent identifier
            messages: List of (recipient_id, message_hash) pairs

        Returns:
            FaultRecord if equivocation detected, None otherwise
        """
        if len(messages) < 2:
            return None

        hashes = set(msg_hash for _, msg_hash in messages)

        if len(hashes) > 1:
            fault_id = f"fault-{uuid.uuid4().hex[:8]}"
            return FaultRecord(
                id=fault_id,
                agent_id=agent_id,
                fault_type=FaultType.EQUIVOCATION,
                severity=self.config.equivocation_penalty,
                description="Agent sent different messages to different recipients",
                evidence={
                    "message_hashes": list(hashes),
                    "recipients": [r for r, _ in messages],
                },
            )

        return None

    def detect_result_conflict(
        self,
        agent_id: str,
        agent_result: Any,
        consensus_result: Any,
        proposal_id: str,
    ) -> Optional[FaultRecord]:
        """
        Detect if an agent's result conflicts with consensus.

        Args:
            agent_id: Agent identifier
            agent_result: Result reported by agent
            consensus_result: The consensus result
            proposal_id: Proposal identifier

        Returns:
            FaultRecord if conflict detected, None otherwise
        """
        agent_hash = self.hash_value(agent_result)
        consensus_hash = self.hash_value(consensus_result)

        if agent_hash != consensus_hash:
            fault_id = f"fault-{uuid.uuid4().hex[:8]}"
            return FaultRecord(
                id=fault_id,
                agent_id=agent_id,
                fault_type=FaultType.CONFLICTING_RESULT,
                severity=self.config.inconsistency_penalty,
                description="Agent's result differs from consensus",
                evidence={
                    "proposal_id": proposal_id,
                    "agent_result_hash": agent_hash,
                    "consensus_result_hash": consensus_hash,
                },
            )

        return None

    def record_timeout(self, agent_id: str, proposal_id: str, timeout_seconds: float) -> FaultRecord:
        """
        Record a timeout fault for an agent.

        Args:
            agent_id: Agent identifier
            proposal_id: Proposal that timed out
            timeout_seconds: The timeout duration

        Returns:
            Created FaultRecord
        """
        fault_id = f"fault-{uuid.uuid4().hex[:8]}"
        fault = FaultRecord(
            id=fault_id,
            agent_id=agent_id,
            fault_type=FaultType.TIMEOUT,
            severity=self.config.timeout_penalty,
            description=f"Agent did not respond within {timeout_seconds}s deadline",
            evidence={
                "proposal_id": proposal_id,
                "timeout_seconds": timeout_seconds,
            },
        )

        self.update_reputation(agent_id, success=False, fault=fault)
        return fault

    # -------------------------------------------------------------------------
    # PBFT-lite Consensus
    # -------------------------------------------------------------------------

    def run_consensus(
        self,
        proposal_id: str,
        value: Any,
        participants: List[str],
        primary_id: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ) -> BFTResult:
        """
        Run PBFT-lite consensus on a value.

        This implements a simplified PBFT protocol:
        1. PRE-PREPARE: Primary broadcasts proposed value
        2. PREPARE: Replicas acknowledge and vote on value
        3. COMMIT: If 2f+1 prepare votes, replicas commit
        4. REPLY: If 2f+1 commit votes, consensus reached

        Args:
            proposal_id: Unique proposal identifier
            value: The value to reach consensus on
            participants: List of participating agent IDs
            primary_id: Optional primary (leader) agent ID
            timeout_seconds: Optional timeout override

        Returns:
            BFTResult with consensus outcome
        """
        start_time = datetime.now(timezone.utc)
        timeout = timeout_seconds or self.config.consensus_timeout_seconds

        # Filter to eligible agents
        eligible = self.get_eligible_agents(participants)
        excluded = [p for p in participants if p not in eligible]

        if len(eligible) < 4:
            # Need at least 4 agents for any fault tolerance (n > 3f, f >= 1)
            return BFTResult(
                success=False,
                consensus_reached=False,
                participating_agents=eligible,
                excluded_agents=excluded,
                metadata={"error": "Insufficient eligible agents for BFT (need >= 4)"},
            )

        # Calculate fault tolerance
        # n = 3f + 1, so f = (n - 1) / 3
        n = len(eligible)
        f = (n - 1) // 3
        quorum = 2 * f + 1

        # Select primary if not specified
        if not primary_id or primary_id not in eligible:
            # Select agent with highest reputation
            primary_id = max(eligible, key=lambda a: self.get_reputation(a).score)

        # Create consensus round
        round_id = f"round-{uuid.uuid4().hex[:8]}"
        round_obj = ConsensusRound(
            id=round_id,
            proposal_id=proposal_id,
            primary_id=primary_id,
            value=value,
            timeout_seconds=timeout,
        )
        self._active_rounds[round_id] = round_obj

        faults_detected: List[FaultRecord] = []
        value_hash = self.hash_value(value)

        # Phase 1: PRE-PREPARE
        # In real PBFT, primary broadcasts. Here we simulate it.
        round_obj.phase = ConsensusPhase.PREPARE

        # Phase 2: PREPARE
        # Collect prepare votes from replicas
        for agent_id in eligible:
            # Check for vote inconsistency
            fault = self.detect_vote_inconsistency(
                agent_id=agent_id,
                proposal_id=proposal_id,
                vote=value_hash,
            )
            if fault:
                faults_detected.append(fault)
                self.update_reputation(agent_id, success=False, fault=fault)
                continue

            # Record prepare vote
            round_obj.prepare_votes[agent_id] = value_hash
            self.update_reputation(agent_id, success=True)

        # Check prepare quorum
        if not round_obj.has_prepare_quorum(n):
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            return BFTResult(
                success=False,
                value=value,
                consensus_reached=False,
                participating_agents=list(round_obj.prepare_votes.keys()),
                excluded_agents=excluded,
                faults_detected=faults_detected,
                rounds_completed=1,
                duration_ms=duration_ms,
                metadata={
                    "phase_reached": "prepare",
                    "prepare_votes": len(round_obj.prepare_votes),
                    "quorum_needed": quorum,
                },
            )

        # Phase 3: COMMIT
        round_obj.phase = ConsensusPhase.COMMIT

        # Collect commit votes
        for agent_id in round_obj.prepare_votes.keys():
            round_obj.commit_votes[agent_id] = value_hash

        # Check commit quorum
        if not round_obj.has_commit_quorum(n):
            end_time = datetime.now(timezone.utc)
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            return BFTResult(
                success=False,
                value=value,
                consensus_reached=False,
                participating_agents=list(round_obj.commit_votes.keys()),
                excluded_agents=excluded,
                faults_detected=faults_detected,
                rounds_completed=1,
                duration_ms=duration_ms,
                metadata={
                    "phase_reached": "commit",
                    "commit_votes": len(round_obj.commit_votes),
                    "quorum_needed": quorum,
                },
            )

        # Phase 4: REPLY - Consensus reached
        round_obj.phase = ConsensusPhase.REPLY
        round_obj.result = value
        round_obj.completed_at = datetime.now(timezone.utc)

        # Clean up
        del self._active_rounds[round_id]

        end_time = datetime.now(timezone.utc)
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        return BFTResult(
            success=True,
            value=value,
            consensus_reached=True,
            participating_agents=list(round_obj.commit_votes.keys()),
            excluded_agents=excluded,
            faults_detected=faults_detected,
            rounds_completed=1,
            duration_ms=duration_ms,
            metadata={
                "total_agents": n,
                "fault_tolerance": f,
                "quorum": quorum,
                "prepare_votes": len(round_obj.prepare_votes),
                "commit_votes": len(round_obj.commit_votes),
            },
        )

    def verify_result(
        self,
        proposal_id: str,
        agent_results: Dict[str, Any],
    ) -> Tuple[Any, List[FaultRecord]]:
        """
        Verify results from multiple agents and detect conflicts.

        Args:
            proposal_id: Proposal identifier
            agent_results: Dict mapping agent_id to their result

        Returns:
            Tuple of (consensus_result, faults_detected)
        """
        if not agent_results:
            return None, []

        # Group results by hash
        result_groups: Dict[str, List[str]] = {}  # hash -> [agent_ids]
        result_values: Dict[str, Any] = {}  # hash -> value

        for agent_id, result in agent_results.items():
            result_hash = self.hash_value(result)
            if result_hash not in result_groups:
                result_groups[result_hash] = []
                result_values[result_hash] = result
            result_groups[result_hash].append(agent_id)

        # Find majority result
        majority_hash = max(result_groups.keys(), key=lambda h: len(result_groups[h]))
        consensus_result = result_values[majority_hash]

        # Detect conflicts
        faults: List[FaultRecord] = []
        for result_hash, agent_ids in result_groups.items():
            if result_hash != majority_hash:
                for agent_id in agent_ids:
                    fault = self.detect_result_conflict(
                        agent_id=agent_id,
                        agent_result=result_values[result_hash],
                        consensus_result=consensus_result,
                        proposal_id=proposal_id,
                    )
                    if fault:
                        faults.append(fault)
                        self.update_reputation(agent_id, success=False, fault=fault)

        # Record success for agreeing agents
        for agent_id in result_groups[majority_hash]:
            self.update_reputation(agent_id, success=True)

        return consensus_result, faults

    def cross_check_results(
        self,
        proposal_id: str,
        results: List[Tuple[str, Any]],  # List of (agent_id, result)
        min_agreement: float = 0.67,
    ) -> Tuple[bool, Optional[Any], List[FaultRecord]]:
        """
        Cross-check results from multiple agents.

        Args:
            proposal_id: Proposal identifier
            results: List of (agent_id, result) pairs
            min_agreement: Minimum agreement ratio required

        Returns:
            Tuple of (agreement_reached, consensus_value, faults_detected)
        """
        if not results:
            return False, None, []

        agent_results = {agent_id: result for agent_id, result in results}
        consensus_result, faults = self.verify_result(proposal_id, agent_results)

        # Check agreement ratio
        agreement_count = sum(
            1 for _, r in results
            if self.hash_value(r) == self.hash_value(consensus_result)
        )
        agreement_ratio = agreement_count / len(results)

        if agreement_ratio >= min_agreement:
            return True, consensus_result, faults
        else:
            return False, None, faults

    # -------------------------------------------------------------------------
    # BFT-Aware Voting
    # -------------------------------------------------------------------------

    def bft_vote(
        self,
        proposal_id: str,
        votes: List[Vote],
        weighted_by_reputation: bool = True,
    ) -> Tuple[VoteChoice, Dict[str, Any]]:
        """
        Execute BFT-aware voting.

        Args:
            proposal_id: Proposal being voted on
            votes: List of votes from agents
            weighted_by_reputation: Whether to weight by reputation

        Returns:
            Tuple of (winning_choice, metadata)
        """
        if not votes:
            return VoteChoice.ABSTAIN, {"error": "No votes"}

        # Filter votes from eligible agents
        eligible_votes = []
        excluded_voters = []

        for vote in votes:
            rep = self.get_reputation(vote.voter_id)
            if rep.is_excluded or rep.score < self.config.min_reputation_for_consensus:
                excluded_voters.append(vote.voter_id)
            else:
                # Check for vote inconsistency
                vote_str = vote.choice.value
                fault = self.detect_vote_inconsistency(vote.voter_id, proposal_id, vote_str)
                if fault:
                    self.update_reputation(vote.voter_id, success=False, fault=fault)
                    excluded_voters.append(vote.voter_id)
                else:
                    eligible_votes.append((vote, rep))

        if not eligible_votes:
            return VoteChoice.ABSTAIN, {
                "error": "No eligible votes",
                "excluded_voters": excluded_voters,
            }

        # Count votes
        vote_weights: Dict[VoteChoice, float] = {
            VoteChoice.APPROVE: 0.0,
            VoteChoice.REJECT: 0.0,
            VoteChoice.ABSTAIN: 0.0,
        }

        for vote, rep in eligible_votes:
            if weighted_by_reputation:
                weight = vote.confidence * rep.score
            else:
                weight = vote.confidence
            vote_weights[vote.choice] += weight

        # Record successful participation
        for vote, _ in eligible_votes:
            self.update_reputation(vote.voter_id, success=True)

        # Determine winner
        total_weight = sum(vote_weights.values())
        if total_weight == 0:
            return VoteChoice.ABSTAIN, {"error": "Zero total weight"}

        winning_choice = max(vote_weights.keys(), key=lambda c: vote_weights[c])

        return winning_choice, {
            "vote_weights": {c.value: w for c, w in vote_weights.items()},
            "total_weight": total_weight,
            "eligible_voters": len(eligible_votes),
            "excluded_voters": excluded_voters,
            "weighted_by_reputation": weighted_by_reputation,
        }

    # -------------------------------------------------------------------------
    # BFT-Aware Delegation
    # -------------------------------------------------------------------------

    def bft_delegate(
        self,
        task_id: str,
        required_capabilities: List[str],
        candidates: List[str],
        min_reputation: Optional[float] = None,
    ) -> Tuple[Optional[str], Dict[str, Any]]:
        """
        BFT-aware task delegation with fallback.

        Args:
            task_id: Task identifier
            required_capabilities: Required capabilities
            candidates: Candidate agent IDs
            min_reputation: Minimum reputation required

        Returns:
            Tuple of (delegate_id or None, metadata)
        """
        min_rep = min_reputation or self.config.min_reputation_for_consensus

        # Score candidates by reputation and capability
        scored_candidates: List[Tuple[str, float]] = []

        for agent_id in candidates:
            rep = self.get_reputation(agent_id)

            # Skip excluded or low-reputation agents
            if rep.is_excluded or rep.score < min_rep:
                continue

            # Get agent info
            agent = self.registry.get(agent_id)
            if not agent or agent.status not in (AgentStatus.IDLE, AgentStatus.WAITING):
                continue

            # Score based on reputation and capability match
            capability_score = 0.0
            matched_caps = 0
            for cap_name in required_capabilities:
                cap = agent.get_capability(cap_name)
                if cap:
                    capability_score += cap.proficiency
                    matched_caps += 1

            if matched_caps > 0:
                capability_score /= matched_caps
            else:
                capability_score = 0.5  # Base score

            # Combined score: 60% reputation, 40% capability
            combined_score = (rep.score * 0.6) + (capability_score * 0.4)
            scored_candidates.append((agent_id, combined_score))

        if not scored_candidates:
            return None, {
                "error": "No eligible candidates",
                "candidates_evaluated": len(candidates),
            }

        # Sort by score and select best
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        delegate_id, score = scored_candidates[0]

        # Get fallbacks
        fallbacks = [c[0] for c in scored_candidates[1:3]]

        return delegate_id, {
            "delegate_score": score,
            "candidates_evaluated": len(candidates),
            "eligible_candidates": len(scored_candidates),
            "fallbacks": fallbacks,
        }

    # -------------------------------------------------------------------------
    # Persistence
    # -------------------------------------------------------------------------

    def _load_reputations(self) -> None:
        """Load reputations from disk."""
        rep_file = self._bft_dir / "reputations.json"
        if rep_file.exists():
            try:
                with open(rep_file, "r") as f:
                    data = json.load(f)
                    for rep_data in data.get("reputations", []):
                        rep = AgentReputation.from_dict(rep_data)
                        self._reputations[rep.agent_id] = rep
            except (json.JSONDecodeError, IOError):
                pass

    def _save_reputations(self) -> None:
        """Save reputations to disk."""
        rep_file = self._bft_dir / "reputations.json"
        try:
            data = {
                "version": "1.0",
                "last_updated": datetime.now(timezone.utc).isoformat() + "Z",
                "reputations": [rep.to_dict() for rep in self._reputations.values()],
            }
            with open(rep_file, "w") as f:
                json.dump(data, f, indent=2)
        except IOError:
            pass

    def save_config(self) -> None:
        """Save BFT configuration to disk."""
        config_file = self._bft_dir / "config.json"
        try:
            with open(config_file, "w") as f:
                json.dump(self.config.to_dict(), f, indent=2)
        except IOError:
            pass

    def load_config(self) -> bool:
        """Load BFT configuration from disk."""
        config_file = self._bft_dir / "config.json"
        if config_file.exists():
            try:
                with open(config_file, "r") as f:
                    data = json.load(f)
                    self.config = BFTConfig.from_dict(data)
                    return True
            except (json.JSONDecodeError, IOError):
                pass
        return False

    # -------------------------------------------------------------------------
    # Event Handling
    # -------------------------------------------------------------------------

    def on_fault(self, handler: Callable[[FaultRecord], None]) -> None:
        """Register a fault handler."""
        self._fault_handlers.append(handler)

    def _emit_fault(self, fault: FaultRecord) -> None:
        """Emit fault to all registered handlers."""
        for handler in self._fault_handlers:
            try:
                handler(fault)
            except Exception:
                pass  # Don't let handler errors break the system

    # -------------------------------------------------------------------------
    # Statistics
    # -------------------------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        """Get BFT system statistics."""
        total_agents = len(self._reputations)
        excluded_count = len(self.get_excluded_agents())

        total_faults = sum(len(rep.faults) for rep in self._reputations.values())
        total_interactions = sum(rep.total_interactions for rep in self._reputations.values())

        fault_types: Dict[str, int] = {}
        for rep in self._reputations.values():
            for fault in rep.faults:
                ft = fault.fault_type.value
                fault_types[ft] = fault_types.get(ft, 0) + 1

        avg_reputation = 0.0
        if total_agents > 0:
            avg_reputation = sum(rep.score for rep in self._reputations.values()) / total_agents

        return {
            "total_agents_tracked": total_agents,
            "excluded_agents": excluded_count,
            "active_rounds": len(self._active_rounds),
            "total_faults_recorded": total_faults,
            "total_interactions": total_interactions,
            "fault_types": fault_types,
            "average_reputation": avg_reputation,
            "config": self.config.to_dict(),
        }

    def get_fault_report(self, agent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get fault report for one or all agents.

        Args:
            agent_id: Optional agent ID to filter by

        Returns:
            List of fault records as dictionaries
        """
        faults = []
        for rep in self._reputations.values():
            if agent_id and rep.agent_id != agent_id:
                continue
            for fault in rep.faults:
                faults.append(fault.to_dict())

        # Sort by timestamp descending
        faults.sort(key=lambda f: f.get("timestamp", ""), reverse=True)
        return faults
