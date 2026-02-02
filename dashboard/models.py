"""
SQLAlchemy models for Loki Mode Dashboard.

Uses SQLAlchemy 2.0 style with async support.
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class TaskStatus(str, PyEnum):
    """Task status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


class TaskPriority(str, PyEnum):
    """Task priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AgentStatus(str, PyEnum):
    """Agent status enumeration."""
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    ERROR = "error"


class SessionStatus(str, PyEnum):
    """Session status enumeration."""
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class Project(Base):
    """Project model - represents a Loki Mode project."""

    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    prd_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="project", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="project", cascade="all, delete-orphan"
    )


class Task(Base):
    """Task model - represents a task within a project."""

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False
    )
    priority: Mapped[TaskPriority] = mapped_column(
        Enum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    assigned_agent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("agents.id", ondelete="SET NULL"), nullable=True
    )
    parent_task_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True
    )
    estimated_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    actual_duration: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="tasks")
    assigned_agent: Mapped[Optional["Agent"]] = relationship(
        "Agent", back_populates="assigned_tasks"
    )
    subtasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="parent_task",
        foreign_keys=[parent_task_id],
    )
    parent_task: Mapped[Optional["Task"]] = relationship(
        "Task",
        back_populates="subtasks",
        foreign_keys=[parent_task_id],
        remote_side=[id],
    )


class Session(Base):
    """Session model - represents an execution session."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), default=SessionStatus.ACTIVE, nullable=False
    )
    provider: Mapped[str] = mapped_column(String(50), default="claude")
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="sessions")
    agents: Mapped[list["Agent"]] = relationship(
        "Agent", back_populates="session", cascade="all, delete-orphan"
    )


class Agent(Base):
    """Agent model - represents an AI agent instance."""

    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    agent_type: Mapped[str] = mapped_column(String(50), default="general")
    status: Mapped[AgentStatus] = mapped_column(
        Enum(AgentStatus), default=AgentStatus.IDLE, nullable=False
    )
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_task: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    session: Mapped["Session"] = relationship("Session", back_populates="agents")
    assigned_tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="assigned_agent"
    )
