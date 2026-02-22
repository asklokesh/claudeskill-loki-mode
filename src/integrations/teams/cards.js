'use strict';

var SCHEMA = 'http://adaptivecards.io/schemas/adaptive-card.json';
var VERSION = '1.4';

function buildStatusCard(projectId, status, details) {
    var facts = [
        { title: 'Project', value: projectId || 'Unknown' },
        { title: 'Status', value: (status || 'Unknown').toUpperCase() },
    ];

    if (details) {
        if (details.iteration != null) facts.push({ title: 'Iteration', value: String(details.iteration) });
        if (details.provider) facts.push({ title: 'Provider', value: details.provider });
        if (details.phase) facts.push({ title: 'Phase', value: details.phase });
    }

    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                '$schema': SCHEMA,
                type: 'AdaptiveCard',
                version: VERSION,
                body: [
                    {
                        type: 'TextBlock',
                        text: 'Loki Mode Status Update',
                        size: 'large',
                        weight: 'bolder',
                    },
                    {
                        type: 'FactSet',
                        facts: facts,
                    }
                ]
            }
        }]
    };
}

function buildApprovalCard(projectId, description, callbackUrl) {
    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                '$schema': SCHEMA,
                type: 'AdaptiveCard',
                version: VERSION,
                body: [
                    {
                        type: 'TextBlock',
                        text: 'Approval Required',
                        size: 'large',
                        weight: 'bolder',
                    },
                    {
                        type: 'TextBlock',
                        text: description || 'Action requires approval',
                        wrap: true,
                    }
                ],
                actions: [
                    {
                        type: 'Action.Submit',
                        title: 'Approve',
                        style: 'positive',
                        data: { action: 'approve', projectId: projectId },
                    },
                    {
                        type: 'Action.Submit',
                        title: 'Reject',
                        style: 'destructive',
                        data: { action: 'reject', projectId: projectId },
                    }
                ]
            }
        }]
    };
}

function buildMessageCard(content) {
    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                '$schema': SCHEMA,
                type: 'AdaptiveCard',
                version: VERSION,
                body: [
                    {
                        type: 'TextBlock',
                        text: content || '',
                        wrap: true,
                    }
                ]
            }
        }]
    };
}

function buildTaskListCard(tasks) {
    var items = (tasks || []).map(function(t, i) {
        return {
            type: 'TextBlock',
            text: (i + 1) + '. ' + (t.title || 'Untitled'),
            wrap: true,
        };
    });

    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                '$schema': SCHEMA,
                type: 'AdaptiveCard',
                version: VERSION,
                body: [
                    {
                        type: 'TextBlock',
                        text: 'Task Breakdown',
                        size: 'large',
                        weight: 'bolder',
                    },
                ].concat(items)
            }
        }]
    };
}

function buildErrorCard(projectId, error) {
    return {
        type: 'message',
        attachments: [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
                '$schema': SCHEMA,
                type: 'AdaptiveCard',
                version: VERSION,
                body: [
                    {
                        type: 'TextBlock',
                        text: 'Loki Mode Error',
                        size: 'large',
                        weight: 'bolder',
                        color: 'attention',
                    },
                    {
                        type: 'FactSet',
                        facts: [
                            { title: 'Project', value: projectId || 'Unknown' },
                            { title: 'Error', value: error || 'Unknown error' },
                        ]
                    }
                ]
            }
        }]
    };
}

module.exports = { buildStatusCard, buildApprovalCard, buildMessageCard, buildTaskListCard, buildErrorCard, SCHEMA, VERSION };
