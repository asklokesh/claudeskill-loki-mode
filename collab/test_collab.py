"""
Tests for the Collaboration Module

Run with: python -m pytest collab/test_collab.py -v
"""

import asyncio
import json
import tempfile
import threading
import time
from pathlib import Path

import pytest

from .presence import (
    PresenceManager,
    User,
    UserStatus,
    ClientType,
    CursorPosition,
    PresenceEvent,
    PresenceEventType,
    get_presence_manager,
    reset_presence_manager,
)
from .sync import (
    StateSync,
    Operation,
    OperationType,
    OperationalTransform,
    SyncEvent,
    SyncEventType,
    get_state_sync,
    reset_state_sync,
)


# =============================================================================
# Presence Manager Tests
# =============================================================================


class TestUser:
    """Tests for User dataclass."""

    def test_user_creation(self):
        """Test basic user creation."""
        user = User(
            id="test-123",
            name="Alice",
            client_type=ClientType.VSCODE,
        )

        assert user.id == "test-123"
        assert user.name == "Alice"
        assert user.client_type == ClientType.VSCODE
        assert user.status == UserStatus.ONLINE
        assert user.color != ""  # Should have assigned color
        assert user.joined_at != ""

    def test_user_to_dict(self):
        """Test user serialization."""
        user = User(
            id="test-123",
            name="Bob",
            client_type=ClientType.CLI,
            status=UserStatus.BUSY,
        )

        data = user.to_dict()

        assert data["id"] == "test-123"
        assert data["name"] == "Bob"
        assert data["client_type"] == "cli"
        assert data["status"] == "busy"

    def test_user_from_dict(self):
        """Test user deserialization."""
        data = {
            "id": "test-456",
            "name": "Charlie",
            "client_type": "dashboard",
            "status": "away",
            "color": "#FF0000",
            "joined_at": "2025-01-01T00:00:00Z",
            "last_heartbeat": "2025-01-01T00:00:00Z",
        }

        user = User.from_dict(data)

        assert user.id == "test-456"
        assert user.name == "Charlie"
        assert user.client_type == ClientType.DASHBOARD
        assert user.status == UserStatus.AWAY
        assert user.color == "#FF0000"


class TestCursorPosition:
    """Tests for CursorPosition dataclass."""

    def test_cursor_creation(self):
        """Test cursor position creation."""
        cursor = CursorPosition(
            file_path="main.py",
            line=10,
            column=5,
        )

        assert cursor.file_path == "main.py"
        assert cursor.line == 10
        assert cursor.column == 5
        assert cursor.selection_start is None

    def test_cursor_with_selection(self):
        """Test cursor with selection."""
        cursor = CursorPosition(
            file_path="main.py",
            line=10,
            column=5,
            selection_start=(10, 0),
            selection_end=(10, 20),
        )

        assert cursor.selection_start == (10, 0)
        assert cursor.selection_end == (10, 20)

    def test_cursor_serialization(self):
        """Test cursor serialization round trip."""
        original = CursorPosition(
            file_path="test.py",
            line=5,
            column=10,
            selection_start=(5, 0),
            selection_end=(5, 20),
        )

        data = original.to_dict()
        restored = CursorPosition.from_dict(data)

        assert restored.file_path == original.file_path
        assert restored.line == original.line
        assert restored.selection_start == original.selection_start


