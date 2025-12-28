#!/bin/bash
#===============================================================================
# Loki Mode - Autonomous Runner
# Single script that handles prerequisites, setup, and autonomous execution
#
# Usage:
#   ./autonomy/run.sh [PRD_PATH]
#   ./autonomy/run.sh ./docs/requirements.md
#   ./autonomy/run.sh                          # Interactive mode
#
# Environment Variables:
#   LOKI_MAX_RETRIES    - Max retry attempts (default: 50)
#   LOKI_BASE_WAIT      - Base wait time in seconds (default: 60)
#   LOKI_MAX_WAIT       - Max wait time in seconds (default: 3600)
#   LOKI_SKIP_PREREQS   - Skip prerequisite checks (default: false)
#===============================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
MAX_RETRIES=${LOKI_MAX_RETRIES:-50}
BASE_WAIT=${LOKI_BASE_WAIT:-60}
MAX_WAIT=${LOKI_MAX_WAIT:-3600}
SKIP_PREREQS=${LOKI_SKIP_PREREQS:-false}
VIBE_SYNC_INTERVAL=${LOKI_VIBE_SYNC:-30}  # Vibe Kanban sync interval in seconds
VIBE_KANBAN_PID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

#===============================================================================
# Logging Functions
#===============================================================================

log_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} ${BOLD}$1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
}

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $*"; }

#===============================================================================
# Prerequisites Check
#===============================================================================

check_prerequisites() {
    log_header "Checking Prerequisites"

    local missing=()

    # Check Claude Code CLI
    log_step "Checking Claude Code CLI..."
    if command -v claude &> /dev/null; then
        local version=$(claude --version 2>/dev/null | head -1 || echo "unknown")
        log_info "Claude Code CLI: $version"
    else
        missing+=("claude")
        log_error "Claude Code CLI not found"
        log_info "Install: https://claude.ai/code or npm install -g @anthropic-ai/claude-code"
    fi

    # Check Python 3
    log_step "Checking Python 3..."
    if command -v python3 &> /dev/null; then
        local py_version=$(python3 --version 2>&1)
        log_info "Python: $py_version"
    else
        missing+=("python3")
        log_error "Python 3 not found"
    fi

    # Check Git
    log_step "Checking Git..."
    if command -v git &> /dev/null; then
        local git_version=$(git --version)
        log_info "Git: $git_version"
    else
        missing+=("git")
        log_error "Git not found"
    fi

    # Check Node.js (optional but recommended)
    log_step "Checking Node.js (optional)..."
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_info "Node.js: $node_version"
    else
        log_warn "Node.js not found (optional, needed for some builds)"
    fi

    # Check npm (optional)
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        log_info "npm: $npm_version"
    fi

    # Check curl (for web fetches)
    log_step "Checking curl..."
    if command -v curl &> /dev/null; then
        log_info "curl: available"
    else
        missing+=("curl")
        log_error "curl not found"
    fi

    # Check jq (optional but helpful)
    log_step "Checking jq (optional)..."
    if command -v jq &> /dev/null; then
        log_info "jq: available"
    else
        log_warn "jq not found (optional, for JSON parsing)"
    fi

    # Summary
    echo ""
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        log_info "Please install the missing tools and try again."
        return 1
    else
        log_info "All required prerequisites are installed!"
        return 0
    fi
}

#===============================================================================
# Skill Installation Check
#===============================================================================

check_skill_installed() {
    log_header "Checking Loki Mode Skill"

    local skill_locations=(
        "$HOME/.claude/skills/loki-mode/SKILL.md"
        ".claude/skills/loki-mode/SKILL.md"
        "$PROJECT_DIR/SKILL.md"
    )

    for loc in "${skill_locations[@]}"; do
        if [ -f "$loc" ]; then
            log_info "Skill found: $loc"
            return 0
        fi
    done

    log_warn "Loki Mode skill not found in standard locations"
    log_info "The skill will be used from: $PROJECT_DIR/SKILL.md"

    if [ -f "$PROJECT_DIR/SKILL.md" ]; then
        log_info "Using skill from project directory"
        return 0
    else
        log_error "SKILL.md not found!"
        return 1
    fi
}

