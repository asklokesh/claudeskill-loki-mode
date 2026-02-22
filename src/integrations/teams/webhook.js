'use strict';

// Teams webhook utility -- validates and formats outgoing webhook requests

function validateWebhookUrl(webhookUrl) {
    if (!webhookUrl) return false;
    try {
        var parsed = new URL(webhookUrl);
        return parsed.protocol === 'https:' && parsed.hostname.includes('webhook');
    } catch (e) {
        return false;
    }
}

module.exports = { validateWebhookUrl };
