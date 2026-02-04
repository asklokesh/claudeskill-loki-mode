#!/usr/bin/env bash
# Test suite for swarm intelligence patterns
# Tests: registry, voting, consensus, delegation, emergence

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test directory
TEST_DIR=$(mktemp -d)
TEST_LOKI_DIR="$TEST_DIR/.loki"

cleanup() {
    rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

log_test() {
    echo -e "\n${YELLOW}TEST:${NC} $1"
    TESTS_RUN=$((TESTS_RUN + 1))
}

pass() {
    echo -e "${GREEN}PASS${NC}: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}FAIL${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Setup Python path
export PYTHONPATH="$PROJECT_ROOT:${PYTHONPATH:-}"

# ============================================================================
# Test: Module Import
# ============================================================================
log_test "Module imports successfully"

python3 << 'PYTHON'
import sys
sys.path.insert(0, '.')
try:
    from swarm import (
        SwarmCoordinator,
        SwarmConfig,
        AgentRegistry,
        AgentInfo,
        VotingPattern,
        ConsensusPattern,
        DelegationPattern,
        EmergencePattern,
        Vote,
        VoteChoice,
        Proposal,
        TaskAssignment,
    )
    print("All imports successful")
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)
PYTHON

if [ $? -eq 0 ]; then
    pass "Module imports work"
else
    fail "Module imports failed"
fi

# ============================================================================
# Test: Agent Registry
# ============================================================================
log_test "Agent registry - register and lookup"

python3 << PYTHON
import sys
import tempfile
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry, AgentInfo, AgentStatus, AGENT_TYPES

# Create temp dir
loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)

# Test registration
agent = registry.register("eng-frontend")
assert agent.agent_type == "eng-frontend", "Wrong agent type"
assert agent.swarm == "engineering", "Wrong swarm"
assert len(agent.capabilities) > 0, "No capabilities"
print(f"Registered agent: {agent.id}")

# Test lookup by ID
found = registry.get(agent.id)
assert found is not None, "Agent not found"
assert found.id == agent.id, "Wrong agent ID"
print(f"Found agent by ID: {found.id}")

# Test lookup by type
by_type = registry.get_by_type("eng-frontend")
assert len(by_type) == 1, "Wrong count by type"
print(f"Found {len(by_type)} agents by type")

# Test available agents
available = registry.get_available()
assert len(available) == 1, "Wrong available count"
print(f"Found {len(available)} available agents")

# Test stats
stats = registry.get_stats()
assert stats["total_agents"] == 1, "Wrong total count"
print(f"Stats: {stats}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Agent registry operations work"
else
    fail "Agent registry failed"
fi

# ============================================================================
# Test: Agent Capabilities
# ============================================================================
log_test "Agent capabilities - lookup and matching"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry, AGENT_CAPABILITIES

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)

# Clear previous state
registry.clear()

# Register multiple agent types
frontend = registry.register("eng-frontend")
backend = registry.register("eng-backend")
qa = registry.register("eng-qa")

# Test capability lookup
assert frontend.has_capability("react"), "Frontend should have react"
assert frontend.has_capability("typescript"), "Frontend should have typescript"
assert not frontend.has_capability("python"), "Frontend should not have python"

assert backend.has_capability("python"), "Backend should have python"
assert backend.has_capability("graphql"), "Backend should have graphql"

assert qa.has_capability("playwright"), "QA should have playwright"

print("Capability lookups correct")

# Test find by capability
react_agents = registry.get_by_capability("react")
assert len(react_agents) == 1, f"Expected 1 react agent, got {len(react_agents)}"
assert react_agents[0].agent_type == "eng-frontend", "Wrong agent has react"

python_agents = registry.get_by_capability("python")
assert len(python_agents) == 1, f"Expected 1 python agent, got {len(python_agents)}"

print("Find by capability correct")

# Test best agent finding
best = registry.find_best_agent(["react", "typescript"])
assert best is not None, "Should find best agent"
assert best.agent_type == "eng-frontend", "Best should be frontend"
print(f"Best agent for React/TS: {best.agent_type}")

