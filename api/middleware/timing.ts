/**
 * Timing Middleware
 *
 * Tracks API request timing and emits learning signals for efficiency tracking.
 */

import { learningCollector } from "../services/learning-collector.ts";

/**
 * Request timing context
 */
export interface TimingContext {
  startTime: number;
  method: string;
  path: string;
}

/**
 * Create timing middleware that wraps handlers to track response times.
 *
 * Emits ToolEfficiencySignal for each request with timing data.
 */
export function timingMiddleware(
  handler: (req: Request) => Promise<Response> | Response
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const startTime = Date.now();
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;

      // Emit success signal for non-error responses
      if (response.status < 400) {
        learningCollector.emitApiRequest(path, method, startTime, true, {
          statusCode: response.status,
          context: {
            durationMs: duration,
          },
        });
      } else {
        // Clone response to read body for error details
        const clonedResponse = response.clone();
        let errorMessage = "Request failed";
        try {
          const body = await clonedResponse.json();
          errorMessage = body.error || body.message || errorMessage;
        } catch {
          // Body might not be JSON
        }

        learningCollector.emitApiRequest(path, method, startTime, false, {
          statusCode: response.status,
          errorMessage,
          context: {
            durationMs: duration,
          },
        });
      }

      // Add timing header to response
      const headers = new Headers(response.headers);
      headers.set("X-Response-Time", `${duration}ms`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      // Emit error signal
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      learningCollector.emitApiRequest(path, method, startTime, false, {
        statusCode: 500,
        errorMessage,
        context: {
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
      });

      throw error;
    }
  };
}

/**
 * Create a timing context for manual timing in route handlers.
 *
 * Usage:
 *   const timing = startTiming(req);
 *   // ... do work ...
 *   endTiming(timing, true);
 */
export function startTiming(req: Request): TimingContext {
  const url = new URL(req.url);
  return {
    startTime: Date.now(),
    method: req.method,
    path: url.pathname,
  };
}

/**
 * End timing and emit a learning signal.
 */
export function endTiming(
  context: TimingContext,
  success: boolean,
  options: {
    statusCode?: number;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
  } = {}
): number {
  const duration = Date.now() - context.startTime;

  learningCollector.emitApiRequest(
    context.path,
    context.method,
    context.startTime,
    success,
    {
      statusCode: options.statusCode,
      errorMessage: options.errorMessage,
      context: options.metadata,
    }
  );

  return duration;
}