#===============================================================================
# Initialize Loki Directory
#===============================================================================

init_loki_dir() {
    log_header "Initializing Loki Mode Directory"

    mkdir -p .loki/{state,queue,messages,logs,config,prompts,artifacts,scripts}
    mkdir -p .loki/queue
    mkdir -p .loki/state/checkpoints
    mkdir -p .loki/artifacts/{releases,reports,backups}

    # Initialize queue files if they don't exist
    for queue in pending in-progress completed failed dead-letter; do
        if [ ! -f ".loki/queue/${queue}.json" ]; then
            echo "[]" > ".loki/queue/${queue}.json"
        fi
    done

    # Initialize orchestrator state if it doesn't exist
    if [ ! -f ".loki/state/orchestrator.json" ]; then
        cat > ".loki/state/orchestrator.json" << EOF
{
    "version": "$(cat "$PROJECT_DIR/VERSION" 2>/dev/null || echo "2.2.0")",
    "currentPhase": "BOOTSTRAP",
    "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "agents": {},
    "metrics": {
        "tasksCompleted": 0,
        "tasksFailed": 0,
        "retries": 0
    }
}
EOF
    fi

    log_info "Loki directory initialized: .loki/"
}

#===============================================================================
# Vibe Kanban Integration
#===============================================================================

