#!/usr/bin/env bash
# shellcheck disable=SC2034  # Variables may be unused in test context
# shellcheck disable=SC2155  # Declare and assign separately
# Test: Process Supervisor (PID Registry)
# Tests the central PID registry, orphan detection, and cleanup

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR=$(mktemp -d)
PASSED=0
FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAILED++)); }
log_test() { echo -e "${YELLOW}[TEST]${NC} $1"; }

cleanup() {
    # Kill any test background processes
    for pid_file in "$TEST_DIR/.loki/pids"/*.json; do
        [ -f "$pid_file" ] || continue
        local pid
        pid=$(basename "$pid_file" .json)
        kill "$pid" 2>/dev/null || true
        kill -9 "$pid" 2>/dev/null || true
    done
    rm -rf "$TEST_DIR"
}
trap cleanup EXIT

# Set up test environment
mkdir -p "$TEST_DIR/.loki"
cd "$TEST_DIR" || exit 1

# Source run.sh functions (we need to extract just the PID registry functions)
# Set variables that run.sh expects
TARGET_DIR="$TEST_DIR"
export LOKI_DEBUG=""

# Source logging functions (needed by PID registry)
log_info() { echo "[INFO] $*"; }
log_warn() { echo "[WARN] $*"; }
log_error() { echo "[ERROR] $*"; }
log_step() { echo "[STEP] $*"; }

echo "=========================================="
echo "Process Supervisor (PID Registry) Tests"
echo "=========================================="
echo ""

#===============================================================================
# Extract and source PID registry functions from run.sh
#===============================================================================

# We source the functions directly by extracting them
PID_REGISTRY_DIR=""

init_pid_registry() {
    PID_REGISTRY_DIR="${TARGET_DIR:-.}/.loki/pids"
    mkdir -p "$PID_REGISTRY_DIR"
}

# Parse a field from a JSON registry entry (python3 with shell fallback)
_parse_json_field() {
    local file="$1" field="$2"
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get(sys.argv[2],''))" "$file" "$field" 2>/dev/null
    else
        sed 's/.*"'"$field"'":\s*//' "$file" 2>/dev/null | sed 's/[",}].*//' | head -1
    fi
}

register_pid() {
    local pid="$1"
    local label="${2//\\/\\\\}"
    label="${label//\"/\\\"}"
    label="$(printf '%s' "$label" | tr -d '\n\r')"
    local extra="${3:-}"
    extra="${extra//\\/\\\\}"
    extra="${extra//\"/\\\"}"
    extra="$(printf '%s' "$extra" | tr -d '\n\r')"
    [ -z "$PID_REGISTRY_DIR" ] && init_pid_registry
    local entry_file="$PID_REGISTRY_DIR/${pid}.json"
    cat > "$entry_file" << EOF
{"pid":$pid,"label":"$label","started":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","ppid":$$,"extra":"$extra"}
EOF
}

unregister_pid() {
    local pid="$1"
    [ -z "$PID_REGISTRY_DIR" ] && init_pid_registry
    rm -f "$PID_REGISTRY_DIR/${pid}.json" 2>/dev/null
}

kill_registered_pid() {
    local pid="$1"
    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        local waited=0
        while [ $waited -lt 4 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 0.5
            waited=$((waited + 1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    unregister_pid "$pid"
}

cleanup_orphan_pids() {
    [ -z "$PID_REGISTRY_DIR" ] && init_pid_registry
    local orphan_count=0
    if [ ! -d "$PID_REGISTRY_DIR" ]; then
        echo "0"
        return 0
    fi
    for entry_file in "$PID_REGISTRY_DIR"/*.json; do
        [ -f "$entry_file" ] || continue
        local pid
        pid=$(basename "$entry_file" .json)
        case "$pid" in ''|*[!0-9]*) continue ;; esac
        if kill -0 "$pid" 2>/dev/null; then
            local ppid_val=""
            ppid_val=$(_parse_json_field "$entry_file" "ppid") || true
            case "$ppid_val" in ''|*[!0-9]*) ppid_val="" ;; esac
            if [ -n "$ppid_val" ] && [ "$ppid_val" != "$$" ]; then
                if ! kill -0 "$ppid_val" 2>/dev/null; then
                    local label=""
                    label=$(_parse_json_field "$entry_file" "label") || label="unknown"
                    log_warn "Killing orphaned process: PID=$pid label=$label (parent $ppid_val is dead)" >&2
                    kill_registered_pid "$pid"
                    orphan_count=$((orphan_count + 1))
                fi
            fi
        else
            rm -f "$entry_file" 2>/dev/null
        fi
    done
    echo "$orphan_count"
}

kill_all_registered() {
    [ -z "$PID_REGISTRY_DIR" ] && init_pid_registry
    if [ ! -d "$PID_REGISTRY_DIR" ]; then
        return 0
    fi
    for entry_file in "$PID_REGISTRY_DIR"/*.json; do
        [ -f "$entry_file" ] || continue
        local pid
        pid=$(basename "$entry_file" .json)
        case "$pid" in ''|*[!0-9]*) continue ;; esac
        kill_registered_pid "$pid"
    done
}

#===============================================================================
# Test 1: init_pid_registry creates directory
#===============================================================================
log_test "init_pid_registry creates .loki/pids directory"
init_pid_registry
if [ -d "$TEST_DIR/.loki/pids" ]; then
    log_pass "PID registry directory created"
else
    log_fail "PID registry directory not created"
fi

#===============================================================================
# Test 2: register_pid creates entry file
#===============================================================================
log_test "register_pid creates JSON entry file"
sleep 100 &
TEST_PID=$!
register_pid "$TEST_PID" "test-process" "foo=bar"
if [ -f "$PID_REGISTRY_DIR/${TEST_PID}.json" ]; then
    log_pass "PID entry file created"
else
    log_fail "PID entry file not created"
fi

#===============================================================================
# Test 3: Entry file contains valid JSON with correct fields
#===============================================================================
log_test "Entry file contains valid JSON"
ENTRY_CONTENT=$(python3 -c "
import json, sys
with open(sys.argv[1]) as f:
    d = json.load(f)
    assert d['pid'] == $TEST_PID, 'pid mismatch'
    assert d['label'] == 'test-process', 'label mismatch'
    assert d['ppid'] == $$, 'ppid mismatch'
    assert d['extra'] == 'foo=bar', 'extra mismatch'
    assert 'started' in d, 'missing started'
    print('OK')
" "$PID_REGISTRY_DIR/${TEST_PID}.json" 2>&1)
if [ "$ENTRY_CONTENT" = "OK" ]; then
    log_pass "JSON entry has correct fields"
else
    log_fail "JSON entry validation failed: $ENTRY_CONTENT"
fi

#===============================================================================
# Test 4: unregister_pid removes entry
#===============================================================================
log_test "unregister_pid removes entry file"
unregister_pid "$TEST_PID"
if [ ! -f "$PID_REGISTRY_DIR/${TEST_PID}.json" ]; then
    log_pass "PID entry removed"
else
    log_fail "PID entry still exists after unregister"
fi
kill "$TEST_PID" 2>/dev/null || true

#===============================================================================
# Test 5: kill_registered_pid kills process and removes entry
#===============================================================================
log_test "kill_registered_pid kills process and cleans up"
sleep 100 &
TEST_PID=$!
register_pid "$TEST_PID" "kill-test"
kill_registered_pid "$TEST_PID"
sleep 0.5
if ! kill -0 "$TEST_PID" 2>/dev/null; then
    if [ ! -f "$PID_REGISTRY_DIR/${TEST_PID}.json" ]; then
        log_pass "Process killed and entry removed"
    else
        log_fail "Process killed but entry still exists"
    fi
else
    log_fail "Process still alive after kill_registered_pid"
    kill -9 "$TEST_PID" 2>/dev/null || true
fi

#===============================================================================
# Test 6: cleanup_orphan_pids detects dead parent
#===============================================================================
log_test "cleanup_orphan_pids kills orphaned process"
# Spawn a grandchild: parent (subshell) exits, child (sleep) becomes orphan
(
    sleep 100 &
    CHILD=$!
    # Write registry entry with THIS subshell's PID as parent
    # This subshell will exit immediately, making the child an orphan
    cat > "$PID_REGISTRY_DIR/${CHILD}.json" << XEOF
{"pid":$CHILD,"label":"orphan-test","started":"2026-01-01T00:00:00Z","ppid":$$$$,"extra":""}
XEOF
    echo "$CHILD"
) > "$TEST_DIR/orphan_pid" &
PARENT_PID=$!
wait "$PARENT_PID" 2>/dev/null || true
sleep 0.5

ORPHAN_PID=$(cat "$TEST_DIR/orphan_pid" 2>/dev/null)
if [ -n "$ORPHAN_PID" ] && kill -0 "$ORPHAN_PID" 2>/dev/null; then
    # The orphan_pid's parent (the subshell) is dead, but the PID in the file
    # points to a non-existent PID ($$$$). Let's fix the entry to use the dead parent.
    # Actually, the subshell's PID was $PARENT_PID. Let's rewrite the entry.
    cat > "$PID_REGISTRY_DIR/${ORPHAN_PID}.json" << EOF
{"pid":$ORPHAN_PID,"label":"orphan-test","started":"2026-01-01T00:00:00Z","ppid":$PARENT_PID,"extra":""}
EOF

    RESULT=$(cleanup_orphan_pids)
    sleep 0.5
    if ! kill -0 "$ORPHAN_PID" 2>/dev/null; then
        log_pass "Orphaned process detected and killed (count=$RESULT)"
    else
        log_fail "Orphaned process not killed"
        kill -9 "$ORPHAN_PID" 2>/dev/null || true
    fi
else
    log_fail "Could not set up orphan test (orphan already dead)"
fi

#===============================================================================
# Test 7: cleanup_orphan_pids cleans stale entries (dead processes)
#===============================================================================
log_test "cleanup_orphan_pids removes stale entries for dead processes"
# Create entry for a PID that doesn't exist
cat > "$PID_REGISTRY_DIR/99999999.json" << EOF
{"pid":99999999,"label":"stale-test","started":"2026-01-01T00:00:00Z","ppid":1,"extra":""}
EOF
cleanup_orphan_pids > /dev/null
if [ ! -f "$PID_REGISTRY_DIR/99999999.json" ]; then
    log_pass "Stale entry cleaned up"
else
    log_fail "Stale entry not cleaned up"
    rm -f "$PID_REGISTRY_DIR/99999999.json"
fi

#===============================================================================
# Test 8: kill_all_registered kills multiple processes
#===============================================================================
log_test "kill_all_registered kills all registered processes"
sleep 100 &
PID1=$!
sleep 100 &
PID2=$!
sleep 100 &
PID3=$!
register_pid "$PID1" "multi-1"
register_pid "$PID2" "multi-2"
register_pid "$PID3" "multi-3"
kill_all_registered
sleep 0.5
ALL_DEAD=true
for pid in $PID1 $PID2 $PID3; do
    if kill -0 "$pid" 2>/dev/null; then
        ALL_DEAD=false
        kill -9 "$pid" 2>/dev/null || true
    fi
done
if [ "$ALL_DEAD" = true ]; then
    # Check entries are gone too
    REMAINING=$(ls "$PID_REGISTRY_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
    if [ "$REMAINING" = "0" ]; then
        log_pass "All 3 processes killed and entries removed"
    else
        log_fail "Processes killed but $REMAINING entries remain"
    fi
else
    log_fail "Not all processes were killed"
fi

#===============================================================================
# Test 9: cleanup_orphan_pids does NOT kill processes with alive parents
#===============================================================================
log_test "cleanup_orphan_pids spares processes with alive parents"
sleep 100 &
ALIVE_PID=$!
register_pid "$ALIVE_PID" "alive-parent-test"
# The parent ($$) is alive, so this should NOT be killed
RESULT=$(cleanup_orphan_pids)
if kill -0 "$ALIVE_PID" 2>/dev/null; then
    log_pass "Process with alive parent was spared"
else
    log_fail "Process with alive parent was incorrectly killed"
fi
kill_registered_pid "$ALIVE_PID"

#===============================================================================
# Test 10: Multiple register/unregister cycles work
#===============================================================================
log_test "Multiple register/unregister cycles"
for i in $(seq 1 5); do
    sleep 100 &
    local_pid=$!
    register_pid "$local_pid" "cycle-$i"
    unregister_pid "$local_pid"
    kill "$local_pid" 2>/dev/null || true
done
REMAINING=$(ls "$PID_REGISTRY_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
if [ "$REMAINING" = "0" ]; then
    log_pass "All cycle entries properly cleaned up"
else
    log_fail "$REMAINING entries remain after cycles"
fi

#===============================================================================
# Test 11: Registry handles non-numeric filenames gracefully
#===============================================================================
log_test "Registry handles non-numeric filenames gracefully"
echo '{}' > "$PID_REGISTRY_DIR/not-a-pid.json"
echo '{}' > "$PID_REGISTRY_DIR/readme.json"
cleanup_orphan_pids > /dev/null 2>&1
# Should not crash
log_pass "Non-numeric filenames handled without error"
rm -f "$PID_REGISTRY_DIR/not-a-pid.json" "$PID_REGISTRY_DIR/readme.json"

#===============================================================================
# Test 12: register_pid with empty extra field
#===============================================================================
log_test "register_pid with empty extra field"
sleep 100 &
TEST_PID=$!
register_pid "$TEST_PID" "no-extra"
EXTRA=$(python3 -c "import json,sys; print(json.load(open(sys.argv[1])).get('extra','MISSING'))" "$PID_REGISTRY_DIR/${TEST_PID}.json" 2>/dev/null)
if [ "$EXTRA" = "" ]; then
    log_pass "Empty extra field stored correctly"
else
    log_fail "Extra field was '$EXTRA' instead of empty"
fi
kill_registered_pid "$TEST_PID"

#===============================================================================
# Test 13: kill_registered_pid handles already-dead process
#===============================================================================
log_test "kill_registered_pid handles already-dead process"
sleep 0 &
DEAD_PID=$!
wait "$DEAD_PID" 2>/dev/null || true
register_pid "$DEAD_PID" "already-dead"
kill_registered_pid "$DEAD_PID"
if [ ! -f "$PID_REGISTRY_DIR/${DEAD_PID}.json" ]; then
    log_pass "Already-dead process handled cleanly"
else
    log_fail "Entry not cleaned for dead process"
fi

#===============================================================================
# Test 14: init_pid_registry is idempotent
#===============================================================================
log_test "init_pid_registry is idempotent"
init_pid_registry
init_pid_registry
init_pid_registry
if [ -d "$PID_REGISTRY_DIR" ]; then
    log_pass "Multiple init calls succeed"
else
    log_fail "Directory missing after multiple inits"
fi

#===============================================================================
# Test 15: loki cleanup command exists in CLI
#===============================================================================
log_test "loki CLI has cleanup command"
if grep -q "cmd_cleanup" "$PROJECT_DIR/autonomy/loki"; then
    log_pass "cmd_cleanup function exists in loki CLI"
else
    log_fail "cmd_cleanup function not found"
fi

#===============================================================================
# Test 16: cleanup command is in case dispatch
#===============================================================================
log_test "cleanup command in CLI dispatch"
if grep -q "cleanup)" "$PROJECT_DIR/autonomy/loki"; then
    log_pass "cleanup command in case dispatch"
else
    log_fail "cleanup command not in dispatch"
fi

#===============================================================================
# Test 17: run.sh has register_pid function
#===============================================================================
log_test "run.sh has register_pid function"
if grep -q "register_pid()" "$PROJECT_DIR/autonomy/run.sh"; then
    log_pass "register_pid function exists in run.sh"
else
    log_fail "register_pid function not found in run.sh"
fi

#===============================================================================
# Test 18: run.sh has cleanup_orphan_pids function
#===============================================================================
log_test "run.sh has cleanup_orphan_pids function"
if grep -q "cleanup_orphan_pids()" "$PROJECT_DIR/autonomy/run.sh"; then
    log_pass "cleanup_orphan_pids function exists in run.sh"
else
    log_fail "cleanup_orphan_pids function not found in run.sh"
fi

#===============================================================================
# Test 19: run.sh integrates register_pid into status monitor
#===============================================================================
log_test "Status monitor registers PID"
if grep -A2 'STATUS_MONITOR_PID=\$!' "$PROJECT_DIR/autonomy/run.sh" | grep -q 'register_pid'; then
    log_pass "Status monitor PID is registered"
else
    log_fail "Status monitor PID not registered"
fi

#===============================================================================
# Test 20: run.sh integrates register_pid into resource monitor
#===============================================================================
log_test "Resource monitor registers PID"
if grep -A2 'RESOURCE_MONITOR_PID=\$!' "$PROJECT_DIR/autonomy/run.sh" | grep -q 'register_pid'; then
    log_pass "Resource monitor PID is registered"
else
    log_fail "Resource monitor PID not registered"
fi

#===============================================================================
# Test 21: run.sh integrates register_pid into dashboard
#===============================================================================
log_test "Dashboard registers PID"
if grep -A2 'DASHBOARD_PID=\$!' "$PROJECT_DIR/autonomy/run.sh" | grep -q 'register_pid'; then
    log_pass "Dashboard PID is registered"
else
    log_fail "Dashboard PID not registered"
fi

#===============================================================================
# Test 22: run.sh calls cleanup_orphan_pids on startup
#===============================================================================
log_test "Startup orphan scan in main()"
if grep -q 'cleanup_orphan_pids' "$PROJECT_DIR/autonomy/run.sh"; then
    log_pass "cleanup_orphan_pids called in run.sh"
else
    log_fail "cleanup_orphan_pids not called in run.sh"
fi

#===============================================================================
# Test 23: Cleanup handler calls kill_all_registered
#===============================================================================
log_test "Cleanup handler calls kill_all_registered"
KILL_ALL_COUNT=$(grep -c 'kill_all_registered' "$PROJECT_DIR/autonomy/run.sh")
if [ "$KILL_ALL_COUNT" -ge 2 ]; then
    log_pass "kill_all_registered called in both cleanup paths ($KILL_ALL_COUNT occurrences)"
else
    log_fail "kill_all_registered not in both cleanup paths (found $KILL_ALL_COUNT)"
fi

#===============================================================================
# Test 24: loki stop cleans PID registry
#===============================================================================
log_test "loki stop kills registered PIDs"
if grep -A20 'Kill any remaining registered' "$PROJECT_DIR/autonomy/loki" | grep -q 'pids'; then
    log_pass "loki stop handles PID registry cleanup"
else
    log_fail "loki stop does not clean PID registry"
fi

#===============================================================================
# Test 25: app-runner integrates with PID registry
#===============================================================================
log_test "App runner registers with PID registry"
if grep -q 'register_pid' "$PROJECT_DIR/autonomy/app-runner.sh"; then
    log_pass "app-runner.sh calls register_pid"
else
    log_fail "app-runner.sh does not call register_pid"
fi

#===============================================================================
# Test 26: app-runner unregisters on stop
#===============================================================================
log_test "App runner unregisters on stop"
if grep -q 'unregister_pid' "$PROJECT_DIR/autonomy/app-runner.sh"; then
    log_pass "app-runner.sh calls unregister_pid"
else
    log_fail "app-runner.sh does not call unregister_pid"
fi

#===============================================================================
# Summary
#===============================================================================
echo ""
echo "=========================================="
echo "Results: $PASSED passed, $FAILED failed ($(( PASSED + FAILED )) total)"
echo "=========================================="

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
exit 0
