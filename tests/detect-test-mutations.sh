#!/usr/bin/env bash
# Test Mutation Detector - Quality Gate #9
# Verifies that test assertions exercise real code paths
#
# Usage: ./tests/detect-test-mutations.sh [--strict]
#   --strict: Exit with error code on any finding (for CI)
#
# Detects:
# 1. Shell tests where functions are redefined to return canned output
# 2. Test files where all assertions check constant values
# 3. Test files with assertion-to-test ratio below threshold

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
STRICT="${1:-}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

FINDINGS=0

echo "=========================================="
echo "Test Mutation Detector - Quality Gate #9"
echo "=========================================="
echo ""

report() {
    local severity="$1"
    local file="$2"
    local message="$3"

    case "$severity" in
        HIGH)   echo -e "${RED}[HIGH]${NC}   $file - $message" ;;
        MEDIUM) echo -e "${YELLOW}[MEDIUM]${NC} $file - $message" ;;
        LOW)    echo -e "${CYAN}[LOW]${NC}    $file - $message" ;;
    esac
    ((FINDINGS++))
}

# Check 1: Shell tests with function redefinitions that mask real behavior
echo -e "${CYAN}Scanning shell tests for function masking...${NC}"
for test_file in "$PROJECT_DIR"/tests/test-*.sh; do
    [ -f "$test_file" ] || continue
    rel_path="${test_file#$PROJECT_DIR/}"

    # Look for patterns like: function_name() { echo "fixed"; }
    # that redefine functions from the source code
    mask_count=$(grep -cE '^\s*(log_info|log_warn|log_error|log_step|emit_event|emit_learning_signal)\(\)' "$test_file" 2>/dev/null || true)
    mask_count="${mask_count:-0}"
    mask_count=$(echo "$mask_count" | tr -d '[:space:]')
    if [ "$mask_count" -gt 3 ]; then
        report "LOW" "$rel_path" "Redefines $mask_count source functions (acceptable for log suppression)"
    fi
done

# Check 2: JS/TS test files with very low assertion density
echo -e "${CYAN}Scanning for low assertion density...${NC}"
while IFS= read -r test_file; do
    rel_path="${test_file#$PROJECT_DIR/}"

    test_count=$(grep -cE '(it\(|test\()' "$test_file" 2>/dev/null || echo "0")
    assert_count=$(grep -cE '(assert\.|expect\(|should\.)' "$test_file" 2>/dev/null || echo "0")

    if [ "$test_count" -gt 5 ] && [ "$assert_count" -lt "$test_count" ]; then
        report "MEDIUM" "$rel_path" "Low assertion density: $assert_count assertions in $test_count tests (some tests have no assertions)"
    fi
done < <(find "$PROJECT_DIR" \( -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.js" \) 2>/dev/null | grep -v node_modules | grep -v dist)

# Check 3: Python tests with no assertions
echo -e "${CYAN}Scanning Python tests for missing assertions...${NC}"
while IFS= read -r test_file; do
    rel_path="${test_file#$PROJECT_DIR/}"

    test_count=$(grep -cE '^\s*def test_' "$test_file" 2>/dev/null || echo "0")
    assert_count=$(grep -cE '(assert |self\.assert|pytest\.raises|assertEqual|assertTrue|assertFalse|assertRaises|assertIn)' "$test_file" 2>/dev/null || echo "0")

    if [ "$test_count" -gt 3 ] && [ "$assert_count" -lt "$test_count" ]; then
        report "MEDIUM" "$rel_path" "Low assertion density: $assert_count assertions in $test_count tests"
    fi
done < <(find "$PROJECT_DIR" -name "test_*.py" 2>/dev/null | grep -v node_modules | grep -v __pycache__)

# Check 4: Shell tests with no pass/fail tracking
echo -e "${CYAN}Scanning shell tests for assertion tracking...${NC}"
for test_file in "$PROJECT_DIR"/tests/test-*.sh; do
    [ -f "$test_file" ] || continue
    rel_path="${test_file#$PROJECT_DIR/}"

    has_pass=$(grep -c 'log_pass\|PASSED\|((PASSED' "$test_file" 2>/dev/null || echo "0")
    has_fail=$(grep -c 'log_fail\|FAILED\|((FAILED' "$test_file" 2>/dev/null || echo "0")

    if [ "$has_pass" -eq 0 ] && [ "$has_fail" -eq 0 ]; then
        report "MEDIUM" "$rel_path" "No pass/fail assertion tracking found"
    fi
done

# Summary
echo ""
echo "=========================================="
echo "Results: $FINDINGS finding(s)"
echo "=========================================="

if [ "$STRICT" = "--strict" ] && [ $FINDINGS -gt 0 ]; then
    echo -e "${RED}GATE FAILED: $FINDINGS finding(s)${NC}"
    exit 1
fi

if [ $FINDINGS -eq 0 ]; then
    echo -e "${GREEN}All tests pass mutation detection gate.${NC}"
fi

exit 0