export_to_vibe_kanban() {
    local export_dir=".loki/vibe-kanban"
    mkdir -p "$export_dir"

    # Get current phase
    local current_phase="UNKNOWN"
    if [ -f ".loki/state/orchestrator.json" ]; then
        current_phase=$(python3 -c "import json; print(json.load(open('.loki/state/orchestrator.json')).get('currentPhase', 'UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
    fi

    # Export tasks from queues
    python3 << EOF 2>/dev/null || true
import json
import os
from datetime import datetime

export_dir = "$export_dir"
current_phase = "$current_phase"

def phase_to_column(phase):
    mapping = {
        "BOOTSTRAP": "backlog", "DISCOVERY": "planning", "ARCHITECTURE": "planning",
        "INFRASTRUCTURE": "in-progress", "DEVELOPMENT": "in-progress",
        "QA": "review", "DEPLOYMENT": "deploying",
        "BUSINESS_OPS": "done", "GROWTH": "done", "COMPLETED": "done"
    }
    return mapping.get(phase, "backlog")

total = 0
for queue in ["pending", "in-progress", "completed", "failed"]:
    queue_file = f".loki/queue/{queue}.json"
    if not os.path.exists(queue_file):
        continue
    try:
        with open(queue_file) as f:
            tasks = json.load(f)
    except:
        continue

    status_map = {"pending": "todo", "in-progress": "doing", "completed": "done", "failed": "blocked"}
    for task in tasks:
        task_id = task.get("id", "unknown")
        payload = task.get("payload", {})
        agent_type = task.get("type", "unknown")

        vibe_task = {
            "id": f"loki-{task_id}",
            "title": f"[{agent_type}] {payload.get('action', 'Task')}",
            "description": payload.get('description', str(payload)),
            "status": status_map.get(queue, "todo"),
            "column": phase_to_column(current_phase),
            "agent": "claude-code",
            "tags": [agent_type, f"phase-{current_phase.lower()}"],
            "updatedAt": datetime.utcnow().isoformat() + "Z"
        }
        with open(f"{export_dir}/{task_id}.json", "w") as out:
            json.dump(vibe_task, out, indent=2)
        total += 1

# Write summary
summary = {
    "phase": current_phase,
    "column": phase_to_column(current_phase),
    "totalTasks": total,
    "updatedAt": datetime.utcnow().isoformat() + "Z"
}
with open(f"{export_dir}/_summary.json", "w") as f:
    json.dump(summary, f, indent=2)
EOF
}

start_vibe_sync() {
    log_step "Starting Vibe Kanban sync (every ${VIBE_SYNC_INTERVAL}s)..."

    # Background sync loop
    (
        while true; do
            export_to_vibe_kanban
            sleep "$VIBE_SYNC_INTERVAL"
        done
    ) &
    VIBE_KANBAN_PID=$!

    log_info "Vibe Kanban sync started (PID: $VIBE_KANBAN_PID)"
    log_info "Monitor tasks at: .loki/vibe-kanban/"
}

stop_vibe_sync() {
    if [ -n "$VIBE_KANBAN_PID" ]; then
        kill "$VIBE_KANBAN_PID" 2>/dev/null || true
        wait "$VIBE_KANBAN_PID" 2>/dev/null || true
        log_info "Vibe Kanban sync stopped"
    fi
}

#===============================================================================
# Calculate Exponential Backoff
#===============================================================================

calculate_wait() {
    local retry="$1"
    local wait_time=$((BASE_WAIT * (2 ** retry)))

    # Add jitter (0-30 seconds)
    local jitter=$((RANDOM % 30))
    wait_time=$((wait_time + jitter))

    # Cap at max wait
    if [ $wait_time -gt $MAX_WAIT ]; then
        wait_time=$MAX_WAIT
    fi

    echo $wait_time
}

#===============================================================================
# Check Completion
#===============================================================================

is_completed() {
    # Check orchestrator state
    if [ -f ".loki/state/orchestrator.json" ]; then
        if command -v python3 &> /dev/null; then
            local phase=$(python3 -c "import json; print(json.load(open('.loki/state/orchestrator.json')).get('currentPhase', ''))" 2>/dev/null || echo "")
            if [ "$phase" = "COMPLETED" ] || [ "$phase" = "complete" ]; then
                return 0
            fi
        fi
    fi

    # Check for completion marker
    if [ -f ".loki/COMPLETED" ]; then
        return 0
    fi

    return 1
}

#===============================================================================
# Save/Load Wrapper State
#===============================================================================

save_state() {
    local retry_count="$1"
    local status="$2"
    local exit_code="$3"

    cat > ".loki/autonomy-state.json" << EOF
{
    "retryCount": $retry_count,
    "status": "$status",
    "lastExitCode": $exit_code,
    "lastRun": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "prdPath": "${PRD_PATH:-}",
    "pid": $$,
    "maxRetries": $MAX_RETRIES,
    "baseWait": $BASE_WAIT
}
EOF
}

load_state() {
    if [ -f ".loki/autonomy-state.json" ]; then
        if command -v python3 &> /dev/null; then
            RETRY_COUNT=$(python3 -c "import json; print(json.load(open('.loki/autonomy-state.json')).get('retryCount', 0))" 2>/dev/null || echo "0")
        else
            RETRY_COUNT=0
        fi
    else
        RETRY_COUNT=0
    fi
}

#===============================================================================
# Build Resume Prompt
#===============================================================================

build_prompt() {
    local retry="$1"
    local prd="$2"

    if [ $retry -eq 0 ]; then
        if [ -n "$prd" ]; then
            echo "Loki Mode with PRD at $prd"
        else
            echo "Loki Mode"
        fi
    else
        if [ -n "$prd" ]; then
            echo "Loki Mode - Resume from checkpoint. PRD at $prd. This is retry #$retry after interruption. Check .loki/state/ for current progress and continue from where we left off."
        else
            echo "Loki Mode - Resume from checkpoint. This is retry #$retry after interruption. Check .loki/state/ for current progress and continue from where we left off."
        fi
    fi
}

#===============================================================================
# Main Autonomous Loop
#===============================================================================

run_autonomous() {
    local prd_path="$1"

    log_header "Starting Autonomous Execution"

    log_info "PRD: ${prd_path:-Interactive}"
    log_info "Max retries: $MAX_RETRIES"
    log_info "Base wait: ${BASE_WAIT}s"
    log_info "Max wait: ${MAX_WAIT}s"
    echo ""

    load_state
    local retry=$RETRY_COUNT

    while [ $retry -lt $MAX_RETRIES ]; do
        local prompt=$(build_prompt $retry "$prd_path")

        echo ""
        log_header "Attempt $((retry + 1)) of $MAX_RETRIES"
        log_info "Prompt: $prompt"
        echo ""

        save_state $retry "running" 0

        # Run Claude Code with live output
        local start_time=$(date +%s)
        local log_file=".loki/logs/autonomy-$(date +%Y%m%d).log"

        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}  CLAUDE CODE OUTPUT (live)${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""

        # Log start time
        echo "=== Session started at $(date) ===" >> "$log_file"
        echo "=== Prompt: $prompt ===" >> "$log_file"

        set +e
        # Run Claude directly for live, unbuffered output
        # No piping or redirection - output goes straight to terminal
        claude --dangerously-skip-permissions -p "$prompt"
        local exit_code=$?
        set -e

        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""

        # Log end time
        echo "=== Session ended at $(date) with exit code $exit_code ===" >> "$log_file"

        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log_info "Claude exited with code $exit_code after ${duration}s"
        save_state $retry "exited" $exit_code

        # Check for success
        if [ $exit_code -eq 0 ]; then
            if is_completed; then
                echo ""
                log_header "LOKI MODE COMPLETED SUCCESSFULLY!"
                save_state $retry "completed" 0
                return 0
            fi

            # Short session might be intentional exit
            if [ $duration -lt 30 ]; then
                log_warn "Session was short (${duration}s). Checking if complete..."
                sleep 5
                if is_completed; then
                    log_header "LOKI MODE COMPLETED!"
                    return 0
                fi
            fi
        fi

        # Handle retry
        local wait_time=$(calculate_wait $retry)
        log_warn "Will retry in ${wait_time}s..."
        log_info "Press Ctrl+C to cancel"

        # Countdown
        local remaining=$wait_time
        while [ $remaining -gt 0 ]; do
            printf "\r${YELLOW}Resuming in ${remaining}s...${NC}    "
            sleep 10
            remaining=$((remaining - 10))
        done
        echo ""

        ((retry++))
    done

    log_error "Max retries ($MAX_RETRIES) exceeded"
    save_state $retry "failed" 1
    return 1
}

#===============================================================================
# Cleanup Handler
#===============================================================================

cleanup() {
    echo ""
    log_warn "Received interrupt signal"
    stop_vibe_sync
    save_state ${RETRY_COUNT:-0} "interrupted" 130
    log_info "State saved. Run again to resume."
    exit 130
}

#===============================================================================
# Main Entry Point
#===============================================================================

main() {
    trap cleanup INT TERM

    echo ""
    echo -e "${BOLD}${BLUE}"
    echo "  ██╗      ██████╗ ██╗  ██╗██╗    ███╗   ███╗ ██████╗ ██████╗ ███████╗"
    echo "  ██║     ██╔═══██╗██║ ██╔╝██║    ████╗ ████║██╔═══██╗██╔══██╗██╔════╝"
    echo "  ██║     ██║   ██║█████╔╝ ██║    ██╔████╔██║██║   ██║██║  ██║█████╗  "
    echo "  ██║     ██║   ██║██╔═██╗ ██║    ██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  "
    echo "  ███████╗╚██████╔╝██║  ██╗██║    ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗"
    echo "  ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝    ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝"
    echo -e "${NC}"
    echo -e "  ${CYAN}Autonomous Multi-Agent Startup System${NC}"
    echo -e "  ${CYAN}Version: $(cat "$PROJECT_DIR/VERSION" 2>/dev/null || echo "2.x.x")${NC}"
    echo ""

    # Parse arguments
    PRD_PATH="${1:-}"

    # Validate PRD if provided
    if [ -n "$PRD_PATH" ] && [ ! -f "$PRD_PATH" ]; then
        log_error "PRD file not found: $PRD_PATH"
        exit 1
    fi

    # Check prerequisites (unless skipped)
    if [ "$SKIP_PREREQS" != "true" ]; then
        if ! check_prerequisites; then
            exit 1
        fi
    else
        log_warn "Skipping prerequisite checks (LOKI_SKIP_PREREQS=true)"
    fi

    # Check skill installation
    if ! check_skill_installed; then
        exit 1
    fi

    # Initialize .loki directory
    init_loki_dir

    # Start Vibe Kanban background sync
    start_vibe_sync

    # Run autonomous loop
    local result=0
    run_autonomous "$PRD_PATH" || result=$?

    # Cleanup
    stop_vibe_sync

    exit $result
}

# Run main
main "$@"
