#!/usr/bin/env bash
# Test state versioning for rollback (SYN-015)

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR=$(mktemp -d)
LOKI_DIR="$TEST_DIR/.loki"
PASSED=0
FAILED=0

cleanup() {
    rm -rf "$TEST_DIR" 2>/dev/null || true
}
trap cleanup EXIT

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Create test Python script for versioning
create_test_script() {
    cat > "$TEST_DIR/test_versioning.py" << 'PYTHON_SCRIPT'
#!/usr/bin/env python3
"""Test state versioning functionality."""

import sys
import os
import json
import time

# Add project root to path
sys.path.insert(0, os.environ.get('PROJECT_ROOT', '.'))

from state.manager import StateManager, reset_state_manager, ManagedFile

def test_version_creation():
    """Test that versions are created on state updates."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=10
    )

    try:
        # Set initial state
        manager.set_state("test/versioning.json", {"value": 1, "name": "first"})

        # Update state multiple times
        manager.set_state("test/versioning.json", {"value": 2, "name": "second"})
        manager.set_state("test/versioning.json", {"value": 3, "name": "third"})

        # Check version count (should be 2 - first and second were saved)
        count = manager.get_version_count("test/versioning.json")
        if count == 2:
            print("PASS: test_version_creation - version count is correct")
            return True
        else:
            print(f"FAIL: test_version_creation - expected 2 versions, got {count}")
            return False
    finally:
        manager.stop()

def test_version_history():
    """Test retrieving version history."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=10
    )

    try:
        # Set state multiple times
        manager.set_state("test/history.json", {"step": 1})
        time.sleep(0.01)  # Small delay to ensure different timestamps
        manager.set_state("test/history.json", {"step": 2})
        time.sleep(0.01)
        manager.set_state("test/history.json", {"step": 3})

        # Get version history
        history = manager.get_version_history("test/history.json")

        if len(history) == 2:  # Two previous versions saved
            # Check they are sorted newest first
            if history[0].version > history[1].version:
                print("PASS: test_version_history - history is correctly sorted")
                return True
            else:
                print("FAIL: test_version_history - history not sorted correctly")
                return False
        else:
            print(f"FAIL: test_version_history - expected 2 versions in history, got {len(history)}")
            return False
    finally:
        manager.stop()

def test_get_state_at_version():
    """Test retrieving state at a specific version."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=10
    )

    try:
        # Set state multiple times
        manager.set_state("test/at_version.json", {"data": "version1"})
        manager.set_state("test/at_version.json", {"data": "version2"})
        manager.set_state("test/at_version.json", {"data": "version3"})

        # Get state at version 1 (the first saved version, which was "version1")
        state_v1 = manager.get_state_at_version("test/at_version.json", 1)

        if state_v1 and state_v1.get("data") == "version1":
            print("PASS: test_get_state_at_version - retrieved correct state")
            return True
        else:
            print(f"FAIL: test_get_state_at_version - expected 'version1', got {state_v1}")
            return False
    finally:
        manager.stop()

def test_rollback():
    """Test rolling back to a previous version."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=10
    )

    try:
        # Set state multiple times
        manager.set_state("test/rollback.json", {"phase": "initial"})
        manager.set_state("test/rollback.json", {"phase": "middle"})
        manager.set_state("test/rollback.json", {"phase": "final"})

        # Rollback to version 1 (initial state)
        change = manager.rollback("test/rollback.json", 1)

        if change is None:
            print("FAIL: test_rollback - rollback returned None")
            return False

        # Check current state is rolled back
        current = manager.get_state("test/rollback.json")
        if current and current.get("phase") == "initial":
            print("PASS: test_rollback - state correctly rolled back")
            return True
        else:
            print(f"FAIL: test_rollback - expected 'initial', got {current}")
            return False
    finally:
        manager.stop()

def test_version_retention():
    """Test that old versions are cleaned up."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=3  # Only keep 3 versions
    )

    try:
        # Create more versions than retention limit
        for i in range(6):
            manager.set_state("test/retention.json", {"iteration": i})

        # Should only have 3 versions (retention limit)
        count = manager.get_version_count("test/retention.json")
        if count == 3:
            print("PASS: test_version_retention - old versions cleaned up")
            return True
        else:
            print(f"FAIL: test_version_retention - expected 3 versions, got {count}")
            return False
    finally:
        manager.stop()

def test_clear_version_history():
    """Test clearing version history."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=10
    )

    try:
        # Create some versions
        manager.set_state("test/clear.json", {"v": 1})
        manager.set_state("test/clear.json", {"v": 2})
        manager.set_state("test/clear.json", {"v": 3})

        # Clear history
        removed = manager.clear_version_history("test/clear.json")

        if removed >= 2:  # At least 2 versions should have been removed
            count = manager.get_version_count("test/clear.json")
            if count == 0:
                print("PASS: test_clear_version_history - history cleared")
                return True
            else:
                print(f"FAIL: test_clear_version_history - still have {count} versions")
                return False
        else:
            print(f"FAIL: test_clear_version_history - only removed {removed} versions")
            return False
    finally:
        manager.stop()

def test_disabled_versioning():
    """Test that versioning can be disabled."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=False  # Disabled
    )

    try:
        # Set state multiple times
        manager.set_state("test/disabled.json", {"v": 1})
        manager.set_state("test/disabled.json", {"v": 2})
        manager.set_state("test/disabled.json", {"v": 3})

        # Should have no versions
        count = manager.get_version_count("test/disabled.json")
        if count == 0:
            print("PASS: test_disabled_versioning - no versions created when disabled")
            return True
        else:
            print(f"FAIL: test_disabled_versioning - expected 0 versions, got {count}")
            return False
    finally:
        manager.stop()

def test_rollback_nonexistent_version():
    """Test rolling back to a non-existent version."""
    manager = StateManager(
        loki_dir=os.environ.get('LOKI_DIR', '.loki'),
        enable_watch=False,
        enable_events=False,
        enable_versioning=True,
        version_retention=10
    )

    try:
        manager.set_state("test/nonexistent.json", {"v": 1})

        # Try to rollback to a version that doesn't exist
        result = manager.rollback("test/nonexistent.json", 999)

        if result is None:
            print("PASS: test_rollback_nonexistent_version - correctly returned None")
            return True
        else:
            print("FAIL: test_rollback_nonexistent_version - should have returned None")
            return False
    finally:
        manager.stop()

if __name__ == "__main__":
    tests = [
        test_version_creation,
        test_version_history,
        test_get_state_at_version,
        test_rollback,
        test_version_retention,
        test_clear_version_history,
        test_disabled_versioning,
        test_rollback_nonexistent_version,
    ]

    passed = 0
    failed = 0

    for test in tests:
        reset_state_manager()  # Reset between tests
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"FAIL: {test.__name__} - Exception: {e}")
            failed += 1

    print(f"\nResults: {passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
PYTHON_SCRIPT
    chmod +x "$TEST_DIR/test_versioning.py"
}

# Main test execution
log_info "Testing state versioning (SYN-015)"
log_info "Test directory: $TEST_DIR"
log_info "Project root: $PROJECT_ROOT"

# Create test script
create_test_script

# Ensure .loki directory exists
mkdir -p "$LOKI_DIR"

# Run Python tests
log_info "Running Python versioning tests..."
cd "$PROJECT_ROOT"
export LOKI_DIR="$LOKI_DIR"
export PROJECT_ROOT="$PROJECT_ROOT"

if python3 "$TEST_DIR/test_versioning.py"; then
    log_pass "All Python versioning tests passed"
else
    log_fail "Some Python versioning tests failed"
fi

# Summary
echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi

exit 0
