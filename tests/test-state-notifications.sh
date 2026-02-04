#!/usr/bin/env bash
#
# Test suite for State Change Notifications (SYN-016)
#
# Tests:
# 1. File-based notification channel
# 2. In-memory notification channel
# 3. Filtered subscriptions (file filter, change type filter)
# 4. Event bus integration
# 5. Notification delivery

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_DIR="/tmp/loki-test-notifications-$$"
LOKI_DIR="$TEST_DIR/.loki"

log_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

cleanup() {
    echo ""
    echo "Cleaning up..."
    rm -rf "$TEST_DIR"
    # Kill any background processes
    pkill -f "loki-test-notifications" 2>/dev/null || true
}

trap cleanup EXIT

setup() {
    echo "Setting up test environment..."
    mkdir -p "$LOKI_DIR"/{state,queue,memory,events}
    cd "$PROJECT_DIR"
}

# Test 1: File-based notification channel writes notifications
test_file_notification_channel() {
    log_test "File-based notification channel"

    local notification_file="$LOKI_DIR/notifications.jsonl"

    # Create a Python test script
    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    FileNotificationChannel,
    ManagedFile
)

# Create state manager and file notification channel
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)
channel = FileNotificationChannel(Path('$notification_file'))
manager.add_notification_channel(channel)

# Make a state change
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "test", "status": "running"}, source="test")

# Clean up
manager.stop()
EOF

    # Check if notification file was created and has content
    if [ -f "$notification_file" ]; then
        local content
        content=$(cat "$notification_file")
        if echo "$content" | grep -q "state/orchestrator.json"; then
            log_pass "File notification channel wrote notification"
        else
            log_fail "File notification channel missing expected content"
        fi
    else
        log_fail "File notification channel did not create notification file"
    fi
}

# Test 2: In-memory notification channel stores notifications
test_in_memory_notification_channel() {
    log_test "In-memory notification channel"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    InMemoryNotificationChannel,
    ManagedFile
)

# Create state manager and in-memory notification channel
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)
channel = InMemoryNotificationChannel(max_size=100)
manager.add_notification_channel(channel)

# Make multiple state changes
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "init"}, source="test1")
manager.set_state(ManagedFile.AUTONOMY, {"status": "running"}, source="test2")
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "planning"}, source="test3")

# Check notifications
notifications = channel.get_notifications()
assert len(notifications) == 3, f"Expected 3 notifications, got {len(notifications)}"
assert notifications[0]["file_path"] == "state/orchestrator.json"
assert notifications[1]["file_path"] == "autonomy-state.json"
assert notifications[2]["change_type"] == "update"

print("SUCCESS: In-memory channel captured 3 notifications")

# Clean up
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "In-memory notification channel stores notifications"
    else
        log_fail "In-memory notification channel test failed"
    fi
}

# Test 3: Filtered subscription by file
test_filtered_subscription_by_file() {
    log_test "Filtered subscription by file"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    ManagedFile
)

# Create state manager
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)

# Track notifications
received = []

def on_orchestrator_change(change):
    received.append(change)

# Subscribe only to orchestrator changes
unsubscribe = manager.subscribe(
    on_orchestrator_change,
    file_filter=[ManagedFile.ORCHESTRATOR]
)

# Make changes to different files
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "test1"}, source="test")
manager.set_state(ManagedFile.AUTONOMY, {"status": "running"}, source="test")  # Should NOT trigger
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "test2"}, source="test")

# Verify only orchestrator changes were received
assert len(received) == 2, f"Expected 2 notifications (orchestrator only), got {len(received)}"
assert all(c.file_path == "state/orchestrator.json" for c in received)

print("SUCCESS: File filter works correctly")

# Clean up
unsubscribe()
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "Filtered subscription by file works"
    else
        log_fail "Filtered subscription by file test failed"
    fi
}

# Test 4: Filtered subscription by change type
test_filtered_subscription_by_change_type() {
    log_test "Filtered subscription by change type"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    ManagedFile
)

# Create state manager
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)

# Track notifications
received = []

def on_create_only(change):
    received.append(change)

# Subscribe only to create events
unsubscribe = manager.subscribe(
    on_create_only,
    change_types=["create"]
)

# Clear existing state first
test_file = "$LOKI_DIR/state/test-change-type.json"
import os
if os.path.exists(test_file):
    os.remove(test_file)

# Make changes - first is create, second is update
manager.set_state("state/test-change-type.json", {"value": 1}, source="test")  # CREATE
manager.set_state("state/test-change-type.json", {"value": 2}, source="test")  # UPDATE - should NOT trigger

# Verify only create was received
assert len(received) == 1, f"Expected 1 notification (create only), got {len(received)}"
assert received[0].change_type == "create"

print("SUCCESS: Change type filter works correctly")

# Clean up
unsubscribe()
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "Filtered subscription by change type works"
    else
        log_fail "Filtered subscription by change type test failed"
    fi
}

# Test 5: SubscriptionFilter object
test_subscription_filter_object() {
    log_test "SubscriptionFilter object"

    # Use a fresh subdirectory to avoid state from previous tests
    local test_subdir="$LOKI_DIR/filter-test"
    mkdir -p "$test_subdir"/{state,queue,memory,events}

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    SubscriptionFilter,
    ManagedFile
)

# Create state manager with fresh directory
manager = StateManager(loki_dir=Path('$test_subdir'), enable_watch=False, enable_events=False)

# Track notifications
received = []

def on_filtered_change(change):
    received.append(change)

# Create a filter for orchestrator updates only
filter_obj = SubscriptionFilter(
    files=[ManagedFile.ORCHESTRATOR],
    change_types=["update"]
)

