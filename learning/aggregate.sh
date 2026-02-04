#!/bin/bash
# Loki Mode Learning Aggregator - Bash CLI helper
#
# Runs learning signal aggregation and displays results.
# This provides a CLI interface for the Python learning aggregator.
#
# Usage:
#   ./aggregate.sh [options]
#
# Options:
#   --days <n>          Time window in days (default: 7)
#   --min-freq <n>      Minimum frequency for patterns (default: 2)
#   --min-conf <0-1>    Minimum confidence score (default: 0.5)
#   --no-save           Don't save the aggregation result
#   --json              Output as JSON instead of summary
#   --list              List recent aggregations
#   --latest            Show the latest aggregation
#
# Examples:
#   # Run aggregation with defaults
#   ./aggregate.sh
#
#   # Run with custom time window
#   ./aggregate.sh --days 30
#
#   # Output as JSON
#   ./aggregate.sh --json
#
#   # List recent aggregations
#   ./aggregate.sh --list
#
# Environment:
#   LOKI_DIR          - Path to .loki directory (default: .loki)
#   LOKI_SKILL_DIR    - Path to skill installation (auto-detected)

set -uo pipefail

# Find skill directory
find_skill_dir() {
    local script_path
    if command -v realpath &> /dev/null; then
        script_path=$(realpath "${BASH_SOURCE[0]}" 2>/dev/null || echo "${BASH_SOURCE[0]}")
    else
        script_path="${BASH_SOURCE[0]}"
    fi
    local script_dir
    script_dir=$(dirname "$script_path")

    # Go up one level from learning/ to get skill root
    local skill_dir
    skill_dir=$(cd "$script_dir/.." && pwd)

    if [ -f "$skill_dir/SKILL.md" ]; then
        echo "$skill_dir"
        return 0
    fi

    # Fallback to common locations
    local dirs=(
        "$HOME/.claude/skills/loki-mode"
        "/usr/local/share/loki-mode"
    )

    for dir in "${dirs[@]}"; do
        if [ -f "$dir/SKILL.md" ]; then
            echo "$dir"
            return 0
        fi
    done

    echo ""
    return 1
}

SKILL_DIR="${LOKI_SKILL_DIR:-$(find_skill_dir)}"
LOKI_DIR="${LOKI_DIR:-.loki}"

# Check Python is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found" >&2
    exit 1
fi

# Default options
TIME_WINDOW_DAYS="7"
MIN_FREQUENCY="2"
MIN_CONFIDENCE="0.5"
SAVE="true"
OUTPUT_JSON="false"
LIST_MODE="false"
LATEST_MODE="false"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --days)
            TIME_WINDOW_DAYS="${2:-7}"
            shift 2
            ;;
        --min-freq)
            MIN_FREQUENCY="${2:-2}"
            shift 2
            ;;
        --min-conf)
            MIN_CONFIDENCE="${2:-0.5}"
            shift 2
            ;;
        --no-save)
            SAVE="false"
            shift
            ;;
        --json)
            OUTPUT_JSON="true"
            shift
            ;;
        --list)
            LIST_MODE="true"
            shift
            ;;
        --latest)
            LATEST_MODE="true"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --days <n>          Time window in days (default: 7)"
            echo "  --min-freq <n>      Minimum frequency for patterns (default: 2)"
            echo "  --min-conf <0-1>    Minimum confidence score (default: 0.5)"
            echo "  --no-save           Don't save the aggregation result"
            echo "  --json              Output as JSON instead of summary"
            echo "  --list              List recent aggregations"
            echo "  --latest            Show the latest aggregation"
            echo "  --help, -h          Show this help message"
            exit 0
            ;;
        *)
            echo "Warning: Unknown option: $1" >&2
            shift
            ;;
    esac
done

# Export environment for Python
export _LOKI_DIR="$LOKI_DIR"
export _LOKI_SKILL_DIR="$SKILL_DIR"
export _LOKI_TIME_WINDOW="$TIME_WINDOW_DAYS"
export _LOKI_MIN_FREQ="$MIN_FREQUENCY"
export _LOKI_MIN_CONF="$MIN_CONFIDENCE"
export _LOKI_SAVE="$SAVE"
export _LOKI_JSON="$OUTPUT_JSON"
export _LOKI_LIST="$LIST_MODE"
export _LOKI_LATEST="$LATEST_MODE"

# Run Python aggregator
python3 << 'PYEOF'
import os
import sys
import json
from pathlib import Path

# Get parameters from environment
loki_dir = os.environ.get('_LOKI_DIR', '.loki')
skill_dir = os.environ.get('_LOKI_SKILL_DIR', '')
time_window = int(os.environ.get('_LOKI_TIME_WINDOW', '7'))
min_freq = int(os.environ.get('_LOKI_MIN_FREQ', '2'))
min_conf = float(os.environ.get('_LOKI_MIN_CONF', '0.5'))
save = os.environ.get('_LOKI_SAVE', 'true').lower() == 'true'
output_json = os.environ.get('_LOKI_JSON', 'false').lower() == 'true'
list_mode = os.environ.get('_LOKI_LIST', 'false').lower() == 'true'
latest_mode = os.environ.get('_LOKI_LATEST', 'false').lower() == 'true'

# Add skill directory to path
if skill_dir:
    sys.path.insert(0, skill_dir)

try:
    from learning.aggregator import (
        LearningAggregator,
        run_aggregation,
        print_aggregation_summary,
    )

    loki_path = Path(loki_dir)
    aggregator = LearningAggregator(
        loki_dir=loki_path,
        time_window_days=time_window,
        min_frequency=min_freq,
        min_confidence=min_conf,
    )

    if list_mode:
        # List recent aggregations
        summaries = aggregator.list_aggregations(limit=10)
        if output_json:
            print(json.dumps(summaries, indent=2))
        else:
            if not summaries:
                print("No aggregations found.")
            else:
                print("\nRecent Aggregations")
                print("===================")
                for s in summaries:
                    print(f"\nID: {s['id']}")
                    print(f"  Time: {s['timestamp']}")
                    print(f"  Window: {s['time_window_days']} days")
                    print(f"  Signals: {s['total_signals_processed']}")
                    counts = s['counts']
                    print(f"  Patterns: {counts['preferences']} prefs, "
                          f"{counts['error_patterns']} errors, "
                          f"{counts['success_patterns']} successes, "
                          f"{counts['tool_efficiencies']} tools, "
                          f"{counts['context_relevance']} contexts")

    elif latest_mode:
        # Show latest aggregation
        result = aggregator.get_latest_aggregation()
        if result is None:
            print("No aggregations found. Run 'loki learning aggregate' first.")
            sys.exit(0)

        if output_json:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print_aggregation_summary(result)

    else:
        # Run new aggregation
        result = run_aggregation(
            loki_dir=loki_path,
            time_window_days=time_window,
            min_frequency=min_freq,
            min_confidence=min_conf,
            save=save,
        )

        if output_json:
            print(json.dumps(result.to_dict(), indent=2))
        else:
            print_aggregation_summary(result)
            if save:
                print(f"Aggregation saved to: {loki_dir}/learning/aggregated/")

except ImportError as e:
    print(f"Error: Learning module not available: {e}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
PYEOF
