'use strict';

var crypto = require('crypto');

function verifySlackSignature(signingSecret, timestamp, body, signature) {
    if (!signingSecret || !timestamp || !signature) return false;
    // Reject requests older than 5 minutes
    var now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp, 10)) > 300) return false;
    var sigBasestring = 'v0:' + timestamp + ':' + body;
    var mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret)
        .update(sigBasestring)
        .digest('hex');
    var a = Buffer.from(mySignature);
    var b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

function parseSlackPayload(body) {
    try {
        // Interactive payloads are URL-encoded with a 'payload' field
        if (body.startsWith('payload=')) {
            return JSON.parse(decodeURIComponent(body.slice(8)));
        }
        return JSON.parse(body);
    } catch (e) {
        return null;
    }
}

module.exports = { verifySlackSignature, parseSlackPayload };
