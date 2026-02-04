/**
 * Learning Collector Tests
 *
 * Tests for the API learning signal collector.
 *
 * Run with: deno test --allow-all api/services/learning-collector_test.ts
 */

import {
  assertEquals,
  assertExists,
  assertGreater,
} from "https://deno.land/std@0.220.0/assert/mod.ts";
import * as path from "https://deno.land/std@0.220.0/path/mod.ts";
import {
  LearningCollector,
  Outcome,
} from "./learning-collector.ts";

// Test directory for signal storage
const TEST_LOKI_DIR = "/tmp/loki-learning-collector-test";

/**
 * Setup test environment
 */
async function setup(): Promise<LearningCollector> {
  // Clean up any existing test directory
  try {
    await Deno.remove(TEST_LOKI_DIR, { recursive: true });
  } catch {
    // Directory may not exist
  }

  // Create test directory
  await Deno.mkdir(path.join(TEST_LOKI_DIR, "learning", "signals"), {
    recursive: true,
  });

  return new LearningCollector(TEST_LOKI_DIR);
}

/**
 * Teardown test environment
 */
async function teardown(collector: LearningCollector): Promise<void> {
  collector.stopFlushTimer();
  try {
    await Deno.remove(TEST_LOKI_DIR, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get signal files from test directory
 */
async function getSignalFiles(): Promise<string[]> {
  const signalsDir = path.join(TEST_LOKI_DIR, "learning", "signals");
  const files: string[] = [];
  try {
    for await (const entry of Deno.readDir(signalsDir)) {
      if (entry.isFile && entry.name.endsWith(".json")) {
        files.push(entry.name);
      }
    }
  } catch {
    // Directory may not exist
  }
  return files;
}

/**
 * Read a signal file
 */
async function readSignalFile(filename: string): Promise<Record<string, unknown>> {
  const filepath = path.join(TEST_LOKI_DIR, "learning", "signals", filename);
  const content = await Deno.readTextFile(filepath);
  return JSON.parse(content);
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

Deno.test("LearningCollector - emitUserPreference queues signal", async () => {
  const collector = await setup();

  try {
    collector.emitUserPreference(
      "test_action",
      "test_key",
      "test_value",
      {
        alternativesRejected: ["other_value"],
        context: { source: "test" },
      }
    );

    assertEquals(collector.getBufferSize(), 1);

    // Flush and verify
    const flushed = await collector.flush();
    assertEquals(flushed, 1);
    assertEquals(collector.getBufferSize(), 0);

    // Check signal file was created
    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    // Verify signal content
    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "user_preference");
    assertEquals(signal.source, "api");
    assertEquals(signal.action, "test_action");
    assertEquals(signal.preference_key, "test_key");
    assertEquals(signal.preference_value, "test_value");
    assertExists(signal.id);
    assertExists(signal.timestamp);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitErrorPattern queues signal", async () => {
  const collector = await setup();

  try {
    collector.emitErrorPattern(
      "test_action",
      "TestError",
      "Something went wrong",
      {
        resolution: "Fixed it",
        recoverySteps: ["step1", "step2"],
        stackTrace: "Error: ...",
      }
    );

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "error_pattern");
    assertEquals(signal.error_type, "TestError");
    assertEquals(signal.error_message, "Something went wrong");
    assertEquals(signal.resolution, "Fixed it");
    assertEquals(signal.recovery_steps, ["step1", "step2"]);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitSuccessPattern queues signal", async () => {
  const collector = await setup();

  try {
    collector.emitSuccessPattern(
      "test_action",
      "test_pattern",
      ["action1", "action2"],
      {
        preconditions: ["pre1"],
        postconditions: ["post1"],
        durationSeconds: 5,
      }
    );

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "success_pattern");
    assertEquals(signal.pattern_name, "test_pattern");
    assertEquals(signal.action_sequence, ["action1", "action2"]);
    assertEquals(signal.duration_seconds, 5);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitToolEfficiency queues signal", async () => {
  const collector = await setup();

  try {
    collector.emitToolEfficiency(
      "test_action",
      "test_tool",
      {
        tokensUsed: 100,
        executionTimeMs: 250,
        successRate: 0.95,
        alternativeTools: ["tool2", "tool3"],
      }
    );

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "tool_efficiency");
    assertEquals(signal.tool_name, "test_tool");
    assertEquals(signal.tokens_used, 100);
    assertEquals(signal.execution_time_ms, 250);
    assertEquals(signal.success_rate, 0.95);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitContextRelevance queues signal", async () => {
  const collector = await setup();

  try {
    collector.emitContextRelevance(
      "test_action",
      "test query",
      ["ctx1", "ctx2", "ctx3"],
      {
        relevantIds: ["ctx1", "ctx2"],
        irrelevantIds: ["ctx3"],
        precision: 0.67,
        recall: 0.8,
      }
    );

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "context_relevance");
    assertEquals(signal.query, "test query");
    assertEquals(signal.retrieved_context_ids, ["ctx1", "ctx2", "ctx3"]);
    assertEquals(signal.relevant_ids, ["ctx1", "ctx2"]);
    assertEquals(signal.precision, 0.67);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitApiRequest success", async () => {
  const collector = await setup();

  try {
    const startTime = Date.now() - 100; // Simulate 100ms ago
    collector.emitApiRequest("/api/test", "GET", startTime, true, {
      statusCode: 200,
    });

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "tool_efficiency");
    assertEquals(signal.tool_name, "api::api:test");
    assertGreater(signal.execution_time_ms as number, 90);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitApiRequest failure", async () => {
  const collector = await setup();

  try {
    const startTime = Date.now() - 50;
    collector.emitApiRequest("/api/test", "POST", startTime, false, {
      statusCode: 500,
      errorMessage: "Internal error",
    });

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "error_pattern");
    assertEquals(signal.error_message, "Internal error");
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitMemoryRetrieval", async () => {
  const collector = await setup();

  try {
    const startTime = Date.now() - 150;
    collector.emitMemoryRetrieval(
      "test query",
      ["mem1", "mem2"],
      startTime,
      {
        taskType: "debugging",
        relevantIds: ["mem1"],
      }
    );

    // Should emit both context relevance and tool efficiency
    assertEquals(collector.getBufferSize(), 2);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 2);

    // Find context relevance signal
    let foundContextRelevance = false;
    let foundToolEfficiency = false;
    for (const file of files) {
      const signal = await readSignalFile(file);
      if (signal.type === "context_relevance") {
        foundContextRelevance = true;
        assertEquals(signal.query, "test query");
        assertEquals(signal.retrieved_context_ids, ["mem1", "mem2"]);
      } else if (signal.type === "tool_efficiency") {
        foundToolEfficiency = true;
        assertEquals(signal.tool_name, "api:memory:retrieve");
      }
    }
    assertEquals(foundContextRelevance, true);
    assertEquals(foundToolEfficiency, true);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitSessionOperation success", async () => {
  const collector = await setup();

  try {
    collector.emitSessionOperation("start", "session-123", true, {
      provider: "claude",
      durationMs: 500,
    });

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "success_pattern");
    assertEquals(signal.pattern_name, "session_start_success");
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitSessionOperation failure", async () => {
  const collector = await setup();

  try {
    collector.emitSessionOperation("stop", "session-123", false, {
      provider: "claude",
      errorMessage: "Session not found",
    });

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "error_pattern");
    assertEquals(signal.error_type, "session_stop_error");
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - emitSettingsChange", async () => {
  const collector = await setup();

  try {
    collector.emitSettingsChange("theme", "dark", "light", {
      source: "dashboard",
    });

    assertEquals(collector.getBufferSize(), 1);

    await collector.flush();

    const files = await getSignalFiles();
    assertEquals(files.length, 1);

    const signal = await readSignalFile(files[0]);
    assertEquals(signal.type, "user_preference");
    assertEquals(signal.preference_key, "theme");
    assertEquals(signal.preference_value, "dark");
    assertEquals(signal.alternatives_rejected, ["light"]);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - disabled collector does not queue", async () => {
  const collector = await setup();

  try {
    collector.setEnabled(false);
    assertEquals(collector.isCollectorEnabled(), false);

    collector.emitUserPreference("test", "key", "value");
    assertEquals(collector.getBufferSize(), 0);

    // Re-enable and verify it works
    collector.setEnabled(true);
    assertEquals(collector.isCollectorEnabled(), true);

    collector.emitUserPreference("test", "key", "value");
    assertEquals(collector.getBufferSize(), 1);
  } finally {
    await teardown(collector);
  }
});

Deno.test("LearningCollector - multiple signals batch flush", async () => {
  const collector = await setup();

  try {
    // Queue multiple signals
    collector.emitUserPreference("pref1", "key1", "value1");
    collector.emitErrorPattern("err1", "Error", "message");
    collector.emitSuccessPattern("success1", "pattern", ["action"]);
    collector.emitToolEfficiency("tool1", "tool", { executionTimeMs: 100 });
    collector.emitContextRelevance("ctx1", "query", ["id1"]);

    assertEquals(collector.getBufferSize(), 5);

    // Flush all at once
    const flushed = await collector.flush();
    assertEquals(flushed, 5);
    assertEquals(collector.getBufferSize(), 0);

    // Verify all files were created
    const files = await getSignalFiles();
    assertEquals(files.length, 5);
  } finally {
    await teardown(collector);
  }
});
