"""
Tests for Byzantine Fault Tolerance module.

Tests cover:
- Message authentication (HMAC)
- Reputation tracking
- Fault detection mechanisms
- PBFT-lite consensus
- BFT-aware voting and delegation
- Result verification and cross-checking
"""

import json
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from swarm.registry import AgentRegistry, AgentInfo, AgentStatus, AgentCapability
from swarm.messages import SwarmMessage, MessageType, Vote, VoteChoice
from swarm.bft import (
    ByzantineFaultTolerance,
    BFTConfig,
    BFTResult,
    AgentReputation,
    FaultRecord,
    FaultType,
    ConsensusPhase,
    ConsensusRound,
    AuthenticatedMessage,
)


@pytest.fixture
def temp_loki_dir():
    """Create a temporary .loki directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        loki_dir = Path(tmpdir) / ".loki"
        loki_dir.mkdir()
        yield loki_dir


@pytest.fixture
def registry(temp_loki_dir):
    """Create a test registry."""
    return AgentRegistry(temp_loki_dir)


@pytest.fixture
def bft(registry, temp_loki_dir):
    """Create a BFT system with test configuration."""
    config = BFTConfig(
        consensus_timeout_seconds=5.0,
        max_faults_before_exclusion=2,
    )
    return ByzantineFaultTolerance(
        registry=registry,
        loki_dir=temp_loki_dir,
        config=config,
        secret_key="test-secret-key",
    )


@pytest.fixture
def four_agents(registry):
    """Register four agents for BFT testing (minimum for f=1)."""
    agents = []
    for i in range(4):
        agent = registry.register(f"eng-backend")
        agents.append(agent)
    return agents


class TestMessageAuthentication:
    """Test message authentication with HMAC."""

    def test_create_authenticated_message(self, bft):
        """Test creating an authenticated message."""
        message = SwarmMessage.create(
            msg_type=MessageType.VOTE_REQUEST,
            sender_id="agent-1",
            payload={"question": "Test?"},
        )

        auth_msg = bft.create_authenticated_message(message)

        assert auth_msg.message.id == message.id
        assert auth_msg.mac  # MAC should be set
        assert auth_msg.nonce  # Nonce should be set
        assert auth_msg.timestamp > 0

    def test_verify_valid_message(self, bft):
        """Test verifying a valid authenticated message."""
        message = SwarmMessage.create(
            msg_type=MessageType.VOTE_RESPONSE,
            sender_id="agent-1",
            payload={"vote": "approve"},
        )

        auth_msg = bft.create_authenticated_message(message)
        is_valid, error = bft.verify_authenticated_message(auth_msg)

        assert is_valid is True
        assert error is None

    def test_reject_tampered_message(self, bft):
        """Test rejecting a tampered message."""
        message = SwarmMessage.create(
            msg_type=MessageType.VOTE_RESPONSE,
            sender_id="agent-1",
            payload={"vote": "approve"},
        )

        auth_msg = bft.create_authenticated_message(message)

        # Tamper with the message
        auth_msg.message.payload["vote"] = "reject"

        is_valid, error = bft.verify_authenticated_message(auth_msg)

        assert is_valid is False
        assert "tampered" in error.lower()

    def test_reject_replay_attack(self, bft):
        """Test rejecting replay attacks (same nonce)."""
        message = SwarmMessage.create(
            msg_type=MessageType.VOTE_RESPONSE,
            sender_id="agent-1",
            payload={"vote": "approve"},
        )

        auth_msg = bft.create_authenticated_message(message)

        # First verification should succeed
        is_valid1, _ = bft.verify_authenticated_message(auth_msg)
        assert is_valid1 is True

        # Replay should fail
        is_valid2, error = bft.verify_authenticated_message(auth_msg)
        assert is_valid2 is False
        assert "replay" in error.lower()

    def test_reject_old_message(self, bft):
        """Test rejecting messages that are too old."""
        message = SwarmMessage.create(
            msg_type=MessageType.VOTE_RESPONSE,
            sender_id="agent-1",
            payload={"vote": "approve"},
        )

        auth_msg = bft.create_authenticated_message(message)

        # Make message appear old
        auth_msg.timestamp = time.time() - 120  # 2 minutes ago

        # Recreate MAC for old timestamp (simulating actual old message)
        msg_data = json.dumps({
            "message": auth_msg.message.to_dict(),
            "nonce": auth_msg.nonce,
            "timestamp": auth_msg.timestamp,
        }, sort_keys=True)

        import hmac
        import hashlib
        auth_msg.mac = hmac.new(
            b"test-secret-key",
            msg_data.encode(),
            hashlib.sha256
        ).hexdigest()

        is_valid, error = bft.verify_authenticated_message(auth_msg)
        assert is_valid is False
        assert "old" in error.lower()

    def test_hash_value(self, bft):
        """Test value hashing for comparison."""
        value1 = {"key": "value", "number": 42}
        value2 = {"key": "value", "number": 42}
        value3 = {"key": "different", "number": 42}

        hash1 = bft.hash_value(value1)
        hash2 = bft.hash_value(value2)
        hash3 = bft.hash_value(value3)

        assert hash1 == hash2  # Same content, same hash
        assert hash1 != hash3  # Different content, different hash
        assert len(hash1) == 16  # Truncated hash


class TestReputationManagement:
    """Test agent reputation tracking."""

    def test_initial_reputation(self, bft, four_agents):
        """Test that new agents start with full reputation."""
        rep = bft.get_reputation(four_agents[0].id)

        assert rep.score == 1.0
        assert rep.total_interactions == 0
        assert rep.is_excluded is False

    def test_record_success(self, bft, four_agents):
        """Test recording successful interactions."""
        agent_id = four_agents[0].id

        bft.update_reputation(agent_id, success=True)
        rep = bft.get_reputation(agent_id)

        assert rep.total_interactions == 1
        assert rep.successful_interactions == 1
        assert rep.score == 1.0  # Still full score

    def test_record_fault(self, bft, four_agents):
        """Test recording faults reduces reputation."""
        agent_id = four_agents[0].id

        fault = FaultRecord(
            id="fault-1",
            agent_id=agent_id,
            fault_type=FaultType.TIMEOUT,
            severity=0.3,
            description="Test timeout",
        )

        bft.update_reputation(agent_id, success=False, fault=fault)
        rep = bft.get_reputation(agent_id)

        assert rep.total_interactions == 1
        assert rep.successful_interactions == 0
        assert rep.score < 1.0
        assert len(rep.faults) == 1

    def test_exclusion_on_low_score(self, bft, four_agents):
        """Test that agents with low scores get excluded."""
        agent_id = four_agents[0].id
        config = bft.config

        # Record multiple severe faults
        for i in range(5):
            fault = FaultRecord(
                id=f"fault-{i}",
                agent_id=agent_id,
                fault_type=FaultType.EQUIVOCATION,
                severity=0.5,  # High severity
                description="Test fault",
            )
            bft.update_reputation(agent_id, success=False, fault=fault)

        rep = bft.get_reputation(agent_id)
        assert rep.is_excluded is True
        assert rep.exclusion_reason is not None

    def test_rehabilitation(self, bft, four_agents):
        """Test agent rehabilitation after exclusion."""
        agent_id = four_agents[0].id

        # Exclude the agent
        rep = bft.get_reputation(agent_id)
        rep.is_excluded = True
        rep.exclusion_reason = "Test exclusion"
        rep.score = 0.6  # Above rehabilitation threshold

        # Attempt rehabilitation
        result = bft.rehabilitate_agent(agent_id)

        assert result is True
        rep = bft.get_reputation(agent_id)
        assert rep.is_excluded is False
        assert rep.exclusion_reason is None

    def test_get_eligible_agents(self, bft, four_agents):
        """Test filtering to eligible agents only."""
        agent_ids = [a.id for a in four_agents]

        # Exclude one agent
        bft.get_reputation(agent_ids[0]).is_excluded = True

        # Lower another's reputation
        bft.get_reputation(agent_ids[1]).score = 0.1

        eligible = bft.get_eligible_agents(agent_ids)

        assert len(eligible) == 2
        assert agent_ids[0] not in eligible
        assert agent_ids[1] not in eligible


class TestFaultDetection:
    """Test fault detection mechanisms."""

    def test_detect_vote_inconsistency(self, bft, four_agents):
        """Test detecting inconsistent votes."""
        agent_id = four_agents[0].id
        proposal_id = "proposal-1"

        # First vote
        fault1 = bft.detect_vote_inconsistency(agent_id, proposal_id, "approve")
        assert fault1 is None  # First vote is fine

        # Inconsistent second vote
        fault2 = bft.detect_vote_inconsistency(agent_id, proposal_id, "reject")
        assert fault2 is not None
        assert fault2.fault_type == FaultType.INCONSISTENT_VOTE
        assert "approve" in fault2.evidence["original_vote"]
        assert "reject" in fault2.evidence["new_vote"]

    def test_detect_equivocation(self, bft, four_agents):
        """Test detecting equivocation (different messages to different recipients)."""
        agent_id = four_agents[0].id

        messages = [
            ("agent-1", "hash-abc"),
            ("agent-2", "hash-xyz"),  # Different hash!
        ]

        fault = bft.detect_equivocation(agent_id, messages)

        assert fault is not None
        assert fault.fault_type == FaultType.EQUIVOCATION

    def test_no_equivocation_on_same_messages(self, bft, four_agents):
        """Test that same messages to different recipients is OK."""
        agent_id = four_agents[0].id

        messages = [
            ("agent-1", "hash-abc"),
            ("agent-2", "hash-abc"),  # Same hash
        ]

        fault = bft.detect_equivocation(agent_id, messages)
        assert fault is None

    def test_detect_result_conflict(self, bft, four_agents):
        """Test detecting conflicting results."""
        agent_id = four_agents[0].id

        fault = bft.detect_result_conflict(
            agent_id=agent_id,
            agent_result={"status": "success"},
            consensus_result={"status": "failure"},
            proposal_id="proposal-1",
        )

        assert fault is not None
        assert fault.fault_type == FaultType.CONFLICTING_RESULT

    def test_no_conflict_on_matching_results(self, bft, four_agents):
        """Test that matching results don't trigger fault."""
        agent_id = four_agents[0].id

        fault = bft.detect_result_conflict(
            agent_id=agent_id,
            agent_result={"status": "success"},
            consensus_result={"status": "success"},
            proposal_id="proposal-1",
        )

        assert fault is None

    def test_record_timeout(self, bft, four_agents):
        """Test recording timeout faults."""
        agent_id = four_agents[0].id

        fault = bft.record_timeout(agent_id, "proposal-1", 30.0)

        assert fault.fault_type == FaultType.TIMEOUT
        assert fault.severity == bft.config.timeout_penalty

        rep = bft.get_reputation(agent_id)
        assert len(rep.faults) == 1


