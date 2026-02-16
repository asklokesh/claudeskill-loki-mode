#!/bin/bash
#===============================================================================
# PRD Checklist Module (v5.44.0)
#
# Manages PRD requirement tracking and automated verification. Creates a
# structured checklist from PRD analysis, verifies items on a configurable
# interval, and provides status summaries for prompt injection and council.
#
# Functions:
#   checklist_init(prd_path)    - Initialize checklist during DISCOVERY phase
#   checklist_should_verify()   - Check if verification should run this iteration
#   checklist_verify()          - Run verification checks via checklist-verify.py
#   checklist_summary()         - One-line summary for prompt injection
#   checklist_as_evidence()     - Formatted output for council evidence file
#
# Environment Variables:
#   LOKI_CHECKLIST_INTERVAL     - Verify every N iterations (default: 5)
#   LOKI_CHECKLIST_TIMEOUT      - Timeout per check in seconds (default: 30)
#   LOKI_CHECKLIST_ENABLED      - Enable/disable checklist (default: true)
#
# Data:
#   .loki/checklist/checklist.json          - Full checklist with verification
#   .loki/checklist/verification-results.json - Summary of last verification
#
# Usage:
#   source autonomy/prd-checklist.sh
#   checklist_init "$prd_path"
#   if checklist_should_verify; then checklist_verify; fi
#   checklist_summary
#
#===============================================================================

# Configuration
CHECKLIST_ENABLED=${LOKI_CHECKLIST_ENABLED:-true}
CHECKLIST_INTERVAL=${LOKI_CHECKLIST_INTERVAL:-5}
# Guard against zero/negative interval (division by zero in modulo)
if [ "$CHECKLIST_INTERVAL" -le 0 ] 2>/dev/null; then
    CHECKLIST_INTERVAL=5
fi
CHECKLIST_TIMEOUT=${LOKI_CHECKLIST_TIMEOUT:-30}
# Guard against zero/negative timeout
if [ "$CHECKLIST_TIMEOUT" -le 0 ] 2>/dev/null; then
    CHECKLIST_TIMEOUT=30
fi

# Internal state
CHECKLIST_DIR=""
CHECKLIST_FILE=""
CHECKLIST_RESULTS_FILE=""
CHECKLIST_LAST_VERIFY_ITERATION=0

#===============================================================================
# Initialization
#===============================================================================

checklist_init() {
    local prd_path="${1:-}"

    if [ "$CHECKLIST_ENABLED" != "true" ]; then
        return 0
    fi

    CHECKLIST_DIR=".loki/checklist"
    CHECKLIST_FILE="${CHECKLIST_DIR}/checklist.json"
    CHECKLIST_RESULTS_FILE="${CHECKLIST_DIR}/verification-results.json"

    mkdir -p "$CHECKLIST_DIR"

    if [ -n "$prd_path" ] && [ -f "$prd_path" ]; then
        log_info "PRD checklist initialized for: $prd_path"
    fi

    return 0
}

#===============================================================================
# Interval Control
#===============================================================================

checklist_should_verify() {
    # Returns 0 (true) if verification should run this iteration
    if [ "$CHECKLIST_ENABLED" != "true" ]; then
        return 1
    fi

    if [ ! -f "$CHECKLIST_FILE" ]; then
        return 1
    fi

    # Check iteration interval
    local current_iteration="${ITERATION_COUNT:-0}"
    if [ "$current_iteration" -eq 0 ]; then
        return 1
    fi

    if [ $((current_iteration % CHECKLIST_INTERVAL)) -ne 0 ]; then
        return 1
    fi

    # Don't verify same iteration twice
    if [ "$current_iteration" -eq "$CHECKLIST_LAST_VERIFY_ITERATION" ]; then
        return 1
    fi

    return 0
}

#===============================================================================
# Verification
#===============================================================================

checklist_verify() {
    if [ "$CHECKLIST_ENABLED" != "true" ]; then
        return 0
    fi

    if [ ! -f "$CHECKLIST_FILE" ]; then
        return 0
    fi

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local verify_script="${script_dir}/checklist-verify.py"

    if [ ! -f "$verify_script" ]; then
        log_warn "checklist-verify.py not found at $verify_script"
        return 0
    fi

    log_step "Running PRD checklist verification..."

    python3 "$verify_script" \
        --checklist "$CHECKLIST_FILE" \
        --timeout "$CHECKLIST_TIMEOUT" 2>/dev/null || true

    CHECKLIST_LAST_VERIFY_ITERATION="${ITERATION_COUNT:-0}"

    # Log result if available
    if [ -f "$CHECKLIST_RESULTS_FILE" ]; then
        local summary
        summary=$(checklist_summary 2>/dev/null || true)
        if [ -n "$summary" ]; then
            log_info "Checklist: $summary"
        fi
    fi

    return 0
}

#===============================================================================
# Summary (for prompt injection)
#===============================================================================

checklist_summary() {
    # Returns one-line summary string
    if [ ! -f "$CHECKLIST_RESULTS_FILE" ]; then
        echo ""
        return 0
    fi

    _CHECKLIST_RESULTS="$CHECKLIST_RESULTS_FILE" python3 -c "
import json, sys, os
try:
    fpath = os.environ.get('_CHECKLIST_RESULTS', '')
    data = json.load(open(fpath))
    s = data.get('summary', {})
    total = s.get('total', 0)
    verified = s.get('verified', 0)
    failing = s.get('failing', 0)
    pending = s.get('pending', 0)
    if total == 0:
        print('')
    else:
        failing_items = []
        for cat in data.get('categories', []):
            for item in cat.get('items', []):
                if item.get('status') == 'failing' and item.get('priority') in ('critical', 'major'):
                    failing_items.append(item.get('title', item.get('id', '?')))
        detail = ''
        if failing_items:
            detail = ' FAILING: ' + ', '.join(failing_items[:5])
        print(f'{verified}/{total} verified, {failing} failing, {pending} pending.{detail}')
except Exception:
    print('', file=sys.stderr)
" 2>/dev/null || echo ""
}

#===============================================================================
# Council Evidence (for completion-council.sh)
#===============================================================================

checklist_as_evidence() {
    # Writes formatted checklist evidence to stdout for council consumption
    local evidence_file="${1:-}"

    if [ ! -f "$CHECKLIST_RESULTS_FILE" ]; then
        return 0
    fi

    {
        echo ""
        echo "## PRD Checklist Verification"
        echo ""

        _CHECKLIST_RESULTS="$CHECKLIST_RESULTS_FILE" python3 -c "
import json, os
try:
    data = json.load(open(os.environ['_CHECKLIST_RESULTS']))
    s = data.get('summary', {})
    print(f\"Summary: {s.get('verified',0)}/{s.get('total',0)} verified, {s.get('failing',0)} failing\")
    print()
    for cat in data.get('categories', []):
        print(f\"### {cat.get('name', 'Unknown')}\")
        for item in cat.get('items', []):
            status_icon = {'verified': '[PASS]', 'failing': '[FAIL]', 'pending': '[----]'}.get(item.get('status','pending'), '[----]')
            priority = item.get('priority', 'minor').upper()
            print(f\"  {status_icon} [{priority}] {item.get('title', item.get('id', '?'))}\")
        print()
except Exception:
    print('Checklist data unavailable')
" 2>/dev/null || echo "Checklist data unavailable"
    } >> "${evidence_file:-/dev/stdout}"
}
