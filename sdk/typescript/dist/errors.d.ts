/**
 * Autonomi SDK - Error Classes
 *
 * Typed error hierarchy for API error handling.
 */
export declare class AutonomiError extends Error {
    statusCode: number;
    responseBody?: string;
    constructor(message: string, statusCode: number, responseBody?: string);
}
export declare class AuthenticationError extends AutonomiError {
    constructor(message?: string, responseBody?: string);
}
export declare class ForbiddenError extends AutonomiError {
    constructor(message?: string, responseBody?: string);
}
export declare class NotFoundError extends AutonomiError {
    constructor(message?: string, responseBody?: string);
}
//# sourceMappingURL=errors.d.ts.map