class TestPBFTConsensus:
    """Test PBFT-lite consensus protocol."""

    def test_successful_consensus(self, bft, four_agents):
        """Test successful consensus with 4 agents (tolerates 1 fault)."""
        participants = [a.id for a in four_agents]

        result = bft.run_consensus(
            proposal_id="proposal-1",
            value="TypeScript",
            participants=participants,
        )

        assert result.success is True
        assert result.consensus_reached is True
        assert result.value == "TypeScript"
        assert len(result.participating_agents) >= 3  # At least 2f+1

    def test_consensus_needs_minimum_agents(self, bft, registry):
        """Test that consensus requires at least 4 agents."""
        # Register only 3 agents
        agents = [registry.register("eng-backend") for _ in range(3)]
        participants = [a.id for a in agents]

        result = bft.run_consensus(
            proposal_id="proposal-1",
            value="TypeScript",
            participants=participants,
        )

        assert result.success is False
        assert result.consensus_reached is False
        assert "Insufficient" in result.metadata.get("error", "")

    def test_consensus_excludes_bad_actors(self, bft, four_agents):
        """Test that excluded agents don't participate in consensus."""
        participants = [a.id for a in four_agents]

        # Exclude one agent
        bft.get_reputation(participants[0]).is_excluded = True

        result = bft.run_consensus(
            proposal_id="proposal-1",
            value="TypeScript",
            participants=participants,
        )

        # Should fail - only 3 eligible agents
        assert result.success is False
        assert participants[0] in result.excluded_agents

    def test_consensus_fault_tolerance(self, bft, registry):
        """Test fault tolerance calculation."""
        # 7 agents = tolerates 2 faults (n > 3f, f = 2)
        agents = [registry.register("eng-backend") for _ in range(7)]
        participants = [a.id for a in agents]

        result = bft.run_consensus(
            proposal_id="proposal-1",
            value="Go",
            participants=participants,
        )

        assert result.success is True
        assert result.metadata["fault_tolerance"] == 2
        assert result.metadata["quorum"] == 5  # 2*2 + 1


