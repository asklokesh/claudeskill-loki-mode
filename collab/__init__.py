"""
Loki Mode Collaboration Module

Provides real-time collaboration features for multi-user support:
- Presence tracking (who is online)
- Cursor/selection sharing
- Shared state synchronization
- Conflict resolution for concurrent edits

Usage:
    from collab import PresenceManager, StateSync, ClientType

    # Presence tracking
    presence = PresenceManager()
    user = presence.join("alice", ClientType.VSCODE)
    presence.update_cursor(user.id, CursorPosition("main.py", 10, 5))

    # State synchronization
    sync = StateSync()
    op = Operation(type=OperationType.SET, path=["tasks", 0, "status"], value="done")
    sync.apply_operation(op)

API Integration:
    from collab.api import create_collab_routes
    create_collab_routes(app)  # Adds /api/collab/* and /ws/collab endpoints
"""

from .presence import (
    PresenceManager,
    User,
    PresenceEvent,
    PresenceEventType,
    UserStatus,
    ClientType,
    CursorPosition,
    get_presence_manager,
    reset_presence_manager,
)
from .sync import (
    StateSync,
    SyncEvent,
    SyncEventType,
    Operation,
    OperationType,
    OperationalTransform,
    get_state_sync,
    reset_state_sync,
)
from .websocket import (
    CollabWebSocketManager,
    CollabConnection,
    get_collab_ws_manager,
    reset_collab_ws_manager,
)

__all__ = [
    # Presence
    "PresenceManager",
    "User",
    "PresenceEvent",
    "PresenceEventType",
    "UserStatus",
    "ClientType",
    "CursorPosition",
    "get_presence_manager",
    "reset_presence_manager",
    # Sync
    "StateSync",
    "SyncEvent",
    "SyncEventType",
    "Operation",
    "OperationType",
    "OperationalTransform",
    "get_state_sync",
    "reset_state_sync",
    # WebSocket
    "CollabWebSocketManager",
    "CollabConnection",
    "get_collab_ws_manager",
    "reset_collab_ws_manager",
]