class TestPresenceManager:
    """Tests for PresenceManager class."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for tests."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / ".loki"

    @pytest.fixture
    def manager(self, temp_dir):
        """Create a PresenceManager instance for tests."""
        reset_presence_manager()
        mgr = PresenceManager(loki_dir=temp_dir)
        yield mgr
        mgr.stop()

    def test_join(self, manager):
        """Test user joining."""
        user = manager.join("Alice", ClientType.VSCODE)

        assert user.name == "Alice"
        assert user.client_type == ClientType.VSCODE
        assert user.status == UserStatus.ONLINE

        # User should be in the list
        users = manager.get_users()
        assert len(users) == 1
        assert users[0].id == user.id

    def test_leave(self, manager):
        """Test user leaving."""
        user = manager.join("Alice", ClientType.VSCODE)
        manager.leave(user.id)

        users = manager.get_users()
        assert len(users) == 0

    def test_leave_nonexistent(self, manager):
        """Test leaving with nonexistent user ID."""
        result = manager.leave("nonexistent-id")
        assert result is False

    def test_heartbeat(self, manager):
        """Test heartbeat updates."""
        user = manager.join("Alice", ClientType.VSCODE)
        old_heartbeat = user.last_heartbeat

        time.sleep(0.1)
        manager.heartbeat(user.id)

        updated_user = manager.get_user(user.id)
        assert updated_user.last_heartbeat > old_heartbeat

    def test_update_cursor(self, manager):
        """Test cursor update."""
        user = manager.join("Alice", ClientType.VSCODE)

        cursor = CursorPosition("main.py", 10, 5)
        manager.update_cursor(user.id, cursor)

        updated_user = manager.get_user(user.id)
        assert updated_user.cursor is not None
        assert updated_user.cursor.file_path == "main.py"
        assert updated_user.cursor.line == 10
        assert updated_user.current_file == "main.py"

    def test_update_status(self, manager):
        """Test status update."""
        user = manager.join("Alice", ClientType.VSCODE)
        manager.update_status(user.id, UserStatus.BUSY)

        updated_user = manager.get_user(user.id)
        assert updated_user.status == UserStatus.BUSY

    def test_get_users_filter_by_client_type(self, manager):
        """Test filtering users by client type."""
        manager.join("Alice", ClientType.VSCODE)
        manager.join("Bob", ClientType.CLI)
        manager.join("Charlie", ClientType.VSCODE)

        vscode_users = manager.get_users(client_type=ClientType.VSCODE)
        assert len(vscode_users) == 2

        cli_users = manager.get_users(client_type=ClientType.CLI)
        assert len(cli_users) == 1

    def test_get_users_in_file(self, manager):
        """Test getting users in a specific file."""
        user1 = manager.join("Alice", ClientType.VSCODE)
        user2 = manager.join("Bob", ClientType.VSCODE)

        manager.update_cursor(user1.id, CursorPosition("main.py", 10, 5))
        manager.update_cursor(user2.id, CursorPosition("other.py", 5, 0))

        users_in_main = manager.get_users_in_file("main.py")
        assert len(users_in_main) == 1
        assert users_in_main[0].name == "Alice"

    def test_subscribe(self, manager):
        """Test event subscription."""
        events = []

        def callback(event):
            events.append(event)

        unsubscribe = manager.subscribe(callback)

        manager.join("Alice", ClientType.VSCODE)

        assert len(events) == 1
        assert events[0].type == PresenceEventType.USER_JOINED

        unsubscribe()

        manager.join("Bob", ClientType.CLI)
        # Should not receive event after unsubscribe
        assert len(events) == 1

    def test_presence_summary(self, manager):
        """Test presence summary."""
        user1 = manager.join("Alice", ClientType.VSCODE)
        user2 = manager.join("Bob", ClientType.CLI)
        manager.update_cursor(user1.id, CursorPosition("main.py", 10, 5))

        summary = manager.get_presence_summary()

        assert summary["total_users"] == 2
        assert "vscode" in summary["by_client_type"]
        assert "cli" in summary["by_client_type"]
        assert "main.py" in summary["by_file"]


# =============================================================================
# State Sync Tests
# =============================================================================


class TestOperation:
    """Tests for Operation dataclass."""

    def test_operation_creation(self):
        """Test basic operation creation."""
        op = Operation(
            type=OperationType.SET,
            path=["tasks", 0, "status"],
            value="done",
            user_id="alice",
        )

        assert op.type == OperationType.SET
        assert op.path == ["tasks", 0, "status"]
        assert op.value == "done"
        assert op.id != ""

    def test_operation_serialization(self):
        """Test operation serialization round trip."""
        original = Operation(
            type=OperationType.INSERT,
            path=["items"],
            value="new item",
            index=0,
            user_id="bob",
        )

        data = original.to_dict()
        restored = Operation.from_dict(data)

        assert restored.type == original.type
        assert restored.path == original.path
        assert restored.value == original.value
        assert restored.index == original.index


class TestOperationalTransform:
    """Tests for Operational Transformation."""

    def test_transform_independent_ops(self):
        """Test that independent operations are not transformed."""
        op1 = Operation(type=OperationType.SET, path=["a"], value=1)
        op2 = Operation(type=OperationType.SET, path=["b"], value=2)

        t_op1, t_op2 = OperationalTransform.transform_pair(op1, op2)

        assert t_op1.path == ["a"]
        assert t_op2.path == ["b"]

    def test_transform_conflicting_sets(self):
        """Test transformation of conflicting SET operations."""
        op1 = Operation(type=OperationType.SET, path=["x"], value=1)
        op2 = Operation(type=OperationType.SET, path=["x"], value=2)

        t_op1, t_op2 = OperationalTransform.transform_pair(op1, op2, priority_to_first=True)

        # op1 should win, op2 should adopt op1's value
        assert t_op2.value == 1

    def test_transform_list_inserts(self):
        """Test transformation of list insert operations."""
        op1 = Operation(type=OperationType.INSERT, path=["items"], index=0, value="a")
        op2 = Operation(type=OperationType.INSERT, path=["items"], index=0, value="b")

        t_op1, t_op2 = OperationalTransform.transform_pair(op1, op2)

        # Second insert should be shifted
        assert t_op2.index == 1

    def test_transform_list_removes(self):
        """Test transformation of list remove operations."""
        op1 = Operation(type=OperationType.REMOVE, path=["items"], index=0)
        op2 = Operation(type=OperationType.REMOVE, path=["items"], index=2)

        t_op1, t_op2 = OperationalTransform.transform_pair(op1, op2)

        # Second remove index should be adjusted
        assert t_op2.index == 1


class TestStateSync:
    """Tests for StateSync class."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for tests."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / ".loki"

    @pytest.fixture
    def sync(self, temp_dir):
        """Create a StateSync instance for tests."""
        reset_state_sync()
        s = StateSync(loki_dir=temp_dir)
        yield s
        s.stop()

    def test_set_operation(self, sync):
        """Test SET operation."""
        op = Operation(type=OperationType.SET, path=["key"], value="value")
        success, event = sync.apply_operation(op)

        assert success
        assert event.type == SyncEventType.OPERATION_APPLIED

        state = sync.get_state()
        assert state["key"] == "value"

    def test_nested_set_operation(self, sync):
        """Test SET operation on nested path."""
        # First create parent
        sync.apply_operation(Operation(type=OperationType.SET, path=["parent"], value={}))

        # Then set nested value
        op = Operation(type=OperationType.SET, path=["parent", "child"], value="nested")
        success, _ = sync.apply_operation(op)

        assert success
        found, value = sync.get_value(["parent", "child"])
        assert found
        assert value == "nested"

    def test_delete_operation(self, sync):
        """Test DELETE operation."""
        sync.apply_operation(Operation(type=OperationType.SET, path=["key"], value="value"))
        op = Operation(type=OperationType.DELETE, path=["key"])
        success, _ = sync.apply_operation(op)

        assert success
        found, _ = sync.get_value(["key"])
        assert not found

    def test_insert_operation(self, sync):
        """Test INSERT operation on lists."""
        sync.apply_operation(Operation(type=OperationType.SET, path=["items"], value=[]))

        op = Operation(type=OperationType.INSERT, path=["items"], index=0, value="first")
        success, _ = sync.apply_operation(op)

        assert success
        found, value = sync.get_value(["items"])
        assert value == ["first"]

    def test_remove_operation(self, sync):
        """Test REMOVE operation on lists."""
        sync.apply_operation(Operation(type=OperationType.SET, path=["items"], value=["a", "b", "c"]))

        op = Operation(type=OperationType.REMOVE, path=["items"], index=1)
        success, _ = sync.apply_operation(op)

        assert success
        found, value = sync.get_value(["items"])
        assert value == ["a", "c"]

    def test_increment_operation(self, sync):
        """Test INCREMENT operation."""
        sync.apply_operation(Operation(type=OperationType.SET, path=["count"], value=5))

        op = Operation(type=OperationType.INCREMENT, path=["count"], value=3)
        success, _ = sync.apply_operation(op)

        assert success
        found, value = sync.get_value(["count"])
        assert value == 8

    def test_append_operation(self, sync):
        """Test APPEND operation."""
        sync.apply_operation(Operation(type=OperationType.SET, path=["items"], value=["a"]))

        op = Operation(type=OperationType.APPEND, path=["items"], value="b")
        success, _ = sync.apply_operation(op)

        assert success
        found, value = sync.get_value(["items"])
        assert value == ["a", "b"]

    def test_version_tracking(self, sync):
        """Test that versions are tracked."""
        assert sync.get_version() == 0

        sync.apply_operation(Operation(type=OperationType.SET, path=["a"], value=1))
        assert sync.get_version() == 1

        sync.apply_operation(Operation(type=OperationType.SET, path=["b"], value=2))
        assert sync.get_version() == 2

    def test_get_history(self, sync):
        """Test operation history."""
        sync.apply_operation(Operation(type=OperationType.SET, path=["a"], value=1))
        sync.apply_operation(Operation(type=OperationType.SET, path=["b"], value=2))
        sync.apply_operation(Operation(type=OperationType.SET, path=["c"], value=3))

        history = sync.get_history()
        assert len(history) == 3

        history_since_1 = sync.get_history(since_version=1)
        assert len(history_since_1) == 2

    def test_state_hash(self, sync):
        """Test state hash for consistency checking."""
        hash1 = sync.get_state_hash()

        sync.apply_operation(Operation(type=OperationType.SET, path=["key"], value="value"))
        hash2 = sync.get_state_hash()

        assert hash1 != hash2

        # Same state should give same hash
        sync2 = StateSync(enable_persistence=False)
        sync2.apply_operation(Operation(type=OperationType.SET, path=["key"], value="value"))
        hash3 = sync2.get_state_hash()
        sync2.stop()

        assert hash2 == hash3

    def test_sync_state(self, sync):
        """Test full state synchronization."""
        # Local state
        sync.apply_operation(Operation(type=OperationType.SET, path=["local"], value=1))

        # Incoming remote state with higher version
        remote_state = {"remote": 2}
        merged, event = sync.sync_state(remote_state, remote_version=10)

        # Remote should win (higher version)
        assert merged == remote_state
        assert sync.get_version() == 10

    def test_subscribe(self, sync):
        """Test event subscription."""
        events = []

        def callback(event):
            events.append(event)

        unsubscribe = sync.subscribe(callback)

        sync.apply_operation(Operation(type=OperationType.SET, path=["key"], value="value"))

        assert len(events) == 1
        assert events[0].type == SyncEventType.OPERATION_APPLIED

        unsubscribe()

        sync.apply_operation(Operation(type=OperationType.SET, path=["key2"], value="value2"))
        assert len(events) == 1  # No new events after unsubscribe