class TestResultVerification:
    """Test result verification and cross-checking."""

    def test_verify_unanimous_results(self, bft, four_agents):
        """Test verifying unanimous agent results."""
        agent_results = {
            four_agents[0].id: {"answer": 42},
            four_agents[1].id: {"answer": 42},
            four_agents[2].id: {"answer": 42},
            four_agents[3].id: {"answer": 42},
        }

        consensus, faults = bft.verify_result("proposal-1", agent_results)

        assert consensus == {"answer": 42}
        assert len(faults) == 0

    def test_verify_with_one_conflict(self, bft, four_agents):
        """Test verifying results with one conflicting agent."""
        agent_results = {
            four_agents[0].id: {"answer": 42},
            four_agents[1].id: {"answer": 42},
            four_agents[2].id: {"answer": 42},
            four_agents[3].id: {"answer": 99},  # Different!
        }

        consensus, faults = bft.verify_result("proposal-1", agent_results)

        assert consensus == {"answer": 42}  # Majority wins
        assert len(faults) == 1
        assert faults[0].agent_id == four_agents[3].id

    def test_cross_check_with_agreement(self, bft, four_agents):
        """Test cross-checking with sufficient agreement."""
        results = [
            (four_agents[0].id, "success"),
            (four_agents[1].id, "success"),
            (four_agents[2].id, "success"),
            (four_agents[3].id, "failure"),
        ]

        agreed, value, faults = bft.cross_check_results(
            "proposal-1", results, min_agreement=0.67
        )

        assert agreed is True
        assert value == "success"
        assert len(faults) == 1

    def test_cross_check_without_agreement(self, bft, four_agents):
        """Test cross-checking without sufficient agreement."""
        results = [
            (four_agents[0].id, "a"),
            (four_agents[1].id, "b"),
            (four_agents[2].id, "c"),
            (four_agents[3].id, "d"),
        ]

        agreed, value, faults = bft.cross_check_results(
            "proposal-1", results, min_agreement=0.67
        )

        assert agreed is False
        assert value is None


