'use strict';

// Slash command handlers for Slack integration
// Each handler returns a response object suitable for Slack's slash command response

function handleStatus(params) {
    // /loki-status -- returns current RARV status
    return {
        response_type: 'in_channel',
        text: 'Loki Mode Status',
        blocks: [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: '*Status:* ' + (params.status || 'idle') }
            },
            {
                type: 'section',
                fields: [
                    { type: 'mrkdwn', text: '*Iteration:*\n' + (params.iteration || 'N/A') },
                    { type: 'mrkdwn', text: '*Provider:*\n' + (params.provider || 'N/A') },
                    { type: 'mrkdwn', text: '*Phase:*\n' + (params.phase || 'N/A') }
                ]
            }
        ]
    };
}

function handleApprove(params) {
    // /loki-approve -- approve pending action
    return {
        response_type: 'in_channel',
        text: 'Action approved by <@' + (params.userId || 'unknown') + '>',
    };
}

function handleStop(params) {
    // /loki-stop -- request session stop
    return {
        response_type: 'in_channel',
        text: 'Stop requested by <@' + (params.userId || 'unknown') + '>. Session will stop after current iteration.',
    };
}

var COMMAND_HANDLERS = {
    '/loki-status': handleStatus,
    '/loki-approve': handleApprove,
    '/loki-stop': handleStop,
};

function routeCommand(command, params) {
    var handler = COMMAND_HANDLERS[command];
    if (!handler) {
        return { response_type: 'ephemeral', text: 'Unknown command: ' + command };
    }
    return handler(params || {});
}

module.exports = { handleStatus, handleApprove, handleStop, routeCommand, COMMAND_HANDLERS };