# Test with multiple required capabilities
best2 = registry.find_best_agent(["python", "rest"])
assert best2 is not None, "Should find backend agent"
assert best2.agent_type == "eng-backend", "Best should be backend"
print(f"Best agent for Python/REST: {best2.agent_type}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Agent capabilities work"
else
    fail "Agent capabilities failed"
fi

# ============================================================================
# Test: Voting Pattern
# ============================================================================
log_test "Voting pattern - basic voting"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry
from swarm.patterns import VotingPattern, VotingResult
from swarm.messages import Vote, VoteChoice

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)

# Get existing agents
agents = registry.list_all()
print(f"Using {len(agents)} agents for voting")

pattern = VotingPattern(
    registry=registry,
    quorum_percent=0.5,
    approval_threshold=0.5,
)

# Test unanimous approval
votes = [
    Vote(voter_id=agents[0].id, choice=VoteChoice.APPROVE, confidence=0.9),
    Vote(voter_id=agents[1].id, choice=VoteChoice.APPROVE, confidence=0.8),
    Vote(voter_id=agents[2].id, choice=VoteChoice.APPROVE, confidence=0.7),
]

result = pattern.execute({
    "question": "Should we use TypeScript?",
    "voters": [a.id for a in agents],
    "votes": votes,
})

assert result.success, "Voting should succeed"
assert result.decision == "approved", f"Expected approved, got {result.decision}"
assert result.unanimous, "Should be unanimous"
assert result.quorum_reached, "Quorum should be reached"
print(f"Unanimous vote: {result.decision}")

# Test rejection
votes2 = [
    Vote(voter_id=agents[0].id, choice=VoteChoice.REJECT, confidence=0.9),
    Vote(voter_id=agents[1].id, choice=VoteChoice.REJECT, confidence=0.8),
    Vote(voter_id=agents[2].id, choice=VoteChoice.APPROVE, confidence=0.5),
]

result2 = pattern.execute({
    "question": "Should we use CoffeeScript?",
    "voters": [a.id for a in agents],
    "votes": votes2,
})

assert result2.decision == "rejected", f"Expected rejected, got {result2.decision}"
print(f"Majority reject: {result2.decision}")

# Test no quorum
votes3 = [
    Vote(voter_id=agents[0].id, choice=VoteChoice.APPROVE, confidence=0.9),
]

result3 = pattern.execute({
    "question": "Should we rewrite everything?",
    "voters": [a.id for a in agents],
    "votes": votes3,
})

assert result3.decision == "no_quorum", f"Expected no_quorum, got {result3.decision}"
print(f"No quorum: {result3.decision}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Voting pattern works"
else
    fail "Voting pattern failed"
fi

# ============================================================================
# Test: Weighted Voting
# ============================================================================
log_test "Voting pattern - weighted voting"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry
from swarm.patterns import VotingPattern
from swarm.messages import Vote, VoteChoice

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)
agents = registry.list_all()

# Weighted pattern
pattern = VotingPattern(
    registry=registry,
    quorum_percent=0.5,
    approval_threshold=0.5,
    weighted=True,
)

# High confidence reject vs low confidence approves
votes = [
    Vote(voter_id=agents[0].id, choice=VoteChoice.REJECT, confidence=0.95),
    Vote(voter_id=agents[1].id, choice=VoteChoice.APPROVE, confidence=0.3),
    Vote(voter_id=agents[2].id, choice=VoteChoice.APPROVE, confidence=0.2),
]

result = pattern.execute({
    "question": "Weighted test",
    "voters": [a.id for a in agents],
    "votes": votes,
})

# Even with 2 approves vs 1 reject, high confidence reject should win
# Total weight: 0.95 + 0.3 + 0.2 = 1.45
# Approve weight: 0.3 + 0.2 = 0.5
# Approve ratio: 0.5 / 1.45 = 0.345 < 0.5
assert result.decision == "rejected", f"Weighted should reject, got {result.decision}"
print(f"Weighted voting respects confidence: {result.decision}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Weighted voting works"
else
    fail "Weighted voting failed"
fi

# ============================================================================
# Test: Consensus Pattern
# ============================================================================
log_test "Consensus pattern - building consensus"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry
from swarm.patterns import ConsensusPattern
from swarm.messages import Proposal

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)
agents = registry.list_all()

