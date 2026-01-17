#!/bin/bash
# Vibe Kanban Sync Watcher
# Watches .loki/queue/ for changes and automatically exports to Vibe Kanban
#
# Usage:
#   ./scripts/vibe-sync-watcher.sh [export_dir]
#
# Environment Variables:
#   VIBE_KANBAN_DIR - Export directory (default: ~/.vibe-kanban/loki-tasks)
#   VIBE_SYNC_INTERVAL - Minimum seconds between exports (default: 5)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOKI_DIR=".loki"
EXPORT_DIR="${1:-${VIBE_KANBAN_DIR:-$HOME/.vibe-kanban/loki-tasks}}"
SYNC_INTERVAL="${VIBE_SYNC_INTERVAL:-5}"
LOG_FILE=".loki/logs/vibe-kanban.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[VIBE-SYNC]${NC} $*" | tee -a "$LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[VIBE-SYNC]${NC} $*" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[VIBE-SYNC]${NC} $*" | tee -a "$LOG_FILE"; }

# Check if .loki directory exists
if [ ! -d "$LOKI_DIR" ]; then
    log_error "No .loki directory found. Loki Mode must be running first."
    exit 1
fi

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

log_info "Starting Vibe Kanban sync watcher"
log_info "Watching: $LOKI_DIR/queue/ and $LOKI_DIR/state/"
log_info "Export dir: $EXPORT_DIR"
log_info "Sync interval: ${SYNC_INTERVAL}s"

# Track last export time to prevent spam
LAST_EXPORT=0

export_tasks() {
    local current_time=$(date +%s)
    local time_since_last=$((current_time - LAST_EXPORT))

    # Rate limit: don't export more than once per SYNC_INTERVAL seconds
    if [ $time_since_last -lt $SYNC_INTERVAL ]; then
        return
    fi

    log_info "Queue changed, exporting tasks..."

    # Run export script
    if [ -x "$SCRIPT_DIR/export-to-vibe-kanban.sh" ]; then
        "$SCRIPT_DIR/export-to-vibe-kanban.sh" "$EXPORT_DIR" 2>&1 | tee -a "$LOG_FILE"
    else
        log_error "Export script not found or not executable: $SCRIPT_DIR/export-to-vibe-kanban.sh"
        return 1
    fi

    LAST_EXPORT=$(date +%s)
}

# Initial export
export_tasks

# Detect which file watching tool is available
WATCHER=""
if command -v fswatch &> /dev/null; then
    WATCHER="fswatch"
    log_info "Using fswatch for file monitoring (macOS)"
elif command -v inotifywait &> /dev/null; then
    WATCHER="inotifywait"
    log_info "Using inotifywait for file monitoring (Linux)"
else
    WATCHER="polling"
    log_warn "No file watcher found (fswatch or inotifywait). Using polling fallback."
    log_warn "Install fswatch (macOS: brew install fswatch) or inotify-tools (Linux: apt install inotify-tools) for better performance."
fi

# Watch for changes
case "$WATCHER" in
    fswatch)
        # macOS: Use fswatch to monitor queue directory
        fswatch -0 -r -l "$SYNC_INTERVAL" \
            "$LOKI_DIR/queue/" \
            "$LOKI_DIR/state/orchestrator.json" 2>/dev/null | \
        while read -d "" event; do
            log_info "File changed: $event"
            export_tasks
        done
        ;;

    inotifywait)
        # Linux: Use inotifywait to monitor queue directory
        while true; do
            inotifywait -q -e modify,create,moved_to \
                "$LOKI_DIR/queue/" \
                "$LOKI_DIR/state/orchestrator.json" 2>/dev/null

            log_info "Queue files changed"
            export_tasks
        done
        ;;

    polling)
        # Fallback: Poll for changes
        log_info "Polling mode: checking every ${SYNC_INTERVAL}s"

        # Calculate initial checksum
        LAST_CHECKSUM=$(find "$LOKI_DIR/queue/" -type f -name "*.json" -exec md5sum {} \; 2>/dev/null | md5sum)

        while true; do
            sleep "$SYNC_INTERVAL"

            # Calculate current checksum
            CURRENT_CHECKSUM=$(find "$LOKI_DIR/queue/" -type f -name "*.json" -exec md5sum {} \; 2>/dev/null | md5sum)

            # If checksums differ, files changed
            if [ "$CURRENT_CHECKSUM" != "$LAST_CHECKSUM" ]; then
                log_info "Queue files changed (polling detected)"
                export_tasks
                LAST_CHECKSUM="$CURRENT_CHECKSUM"
            fi
        done
        ;;
esac

log_info "Sync watcher stopped"
