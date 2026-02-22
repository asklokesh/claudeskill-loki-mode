"use strict";
/**
 * Autonomi SDK - Error Classes
 *
 * Typed error hierarchy for API error handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.ForbiddenError = exports.AuthenticationError = exports.AutonomiError = void 0;
class AutonomiError extends Error {
    statusCode;
    responseBody;
    constructor(message, statusCode, responseBody) {
        super(message);
        this.name = 'AutonomiError';
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}
exports.AutonomiError = AutonomiError;
class AuthenticationError extends AutonomiError {
    constructor(message = 'Authentication required', responseBody) {
        super(message, 401, responseBody);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class ForbiddenError extends AutonomiError {
    constructor(message = 'Access forbidden', responseBody) {
        super(message, 403, responseBody);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AutonomiError {
    constructor(message = 'Resource not found', responseBody) {
        super(message, 404, responseBody);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
//# sourceMappingURL=errors.js.map