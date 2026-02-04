"""
Loki Mode Swarm Registry - Agent capability tracking and lookup.

This module provides:
- Agent type definitions with capabilities
- Agent registry for tracking active agents
- Capability-based agent lookup
- Load balancing across agents of the same type
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set


# Agent swarm categories
SWARM_CATEGORIES = {
    "engineering": ["eng-frontend", "eng-backend", "eng-database", "eng-mobile",
                    "eng-api", "eng-qa", "eng-perf", "eng-infra"],
    "operations": ["ops-devops", "ops-sre", "ops-security", "ops-monitor",
                   "ops-incident", "ops-release", "ops-cost", "ops-compliance"],
    "business": ["biz-marketing", "biz-sales", "biz-finance", "biz-legal",
                 "biz-support", "biz-hr", "biz-investor", "biz-partnerships"],
    "data": ["data-ml", "data-eng", "data-analytics"],
    "product": ["prod-pm", "prod-design", "prod-techwriter"],
    "growth": ["growth-hacker", "growth-community", "growth-success", "growth-lifecycle"],
    "review": ["review-code", "review-business", "review-security"],
    "orchestration": ["orch-planner", "orch-sub-planner", "orch-judge", "orch-coordinator"],
}


# Flattened agent types
AGENT_TYPES: List[str] = []
for category_agents in SWARM_CATEGORIES.values():
    AGENT_TYPES.extend(category_agents)


# Agent capabilities by type
AGENT_CAPABILITIES: Dict[str, List[str]] = {
    # Engineering
    "eng-frontend": ["react", "vue", "svelte", "typescript", "tailwind", "accessibility",
                     "responsive-design", "state-management", "core-web-vitals"],
    "eng-backend": ["node", "python", "go", "rest", "graphql", "authentication",
                    "authorization", "caching", "message-queues"],
    "eng-database": ["postgresql", "mysql", "mongodb", "redis", "migrations",
                     "query-optimization", "indexing", "replication"],
    "eng-mobile": ["react-native", "flutter", "swift", "kotlin", "offline-first",
                   "push-notifications", "app-store"],
    "eng-api": ["openapi", "sdk-generation", "versioning", "webhooks", "rate-limiting",
                "api-documentation"],
    "eng-qa": ["unit-testing", "integration-testing", "e2e-testing", "load-testing",
               "test-automation", "playwright", "jest"],
    "eng-perf": ["profiling", "benchmarking", "optimization", "caching-strategy",
                 "bundle-optimization", "memory-analysis"],
    "eng-infra": ["docker", "kubernetes", "helm", "terraform", "security-hardening",
                  "multi-stage-builds"],

    # Operations
    "ops-devops": ["ci-cd", "github-actions", "gitlab-ci", "jenkins", "gitops",
                   "argocd", "infrastructure-as-code"],
    "ops-sre": ["reliability", "slo-sli", "capacity-planning", "chaos-engineering",
                "error-budgets", "toil-reduction"],
    "ops-security": ["sast", "dast", "pen-testing", "vulnerability-scanning",
                     "compliance", "security-policies"],
    "ops-monitor": ["observability", "datadog", "grafana", "alerting", "tracing",
                    "log-aggregation"],
    "ops-incident": ["incident-response", "runbooks", "auto-remediation", "rca",
                     "post-mortems"],
    "ops-release": ["versioning", "changelogs", "feature-flags", "blue-green",
                    "canary", "rollbacks"],
    "ops-cost": ["cost-analysis", "right-sizing", "spot-instances", "finops",
                 "budget-alerts"],
    "ops-compliance": ["soc2", "gdpr", "hipaa", "pci-dss", "iso27001", "audit-prep"],

    # Business
    "biz-marketing": ["landing-pages", "seo", "content-marketing", "email-campaigns",
                      "social-media", "analytics"],
    "biz-sales": ["crm", "outreach", "demos", "proposals", "pipeline-management"],
    "biz-finance": ["billing", "stripe", "invoicing", "metrics", "runway", "pricing"],
    "biz-legal": ["terms-of-service", "privacy-policy", "contracts", "ip-protection",
                  "compliance-docs"],
    "biz-support": ["help-docs", "faqs", "ticket-system", "chatbot", "knowledge-base"],
    "biz-hr": ["job-posts", "recruiting", "onboarding", "culture-docs", "handbook"],
    "biz-investor": ["pitch-decks", "investor-updates", "data-room", "cap-table",
                     "financial-modeling"],
    "biz-partnerships": ["bd-outreach", "integration-partnerships", "co-marketing",
                         "partner-documentation"],

    # Data
    "data-ml": ["model-training", "mlops", "feature-engineering", "inference",
                "model-monitoring", "llm-integration"],
    "data-eng": ["etl", "data-warehousing", "dbt", "airflow", "data-quality"],
    "data-analytics": ["bi", "dashboards", "sql", "metrics-definition", "ab-testing"],

    # Product
    "prod-pm": ["backlog-grooming", "prioritization", "roadmap", "specs",
                "stakeholder-management"],
    "prod-design": ["design-system", "figma", "ux-patterns", "prototypes",
                    "user-research", "accessibility"],
    "prod-techwriter": ["api-docs", "guides", "tutorials", "release-notes",
                        "architecture-docs"],

    # Growth
    "growth-hacker": ["growth-experiments", "viral-loops", "referral-programs",
                      "activation", "retention"],
    "growth-community": ["community-building", "discord", "slack", "ambassador-programs",
                         "events"],
    "growth-success": ["customer-success", "health-scoring", "churn-prevention",
                       "expansion", "nps"],
    "growth-lifecycle": ["email-lifecycle", "in-app-messaging", "push-notifications",
                         "segmentation", "re-engagement"],

    # Review
    "review-code": ["code-quality", "design-patterns", "solid", "maintainability",
                    "duplication", "complexity"],
    "review-business": ["requirements-alignment", "business-logic", "edge-cases",
                        "ux-flows", "acceptance-criteria"],
    "review-security": ["vulnerabilities", "auth-authz", "owasp", "data-protection",
                        "input-validation"],

    # Orchestration
    "orch-planner": ["task-decomposition", "dependency-analysis", "work-distribution",
                     "sub-planner-spawning"],
    "orch-sub-planner": ["domain-planning", "recursive-breakdown", "context-focus"],
    "orch-judge": ["cycle-continuation", "goal-assessment", "escalation-triggers"],
    "orch-coordinator": ["cross-stream-coordination", "merge-decisions",
                         "conflict-resolution"],
}


class AgentStatus(str, Enum):
    """Agent lifecycle status."""
    IDLE = "idle"
    WORKING = "working"
    WAITING = "waiting"
    FAILED = "failed"
    TERMINATED = "terminated"


@dataclass
class AgentCapability:
    """
    A specific capability an agent has.

    Attributes:
        name: Capability identifier
        proficiency: How good the agent is (0.0 to 1.0)
        last_used: When this capability was last exercised
        usage_count: Number of times used
    """
    name: str
    proficiency: float = 0.8
    last_used: Optional[datetime] = None
    usage_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "name": self.name,
            "proficiency": self.proficiency,
            "usage_count": self.usage_count,
        }
        if self.last_used:
            result["last_used"] = self.last_used.isoformat() + "Z"
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AgentCapability:
        """Create from dictionary."""
        last_used = None
        if data.get("last_used"):
            last_used_str = data["last_used"]
            if isinstance(last_used_str, str):
                if last_used_str.endswith("Z"):
                    last_used_str = last_used_str[:-1]
                last_used = datetime.fromisoformat(last_used_str)

        return cls(
            name=data.get("name", ""),
            proficiency=data.get("proficiency", 0.8),
            last_used=last_used,
            usage_count=data.get("usage_count", 0),
        )


@dataclass
class AgentInfo:
    """
    Information about a registered agent.

    Attributes:
        id: Unique agent identifier
        agent_type: Type of agent (e.g., "eng-frontend")
        swarm: Which swarm category this agent belongs to
        status: Current agent status
        capabilities: List of agent capabilities
        tasks_completed: Number of tasks completed
        tasks_failed: Number of tasks failed
        current_task: ID of current task (if any)
        created_at: When the agent was created
        last_heartbeat: Last heartbeat timestamp
        metadata: Additional metadata
    """
    id: str
    agent_type: str
    swarm: str
    status: AgentStatus = AgentStatus.IDLE
    capabilities: List[AgentCapability] = field(default_factory=list)
    tasks_completed: int = 0
    tasks_failed: int = 0
    current_task: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_heartbeat: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "agent_type": self.agent_type,
            "swarm": self.swarm,
            "status": self.status.value,
            "capabilities": [c.to_dict() for c in self.capabilities],
            "tasks_completed": self.tasks_completed,
            "tasks_failed": self.tasks_failed,
            "current_task": self.current_task,
            "created_at": self.created_at.isoformat() + "Z",
            "last_heartbeat": self.last_heartbeat.isoformat() + "Z",
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> AgentInfo:
        """Create from dictionary."""
        created_at = datetime.now(timezone.utc)
        if data.get("created_at"):
            created_str = data["created_at"]
            if isinstance(created_str, str):
                if created_str.endswith("Z"):
                    created_str = created_str[:-1]
                created_at = datetime.fromisoformat(created_str)

        last_heartbeat = datetime.now(timezone.utc)
        if data.get("last_heartbeat"):
            hb_str = data["last_heartbeat"]
            if isinstance(hb_str, str):
                if hb_str.endswith("Z"):
                    hb_str = hb_str[:-1]
                last_heartbeat = datetime.fromisoformat(hb_str)

        status = AgentStatus.IDLE
        if data.get("status"):
            try:
                status = AgentStatus(data["status"])
            except ValueError:
                pass

        return cls(
            id=data.get("id", ""),
            agent_type=data.get("agent_type", ""),
            swarm=data.get("swarm", ""),
            status=status,
            capabilities=[
                AgentCapability.from_dict(c) for c in data.get("capabilities", [])
            ],
            tasks_completed=data.get("tasks_completed", 0),
            tasks_failed=data.get("tasks_failed", 0),
            current_task=data.get("current_task"),
            created_at=created_at,
            last_heartbeat=last_heartbeat,
            metadata=data.get("metadata", {}),
        )

    @classmethod
    def create(cls, agent_type: str) -> AgentInfo:
        """Factory method to create a new agent with default capabilities."""
        # Determine swarm category
        swarm = "unknown"
        for category, types in SWARM_CATEGORIES.items():
            if agent_type in types:
                swarm = category
                break

        # Get capabilities for this agent type
        capability_names = AGENT_CAPABILITIES.get(agent_type, [])
        capabilities = [AgentCapability(name=c) for c in capability_names]

        agent_id = f"agent-{agent_type}-{uuid.uuid4().hex[:8]}"

        return cls(
            id=agent_id,
            agent_type=agent_type,
            swarm=swarm,
            capabilities=capabilities,
        )

    def has_capability(self, capability: str) -> bool:
        """Check if agent has a specific capability."""
        return any(c.name == capability for c in self.capabilities)

    def get_capability(self, capability: str) -> Optional[AgentCapability]:
        """Get a specific capability."""
        for c in self.capabilities:
            if c.name == capability:
                return c
        return None

    def update_heartbeat(self) -> None:
        """Update last heartbeat timestamp."""
        self.last_heartbeat = datetime.now(timezone.utc)

    def record_task_completion(self, success: bool) -> None:
        """Record task completion."""
        if success:
            self.tasks_completed += 1
        else:
            self.tasks_failed += 1
        self.current_task = None
        self.status = AgentStatus.IDLE


class AgentRegistry:
    """
    Registry for tracking active agents and their capabilities.

    Provides:
    - Agent registration and deregistration
    - Capability-based agent lookup
    - Load balancing across agents
    - Health monitoring via heartbeats
    """

    def __init__(self, loki_dir: Optional[Path] = None):
        """
        Initialize the agent registry.

        Args:
            loki_dir: Path to .loki directory. Defaults to ./.loki
        """
        self.loki_dir = loki_dir or Path(".loki")
        self.registry_dir = self.loki_dir / "swarm" / "registry"
        self.registry_dir.mkdir(parents=True, exist_ok=True)

        self._agents: Dict[str, AgentInfo] = {}
        self._load_registry()

    def _load_registry(self) -> None:
        """Load agent registry from disk."""
        registry_file = self.registry_dir / "agents.json"
        if registry_file.exists():
            try:
                with open(registry_file, "r") as f:
                    data = json.load(f)
                    for agent_data in data.get("agents", []):
                        agent = AgentInfo.from_dict(agent_data)
                        self._agents[agent.id] = agent
            except (json.JSONDecodeError, IOError):
                pass

    def _save_registry(self) -> None:
        """Save agent registry to disk."""
        registry_file = self.registry_dir / "agents.json"
        try:
            data = {
                "version": "1.0",
                "last_updated": datetime.now(timezone.utc).isoformat() + "Z",
                "agents": [a.to_dict() for a in self._agents.values()],
            }
            with open(registry_file, "w") as f:
                json.dump(data, f, indent=2)
        except IOError:
            pass

    def register(self, agent_type: str, metadata: Optional[Dict[str, Any]] = None) -> AgentInfo:
        """
        Register a new agent.

        Args:
            agent_type: Type of agent to register
            metadata: Optional metadata for the agent

        Returns:
            The registered AgentInfo
        """
        agent = AgentInfo.create(agent_type)
        if metadata:
            agent.metadata = metadata

        self._agents[agent.id] = agent
        self._save_registry()

        return agent

    def deregister(self, agent_id: str) -> bool:
        """
        Deregister an agent.

        Args:
            agent_id: ID of agent to deregister

        Returns:
            True if agent was found and removed
        """
        if agent_id in self._agents:
            self._agents[agent_id].status = AgentStatus.TERMINATED
            del self._agents[agent_id]
            self._save_registry()
            return True
        return False

    def get(self, agent_id: str) -> Optional[AgentInfo]:
        """Get agent by ID."""
        return self._agents.get(agent_id)

    def get_by_type(self, agent_type: str) -> List[AgentInfo]:
        """Get all agents of a specific type."""
        return [a for a in self._agents.values() if a.agent_type == agent_type]

    def get_by_swarm(self, swarm: str) -> List[AgentInfo]:
        """Get all agents in a specific swarm category."""
        return [a for a in self._agents.values() if a.swarm == swarm]

    def get_by_capability(self, capability: str) -> List[AgentInfo]:
        """Get all agents with a specific capability."""
        return [a for a in self._agents.values() if a.has_capability(capability)]

    def get_available(self, agent_type: Optional[str] = None) -> List[AgentInfo]:
        """Get available (idle or waiting) agents, optionally filtered by type."""
        available = [
            a for a in self._agents.values()
            if a.status in (AgentStatus.IDLE, AgentStatus.WAITING)
        ]
        if agent_type:
            available = [a for a in available if a.agent_type == agent_type]
        return available

    def find_best_agent(
        self,
        required_capabilities: List[str],
        preferred_type: Optional[str] = None,
    ) -> Optional[AgentInfo]:
        """
        Find the best available agent for a task.

        Args:
            required_capabilities: Capabilities needed for the task
            preferred_type: Preferred agent type (optional)

        Returns:
            Best matching agent or None
        """
        candidates = self.get_available(preferred_type)
        if not candidates:
            return None

        # Score each candidate
        scored_candidates: List[tuple] = []
        for agent in candidates:
            score = 0.0
            matched_caps = 0

            for cap_name in required_capabilities:
                cap = agent.get_capability(cap_name)
                if cap:
                    matched_caps += 1
                    score += cap.proficiency

            if matched_caps > 0:
                # Average proficiency of matched capabilities
                avg_proficiency = score / matched_caps
                # Bonus for matching more capabilities
                coverage = matched_caps / len(required_capabilities)
                # Bonus for fewer failures
                reliability = 1.0 - (agent.tasks_failed / max(1, agent.tasks_completed + agent.tasks_failed))

                final_score = (avg_proficiency * 0.4) + (coverage * 0.4) + (reliability * 0.2)
                scored_candidates.append((agent, final_score))

        if not scored_candidates:
            # No agents with required capabilities, return least busy
            return min(candidates, key=lambda a: a.tasks_completed + a.tasks_failed)

        # Return agent with highest score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return scored_candidates[0][0]

    def update_status(self, agent_id: str, status: AgentStatus, task_id: Optional[str] = None) -> bool:
        """
        Update agent status.

        Args:
            agent_id: Agent ID
            status: New status
            task_id: Current task ID (if working)

        Returns:
            True if agent was found and updated
        """
        agent = self._agents.get(agent_id)
        if agent:
            agent.status = status
            agent.current_task = task_id
            agent.update_heartbeat()
            self._save_registry()
            return True
        return False

    def heartbeat(self, agent_id: str) -> bool:
        """
        Record heartbeat for an agent.

        Args:
            agent_id: Agent ID

        Returns:
            True if agent was found
        """
        agent = self._agents.get(agent_id)
        if agent:
            agent.update_heartbeat()
            self._save_registry()
            return True
        return False

    def get_stale_agents(self, max_age_seconds: int = 300) -> List[AgentInfo]:
        """
        Get agents that haven't sent a heartbeat recently.

        Args:
            max_age_seconds: Maximum age since last heartbeat

        Returns:
            List of stale agents
        """
        now = datetime.now(timezone.utc)
        stale = []
        for agent in self._agents.values():
            age = (now - agent.last_heartbeat).total_seconds()
            if age > max_age_seconds:
                stale.append(agent)
        return stale

    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        total = len(self._agents)
        by_status = {}
        by_swarm = {}
        by_type = {}

        for agent in self._agents.values():
            # By status
            status = agent.status.value
            by_status[status] = by_status.get(status, 0) + 1

            # By swarm
            by_swarm[agent.swarm] = by_swarm.get(agent.swarm, 0) + 1

            # By type
            by_type[agent.agent_type] = by_type.get(agent.agent_type, 0) + 1

        return {
            "total_agents": total,
            "by_status": by_status,
            "by_swarm": by_swarm,
            "by_type": by_type,
            "available_count": len(self.get_available()),
        }

    def list_all(self) -> List[AgentInfo]:
        """List all registered agents."""
        return list(self._agents.values())

    def clear(self) -> int:
        """
        Clear all agents from registry.

        Returns:
            Number of agents removed
        """
        count = len(self._agents)
        self._agents.clear()
        self._save_registry()
        return count
