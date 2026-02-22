'use strict';

function buildStatusBlocks(projectId, status, details) {
    var blocks = [
        {
            type: 'header',
            text: { type: 'plain_text', text: 'Loki Mode Status Update' }
        },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: '*Project:*\n' + (projectId || 'Unknown') },
                { type: 'mrkdwn', text: '*Status:*\n' + (status || 'Unknown').toUpperCase() },
            ]
        }
    ];

    if (details) {
        var detailFields = [];
        if (details.iteration != null) {
            detailFields.push({ type: 'mrkdwn', text: '*Iteration:*\n' + details.iteration });
        }
        if (details.provider) {
            detailFields.push({ type: 'mrkdwn', text: '*Provider:*\n' + details.provider });
        }
        if (details.phase) {
            detailFields.push({ type: 'mrkdwn', text: '*Phase:*\n' + details.phase });
        }
        if (detailFields.length > 0) {
            blocks.push({ type: 'section', fields: detailFields });
        }
    }

    blocks.push({ type: 'divider' });

    return blocks;
}

function buildApprovalBlocks(projectId, description, actionId) {
    return [
        {
            type: 'header',
            text: { type: 'plain_text', text: 'Approval Required' }
        },
        {
            type: 'section',
            text: { type: 'mrkdwn', text: description || 'Action requires approval' }
        },
        {
            type: 'actions',
            elements: [
                {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Approve' },
                    style: 'primary',
                    action_id: 'approve_' + (actionId || 'action'),
                    value: JSON.stringify({ projectId: projectId, action: 'approve' })
                },
                {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Reject' },
                    style: 'danger',
                    action_id: 'reject_' + (actionId || 'action'),
                    value: JSON.stringify({ projectId: projectId, action: 'reject' })
                }
            ]
        }
    ];
}

function buildErrorBlocks(projectId, error) {
    return [
        {
            type: 'header',
            text: { type: 'plain_text', text: 'Loki Mode Error' }
        },
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: '*Project:* ' + (projectId || 'Unknown') + '\n*Error:* ' + (error || 'Unknown error')
            }
        }
    ];
}

module.exports = { buildStatusBlocks, buildApprovalBlocks, buildErrorBlocks };
