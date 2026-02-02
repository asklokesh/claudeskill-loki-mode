#!/usr/bin/env bash
#===============================================================================
# Loki Mode - Multi-Channel Notification System
# Version: 1.0.0
#
# Supports: Slack, Discord, Generic Webhooks
# Environment Variables:
#   LOKI_SLACK_WEBHOOK    - Slack incoming webhook URL
#   LOKI_DISCORD_WEBHOOK  - Discord webhook URL
#   LOKI_WEBHOOK_URL          - Generic webhook URL (any endpoint)
#   LOKI_PROJECT              - Project name for notifications (optional)
#   LOKI_NOTIFICATIONS        - Enable/disable all notifications (default: true)
#===============================================================================

# Notification settings
NOTIFICATIONS_ENABLED=${LOKI_NOTIFICATIONS:-true}

#===============================================================================
# Internal Helper Functions
#===============================================================================

# Get ISO 8601 timestamp
_get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Get project name from environment or current directory
_get_project_name() {
    if [ -n "$LOKI_PROJECT" ]; then
        echo "$LOKI_PROJECT"
    elif [ -n "$PROJECT_DIR" ]; then
        basename "$PROJECT_DIR"
    else
        basename "$(pwd)"
    fi
}

# Map event types to colors for Slack (hex format)
_get_slack_color() {
    local event="$1"
    case "$event" in
        session_start)  echo "#3498DB" ;;  # Blue
        session_end)    echo "#57F287" ;;  # Green
        task_complete)  echo "#57F287" ;;  # Green
        milestone)      echo "#9b59b6" ;;  # Purple
        error)          echo "#ED4245" ;;  # Red
        warning)        echo "#f39c12" ;;  # Orange
        *)              echo "#808080" ;;  # Gray
    esac
}

# Map event types to colors for Discord (decimal format)
# Per requirements:
#   session_start: blue (3447003)
#   session_end: green (5763719)
#   task_complete: green (5763719)
#   error: red (15548997)
_get_discord_color() {
    local event="$1"
    case "$event" in
        session_start)  echo "3447003" ;;   # Blue
        session_end)    echo "5763719" ;;   # Green
        task_complete)  echo "5763719" ;;   # Green
        milestone)      echo "10181046" ;;  # Purple
        error)          echo "15548997" ;;  # Red
        warning)        echo "15981348" ;;  # Orange
        *)              echo "9807270" ;;   # Gray
    esac
}

#===============================================================================
# Slack Notifications
#===============================================================================

