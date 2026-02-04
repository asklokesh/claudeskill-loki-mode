#!/usr/bin/env python3
"""
Loki Mode Swarm CLI - Command-line interface for swarm operations.

Usage:
    python -m swarm.cli <command> [options]
    loki swarm <command> [options]

Commands:
    status              Show swarm status
    agents              List registered agents
    register <type>     Register a new agent
    deregister <id>     Remove an agent
    vote <question>     Start a voting session
    delegate <task>     Delegate a task
    observe <text>      Share an observation
    insights            Generate emergent insights
    cleanup             Clean up stale agents
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from swarm import (
    SwarmCoordinator,
    SwarmConfig,
    Vote,
    VoteChoice,
    AGENT_TYPES,
    SWARM_CATEGORIES,
)
from swarm.registry import AgentStatus


def get_coordinator(loki_dir: Optional[str] = None) -> SwarmCoordinator:
    """Get or create a SwarmCoordinator instance."""
    path = Path(loki_dir) if loki_dir else Path(".loki")
    return SwarmCoordinator(path)


def cmd_status(args: argparse.Namespace) -> int:
    """Show swarm status."""
    coordinator = get_coordinator(args.loki_dir)
    status = coordinator.get_swarm_status()

    print("\n=== Swarm Status ===\n")
    print(f"Timestamp: {status['timestamp']}")
    print(f"\nRegistry:")
    print(f"  Total agents: {status['registry']['total_agents']}")
    print(f"  Available: {status['registry']['available_count']}")

    if status['registry']['by_status']:
        print(f"\n  By status:")
        for s, count in status['registry']['by_status'].items():
            print(f"    {s}: {count}")

    if status['registry']['by_swarm']:
        print(f"\n  By swarm:")
        for swarm, count in status['registry']['by_swarm'].items():
            print(f"    {swarm}: {count}")

    print(f"\nMessages pending: {status['pending_messages']}")
    print(f"Stale agents: {status['stale_agent_count']}")

    if status['stale_agents']:
        print(f"  IDs: {', '.join(status['stale_agents'])}")

    print("")
    return 0


def cmd_agents(args: argparse.Namespace) -> int:
    """List registered agents."""
    coordinator = get_coordinator(args.loki_dir)

    # Apply filters
    agents = coordinator.list_agents(
        agent_type=args.type,
        swarm=args.swarm,
        status=AgentStatus(args.status) if args.status else None,
    )

    if not agents:
        print("\nNo agents found matching criteria.\n")
        return 0

    print("\n=== Registered Agents ===\n")

    if args.json:
        print(json.dumps([a.to_dict() for a in agents], indent=2))
        return 0

    for agent in agents:
        print(f"ID: {agent.id}")
        print(f"  Type: {agent.agent_type}")
        print(f"  Swarm: {agent.swarm}")
        print(f"  Status: {agent.status.value}")
        print(f"  Tasks completed: {agent.tasks_completed}")
        print(f"  Tasks failed: {agent.tasks_failed}")
        if agent.current_task:
            print(f"  Current task: {agent.current_task}")
        print(f"  Capabilities: {len(agent.capabilities)}")
        if args.verbose:
            caps = [c.name for c in agent.capabilities]
            print(f"    {', '.join(caps)}")
        print("")

    print(f"Total: {len(agents)} agent(s)\n")
    return 0


def cmd_register(args: argparse.Namespace) -> int:
    """Register a new agent."""
    if args.agent_type not in AGENT_TYPES:
        print(f"\nError: Unknown agent type '{args.agent_type}'")
        print(f"\nValid types:")
        for category, types in SWARM_CATEGORIES.items():
            print(f"  {category}: {', '.join(types)}")
        return 1

    coordinator = get_coordinator(args.loki_dir)

    metadata = {}
    if args.metadata:
        try:
            metadata = json.loads(args.metadata)
        except json.JSONDecodeError:
            print(f"\nError: Invalid JSON metadata: {args.metadata}")
            return 1

    agent = coordinator.register_agent(args.agent_type, metadata)

    print(f"\n[OK] Agent registered successfully")
    print(f"  ID: {agent.id}")
    print(f"  Type: {agent.agent_type}")
    print(f"  Swarm: {agent.swarm}")
    print(f"  Capabilities: {len(agent.capabilities)}")
    print("")
    return 0


def cmd_deregister(args: argparse.Namespace) -> int:
    """Deregister an agent."""
    coordinator = get_coordinator(args.loki_dir)

    if coordinator.deregister_agent(args.agent_id):
        print(f"\n[OK] Agent '{args.agent_id}' deregistered successfully.\n")
        return 0
    else:
        print(f"\n[ERROR] Agent '{args.agent_id}' not found.\n")
        return 1


def cmd_vote(args: argparse.Namespace) -> int:
    """Start a voting session."""
    coordinator = get_coordinator(args.loki_dir)

    # Get voters
    if args.voters:
        voter_ids = args.voters.split(",")
    else:
        # Use all available agents
        agents = coordinator.list_agents(status=AgentStatus.IDLE)
        voter_ids = [a.id for a in agents]

    if not voter_ids:
        print("\n[ERROR] No voters available. Register agents first.\n")
        return 1

    # In CLI mode, we simulate votes (in real use, this would be interactive)
    if args.auto:
        # Auto-generate approve votes for demonstration
        votes = [
            Vote(voter_id=vid, choice=VoteChoice.APPROVE, confidence=0.8)
            for vid in voter_ids
        ]
    else:
        print(f"\nQuestion: {args.question}")
        print(f"Voters: {len(voter_ids)}")
        print("\nEnter votes (format: agent_id:approve|reject|abstain[:confidence])")
        print("Enter 'done' when finished.\n")

        votes = []
        while True:
            try:
                line = input("> ").strip()
                if line.lower() == "done":
                    break

                parts = line.split(":")
                if len(parts) < 2:
                    print("Invalid format. Use: agent_id:choice[:confidence]")
                    continue

                voter_id = parts[0]
                choice_str = parts[1].lower()

                if choice_str == "approve":
                    choice = VoteChoice.APPROVE
                elif choice_str == "reject":
                    choice = VoteChoice.REJECT
                elif choice_str == "abstain":
                    choice = VoteChoice.ABSTAIN
                else:
                    print(f"Invalid choice: {choice_str}")
                    continue

                confidence = float(parts[2]) if len(parts) > 2 else 0.8

                votes.append(Vote(voter_id=voter_id, choice=choice, confidence=confidence))
                print(f"  Recorded: {voter_id} -> {choice_str}")
            except EOFError:
                break

    if not votes:
        print("\n[ERROR] No votes submitted.\n")
        return 1

    result = coordinator.vote(
        question=args.question,
        voters=voter_ids,
        votes=votes,
        weighted=args.weighted,
    )

    print(f"\n=== Voting Result ===")
    print(f"Question: {args.question}")
    print(f"Decision: {result.decision}")
    print(f"Quorum reached: {result.quorum_reached}")
    print(f"Unanimous: {result.unanimous}")
    print(f"\nVote counts:")
    for choice, count in result.vote_counts.items():
        print(f"  {choice}: {count}")
    print("")
    return 0


def cmd_delegate(args: argparse.Namespace) -> int:
    """Delegate a task to the best available agent."""
    coordinator = get_coordinator(args.loki_dir)

    capabilities = args.capabilities.split(",") if args.capabilities else []

    result = coordinator.delegate_task(
        task_id=args.task_id,
        delegator_id=args.delegator or "cli",
        task_type=args.task_type,
        description=args.description,
        required_capabilities=capabilities,
        priority=args.priority,
    )

    if result.delegated:
        print(f"\n[OK] Task delegated successfully")
        print(f"  Task ID: {args.task_id}")
        print(f"  Delegate: {result.delegate_id}")
        print(f"  Fallback used: {result.fallback_used}")
        print(f"  Candidates evaluated: {result.candidates_evaluated}")
    else:
        print(f"\n[ERROR] Failed to delegate task")
        print(f"  Task ID: {args.task_id}")
        print(f"  Reason: No suitable agent found")
        print(f"  Candidates evaluated: {result.candidates_evaluated}")

    print("")
    return 0 if result.delegated else 1


def cmd_observe(args: argparse.Namespace) -> int:
    """Share an observation."""
    coordinator = get_coordinator(args.loki_dir)

    obs_id = coordinator.share_observation(
        agent_id=args.agent_id,
        observation=args.observation,
        category=args.category,
    )

    print(f"\n[OK] Observation recorded")
    print(f"  ID: {obs_id}")
    print(f"  Agent: {args.agent_id}")
    print(f"  Category: {args.category}")
    print("")
    return 0


def cmd_insights(args: argparse.Namespace) -> int:
    """Generate emergent insights from observations."""
    coordinator = get_coordinator(args.loki_dir)

    result = coordinator.generate_insights(
        category=args.category,
        max_age_hours=args.max_age,
    )

    print(f"\n=== Emergent Insights ===")
    print(f"Observations processed: {result.observations_processed}")
    print(f"Insights generated: {result.insights_generated}")

    if result.insights:
        print("\nInsights:")
        for i, insight in enumerate(result.insights, 1):
            print(f"\n  {i}. {insight.insight}")
            print(f"     Category: {insight.category}")
            print(f"     Confidence: {insight.confidence:.1%}")
            print(f"     Contributors: {', '.join(insight.contributors)}")
    else:
        print("\nNo insights generated. Need more observations with common themes.")

    print("")
    return 0


def cmd_cleanup(args: argparse.Namespace) -> int:
    """Clean up stale agents."""
    coordinator = get_coordinator(args.loki_dir)

    removed = coordinator.cleanup_stale_agents()

    if removed > 0:
        print(f"\n[OK] Removed {removed} stale agent(s).\n")
    else:
        print(f"\n[OK] No stale agents found.\n")

    return 0


def cmd_types(args: argparse.Namespace) -> int:
    """List available agent types."""
    print("\n=== Available Agent Types ===\n")

    for category, types in SWARM_CATEGORIES.items():
        print(f"{category.upper()} ({len(types)} types):")
        for t in types:
            print(f"  - {t}")
        print("")

    print(f"Total: {len(AGENT_TYPES)} agent types\n")
    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Loki Mode Swarm Intelligence CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Show swarm status
    python -m swarm.cli status

    # List all agents
    python -m swarm.cli agents

    # Register a new frontend agent
    python -m swarm.cli register eng-frontend

    # Delegate a task
    python -m swarm.cli delegate task-001 ui-component "Build login form" -c react,typescript

    # Start a vote
    python -m swarm.cli vote "Should we use TypeScript?" --auto

    # Generate insights from observations
    python -m swarm.cli insights
        """,
    )

    parser.add_argument(
        "--loki-dir",
        default=None,
        help="Path to .loki directory (default: ./.loki)",
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # status command
    status_parser = subparsers.add_parser("status", help="Show swarm status")
    status_parser.set_defaults(func=cmd_status)

    # agents command
    agents_parser = subparsers.add_parser("agents", help="List registered agents")
    agents_parser.add_argument("--type", "-t", help="Filter by agent type")
    agents_parser.add_argument("--swarm", "-s", help="Filter by swarm category")
    agents_parser.add_argument("--status", help="Filter by status")
    agents_parser.add_argument("--json", "-j", action="store_true", help="Output as JSON")
    agents_parser.add_argument("--verbose", "-v", action="store_true", help="Show capabilities")
    agents_parser.set_defaults(func=cmd_agents)

    # register command
    register_parser = subparsers.add_parser("register", help="Register a new agent")
    register_parser.add_argument("agent_type", help="Type of agent to register")
    register_parser.add_argument("--metadata", "-m", help="JSON metadata for agent")
    register_parser.set_defaults(func=cmd_register)

    # deregister command
    deregister_parser = subparsers.add_parser("deregister", help="Deregister an agent")
    deregister_parser.add_argument("agent_id", help="ID of agent to deregister")
    deregister_parser.set_defaults(func=cmd_deregister)

    # vote command
    vote_parser = subparsers.add_parser("vote", help="Start a voting session")
    vote_parser.add_argument("question", help="Question to vote on")
    vote_parser.add_argument("--voters", help="Comma-separated voter IDs")
    vote_parser.add_argument("--weighted", "-w", action="store_true", help="Use weighted voting")
    vote_parser.add_argument("--auto", "-a", action="store_true", help="Auto-generate approve votes")
    vote_parser.set_defaults(func=cmd_vote)

    # delegate command
    delegate_parser = subparsers.add_parser("delegate", help="Delegate a task")
    delegate_parser.add_argument("task_id", help="Task identifier")
    delegate_parser.add_argument("task_type", help="Type of task")
    delegate_parser.add_argument("description", help="Task description")
    delegate_parser.add_argument("--capabilities", "-c", help="Comma-separated required capabilities")
    delegate_parser.add_argument("--delegator", "-d", help="Delegator agent ID")
    delegate_parser.add_argument("--priority", "-p", type=int, default=5, help="Task priority (1-10)")
    delegate_parser.set_defaults(func=cmd_delegate)

    # observe command
    observe_parser = subparsers.add_parser("observe", help="Share an observation")
    observe_parser.add_argument("observation", help="Observation text")
    observe_parser.add_argument("--agent-id", "-a", required=True, help="Agent ID")
    observe_parser.add_argument("--category", "-c", default="general", help="Observation category")
    observe_parser.set_defaults(func=cmd_observe)

    # insights command
    insights_parser = subparsers.add_parser("insights", help="Generate emergent insights")
    insights_parser.add_argument("--category", "-c", help="Filter by category")
    insights_parser.add_argument("--max-age", "-m", type=int, default=24, help="Max observation age in hours")
    insights_parser.set_defaults(func=cmd_insights)

    # cleanup command
    cleanup_parser = subparsers.add_parser("cleanup", help="Clean up stale agents")
    cleanup_parser.set_defaults(func=cmd_cleanup)

    # types command
    types_parser = subparsers.add_parser("types", help="List available agent types")
    types_parser.set_defaults(func=cmd_types)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