class TestRemoteOperations:
    """Tests for remote operation handling."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for tests."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / ".loki"

    @pytest.fixture
    def sync(self, temp_dir):
        """Create a StateSync instance for tests."""
        reset_state_sync()
        s = StateSync(loki_dir=temp_dir)
        yield s
        s.stop()

    def test_apply_remote_operation(self, sync):
        """Test applying a remote operation."""
        remote_op = Operation(
            type=OperationType.SET,
            path=["remote_key"],
            value="remote_value",
            user_id="remote_user",
            version=5,
        )

        success, event = sync.apply_remote_operation(remote_op)

        assert success
        found, value = sync.get_value(["remote_key"])
        assert value == "remote_value"

    def test_concurrent_operations(self, sync):
        """Test handling concurrent operations."""
        # Local operation
        local_op = Operation(
            type=OperationType.SET,
            path=["key"],
            value="local",
            user_id="local_user",
        )
        sync.apply_operation(local_op)

        # Concurrent remote operation on same key
        remote_op = Operation(
            type=OperationType.SET,
            path=["key"],
            value="remote",
            user_id="remote_user",
            version=0,  # Same version as when local was made
        )

        success, _ = sync.apply_remote_operation(remote_op, transform_against_pending=True)

        assert success
        # With OT, local should win (was applied first)
        found, value = sync.get_value(["key"])
        # Value depends on transform priority


# =============================================================================
# Integration Tests
# =============================================================================


class TestCollabIntegration:
    """Integration tests for collaboration module."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for tests."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / ".loki"

    def test_multiple_users_workflow(self, temp_dir):
        """Test a workflow with multiple users."""
        reset_presence_manager()
        reset_state_sync()

        presence = PresenceManager(loki_dir=temp_dir)
        sync = StateSync(loki_dir=temp_dir)

        try:
            # Users join
            alice = presence.join("Alice", ClientType.VSCODE)
            bob = presence.join("Bob", ClientType.CLI)

            assert len(presence.get_users()) == 2

            # Alice makes changes
            sync.apply_operation(Operation(
                type=OperationType.SET,
                path=["project", "tasks"],
                value=[],
                user_id=alice.id,
            ))

            sync.apply_operation(Operation(
                type=OperationType.INSERT,
                path=["project", "tasks"],
                index=0,
                value={"id": 1, "title": "Task 1", "status": "pending"},
                user_id=alice.id,
            ))

            # Bob makes changes
            sync.apply_operation(Operation(
                type=OperationType.INSERT,
                path=["project", "tasks"],
                index=1,
                value={"id": 2, "title": "Task 2", "status": "pending"},
                user_id=bob.id,
            ))

            # Verify state
            found, tasks = sync.get_value(["project", "tasks"])
            assert found
            assert len(tasks) == 2

            # Update cursors
            presence.update_cursor(alice.id, CursorPosition("main.py", 10, 5))
            presence.update_cursor(bob.id, CursorPosition("main.py", 20, 0))

            # Both in same file
            users_in_file = presence.get_users_in_file("main.py")
            assert len(users_in_file) == 2

            # Bob leaves
            presence.leave(bob.id)
            assert len(presence.get_users()) == 1

        finally:
            presence.stop()
            sync.stop()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
