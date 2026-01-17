#!/bin/bash
# Automatic Vibe Kanban sync watcher for Loki Mode
# Watches .loki/queue/ for changes and automatically exports tasks
# Usage: ./scripts/vibe-sync-watcher.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOKI_DIR="$PROJECT_DIR/.loki"
EXPORT_SCRIPT="$SCRIPT_DIR/export-to-vibe-kanban.sh"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[VIBE-SYNC]${NC} $*"; }
log_debug() { echo -e "${CYAN}[VIBE-SYNC]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[VIBE-SYNC]${NC} $*"; }

# Check if .loki directory exists
if [ ! -d "$LOKI_DIR" ]; then
    log_warn "No .loki directory found. Waiting for initialization..."
    # Wait for .loki to be created
    while [ ! -d "$LOKI_DIR" ]; do
        sleep 2
    done
fi

# Check if export script exists
if [ ! -f "$EXPORT_SCRIPT" ]; then
    log_warn "Export script not found: $EXPORT_SCRIPT"
    exit 1
fi

# Make sure queue directory exists
mkdir -p "$LOKI_DIR/queue"

log_info "Starting Vibe Kanban sync watcher..."
log_info "Monitoring: $LOKI_DIR/queue/"
log_info "Export script: $EXPORT_SCRIPT"
echo ""

# Initial export
log_debug "Initial export..."
"$EXPORT_SCRIPT" 2>&1 | while read line; do
    echo "  $line"
done

# Track last export time to avoid duplicate exports
LAST_EXPORT=0
MIN_INTERVAL=5  # Minimum 5 seconds between exports

sync_tasks() {
    local now=$(date +%s)
    local elapsed=$((now - LAST_EXPORT))

    if [ $elapsed -lt $MIN_INTERVAL ]; then
        log_debug "Skipping export (too soon, ${elapsed}s < ${MIN_INTERVAL}s)"
        return
    fi

    log_debug "Queue changed, exporting to Vibe Kanban..."
    "$EXPORT_SCRIPT" 2>&1 | while read line; do
        echo "  $line"
    done
    LAST_EXPORT=$now
}

# Watch for changes using available tools
if command -v fswatch &> /dev/null; then
    # macOS: use fswatch
    log_info "Using fswatch for monitoring"
    fswatch -0 -e ".*" -i "\\.json$" "$LOKI_DIR/queue/" "$LOKI_DIR/state/orchestrator.json" 2>/dev/null | while read -d "" event; do
        sync_tasks
    done
elif command -v inotifywait &> /dev/null; then
    # Linux: use inotifywait
    log_info "Using inotifywait for monitoring"
    inotifywait -m -e modify,create,moved_to "$LOKI_DIR/queue/" "$LOKI_DIR/state/" 2>/dev/null | while read path action file; do
        if [[ "$file" == *.json ]]; then
            sync_tasks
        fi
    done
else
    # Fallback: polling
    log_warn "fswatch/inotifywait not found, using polling (install fswatch for better performance)"
    log_info "Polling every 10 seconds..."

    # Track file modification times
    declare -A file_mtimes

    while true; do
        changed=false

        for file in "$LOKI_DIR/queue/"*.json "$LOKI_DIR/state/orchestrator.json"; do
            if [ -f "$file" ]; then
                current_mtime=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo "0")
                last_mtime="${file_mtimes[$file]:-0}"

                if [ "$current_mtime" != "$last_mtime" ]; then
                    file_mtimes[$file]=$current_mtime
                    changed=true
                fi
            fi
        done

        if [ "$changed" = true ]; then
            sync_tasks
        fi

        sleep 10
    done
fi