_notify_slack() {
    local event="$1"
    local title="$2"
    local message="$3"
    local metadata="${4:-}"

    # Skip if no webhook URL configured
    [ -z "$LOKI_SLACK_WEBHOOK" ] && return 0

    local project
    project="$(_get_project_name)"
    local timestamp
    timestamp="$(_get_timestamp)"
    local color
    color="$(_get_slack_color "$event")"

    # Build Slack payload with attachment
    local payload
    payload=$(cat <<PAYLOAD
{
    "attachments": [{
        "color": "$color",
        "title": "Loki Mode: $title",
        "text": "$message",
        "fields": [
            {"title": "Event", "value": "$event", "short": true},
            {"title": "Project", "value": "$project", "short": true}
        ],
        "footer": "Loki Mode",
        "ts": $(date +%s)
    }]
}
PAYLOAD
)

    # Send in background, fail silently
    (curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$LOKI_SLACK_WEBHOOK" \
        >/dev/null 2>&1) &
}

#===============================================================================
# Discord Notifications
#===============================================================================

_notify_discord() {
    local event="$1"
    local title="$2"
    local message="$3"
    local metadata="${4:-}"

    # Skip if no webhook URL configured
    [ -z "$LOKI_DISCORD_WEBHOOK" ] && return 0

    local project
    project="$(_get_project_name)"
    local timestamp
    timestamp="$(_get_timestamp)"
    local color
    color="$(_get_discord_color "$event")"

    # Build Discord embed payload
    local payload
    payload=$(cat <<PAYLOAD
{
    "embeds": [{
        "title": "Loki Mode: $title",
        "description": "$message",
        "color": $color,
        "fields": [
            {"name": "Event", "value": "$event", "inline": true},
            {"name": "Project", "value": "$project", "inline": true}
        ],
        "footer": {"text": "Loki Mode"},
        "timestamp": "$timestamp"
    }]
}
PAYLOAD
)

    # Send in background, fail silently
    (curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$LOKI_DISCORD_WEBHOOK" \
        >/dev/null 2>&1) &
}

#===============================================================================
# Generic Webhook Notifications
#===============================================================================

_notify_webhook() {
    local event="$1"
    local title="$2"
    local message="$3"
    local metadata="${4:-{\}}"

    # Skip if no webhook URL configured
    [ -z "$LOKI_WEBHOOK_URL" ] && return 0

    local project
    project="$(_get_project_name)"
    local timestamp
    timestamp="$(_get_timestamp)"

    # Ensure metadata is valid JSON, default to empty object
    if [ -z "$metadata" ] || [ "$metadata" = "{}" ]; then
        metadata="{}"
    fi

    # Build standard JSON payload
    local payload
    payload=$(cat <<PAYLOAD
{
    "event": "$event",
    "project": "$project",
    "title": "$title",
    "message": "$message",
    "timestamp": "$timestamp",
    "metadata": $metadata
}
PAYLOAD
)

    # Send in background, fail silently
    (curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$LOKI_WEBHOOK_URL" \
        >/dev/null 2>&1) &
}

#===============================================================================
# Unified Notification Function (Main Entry Point)
#===============================================================================

# Send notification to all configured channels
# Usage: notify <event> <title> <message> [metadata_json]
# Events: session_start, session_end, task_complete, error, milestone, warning
notify() {
    local event="$1"
    local title="$2"
    local message="$3"
    local metadata="${4:-}"

    # Skip if notifications disabled
    [ "$NOTIFICATIONS_ENABLED" != "true" ] && return 0

    # Validate required parameters
    if [ -z "$event" ] || [ -z "$title" ]; then
        return 0
    fi

    # Send to all configured channels (background, non-blocking)
    _notify_slack "$event" "$title" "$message" "$metadata"
    _notify_discord "$event" "$title" "$message" "$metadata"
    _notify_webhook "$event" "$title" "$message" "$metadata"

    return 0
}

#===============================================================================
# Convenience Functions
#===============================================================================

notify_session_start() {
    local prd_name="${1:-Unknown PRD}"
    notify "session_start" "Session Started" "Starting Loki Mode session with PRD: $prd_name"
}

notify_session_end() {
    local status="${1:-completed}"
    local duration="${2:-}"
    local msg="Loki Mode session ended with status: $status"
    [ -n "$duration" ] && msg="$msg (duration: $duration)"
    notify "session_end" "Session Ended" "$msg"
}

notify_task_complete() {
    local task_name="$1"
    notify "task_complete" "Task Completed" "$task_name"
}

notify_milestone() {
    local milestone_name="$1"
    local details="${2:-}"
    notify "milestone" "Milestone Reached" "$milestone_name${details:+: $details}"
}

notify_error() {
    local error_msg="$1"
    local context="${2:-}"
    notify "error" "Error Occurred" "$error_msg${context:+ (Context: $context)}"
}

notify_warning() {
    local warning_msg="$1"
    notify "warning" "Warning" "$warning_msg"
}

#===============================================================================
# Self-test (run directly to test)
#===============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Testing Loki Mode Notification System"
    echo "======================================"
    echo ""
    echo "Environment:"
    echo "  LOKI_SLACK_WEBHOOK: ${LOKI_SLACK_WEBHOOK:-(not set)}"
    echo "  LOKI_DISCORD_WEBHOOK: ${LOKI_DISCORD_WEBHOOK:-(not set)}"
    echo "  LOKI_WEBHOOK_URL: ${LOKI_WEBHOOK_URL:-(not set)}"
    echo "  LOKI_PROJECT: ${LOKI_PROJECT:-(auto-detect)}"
    echo "  LOKI_NOTIFICATIONS: ${LOKI_NOTIFICATIONS:-true}"
    echo ""

    if [ -z "$LOKI_SLACK_WEBHOOK" ] && [ -z "$LOKI_DISCORD_WEBHOOK" ] && [ -z "$LOKI_WEBHOOK_URL" ]; then
        echo "No webhook URLs configured. Set at least one of:"
        echo "  export LOKI_SLACK_WEBHOOK='https://hooks.slack.com/...'"
        echo "  export LOKI_DISCORD_WEBHOOK='https://discord.com/api/webhooks/...'"
        echo "  export LOKI_WEBHOOK_URL='https://your-endpoint.com/webhook'"
        exit 1
    fi

    echo "Sending test notification..."
    notify "session_start" "Test Notification" "This is a test from Loki Mode notification system"

    # Wait for background jobs to complete
    sleep 2
    echo "Done. Check your configured channels for the test message."
fi
