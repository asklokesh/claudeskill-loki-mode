"""
WebSocket Handler for Loki Mode Collaboration

Provides real-time communication for collaboration features.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set

from .presence import (
    PresenceManager,
    PresenceEvent,
    PresenceEventType,
    User,
    UserStatus,
    ClientType,
    CursorPosition,
    get_presence_manager,
)
from .sync import (
    StateSync,
    SyncEvent,
    SyncEventType,
    Operation,
    OperationType,
    get_state_sync,
)

logger = logging.getLogger(__name__)


class CollabConnection:
    """Represents a single collaboration WebSocket connection."""

    def __init__(
        self,
        websocket: Any,  # FastAPI WebSocket
        user_id: str,
        session_id: str,
    ):
        self.websocket = websocket
        self.user_id = user_id
        self.session_id = session_id
        self.connected_at = datetime.now(timezone.utc).isoformat()
        self.last_ping = self.connected_at

    async def send(self, message: Dict[str, Any]) -> bool:
        """Send a message to this connection."""
        try:
            await self.websocket.send_json(message)
            return True
        except Exception as e:
            logger.debug(f"Failed to send to {self.user_id}: {e}")
            return False


class CollabWebSocketManager:
    """
    Manages WebSocket connections for real-time collaboration.

    Features:
    - User presence broadcasting
    - Cursor position sharing
    - State synchronization
    - Operation broadcasting

    Message Protocol:
    - Client -> Server:
        - join: {type: "join", name: str, client_type: str}
        - leave: {type: "leave"}
        - heartbeat: {type: "heartbeat"}
        - cursor: {type: "cursor", file_path: str, line: int, column: int, ...}
        - operation: {type: "operation", op: Operation}
        - sync_request: {type: "sync_request", version: int}
        - subscribe: {type: "subscribe", channels: [str]}

    - Server -> Client:
        - connected: {type: "connected", user: User, session_id: str}
        - presence: {type: "presence", event: PresenceEvent}
        - cursors: {type: "cursors", users: [User]}
        - operation: {type: "operation", op: Operation}
        - sync: {type: "sync", state: dict, version: int}
        - error: {type: "error", message: str}
    """

    def __init__(
        self,
        presence_manager: Optional[PresenceManager] = None,
        state_sync: Optional[StateSync] = None,
    ):
        """
        Initialize the WebSocket manager.

        Args:
            presence_manager: PresenceManager instance (uses default if not provided)
            state_sync: StateSync instance (uses default if not provided)
        """
        self.presence = presence_manager or get_presence_manager()
        self.sync = state_sync or get_state_sync()

        # Active connections: user_id -> CollabConnection
        self._connections: Dict[str, CollabConnection] = {}
        self._lock = asyncio.Lock()

        # Session tracking
        self._sessions: Dict[str, Set[str]] = {}  # session_id -> set of user_ids

        # Subscribe to presence events
        self.presence.subscribe_async(self._handle_presence_event)
        self.sync.subscribe_async(self._handle_sync_event)

    async def connect(
        self,
        websocket: Any,
        user_id: Optional[str] = None,
        session_id: str = "default",
    ) -> CollabConnection:
        """
        Accept a new WebSocket connection.

        Args:
            websocket: FastAPI WebSocket
            user_id: Optional user ID (generated if not provided)
            session_id: Session to join

        Returns:
            CollabConnection for this client
        """
        await websocket.accept()

        # Generate user ID if not provided
        if not user_id:
            import uuid
            user_id = str(uuid.uuid4())[:8]

        connection = CollabConnection(
            websocket=websocket,
            user_id=user_id,
            session_id=session_id,
        )

        async with self._lock:
            self._connections[user_id] = connection

            # Track session membership
            if session_id not in self._sessions:
                self._sessions[session_id] = set()
            self._sessions[session_id].add(user_id)

        return connection

    async def disconnect(self, user_id: str) -> None:
        """
        Handle WebSocket disconnection.

        Args:
            user_id: ID of disconnecting user
        """
        async with self._lock:
            if user_id in self._connections:
                connection = self._connections.pop(user_id)

                # Remove from session
                session_id = connection.session_id
                if session_id in self._sessions:
                    self._sessions[session_id].discard(user_id)
                    if not self._sessions[session_id]:
                        del self._sessions[session_id]

        # Leave presence
        self.presence.leave(user_id)

    async def handle_message(
        self,
        connection: CollabConnection,
        message: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Handle an incoming WebSocket message.

        Args:
            connection: The connection that sent the message
            message: Parsed JSON message

        Returns:
            Response to send back (or None)
        """
        msg_type = message.get("type")

        if msg_type == "join":
            return await self._handle_join(connection, message)
        elif msg_type == "leave":
            return await self._handle_leave(connection)
        elif msg_type == "heartbeat":
            return await self._handle_heartbeat(connection)
        elif msg_type == "cursor":
            return await self._handle_cursor(connection, message)
        elif msg_type == "file_open":
            return await self._handle_file_open(connection, message)
        elif msg_type == "operation":
            return await self._handle_operation(connection, message)
        elif msg_type == "sync_request":
            return await self._handle_sync_request(connection, message)
        elif msg_type == "ping":
            return {"type": "pong"}
        else:
            return {"type": "error", "message": f"Unknown message type: {msg_type}"}

    async def _handle_join(
        self,
        connection: CollabConnection,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle user join."""
        name = message.get("name", f"User-{connection.user_id[:4]}")
        client_type_str = message.get("client_type", "api")

        try:
            client_type = ClientType(client_type_str)
        except ValueError:
            client_type = ClientType.API

        # Join presence
        user = self.presence.join(
            name=name,
            client_type=client_type,
            user_id=connection.user_id,
            metadata=message.get("metadata", {}),
        )

        # Return user info and current state
        return {
            "type": "connected",
            "user": user.to_dict(),
            "session_id": connection.session_id,
            "users": [u.to_dict() for u in self.presence.get_users()],
            "state": self.sync.get_state(),
            "version": self.sync.get_version(),
        }

    async def _handle_leave(self, connection: CollabConnection) -> Dict[str, Any]:
        """Handle user leave."""
        self.presence.leave(connection.user_id)
        return {"type": "left", "user_id": connection.user_id}

    async def _handle_heartbeat(self, connection: CollabConnection) -> Dict[str, Any]:
        """Handle heartbeat."""
        connection.last_ping = datetime.now(timezone.utc).isoformat()
        self.presence.heartbeat(connection.user_id)
        return {"type": "heartbeat_ack"}

    async def _handle_cursor(
        self,
        connection: CollabConnection,
        message: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Handle cursor update."""
        cursor = CursorPosition(
            file_path=message.get("file_path", ""),
            line=message.get("line", 0),
            column=message.get("column", 0),
            selection_start=tuple(message["selection_start"]) if message.get("selection_start") else None,
            selection_end=tuple(message["selection_end"]) if message.get("selection_end") else None,
        )

        self.presence.update_cursor(connection.user_id, cursor)

        # Broadcast to session (no response needed, presence event handles it)
        return None

    async def _handle_file_open(
        self,
        connection: CollabConnection,
        message: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Handle file open notification."""
        file_path = message.get("file_path", "")
        self.presence.open_file(connection.user_id, file_path)
        return None

    async def _handle_operation(
        self,
        connection: CollabConnection,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle state operation."""
        op_data = message.get("op", {})
        op = Operation.from_dict(op_data)
        op.user_id = connection.user_id

        success, event = self.sync.apply_operation(op)

        return {
            "type": "operation_result",
            "success": success,
            "operation_id": op.id,
            "version": self.sync.get_version(),
        }

    async def _handle_sync_request(
        self,
        connection: CollabConnection,
        message: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Handle sync request."""
        client_version = message.get("version", 0)

        if client_version < self.sync.get_version():
            # Client is behind, send full state or operations
            ops = self.sync.get_history(since_version=client_version)
            return {
                "type": "sync",
                "state": self.sync.get_state(),
                "version": self.sync.get_version(),
                "operations": [op.to_dict() for op in ops],
            }
        else:
            # Client is up to date
            return {
                "type": "sync_ack",
                "version": self.sync.get_version(),
            }

    async def _handle_presence_event(self, event: PresenceEvent) -> None:
        """Handle presence event and broadcast to all connections."""
        message = {
            "type": "presence",
            "event": event.to_dict(),
        }

        await self.broadcast(message)

    async def _handle_sync_event(self, event: SyncEvent) -> None:
        """Handle sync event and broadcast to all connections."""
        message = {
            "type": "sync_event",
            "event": event.to_dict(),
        }

        await self.broadcast(message)

    async def broadcast(
        self,
        message: Dict[str, Any],
        session_id: Optional[str] = None,
        exclude_user: Optional[str] = None,
    ) -> int:
        """
        Broadcast a message to all connected clients.

        Args:
            message: Message to broadcast
            session_id: Only broadcast to users in this session
            exclude_user: Exclude this user from broadcast

        Returns:
            Number of clients successfully sent to
        """
        sent = 0
        disconnected = []

        async with self._lock:
            connections = list(self._connections.items())

        for user_id, connection in connections:
            # Filter by session
            if session_id and connection.session_id != session_id:
                continue

            # Exclude user
            if exclude_user and user_id == exclude_user:
                continue

            success = await connection.send(message)
            if success:
                sent += 1
            else:
                disconnected.append(user_id)

        # Clean up disconnected clients
        for user_id in disconnected:
            await self.disconnect(user_id)

        return sent

    async def send_to_user(
        self,
        user_id: str,
        message: Dict[str, Any]
    ) -> bool:
        """Send a message to a specific user."""
        async with self._lock:
            connection = self._connections.get(user_id)

        if connection:
            return await connection.send(message)
        return False

    async def send_to_session(
        self,
        session_id: str,
        message: Dict[str, Any],
        exclude_user: Optional[str] = None,
    ) -> int:
        """Send a message to all users in a session."""
        return await self.broadcast(message, session_id=session_id, exclude_user=exclude_user)

    def get_active_users(
        self,
        session_id: Optional[str] = None
    ) -> List[User]:
        """Get list of active users."""
        users = self.presence.get_users()

        if session_id:
            session_user_ids = self._sessions.get(session_id, set())
            users = [u for u in users if u.id in session_user_ids]

        return users

    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self._connections)

    async def cleanup_stale_connections(self, timeout_seconds: float = 60.0) -> int:
        """
        Remove connections that haven't sent a heartbeat recently.

        Args:
            timeout_seconds: Disconnect after this many seconds without heartbeat

        Returns:
            Number of connections cleaned up
        """
        cleaned = 0
        now = datetime.now(timezone.utc)
        stale = []

        async with self._lock:
            for user_id, connection in self._connections.items():
                try:
                    last_ping = datetime.fromisoformat(
                        connection.last_ping.replace("Z", "+00:00")
                    )
                    if (now - last_ping).total_seconds() > timeout_seconds:
                        stale.append(user_id)
                except (ValueError, TypeError):
                    stale.append(user_id)

        for user_id in stale:
            await self.disconnect(user_id)
            cleaned += 1

        return cleaned

    def stop(self) -> None:
        """Stop the WebSocket manager."""
        self._connections.clear()
        self._sessions.clear()


# Singleton instance
_ws_manager: Optional[CollabWebSocketManager] = None


def get_collab_ws_manager() -> CollabWebSocketManager:
    """Get the default WebSocket manager."""
    global _ws_manager
    if _ws_manager is None:
        _ws_manager = CollabWebSocketManager()
    return _ws_manager


def reset_collab_ws_manager() -> None:
    """Reset the default WebSocket manager."""
    global _ws_manager
    if _ws_manager:
        _ws_manager.stop()
        _ws_manager = None
