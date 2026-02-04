/**
 * Learning Routes
 *
 * REST endpoints for learning metrics and aggregated data.
 * Provides access to learning signals, aggregations, and trends.
 */

import * as path from "https://deno.land/std@0.208.0/path/mod.ts";
import {
  LokiApiError,
  ErrorCodes,
  successResponse,
} from "../middleware/error.ts";

// Default Loki directory
const LOKI_DIR = Deno.env.get("LOKI_DIR") || ".loki";

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get signals directory path
 */
function getSignalsDir(): string {
  return path.join(LOKI_DIR, "learning", "signals");
}

/**
 * Get aggregated directory path
 */
function getAggregatedDir(): string {
  return path.join(LOKI_DIR, "learning", "aggregated");
}

/**
 * Parse time range to hours
 */
function parseTimeRange(timeRange: string): number {
  const ranges: Record<string, number> = {
    "1h": 1,
    "24h": 24,
    "7d": 168,
    "30d": 720,
  };
  return ranges[timeRange] || 168;
}

/**
 * Read all signal files in time range
 */
async function readSignals(
  since: Date,
  signalType?: string,
  source?: string,
  limit = 1000
): Promise<unknown[]> {
  const signalsDir = getSignalsDir();
  const signals: unknown[] = [];

  try {
    for await (const entry of Deno.readDir(signalsDir)) {
      if (!entry.isFile || !entry.name.endsWith(".json")) continue;

      const filePath = path.join(signalsDir, entry.name);
      try {
        const content = await Deno.readTextFile(filePath);
        const signal = JSON.parse(content);

        // Filter by timestamp
        const signalTime = new Date(signal.timestamp);
        if (signalTime < since) continue;

        // Filter by type
        if (signalType && signal.type !== signalType) continue;

        // Filter by source
        if (source && signal.source !== source) continue;

        signals.push(signal);

        if (signals.length >= limit) break;
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory may not exist
  }

  // Sort by timestamp descending
  signals.sort((a: unknown, b: unknown) => {
    const aTime = new Date((a as { timestamp: string }).timestamp).getTime();
    const bTime = new Date((b as { timestamp: string }).timestamp).getTime();
    return bTime - aTime;
  });

  return signals;
}

/**
 * Read latest aggregation result
 */
async function readLatestAggregation(): Promise<unknown | null> {
  const aggDir = getAggregatedDir();

  try {
    const files: string[] = [];
    for await (const entry of Deno.readDir(aggDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }

    if (files.length === 0) return null;

    // Sort by filename (contains timestamp)
    files.sort().reverse();

    const latestFile = path.join(aggDir, files[0]);
    const content = await Deno.readTextFile(latestFile);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Calculate signal statistics
 */
function calculateStats(signals: unknown[]): {
  totalSignals: number;
  signalsByType: Record<string, number>;
  signalsBySource: Record<string, number>;
  avgConfidence: number;
  outcomeBreakdown: Record<string, number>;
} {
  const stats = {
    totalSignals: signals.length,
    signalsByType: {} as Record<string, number>,
    signalsBySource: {} as Record<string, number>,
    avgConfidence: 0,
    outcomeBreakdown: {} as Record<string, number>,
  };

  let totalConfidence = 0;

  for (const signal of signals) {
    const s = signal as {
      type: string;
      source: string;
      confidence: number;
      outcome: string;
    };

    // Count by type
    stats.signalsByType[s.type] = (stats.signalsByType[s.type] || 0) + 1;

    // Count by source
    stats.signalsBySource[s.source] = (stats.signalsBySource[s.source] || 0) + 1;

    // Sum confidence
    totalConfidence += s.confidence || 0;

    // Count outcomes
    stats.outcomeBreakdown[s.outcome] =
      (stats.outcomeBreakdown[s.outcome] || 0) + 1;
  }

  stats.avgConfidence =
    signals.length > 0 ? totalConfidence / signals.length : 0;

  return stats;
}

/**
 * Generate trend data points from signals
 */
function generateTrends(
  signals: unknown[],
  hours: number
): {
  dataPoints: { label: string; count: number; timestamp: string }[];
  maxValue: number;
  period: string;
} {
  const now = Date.now();
  const bucketMs = hours <= 24 ? 3600000 : 86400000; // hourly or daily
  const bucketCount = hours <= 24 ? hours : Math.ceil(hours / 24);

  const buckets: Map<number, number> = new Map();

  // Initialize buckets
  for (let i = 0; i < bucketCount; i++) {
    const bucketTime = now - i * bucketMs;
    buckets.set(Math.floor(bucketTime / bucketMs), 0);
  }

  // Count signals in buckets
  for (const signal of signals) {
    const s = signal as { timestamp: string };
    const signalTime = new Date(s.timestamp).getTime();
    const bucketKey = Math.floor(signalTime / bucketMs);
    if (buckets.has(bucketKey)) {
      buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
    }
  }

  // Convert to array and format
  const dataPoints = Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([key, count]) => {
      const timestamp = new Date(key * bucketMs);
      const label =
        hours <= 24
          ? timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : timestamp.toLocaleDateString([], { month: "short", day: "numeric" });
      return {
        label,
        count,
        timestamp: timestamp.toISOString(),
      };
    });

  const maxValue = Math.max(...dataPoints.map((d) => d.count), 1);
  const period = hours <= 24 ? "Hourly" : "Daily";

  return { dataPoints, maxValue, period };
}

// -----------------------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------------------

/**
 * GET /api/learning/metrics - Get learning metrics and aggregations
 */
export async function getLearningMetrics(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const timeRange = url.searchParams.get("timeRange") || "7d";
  const signalType = url.searchParams.get("signalType") || undefined;
  const source = url.searchParams.get("source") || undefined;

  const hours = parseTimeRange(timeRange);
  const since = new Date(Date.now() - hours * 3600000);

  // Read signals
  const signals = await readSignals(since, signalType, source);

  // Calculate statistics
  const stats = calculateStats(signals);

  // Get latest aggregation
  const aggregation = await readLatestAggregation();

  return successResponse({
    ...stats,
    aggregation,
    timeRange,
    since: since.toISOString(),
  });
}

/**
 * GET /api/learning/trends - Get signal volume trends over time
 */
export async function getLearningTrends(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const timeRange = url.searchParams.get("timeRange") || "7d";
  const signalType = url.searchParams.get("signalType") || undefined;
  const source = url.searchParams.get("source") || undefined;

  const hours = parseTimeRange(timeRange);
  const since = new Date(Date.now() - hours * 3600000);

  // Read signals
  const signals = await readSignals(since, signalType, source);

  // Generate trends
  const trends = generateTrends(signals, hours);

  return successResponse({
    ...trends,
    timeRange,
    signalCount: signals.length,
  });
}

/**
 * GET /api/learning/signals - Get recent learning signals
 */
export async function getLearningSignals(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const timeRange = url.searchParams.get("timeRange") || "7d";
  const signalType = url.searchParams.get("signalType") || undefined;
  const source = url.searchParams.get("source") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const hours = parseTimeRange(timeRange);
  const since = new Date(Date.now() - hours * 3600000);

  // Read signals
  const allSignals = await readSignals(since, signalType, source, limit + offset);

  // Paginate
  const signals = allSignals.slice(offset, offset + limit);

  return successResponse({
    signals,
    pagination: {
      total: allSignals.length,
      limit,
      offset,
      hasMore: offset + limit < allSignals.length,
    },
  });
}

/**
 * GET /api/learning/aggregation - Get the latest aggregation result
 */
export async function getLatestAggregation(_req: Request): Promise<Response> {
  const aggregation = await readLatestAggregation();

  if (!aggregation) {
    throw new LokiApiError(
      "No aggregation data available. Run aggregation first.",
      ErrorCodes.NOT_FOUND
    );
  }

  return successResponse(aggregation);
}

/**
 * POST /api/learning/aggregate - Trigger a new aggregation
 */
export async function triggerAggregation(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const timeWindowDays = body.timeWindowDays || 7;
  const minFrequency = body.minFrequency || 2;
  const minConfidence = body.minConfidence || 0.5;

  // Run the Python aggregator via CLI
  const cmd = new Deno.Command("python3", {
    args: [
      "-c",
      `
import sys
sys.path.insert(0, '.')
from learning.aggregator import run_aggregation, print_aggregation_summary
result = run_aggregation(
    time_window_days=${timeWindowDays},
    min_frequency=${minFrequency},
    min_confidence=${minConfidence},
    save=True
)
print_aggregation_summary(result)
import json
print("---JSON---")
print(json.dumps(result.to_dict()))
`,
    ],
    cwd: Deno.cwd(),
    stdout: "piped",
    stderr: "piped",
  });

  try {
    const output = await cmd.output();

    if (!output.success) {
      const stderr = new TextDecoder().decode(output.stderr);
      throw new LokiApiError(
        `Aggregation failed: ${stderr}`,
        ErrorCodes.INTERNAL_ERROR
      );
    }

    const stdout = new TextDecoder().decode(output.stdout);
    const jsonPart = stdout.split("---JSON---")[1]?.trim();

    if (jsonPart) {
      const result = JSON.parse(jsonPart);
      return successResponse({
        success: true,
        result,
      });
    }

    return successResponse({
      success: true,
      message: "Aggregation completed",
    });
  } catch (error) {
    if (error instanceof LokiApiError) throw error;

    throw new LokiApiError(
      `Failed to run aggregation: ${error}`,
      ErrorCodes.INTERNAL_ERROR
    );
  }
}

/**
 * GET /api/learning/preferences - Get aggregated user preferences
 */
export async function getAggregatedPreferences(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const aggregation = await readLatestAggregation();

  if (!aggregation) {
    return successResponse({ preferences: [] });
  }

  const agg = aggregation as { preferences?: unknown[] };
  const preferences = (agg.preferences || []).slice(0, limit);

  return successResponse({ preferences });
}

/**
 * GET /api/learning/errors - Get aggregated error patterns
 */
export async function getAggregatedErrors(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const aggregation = await readLatestAggregation();

  if (!aggregation) {
    return successResponse({ error_patterns: [] });
  }

  const agg = aggregation as { error_patterns?: unknown[] };
  const errorPatterns = (agg.error_patterns || []).slice(0, limit);

  return successResponse({ error_patterns: errorPatterns });
}

/**
 * GET /api/learning/success - Get aggregated success patterns
 */
export async function getAggregatedSuccessPatterns(
  req: Request
): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const aggregation = await readLatestAggregation();

  if (!aggregation) {
    return successResponse({ success_patterns: [] });
  }

  const agg = aggregation as { success_patterns?: unknown[] };
  const successPatterns = (agg.success_patterns || []).slice(0, limit);

  return successResponse({ success_patterns: successPatterns });
}

/**
 * GET /api/learning/tools - Get tool efficiency rankings
 */
export async function getToolEfficiency(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const aggregation = await readLatestAggregation();

  if (!aggregation) {
    return successResponse({ tool_efficiencies: [] });
  }

  const agg = aggregation as { tool_efficiencies?: unknown[] };
  const toolEfficiencies = (agg.tool_efficiencies || []).slice(0, limit);

  return successResponse({ tool_efficiencies: toolEfficiencies });
}