pattern = ConsensusPattern(
    registry=registry,
    consensus_threshold=0.67,  # Need 67% support
    max_rounds=3,
)

# Create proposal
proposal = Proposal.create(
    proposer_id=agents[0].id,
    title="Use React for frontend",
    description="Propose using React.js for the frontend implementation",
    options=["React", "Vue", "Svelte"],
)

# Round 1: Strong support
responses = {
    agents[0].id: "support",
    agents[1].id: "support",
    agents[2].id: "oppose",
}

result = pattern.execute({
    "proposal": proposal,
    "participants": [a.id for a in agents],
    "responses": responses,
    "round": 1,
})

# 2/3 = 66.7%, just under 67% threshold
assert not result.consensus_reached, "Should not reach consensus at 66.7%"
print(f"Round 1: support={result.support_level:.1%}, reached={result.consensus_reached}")

# Round 2: More support
proposal2 = Proposal.create(
    proposer_id=agents[0].id,
    title="Use React for frontend v2",
    description="Revised proposal",
)

responses2 = {
    agents[0].id: "support",
    agents[1].id: "support",
    agents[2].id: "support",
}

result2 = pattern.execute({
    "proposal": proposal2,
    "participants": [a.id for a in agents],
    "responses": responses2,
    "round": 2,
})

assert result2.consensus_reached, "Should reach consensus at 100%"
assert result2.support_level == 1.0, f"Support should be 100%, got {result2.support_level}"
print(f"Round 2: support={result2.support_level:.1%}, reached={result2.consensus_reached}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Consensus pattern works"
else
    fail "Consensus pattern failed"
fi

# ============================================================================
# Test: Delegation Pattern
# ============================================================================
log_test "Delegation pattern - task assignment"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry
from swarm.patterns import DelegationPattern
from swarm.messages import TaskAssignment

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)

# Register fresh agents for this test
registry.clear()
frontend = registry.register("eng-frontend")
backend = registry.register("eng-backend")
qa = registry.register("eng-qa")

pattern = DelegationPattern(
    registry=registry,
    capability_match_threshold=0.5,
    consider_load=True,
)

# Test React task delegation
assignment = TaskAssignment.create(
    task_id="task-001",
    delegator_id="orch-001",
    task_type="ui-component",
    description="Build React login form",
    required_capabilities=["react", "typescript"],
)

result = pattern.execute({
    "assignment": assignment,
})

assert result.delegated, "Task should be delegated"
assert result.delegate_id == frontend.id, f"Should delegate to frontend, got {result.delegate_id}"
assert not result.fallback_used, "Should not need fallback"
print(f"React task delegated to: {result.delegate_id}")

# Test Python task delegation
assignment2 = TaskAssignment.create(
    task_id="task-002",
    delegator_id="orch-001",
    task_type="api-endpoint",
    description="Build REST API endpoint",
    required_capabilities=["python", "rest"],
)

result2 = pattern.execute({
    "assignment": assignment2,
})

assert result2.delegated, "Task should be delegated"
assert result2.delegate_id == backend.id, f"Should delegate to backend, got {result2.delegate_id}"
print(f"Python task delegated to: {result2.delegate_id}")

# Test testing task
assignment3 = TaskAssignment.create(
    task_id="task-003",
    delegator_id="orch-001",
    task_type="e2e-test",
    description="Write E2E tests",
    required_capabilities=["playwright", "e2e-testing"],
)

result3 = pattern.execute({
    "assignment": assignment3,
})

assert result3.delegated, "Task should be delegated"
assert result3.delegate_id == qa.id, f"Should delegate to QA, got {result3.delegate_id}"
print(f"Testing task delegated to: {result3.delegate_id}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Delegation pattern works"
else
    fail "Delegation pattern failed"
fi

# ============================================================================
# Test: Delegation Fallback
# ============================================================================
log_test "Delegation pattern - fallback behavior"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry
from swarm.patterns import DelegationPattern
from swarm.messages import TaskAssignment

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)

# Use existing agents
agents = registry.list_all()
assert len(agents) >= 1, "Need at least one agent"

pattern = DelegationPattern(
    registry=registry,
    capability_match_threshold=0.9,  # Very high threshold
    consider_load=True,
    allow_fallback=True,
)