class TestBFTVoting:
    """Test BFT-aware voting."""

    def test_bft_vote_weighted(self, bft, four_agents):
        """Test BFT-aware voting with reputation weighting."""
        # Set different reputations
        bft.get_reputation(four_agents[0].id).score = 1.0
        bft.get_reputation(four_agents[1].id).score = 1.0
        bft.get_reputation(four_agents[2].id).score = 0.5  # Lower reputation
        bft.get_reputation(four_agents[3].id).score = 0.5

        votes = [
            Vote(voter_id=four_agents[0].id, choice=VoteChoice.APPROVE, confidence=1.0),
            Vote(voter_id=four_agents[1].id, choice=VoteChoice.APPROVE, confidence=1.0),
            Vote(voter_id=four_agents[2].id, choice=VoteChoice.REJECT, confidence=1.0),
            Vote(voter_id=four_agents[3].id, choice=VoteChoice.REJECT, confidence=1.0),
        ]

        choice, metadata = bft.bft_vote("proposal-1", votes, weighted_by_reputation=True)

        # High reputation approvers should win
        assert choice == VoteChoice.APPROVE
        assert metadata["weighted_by_reputation"] is True

    def test_bft_vote_excludes_bad_agents(self, bft, four_agents):
        """Test that excluded agents' votes don't count."""
        # Exclude one agent
        bft.get_reputation(four_agents[0].id).is_excluded = True

        votes = [
            Vote(voter_id=four_agents[0].id, choice=VoteChoice.APPROVE, confidence=1.0),
            Vote(voter_id=four_agents[1].id, choice=VoteChoice.REJECT, confidence=1.0),
            Vote(voter_id=four_agents[2].id, choice=VoteChoice.REJECT, confidence=1.0),
            Vote(voter_id=four_agents[3].id, choice=VoteChoice.REJECT, confidence=1.0),
        ]

        choice, metadata = bft.bft_vote("proposal-1", votes)

        assert choice == VoteChoice.REJECT  # Excluded vote doesn't count
        assert four_agents[0].id in metadata["excluded_voters"]


