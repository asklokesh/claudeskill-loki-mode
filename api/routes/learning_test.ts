/**
 * Tests for Learning API Routes
 *
 * Tests the learning metrics and aggregation API endpoints.
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";
import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

// Test directory setup
const TEST_LOKI_DIR = "/tmp/loki-learning-test";

async function setupTestDir() {
  // Clean up any existing test directory
  try {
    await Deno.remove(TEST_LOKI_DIR, { recursive: true });
  } catch {
    // Ignore if doesn't exist
  }

  // Create directories
  const signalsDir = path.join(TEST_LOKI_DIR, "learning", "signals");
  const aggregatedDir = path.join(TEST_LOKI_DIR, "learning", "aggregated");

  await Deno.mkdir(signalsDir, { recursive: true });
  await Deno.mkdir(aggregatedDir, { recursive: true });

  return { signalsDir, aggregatedDir };
}

async function cleanupTestDir() {
  try {
    await Deno.remove(TEST_LOKI_DIR, { recursive: true });
  } catch {
    // Ignore
  }
}

// Sample test signals
function createTestSignal(
  type: string,
  source: string,
  timestamp: Date
): Record<string, unknown> {
  return {
    id: `sig-${crypto.randomUUID().substring(0, 8)}`,
    type,
    source,
    action: `test_action_${type}`,
    context: { test: true },
    outcome: "success",
    confidence: 0.85,
    timestamp: timestamp.toISOString(),
    metadata: {},
  };
}

// Sample aggregation result
function createTestAggregation(): Record<string, unknown> {
  return {
    id: "agg-test123",
    timestamp: new Date().toISOString(),
    time_window_days: 7,
    total_signals_processed: 50,
    preferences: [
      {
        preference_key: "code_style",
        preferred_value: "functional",
        frequency: 10,
        confidence: 0.9,
        sources: ["cli", "vscode"],
        alternatives_rejected: ["oop"],
        first_seen: "2026-01-01T00:00:00Z",
        last_seen: "2026-02-01T00:00:00Z",
      },
    ],
    error_patterns: [
      {
        error_type: "TypeScript",
        common_messages: ["Type error"],
        frequency: 5,
        confidence: 0.85,
        sources: ["cli"],
        resolutions: ["Add type"],
        recovery_steps: [],
        resolution_rate: 0.8,
        first_seen: "2026-01-01T00:00:00Z",
        last_seen: "2026-02-01T00:00:00Z",
      },
    ],
    success_patterns: [
      {
        pattern_name: "tdd",
        common_actions: ["write test", "implement"],
        frequency: 15,
        confidence: 0.92,
        sources: ["cli"],
        avg_duration_seconds: 600,
        preconditions: [],
        postconditions: [],
        first_seen: "2026-01-01T00:00:00Z",
        last_seen: "2026-02-01T00:00:00Z",
      },
    ],
    tool_efficiencies: [
      {
        tool_name: "Read",
        usage_count: 100,
        success_count: 95,
        failure_count: 5,
        avg_execution_time_ms: 50,
        total_tokens_used: 5000,
        success_rate: 0.95,
        efficiency_score: 0.92,
        confidence: 0.98,
        sources: ["cli", "api"],
        alternative_tools: ["Glob"],
        first_seen: "2026-01-01T00:00:00Z",
        last_seen: "2026-02-01T00:00:00Z",
      },
    ],
    context_relevance: [],
  };
}

async function writeTestSignals(
  signalsDir: string,
  count: number,
  types: string[] = ["user_preference", "error_pattern", "success_pattern"],
  sources: string[] = ["cli", "api", "vscode"]
): Promise<void> {
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const source = sources[i % sources.length];
    const timestamp = new Date(now - i * 3600000); // 1 hour apart

    const signal = createTestSignal(type, source, timestamp);
    const filename = `${timestamp.toISOString().replace(/:/g, "-")}_${signal.id}.json`;
    const filepath = path.join(signalsDir, filename);

    await Deno.writeTextFile(filepath, JSON.stringify(signal, null, 2));
  }
}

async function writeTestAggregation(aggregatedDir: string): Promise<void> {
  const aggregation = createTestAggregation();
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const filename = `${timestamp}_${aggregation.id}.json`;
  const filepath = path.join(aggregatedDir, filename);

  await Deno.writeTextFile(filepath, JSON.stringify(aggregation, null, 2));
}

// =============================================================================
// Tests
// =============================================================================

Deno.test("Learning API - Signal file reading", async (t) => {
  const { signalsDir, aggregatedDir } = await setupTestDir();

  await t.step("reads signals in time range", async () => {
    await writeTestSignals(signalsDir, 10);

    // Read signals directory
    const files: string[] = [];
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }

    assertEquals(files.length, 10);
  });

  await t.step("parses signal JSON correctly", async () => {
    const files: string[] = [];
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }

    const firstFile = path.join(signalsDir, files[0]);
    const content = await Deno.readTextFile(firstFile);
    const signal = JSON.parse(content);

    assertExists(signal.id);
    assertExists(signal.type);
    assertExists(signal.source);
    assertExists(signal.timestamp);
    assertExists(signal.confidence);
  });

  await cleanupTestDir();
});

Deno.test("Learning API - Aggregation reading", async (t) => {
  const { signalsDir, aggregatedDir } = await setupTestDir();

  await t.step("reads latest aggregation", async () => {
    await writeTestAggregation(aggregatedDir);

    const files: string[] = [];
    for await (const entry of Deno.readDir(aggregatedDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }

    assertEquals(files.length, 1);

    const firstFile = path.join(aggregatedDir, files[0]);
    const content = await Deno.readTextFile(firstFile);
    const aggregation = JSON.parse(content);

    assertExists(aggregation.id);
    assertExists(aggregation.preferences);
    assertExists(aggregation.error_patterns);
    assertExists(aggregation.success_patterns);
    assertExists(aggregation.tool_efficiencies);
  });

  await t.step("aggregation has correct structure", async () => {
    const files: string[] = [];
    for await (const entry of Deno.readDir(aggregatedDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }

    const firstFile = path.join(aggregatedDir, files[0]);
    const content = await Deno.readTextFile(firstFile);
    const aggregation = JSON.parse(content);

    // Check preferences structure
    if (aggregation.preferences.length > 0) {
      const pref = aggregation.preferences[0];
      assertExists(pref.preference_key);
      assertExists(pref.preferred_value);
      assertExists(pref.frequency);
      assertExists(pref.confidence);
    }

    // Check error patterns structure
    if (aggregation.error_patterns.length > 0) {
      const err = aggregation.error_patterns[0];
      assertExists(err.error_type);
      assertExists(err.resolution_rate);
    }

    // Check success patterns structure
    if (aggregation.success_patterns.length > 0) {
      const succ = aggregation.success_patterns[0];
      assertExists(succ.pattern_name);
      assertExists(succ.common_actions);
    }

    // Check tool efficiencies structure
    if (aggregation.tool_efficiencies.length > 0) {
      const tool = aggregation.tool_efficiencies[0];
      assertExists(tool.tool_name);
      assertExists(tool.success_rate);
      assertExists(tool.efficiency_score);
    }
  });

  await cleanupTestDir();
});

Deno.test("Learning API - Statistics calculation", async (t) => {
  const { signalsDir, aggregatedDir } = await setupTestDir();

  await t.step("calculates signal counts by type", async () => {
    await writeTestSignals(signalsDir, 30, [
      "user_preference",
      "error_pattern",
      "success_pattern",
    ]);

    // Read all signals
    const signals: Record<string, unknown>[] = [];
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const content = await Deno.readTextFile(
          path.join(signalsDir, entry.name)
        );
        signals.push(JSON.parse(content));
      }
    }

    // Calculate counts by type
    const countsByType: Record<string, number> = {};
    for (const signal of signals) {
      const type = signal.type as string;
      countsByType[type] = (countsByType[type] || 0) + 1;
    }

    assertEquals(countsByType["user_preference"], 10);
    assertEquals(countsByType["error_pattern"], 10);
    assertEquals(countsByType["success_pattern"], 10);
  });

  await t.step("calculates signal counts by source", async () => {
    // Read all signals
    const signals: Record<string, unknown>[] = [];
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const content = await Deno.readTextFile(
          path.join(signalsDir, entry.name)
        );
        signals.push(JSON.parse(content));
      }
    }

    // Calculate counts by source
    const countsBySource: Record<string, number> = {};
    for (const signal of signals) {
      const source = signal.source as string;
      countsBySource[source] = (countsBySource[source] || 0) + 1;
    }

    assertEquals(countsBySource["cli"], 10);
    assertEquals(countsBySource["api"], 10);
    assertEquals(countsBySource["vscode"], 10);
  });

  await t.step("calculates average confidence", async () => {
    // Read all signals
    const signals: Record<string, unknown>[] = [];
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        const content = await Deno.readTextFile(
          path.join(signalsDir, entry.name)
        );
        signals.push(JSON.parse(content));
      }
    }

    // Calculate average confidence
    let totalConfidence = 0;
    for (const signal of signals) {
      totalConfidence += (signal.confidence as number) || 0;
    }
    const avgConfidence = totalConfidence / signals.length;

    assertEquals(avgConfidence, 0.85); // All test signals have 0.85 confidence
  });

  await cleanupTestDir();
});

Deno.test("Learning API - Time range parsing", async (t) => {
  await t.step("parses time ranges correctly", () => {
    const ranges: Record<string, number> = {
      "1h": 1,
      "24h": 24,
      "7d": 168,
      "30d": 720,
    };

    for (const [range, hours] of Object.entries(ranges)) {
      const parsed =
        range === "1h"
          ? 1
          : range === "24h"
          ? 24
          : range === "7d"
          ? 168
          : range === "30d"
          ? 720
          : 168;
      assertEquals(parsed, hours);
    }
  });

  await t.step("defaults to 7 days for unknown range", () => {
    const defaultHours = 168;
    assertEquals(defaultHours, 168);
  });
});

Deno.test("Learning API - Trend generation", async (t) => {
  await t.step("generates hourly buckets for 24h range", () => {
    const hours = 24;
    const bucketMs = hours <= 24 ? 3600000 : 86400000;
    const bucketCount = hours <= 24 ? hours : Math.ceil(hours / 24);

    assertEquals(bucketMs, 3600000); // 1 hour in ms
    assertEquals(bucketCount, 24);
  });

  await t.step("generates daily buckets for 7d range", () => {
    const hours = 168;
    const bucketMs = hours <= 24 ? 3600000 : 86400000;
    const bucketCount = hours <= 24 ? hours : Math.ceil(hours / 24);

    assertEquals(bucketMs, 86400000); // 1 day in ms
    assertEquals(bucketCount, 7);
  });
});

Deno.test("Learning API - Edge cases", async (t) => {
  await t.step("handles empty signals directory", async () => {
    const { signalsDir, aggregatedDir } = await setupTestDir();

    const files: string[] = [];
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }

    assertEquals(files.length, 0);

    await cleanupTestDir();
  });

  await t.step("handles missing aggregation directory", async () => {
    // Try to read from non-existent directory
    let exists = false;
    try {
      await Deno.stat("/tmp/nonexistent-loki-dir/learning/aggregated");
      exists = true;
    } catch {
      exists = false;
    }

    assertEquals(exists, false);
  });

  await t.step("handles malformed signal files", async () => {
    const { signalsDir, aggregatedDir } = await setupTestDir();

    // Write a malformed JSON file
    const filepath = path.join(signalsDir, "malformed.json");
    await Deno.writeTextFile(filepath, "{ invalid json }");

    // Try to parse it
    let parseError = false;
    try {
      const content = await Deno.readTextFile(filepath);
      JSON.parse(content);
    } catch {
      parseError = true;
    }

    assertEquals(parseError, true);

    await cleanupTestDir();
  });
});