# Task with impossible requirements
assignment = TaskAssignment.create(
    task_id="task-fallback",
    delegator_id="orch-001",
    task_type="quantum-computing",
    description="Build quantum circuit",
    required_capabilities=["qiskit", "quantum-ml", "topological-qubits"],
)

result = pattern.execute({
    "assignment": assignment,
})

assert result.delegated, "Should use fallback"
assert result.fallback_used, "Fallback should be indicated"
print(f"Fallback used: delegated to {result.delegate_id}")

# Test without fallback
pattern_no_fallback = DelegationPattern(
    registry=registry,
    capability_match_threshold=0.9,
    allow_fallback=False,
)

result2 = pattern_no_fallback.execute({
    "assignment": assignment,
})

assert not result2.delegated, "Should not delegate without fallback"
assert not result2.fallback_used, "No fallback used"
print(f"No fallback: delegated={result2.delegated}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Delegation fallback works"
else
    fail "Delegation fallback failed"
fi

# ============================================================================
# Test: Emergence Pattern
# ============================================================================
log_test "Emergence pattern - insight generation"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.registry import AgentRegistry
from swarm.patterns import EmergencePattern

loki_dir = Path("$TEST_LOKI_DIR")
registry = AgentRegistry(loki_dir)
agents = registry.list_all()

pattern = EmergencePattern(
    registry=registry,
    min_contributors=2,
    confidence_threshold=0.4,
)

# Observations with common themes
observations = [
    {
        "agent_id": agents[0].id,
        "observation": "Performance issues detected in database queries. Slow response times.",
        "category": "performance",
    },
    {
        "agent_id": agents[1].id,
        "observation": "Database connection pooling causing performance bottleneck.",
        "category": "performance",
    },
    {
        "agent_id": agents[2].id if len(agents) > 2 else agents[0].id,
        "observation": "Query optimization needed for performance improvement.",
        "category": "performance",
    },
]

result = pattern.execute({
    "observations": observations,
})

assert result.success, "Should generate insights"
assert result.insights_generated > 0, "Should have at least one insight"
print(f"Generated {result.insights_generated} insight(s)")

for insight in result.insights:
    print(f"  Insight: {insight.insight[:80]}...")
    print(f"  Contributors: {len(insight.contributors)}")
    print(f"  Confidence: {insight.confidence:.1%}")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Emergence pattern works"
else
    fail "Emergence pattern failed"
fi

# ============================================================================
# Test: SwarmCoordinator Integration
# ============================================================================
log_test "SwarmCoordinator - full integration"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm import SwarmCoordinator, SwarmConfig
from swarm.messages import Vote, VoteChoice

loki_dir = Path("$TEST_LOKI_DIR")

# Clear and start fresh
import shutil
swarm_dir = loki_dir / "swarm"
if swarm_dir.exists():
    shutil.rmtree(swarm_dir)

config = SwarmConfig(
    voting_quorum=0.5,
    voting_threshold=0.5,
    consensus_threshold=0.6,
    delegation_capability_threshold=0.3,
)

coordinator = SwarmCoordinator(loki_dir, config)

# Register agents
print("Registering agents...")
frontend = coordinator.register_agent("eng-frontend")
backend = coordinator.register_agent("eng-backend")
qa = coordinator.register_agent("eng-qa")
print(f"  Registered: {frontend.id}, {backend.id}, {qa.id}")

# Test voting
print("\nTesting voting...")
result = coordinator.vote(
    question="Should we use GraphQL?",
    voters=[frontend.id, backend.id, qa.id],
    votes=[
        Vote(voter_id=frontend.id, choice=VoteChoice.APPROVE, confidence=0.8),
        Vote(voter_id=backend.id, choice=VoteChoice.APPROVE, confidence=0.9),
        Vote(voter_id=qa.id, choice=VoteChoice.ABSTAIN, confidence=0.5),
    ],
)
print(f"  Decision: {result.decision}")
assert result.decision == "approved", f"Expected approved, got {result.decision}"

# Test delegation
print("\nTesting delegation...")
delegation = coordinator.delegate_task(
    task_id="task-integration",
    delegator_id="coordinator",
    task_type="unit-test",
    description="Write unit tests for auth module",
    required_capabilities=["jest", "unit-testing"],
)
print(f"  Delegated: {delegation.delegated}")
print(f"  Delegate: {delegation.delegate_id}")
assert delegation.delegated, "Should delegate task"

# Test observation sharing
print("\nTesting emergence...")
coordinator.share_observation(
    agent_id=frontend.id,
    observation="Component render performance is slow",
    category="performance",
)
coordinator.share_observation(
    agent_id=backend.id,
    observation="API response time affecting performance",
    category="performance",
)

insights = coordinator.generate_insights(category="performance")
print(f"  Insights generated: {insights.insights_generated}")

# Test status
print("\nSwarm status:")
status = coordinator.get_swarm_status()
print(f"  Total agents: {status['registry']['total_agents']}")
print(f"  Available: {status['registry']['available_count']}")
print(f"  Pending messages: {status['pending_messages']}")

print("\nSUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "SwarmCoordinator integration works"
else
    fail "SwarmCoordinator integration failed"
fi

# ============================================================================
# Test: Event System
# ============================================================================
log_test "SwarmCoordinator - event system"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm import SwarmCoordinator

loki_dir = Path("$TEST_LOKI_DIR")
coordinator = SwarmCoordinator(loki_dir)

events_received = []

def handler(data):
    events_received.append(data)

coordinator.on("agent_registered", handler)

# Register an agent
agent = coordinator.register_agent("ops-devops")

# Check event was received
assert len(events_received) == 1, f"Expected 1 event, got {len(events_received)}"
assert "agent" in events_received[0], "Event should contain agent"
print(f"Event received: agent_registered for {events_received[0]['agent']['agent_type']}")

# Test removal
result = coordinator.off("agent_registered", handler)
assert result, "Should remove handler"

# Register another - should not trigger
coordinator.register_agent("ops-sre")
assert len(events_received) == 1, "Should not receive more events after off()"

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Event system works"
else
    fail "Event system failed"
fi

# ============================================================================
# Test: Message Bus
# ============================================================================
log_test "Message bus - send and receive"

python3 << PYTHON
import sys
from pathlib import Path
sys.path.insert(0, '.')
from swarm.messages import MessageBus, SwarmMessage, MessageType

loki_dir = Path("$TEST_LOKI_DIR")
bus = MessageBus(loki_dir)

# Clear pending
bus.clear_pending()

# Send a message
msg = SwarmMessage.create(
    msg_type=MessageType.TASK_OFFER,
    sender_id="coordinator",
    payload={"task": "Build feature X"},
    recipient_id="agent-001",
)
bus.send(msg)

# Receive as intended recipient
received = bus.receive("agent-001")
assert len(received) == 1, f"Expected 1 message, got {len(received)}"
assert received[0].id == msg.id, "Message ID mismatch"
print(f"Received message: {received[0].type.value}")

# Receive as different recipient (should be empty)
received2 = bus.receive("agent-002")
assert len(received2) == 0, "Wrong recipient should not receive"

# Test broadcast
broadcast = SwarmMessage.create(
    msg_type=MessageType.STATUS_UPDATE,
    sender_id="coordinator",
    payload={"status": "active"},
    recipient_id=None,  # Broadcast
)
bus.send(broadcast)

# Anyone can receive broadcast
received3 = bus.receive("agent-002")
assert len(received3) == 1, "Should receive broadcast"
assert received3[0].is_broadcast(), "Should be broadcast"
print(f"Received broadcast: {received3[0].type.value}")

# Acknowledge and archive
bus.acknowledge(msg.id)
bus.acknowledge(broadcast.id)

assert bus.get_pending_count() == 0, "All messages should be archived"
print("Messages archived successfully")

print("SUCCESS")
PYTHON

if [ $? -eq 0 ]; then
    pass "Message bus works"
else
    fail "Message bus failed"
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "============================================"
echo "Swarm Intelligence Test Summary"
echo "============================================"
echo -e "Tests run:    $TESTS_RUN"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
echo "============================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}\n"
    exit 0
else
    echo -e "\n${RED}Some tests failed!${NC}\n"
    exit 1
fi