class TestBFTDelegation:
    """Test BFT-aware task delegation."""

    def test_bft_delegate_by_reputation(self, bft, four_agents):
        """Test delegation prefers higher reputation agents."""
        # Set reputations
        bft.get_reputation(four_agents[0].id).score = 0.9
        bft.get_reputation(four_agents[1].id).score = 0.5
        bft.get_reputation(four_agents[2].id).score = 0.3
        bft.get_reputation(four_agents[3].id).score = 0.4

        delegate_id, metadata = bft.bft_delegate(
            task_id="task-1",
            required_capabilities=[],
            candidates=[a.id for a in four_agents],
        )

        # Should pick highest reputation agent
        assert delegate_id == four_agents[0].id
        assert len(metadata["fallbacks"]) > 0

    def test_bft_delegate_skips_excluded(self, bft, four_agents):
        """Test delegation skips excluded agents."""
        # Set high reputation but exclude
        bft.get_reputation(four_agents[0].id).score = 1.0
        bft.get_reputation(four_agents[0].id).is_excluded = True

        bft.get_reputation(four_agents[1].id).score = 0.5

        delegate_id, metadata = bft.bft_delegate(
            task_id="task-1",
            required_capabilities=[],
            candidates=[a.id for a in four_agents],
        )

        # Should not pick excluded agent
        assert delegate_id != four_agents[0].id


class TestPersistence:
    """Test BFT state persistence."""

    def test_save_and_load_reputations(self, registry, temp_loki_dir):
        """Test that reputations are persisted correctly."""
        bft1 = ByzantineFaultTolerance(registry, temp_loki_dir)

        # Create reputation
        agent = registry.register("eng-backend")
        fault = FaultRecord(
            id="fault-1",
            agent_id=agent.id,
            fault_type=FaultType.TIMEOUT,
            severity=0.3,
            description="Test",
        )
        bft1.update_reputation(agent.id, success=False, fault=fault)

        # Create new BFT instance and verify loaded
        bft2 = ByzantineFaultTolerance(registry, temp_loki_dir)
        rep = bft2.get_reputation(agent.id)

        assert len(rep.faults) == 1
        assert rep.faults[0].id == "fault-1"

    def test_save_and_load_config(self, registry, temp_loki_dir):
        """Test configuration persistence."""
        config = BFTConfig(
            min_reputation_for_consensus=0.5,
            exclusion_threshold=0.3,
        )
        bft1 = ByzantineFaultTolerance(registry, temp_loki_dir, config=config)
        bft1.save_config()

        # Load config in new instance
        bft2 = ByzantineFaultTolerance(registry, temp_loki_dir)
        bft2.load_config()

        assert bft2.config.min_reputation_for_consensus == 0.5
        assert bft2.config.exclusion_threshold == 0.3


class TestStatistics:
    """Test BFT statistics and reporting."""

    def test_get_stats(self, bft, four_agents):
        """Test getting BFT statistics."""
        # Record some activity
        bft.update_reputation(four_agents[0].id, success=True)
        bft.update_reputation(four_agents[1].id, success=True)

        fault = FaultRecord(
            id="fault-1",
            agent_id=four_agents[2].id,
            fault_type=FaultType.TIMEOUT,
            severity=0.2,
            description="Test",
        )
        bft.update_reputation(four_agents[2].id, success=False, fault=fault)

        stats = bft.get_stats()

        assert stats["total_agents_tracked"] == 3
        assert stats["total_interactions"] == 3
        assert stats["total_faults_recorded"] == 1
        assert "timeout" in stats["fault_types"]

    def test_get_fault_report(self, bft, four_agents):
        """Test getting fault reports."""
        # Record faults
        for i, agent in enumerate(four_agents[:2]):
            fault = FaultRecord(
                id=f"fault-{i}",
                agent_id=agent.id,
                fault_type=FaultType.TIMEOUT if i == 0 else FaultType.EQUIVOCATION,
                severity=0.3,
                description=f"Test fault {i}",
            )
            bft.update_reputation(agent.id, success=False, fault=fault)

        # Get all faults
        all_faults = bft.get_fault_report()
        assert len(all_faults) == 2

        # Get faults for specific agent
        agent_faults = bft.get_fault_report(four_agents[0].id)
        assert len(agent_faults) == 1


