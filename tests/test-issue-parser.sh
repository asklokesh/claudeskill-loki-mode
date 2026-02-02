#!/bin/bash
#===============================================================================
# Test suite for issue-parser.sh
# Run from project root: ./tests/test-issue-parser.sh
#===============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARSER="$PROJECT_DIR/autonomy/issue-parser.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper
run_test() {
    local name="$1"
    local expected="$2"
    shift 2
    local actual

    echo -n "  Testing: $name... "

    if actual=$("$@" 2>&1); then
        if echo "$actual" | grep -q "$expected"; then
            echo -e "${GREEN}PASS${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            echo -e "${RED}FAIL${NC}"
            echo "    Expected to contain: $expected"
            echo "    Got: $(echo "$actual" | head -5)"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        echo -e "${RED}FAIL (exit code)${NC}"
        echo "    Output: $actual"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test that should fail
run_fail_test() {
    local name="$1"
    local expected="$2"
    shift 2

    echo -n "  Testing: $name... "

    if ! "$@" >/dev/null 2>&1; then
        echo -e "${GREEN}PASS (expected failure)${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}FAIL (should have failed)${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo ""
echo "==============================================="
echo "  Loki Mode - GitHub Issue Parser Tests"
echo "==============================================="
echo ""

# Check prerequisites
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}Skipping: gh CLI not found${NC}"
    exit 0
fi

if ! gh auth status &> /dev/null 2>&1; then
    echo -e "${YELLOW}Skipping: gh CLI not authenticated${NC}"
    exit 0
fi

# Unit tests
echo "Unit Tests:"
echo "-------------------------------------------"

# Test help
run_test "Help output" "Usage:" "$PARSER" --help

# Test missing argument
run_fail_test "Missing issue ref" "" "$PARSER"

# Test invalid format
run_fail_test "Invalid format" "" "$PARSER" "123" --format invalid

echo ""

# Integration tests (require network)
echo "Integration Tests (requires GitHub access):"
echo "-------------------------------------------"

# Test issue parsing - YAML format
run_test "Parse issue (YAML)" "source:" "$PARSER" "cli/cli#12591" --quiet

# Test issue parsing - JSON format
run_test "Parse issue (JSON)" '"source"' "$PARSER" "cli/cli#12591" --format json --quiet

# Test URL format
run_test "Parse URL format" "source:" "$PARSER" "https://github.com/cli/cli/issues/12591" --quiet

# Test owner/repo#number format
run_test "Parse owner/repo#num" "source:" "$PARSER" "cli/cli#12591" --quiet

# Test label extraction
run_test "Label extraction" "labels:" "$PARSER" "cli/cli#12585" --quiet

# Test priority detection
run_test "Priority detection (low)" "priority: low" "$PARSER" "cli/cli#12585" --quiet

# Test type detection (bug)
run_test "Type detection (bug)" "type: bug" "$PARSER" "cli/cli#12585" --quiet

echo ""

# Output tests
echo "Output Tests:"
echo "-------------------------------------------"

# Test file output
TEMP_FILE=$(mktemp)
if "$PARSER" "cli/cli#12591" --output "$TEMP_FILE" --quiet 2>&1 && [ -s "$TEMP_FILE" ]; then
    echo -e "  Testing: File output... ${GREEN}PASS${NC}"
    ((TESTS_PASSED++))
else
    echo -e "  Testing: File output... ${RED}FAIL${NC}"
    ((TESTS_FAILED++))
fi
rm -f "$TEMP_FILE"

echo ""
echo "==============================================="
echo -e "  Results: ${GREEN}$TESTS_PASSED passed${NC}, ${RED}$TESTS_FAILED failed${NC}"
echo "==============================================="
echo ""

# Exit with failure if any tests failed
if [ $TESTS_FAILED -gt 0 ]; then
    exit 1
fi

exit 0