# Subscribe with filter object
unsubscribe = manager.subscribe_filtered(on_filtered_change, filter_obj)

# Make various changes
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "init"}, source="test")  # CREATE - no match
manager.set_state(ManagedFile.AUTONOMY, {"status": "running"}, source="test")  # Wrong file - no match
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "planning"}, source="test")  # UPDATE - match!

# Verify only the orchestrator update was received
assert len(received) == 1, f"Expected 1 notification, got {len(received)}"
assert received[0].file_path == "state/orchestrator.json"
assert received[0].change_type == "update"

print("SUCCESS: SubscriptionFilter object works correctly")

# Clean up
unsubscribe()
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "SubscriptionFilter object works"
    else
        log_fail "SubscriptionFilter object test failed"
    fi
}

# Test 6: Notification diff contains correct data
test_notification_diff() {
    log_test "Notification diff contains correct data"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    InMemoryNotificationChannel,
    ManagedFile
)

# Create state manager with in-memory channel
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)
channel = InMemoryNotificationChannel()
manager.add_notification_channel(channel)

# Set initial state
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "init", "count": 0, "keep": True}, source="test")

# Update state
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "planning", "count": 0, "new_field": "added"}, source="test")

# Get the second notification (update)
notifications = channel.get_notifications()
update_notification = notifications[1]
diff = update_notification["diff"]

# Check diff structure
assert "added" in diff
assert "removed" in diff
assert "changed" in diff

# Check specific changes
assert "new_field" in diff["added"], "new_field should be in added"
assert "keep" in diff["removed"], "keep should be in removed"
assert "phase" in diff["changed"], "phase should be in changed"
assert diff["changed"]["phase"]["old"] == "init"
assert diff["changed"]["phase"]["new"] == "planning"

print("SUCCESS: Diff contains correct change data")

# Clean up
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "Notification diff contains correct data"
    else
        log_fail "Notification diff test failed"
    fi
}

# Test 7: Multiple notification channels
test_multiple_notification_channels() {
    log_test "Multiple notification channels"

    local notification_file="$LOKI_DIR/multi-notifications.jsonl"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    FileNotificationChannel,
    InMemoryNotificationChannel,
    ManagedFile
)

# Create state manager with multiple channels
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)

file_channel = FileNotificationChannel(Path('$notification_file'))
memory_channel = InMemoryNotificationChannel()

remove_file = manager.add_notification_channel(file_channel)
remove_memory = manager.add_notification_channel(memory_channel)

# Make a state change
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "multi-test"}, source="test")

# Both channels should have received the notification
memory_notifications = memory_channel.get_notifications()
assert len(memory_notifications) == 1, f"Memory channel should have 1 notification, got {len(memory_notifications)}"

# File should exist and have content
import os
assert os.path.exists('$notification_file'), "File channel should have created file"

print("SUCCESS: Multiple notification channels work")

# Clean up
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "Multiple notification channels work"
    else
        log_fail "Multiple notification channels test failed"
    fi
}

# Test 8: Remove notification channel
test_remove_notification_channel() {
    log_test "Remove notification channel"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    InMemoryNotificationChannel,
    ManagedFile
)

# Create state manager
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)

channel = InMemoryNotificationChannel()
remove_channel = manager.add_notification_channel(channel)

# Make a change - should be received
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "before-remove"}, source="test")
assert len(channel.get_notifications()) == 1

# Remove the channel
remove_channel()

# Make another change - should NOT be received
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "after-remove"}, source="test")
assert len(channel.get_notifications()) == 1, "Should still have only 1 notification after channel removal"

print("SUCCESS: Channel removal works correctly")

# Clean up
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "Remove notification channel works"
    else
        log_fail "Remove notification channel test failed"
    fi
}

# Test 9: Unsubscribe callback
test_unsubscribe_callback() {
    log_test "Unsubscribe callback"

    python3 << EOF
import sys
sys.path.insert(0, '$PROJECT_DIR')

from pathlib import Path
from state.manager import (
    StateManager,
    ManagedFile
)

# Create state manager
manager = StateManager(loki_dir=Path('$LOKI_DIR'), enable_watch=False, enable_events=False)

received = []

def on_change(change):
    received.append(change)

# Subscribe
unsubscribe = manager.subscribe(on_change)

# Make a change - should be received
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "before-unsub"}, source="test")
assert len(received) == 1

# Unsubscribe
unsubscribe()

# Make another change - should NOT be received
manager.set_state(ManagedFile.ORCHESTRATOR, {"phase": "after-unsub"}, source="test")
assert len(received) == 1, "Should still have only 1 notification after unsubscribe"

print("SUCCESS: Unsubscribe works correctly")

# Clean up
manager.stop()
EOF

    if [ $? -eq 0 ]; then
        log_pass "Unsubscribe callback works"
    else
        log_fail "Unsubscribe callback test failed"
    fi
}

# Run all tests
main() {
    echo ""
    echo "========================================"
    echo "State Change Notifications Tests (SYN-016)"
    echo "========================================"
    echo ""

    setup

    test_file_notification_channel
    test_in_memory_notification_channel
    test_filtered_subscription_by_file
    test_filtered_subscription_by_change_type
    test_subscription_filter_object
    test_notification_diff
    test_multiple_notification_channels
    test_remove_notification_channel
    test_unsubscribe_callback

    echo ""
    echo "========================================"
    echo "Test Results: ${GREEN}$TESTS_PASSED passed${NC}, ${RED}$TESTS_FAILED failed${NC}"
    echo "========================================"
    echo ""

    if [ $TESTS_FAILED -gt 0 ]; then
        exit 1
    fi
}

main "$@"
