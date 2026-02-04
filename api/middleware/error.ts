/**
 * Error Handling Middleware
 *
 * Provides consistent error responses and logging.
 * Emits ErrorPatternSignal for learning from API errors.
 */

import type { ApiError } from "../types/api.ts";
import { learningCollector } from "../services/learning-collector.ts";

// Error codes
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // Server errors (5xx)
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",

  // Loki-specific errors
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_ALREADY_RUNNING: "SESSION_ALREADY_RUNNING",
  PROVIDER_NOT_AVAILABLE: "PROVIDER_NOT_AVAILABLE",
  CLI_ERROR: "CLI_ERROR",
} as const;

type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// HTTP status codes for error codes
const errorStatusMap: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  SESSION_NOT_FOUND: 404,
  SESSION_ALREADY_RUNNING: 409,
  PROVIDER_NOT_AVAILABLE: 503,
  CLI_ERROR: 500,
};

/**
 * Custom API error class
 */
export class LokiApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "LokiApiError";
    this.code = code;
    this.status = errorStatusMap[code] || 500;
    this.details = details;
  }

  toJSON(): ApiError {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }

  toResponse(): Response {
    return new Response(JSON.stringify(this.toJSON()), {
      status: this.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

/**
 * Error middleware wrapper
 */
export function errorMiddleware(
  handler: (req: Request) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      return handleError(err, req);
    }
  };
}

/**
 * Handle an error and return appropriate response.
 * Also emits an ErrorPatternSignal for learning.
 */
export function handleError(err: unknown, req?: Request): Response {
  // Log error for debugging
  const requestInfo = req
    ? `${req.method} ${new URL(req.url).pathname}`
    : "unknown request";

  console.error(`Error handling ${requestInfo}:`, err);

  // Emit error pattern signal for learning
  const errorType = err instanceof LokiApiError
    ? err.code
    : err instanceof Error
    ? err.name
    : "UnknownError";
  const errorMessage = err instanceof Error
    ? err.message
    : "An unexpected error occurred";

  learningCollector.emitErrorPattern(
    requestInfo,
    errorType,
    errorMessage,
    {
      stackTrace: err instanceof Error ? err.stack : undefined,
      context: {
        method: req?.method,
        path: req ? new URL(req.url).pathname : undefined,
        errorCode: err instanceof LokiApiError ? err.code : undefined,
        statusCode: err instanceof LokiApiError ? err.status : 500,
      },
    }
  );

  // Handle known API errors
  if (err instanceof LokiApiError) {
    return err.toResponse();
  }

  // Handle Deno-specific errors
  if (err instanceof Deno.errors.NotFound) {
    return new LokiApiError("Resource not found", ErrorCodes.NOT_FOUND).toResponse();
  }

  if (err instanceof Deno.errors.PermissionDenied) {
    return new LokiApiError(
      "Permission denied",
      ErrorCodes.FORBIDDEN
    ).toResponse();
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.message.includes("JSON")) {
    return new LokiApiError(
      "Invalid JSON in request body",
      ErrorCodes.BAD_REQUEST
    ).toResponse();
  }

  // Handle timeout errors
  if (err instanceof Error && err.name === "AbortError") {
    return new LokiApiError(
      "Request timed out",
      ErrorCodes.TIMEOUT
    ).toResponse();
  }

  // Default to internal error
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";

  return new LokiApiError(
    message,
    ErrorCodes.INTERNAL_ERROR,
    Deno.env.get("LOKI_DEBUG") ? { stack: (err as Error).stack } : undefined
  ).toResponse();
}

/**
 * Validate request body against expected fields
 */
export function validateBody<T extends Record<string, unknown>>(
  body: unknown,
  required: (keyof T)[],
  optional: (keyof T)[] = []
): T {
  if (!body || typeof body !== "object") {
    throw new LokiApiError(
      "Request body must be a JSON object",
      ErrorCodes.BAD_REQUEST
    );
  }

  const obj = body as Record<string, unknown>;

  // Check required fields
  for (const field of required) {
    if (!(field in obj)) {
      throw new LokiApiError(
        `Missing required field: ${String(field)}`,
        ErrorCodes.VALIDATION_ERROR,
        { field: String(field) }
      );
    }
  }

  // Check for unknown fields
  const allowedFields = new Set([...required, ...optional]);
  for (const field of Object.keys(obj)) {
    if (!allowedFields.has(field)) {
      throw new LokiApiError(
        `Unknown field: ${field}`,
        ErrorCodes.VALIDATION_ERROR,
        { field }
      );
    }
  }

  return obj as T;
}

/**
 * Create a simple error response
 */
export function errorResponse(
  message: string,
  code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
  details?: Record<string, unknown>
): Response {
  return new LokiApiError(message, code, details).toResponse();
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