class TestEventHandling:
    """Test fault event handling."""

    def test_fault_handler_called(self, bft, four_agents):
        """Test that fault handlers are called."""
        received_faults = []

        def handler(fault):
            received_faults.append(fault)

        bft.on_fault(handler)

        fault = FaultRecord(
            id="fault-1",
            agent_id=four_agents[0].id,
            fault_type=FaultType.TIMEOUT,
            severity=0.3,
            description="Test",
        )
        bft.update_reputation(four_agents[0].id, success=False, fault=fault)

        assert len(received_faults) == 1
        assert received_faults[0].id == "fault-1"

    def test_fault_handler_exception_does_not_break(self, bft, four_agents):
        """Test that handler exceptions don't break the system."""
        def bad_handler(fault):
            raise RuntimeError("Handler error")

        bft.on_fault(bad_handler)

        fault = FaultRecord(
            id="fault-1",
            agent_id=four_agents[0].id,
            fault_type=FaultType.TIMEOUT,
            severity=0.3,
            description="Test",
        )

        # Should not raise
        bft.update_reputation(four_agents[0].id, success=False, fault=fault)


class TestDataclasses:
    """Test dataclass serialization."""

    def test_fault_record_serialization(self):
        """Test FaultRecord to/from dict."""
        fault = FaultRecord(
            id="fault-1",
            agent_id="agent-1",
            fault_type=FaultType.INCONSISTENT_VOTE,
            severity=0.5,
            description="Test fault",
            evidence={"key": "value"},
        )

        data = fault.to_dict()
        restored = FaultRecord.from_dict(data)

        assert restored.id == fault.id
        assert restored.agent_id == fault.agent_id
        assert restored.fault_type == fault.fault_type
        assert restored.severity == fault.severity
        assert restored.evidence == fault.evidence

    def test_agent_reputation_serialization(self):
        """Test AgentReputation to/from dict."""
        rep = AgentReputation(
            agent_id="agent-1",
            score=0.85,
            total_interactions=10,
            successful_interactions=8,
            is_excluded=False,
        )

        data = rep.to_dict()
        restored = AgentReputation.from_dict(data)

        assert restored.agent_id == rep.agent_id
        assert restored.score == rep.score
        assert restored.total_interactions == rep.total_interactions
        assert restored.is_excluded == rep.is_excluded

    def test_bft_config_serialization(self):
        """Test BFTConfig to/from dict."""
        config = BFTConfig(
            min_reputation_for_consensus=0.4,
            consensus_timeout_seconds=60.0,
            max_faults_before_exclusion=5,
        )

        data = config.to_dict()
        restored = BFTConfig.from_dict(data)

        assert restored.min_reputation_for_consensus == config.min_reputation_for_consensus
        assert restored.consensus_timeout_seconds == config.consensus_timeout_seconds
        assert restored.max_faults_before_exclusion == config.max_faults_before_exclusion

    def test_consensus_round_serialization(self):
        """Test ConsensusRound serialization."""
        round_obj = ConsensusRound(
            id="round-1",
            proposal_id="prop-1",
            phase=ConsensusPhase.PREPARE,
            primary_id="agent-1",
            value={"key": "value"},
            timeout_seconds=30.0,
        )
        round_obj.prepare_votes = {"agent-1": "hash1", "agent-2": "hash1"}

        data = round_obj.to_dict()

        assert data["id"] == "round-1"
        assert data["phase"] == "prepare"
        assert len(data["prepare_votes"]) == 2


class TestConsensusRound:
    """Test ConsensusRound helper methods."""

    def test_is_timed_out(self):
        """Test timeout detection."""
        round_obj = ConsensusRound(
            id="round-1",
            proposal_id="prop-1",
            timeout_seconds=0.1,  # Very short
        )

        assert round_obj.is_timed_out() is False

        time.sleep(0.15)
        assert round_obj.is_timed_out() is True

    def test_has_prepare_quorum(self):
        """Test prepare quorum calculation."""
        round_obj = ConsensusRound(
            id="round-1",
            proposal_id="prop-1",
        )

        # For 4 agents, need 3 votes (2*1 + 1)
        round_obj.prepare_votes = {"a": "h", "b": "h"}
        assert round_obj.has_prepare_quorum(4) is False

        round_obj.prepare_votes = {"a": "h", "b": "h", "c": "h"}
        assert round_obj.has_prepare_quorum(4) is True

    def test_has_commit_quorum(self):
        """Test commit quorum calculation."""
        round_obj = ConsensusRound(
            id="round-1",
            proposal_id="prop-1",
        )

        # For 7 agents, need 5 votes (2*2 + 1)
        round_obj.commit_votes = {"a": "h", "b": "h", "c": "h", "d": "h"}
        assert round_obj.has_commit_quorum(7) is False

        round_obj.commit_votes = {"a": "h", "b": "h", "c": "h", "d": "h", "e": "h"}
        assert round_obj.has_commit_quorum(7) is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
