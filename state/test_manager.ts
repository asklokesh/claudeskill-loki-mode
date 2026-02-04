/**
 * Tests for TypeScript State Manager
 *
 * Run with: npx ts-node state/test_manager.ts
 * Or with Deno: deno run --allow-read --allow-write state/test_manager.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import {
  StateManager,
  StateChange,
  ManagedFile,
  getStateDiff,
  getStateManager,
  resetStateManager,
  ConflictStrategy,
  VersionVector,
  PendingUpdate,
  ConflictInfo,
} from "./manager";

// Test helpers
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `Assertion failed: ${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`
    );
  }
}

// Test runner
async function runTests(): Promise<void> {
  // Create temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "state-manager-test-"));
  const lokiDir = path.join(tempDir, ".loki");

  console.log("Testing StateManager (TypeScript)...");

  try {
    // Test: Manager initialization
    const manager = new StateManager({ lokiDir, enableWatch: false, enableEvents: false });
    assert(fs.existsSync(path.join(lokiDir, "state")), "state directory should exist");
    assert(fs.existsSync(path.join(lokiDir, "queue")), "queue directory should exist");
    console.log("  [PASS] Manager initialized");

    // Test: set_state
    const change1 = manager.setState("test.json", { key: "value" });
    assertEqual(change1.changeType, "create", "should be create");
    assertEqual(change1.newValue, { key: "value" }, "should have new value");
    console.log("  [PASS] setState works");

    // Test: get_state
    const result1 = manager.getState("test.json");
    assertEqual(result1, { key: "value" }, "should get state");
    console.log("  [PASS] getState works");

    // Test: update_state
    const change2 = manager.updateState("test.json", { another: "field" });
    assertEqual(
      change2.newValue,
      { key: "value", another: "field" },
      "should merge updates"
    );
    console.log("  [PASS] updateState works");

    // Test: ManagedFile enum
    manager.setState(ManagedFile.ORCHESTRATOR, { phase: "planning" });
    const result2 = manager.getState(ManagedFile.ORCHESTRATOR);
    assertEqual(result2, { phase: "planning" }, "should work with enum");
    console.log("  [PASS] ManagedFile enum works");

    // Test: subscriptions
    const changes: StateChange[] = [];
    const subscription = manager.subscribe((change) => {
      changes.push(change);
    });
    manager.setState("sub-test.json", { data: 123 });
    assertEqual(changes.length, 1, "should receive change");
    console.log("  [PASS] Subscriptions work");

    subscription.dispose();
    manager.setState("sub-test.json", { data: 456 });
    assertEqual(changes.length, 1, "should not receive after dispose");
    console.log("  [PASS] Unsubscribe works");

    // Test: convenience methods
    manager.setOrchestratorState({ phase: "dev" });
    assertEqual(manager.getOrchestratorState(), { phase: "dev" }, "orchestrator state");
    console.log("  [PASS] Convenience methods work");

    // Test: getStateDiff
    const diff = getStateDiff({ a: 1, b: 2 }, { a: 1, c: 3 });
    assertEqual(diff.added, { c: 3 }, "diff added");
    assertEqual(diff.removed, { b: 2 }, "diff removed");
    assertEqual(diff.changed, {}, "diff changed");
    console.log("  [PASS] getStateDiff works");

    // Test: delete_state
    manager.setState("to-delete.json", { temp: true });
    const change3 = manager.deleteState("to-delete.json");
    assert(change3 !== null, "should return change");
    assertEqual(change3!.changeType, "delete", "should be delete");
    const result3 = manager.getState("to-delete.json");
    assert(result3 === null, "should be null after delete");
    console.log("  [PASS] deleteState works");

    // Test: corrupted JSON handling
    const corruptedPath = path.join(lokiDir, "corrupted.json");
    fs.writeFileSync(corruptedPath, "{ this is not valid json }");
    const resultCorrupted = manager.getState("corrupted.json");
    assert(resultCorrupted === null, "corrupted JSON should return null");
    console.log("  [PASS] Corrupted JSON handling works");

    // Test: empty file handling
    const emptyPath = path.join(lokiDir, "empty.json");
    fs.writeFileSync(emptyPath, "");
    const resultEmpty = manager.getState("empty.json");
    assert(resultEmpty === null, "empty file should return null");
    console.log("  [PASS] Empty file handling works");

    // Test: partial/truncated JSON handling
    const partialPath = path.join(lokiDir, "partial.json");
    fs.writeFileSync(partialPath, '{"key": "value", "incomplete":');
    const resultPartial = manager.getState("partial.json");
    assert(resultPartial === null, "partial JSON should return null");
    console.log("  [PASS] Partial JSON handling works");

    // Test: corrupted JSON with default value
    const resultWithDefault = manager.getState("corrupted.json", { fallback: true });
    assertEqual(resultWithDefault, { fallback: true }, "should return default for corrupted");
    console.log("  [PASS] Corrupted JSON with default works");

    // Cleanup
    manager.stop();

    console.log("");
    console.log("All basic TypeScript tests passed!");

    // Run optimistic update tests
    await runOptimisticUpdateTests();

  } finally {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Optimistic Update Tests (SYN-014)
async function runOptimisticUpdateTests(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "optimistic-test-"));
  const lokiDir = path.join(tempDir, ".loki");

  console.log("");
  console.log("Testing Optimistic Updates (SYN-014)...");

  try {
    // Test: VersionVector
    console.log("  Testing VersionVector...");
    const vv1 = new VersionVector();
    vv1.increment("source1");
    assert(vv1.get("source1") === 1, "version should be 1");
    vv1.increment("source1");
    assert(vv1.get("source1") === 2, "version should be 2");
    assert(vv1.get("nonexistent") === 0, "nonexistent should be 0");
    console.log("  [PASS] VersionVector increment works");

    // Test: VersionVector merge
    const vv2 = new VersionVector();
    vv2.increment("source2");
    vv2.increment("source2");
    const merged = vv1.merge(vv2);
    assert(merged.get("source1") === 2, "merged source1 should be 2");
    assert(merged.get("source2") === 2, "merged source2 should be 2");
    console.log("  [PASS] VersionVector merge works");

    // Test: VersionVector concurrent
    const vvA = new VersionVector();
    vvA.increment("agentA");
    const vvB = new VersionVector();
    vvB.increment("agentB");
    assert(vvA.concurrentWith(vvB), "should be concurrent");
    console.log("  [PASS] VersionVector concurrent detection works");

    // Test: VersionVector dominates
    const vvDom1 = new VersionVector();
    vvDom1.increment("source1");
    vvDom1.increment("source1");
    const vvDom2 = new VersionVector();
    vvDom2.increment("source1");
    assert(vvDom1.dominates(vvDom2), "vvDom1 should dominate vvDom2");
    assert(!vvDom2.dominates(vvDom1), "vvDom2 should not dominate vvDom1");
    console.log("  [PASS] VersionVector dominates works");

    // Test: serialization
    const vvSer = new VersionVector({ source1: 3, source2: 2 });
    const dict = vvSer.toDict();
    const vvDeser = VersionVector.fromDict(dict);
    assert(vvDeser.get("source1") === 3, "deserialized source1 should be 3");
    assert(vvDeser.get("source2") === 2, "deserialized source2 should be 2");
    console.log("  [PASS] VersionVector serialization works");

    // Test: StateManager optimistic updates
    const manager = new StateManager({ lokiDir, enableWatch: false, enableEvents: false });

    // Test: basic optimistic update
    const pending = manager.optimisticUpdate("test.json", "key1", "value1", "agent1");
    assert(pending.status === "pending", "should be pending");
    assert(pending.key === "key1", "key should match");
    assert(pending.value === "value1", "value should match");

    const state = manager.getState("test.json");
    assert(state !== null && state.key1 === "value1", "value should be applied");
    console.log("  [PASS] optimisticUpdate works");

    // Test: version tracking
    manager.optimisticUpdate("test.json", "key2", "value2", "agent2");
    const vv = manager.getVersionVector("test.json");
    assert(vv.get("agent1") === 1, "agent1 version should be 1");
    assert(vv.get("agent2") === 1, "agent2 version should be 1");
    console.log("  [PASS] Version tracking works");

    // Test: pending updates tracking
    const pendingList = manager.getPendingUpdates("test.json");
    assert(pendingList.length === 2, "should have 2 pending updates");
    console.log("  [PASS] Pending updates tracking works");

    // Test: conflict detection
    const manager2 = new StateManager({
      lokiDir: path.join(tempDir, ".loki2"),
      enableWatch: false,
      enableEvents: false,
    });
    manager2.optimisticUpdate("conflict.json", "key1", "local_value", "agent1");

    const remoteState = {
      key1: "remote_value",
      _version_vector: { agent2: 1 },
    };

    const conflicts = manager2.detectConflicts("conflict.json", remoteState, "agent2");
    assert(conflicts.length === 1, "should have 1 conflict");
    assert(conflicts[0].key === "key1", "conflict key should be key1");
    assert(conflicts[0].localValue === "local_value", "local value should match");
    assert(conflicts[0].remoteValue === "remote_value", "remote value should match");
    console.log("  [PASS] Conflict detection works");

    // Test: conflict resolution - last write wins
    manager2.setConflictStrategy(ConflictStrategy.LAST_WRITE_WINS);
    const resolved = manager2.resolveConflicts("conflict.json", conflicts);
    assert(resolved.key1 === "remote_value", "remote value should win");
    assert(conflicts[0].resolution === "last_write_wins", "resolution should be last_write_wins");
    console.log("  [PASS] Last-write-wins resolution works");

    // Test: conflict resolution - merge for dicts
    const manager3 = new StateManager({
      lokiDir: path.join(tempDir, ".loki3"),
      enableWatch: false,
      enableEvents: false,
    });
    manager3.optimisticUpdate("merge.json", "config", { a: 1, b: 2 }, "agent1");
    manager3.setConflictStrategy(ConflictStrategy.MERGE);

    const remoteDict = {
      config: { b: 3, c: 4 },
      _version_vector: { agent2: 1 },
    };

    const dictConflicts = manager3.detectConflicts("merge.json", remoteDict, "agent2");
    const resolvedDict = manager3.resolveConflicts("merge.json", dictConflicts);
    const mergedConfig = resolvedDict.config as Record<string, number>;
    assert(mergedConfig.a === 1, "merged a should be 1");
    assert(mergedConfig.b === 3, "merged b should be 3 (remote wins)");
    assert(mergedConfig.c === 4, "merged c should be 4");
    console.log("  [PASS] Merge resolution for dicts works");

    // Test: commit pending updates
    const manager4 = new StateManager({
      lokiDir: path.join(tempDir, ".loki4"),
      enableWatch: false,
      enableEvents: false,
    });
    manager4.optimisticUpdate("commit.json", "key1", "value1", "agent1");
    manager4.optimisticUpdate("commit.json", "key2", "value2", "agent1");

    const committed = manager4.commitPendingUpdates("commit.json");
    assert(committed === 2, "should commit 2 updates");

    const remaining = manager4.getPendingUpdates("commit.json");
    assert(remaining.length === 0, "should have no pending updates");
    console.log("  [PASS] Commit pending updates works");

    // Test: rollback pending updates
    const manager5 = new StateManager({
      lokiDir: path.join(tempDir, ".loki5"),
      enableWatch: false,
      enableEvents: false,
    });
    const originalState = { original: true };
    manager5.setState("rollback.json", originalState);

    manager5.optimisticUpdate("rollback.json", "key1", "value1", "agent1");
    manager5.optimisticUpdate("rollback.json", "key2", "value2", "agent1");

    const rolledBack = manager5.rollbackPendingUpdates("rollback.json", originalState);
    assert(rolledBack === 2, "should rollback 2 updates");

    const restoredState = manager5.getState("rollback.json");
    assertEqual(restoredState, originalState, "state should be restored");
    console.log("  [PASS] Rollback pending updates works");

    // Test: sync with remote
    const manager6 = new StateManager({
      lokiDir: path.join(tempDir, ".loki6"),
      enableWatch: false,
      enableEvents: false,
    });
    manager6.setState("sync.json", { existing: "value" });
    manager6.optimisticUpdate("sync.json", "local_key", "local_value", "agent1");

    const syncRemote = {
      existing: "value",
      remote_key: "remote_value",
      _version_vector: { agent2: 1 },
    };

    const { resolvedState, conflicts: syncConflicts, committed: syncCommitted } =
      manager6.syncWithRemote("sync.json", syncRemote, "agent2");

    assert(syncConflicts.length === 0, "should have no conflicts (different keys)");
    assert(syncCommitted === 1, "should commit 1 update");
    assert(resolvedState.local_key === "local_value", "local key should be preserved");
    console.log("  [PASS] Sync with remote works");

    // Cleanup managers
    manager.stop();
    manager2.stop();
    manager3.stop();
    manager4.stop();
    manager5.stop();
    manager6.stop();

    console.log("");
    console.log("All Optimistic Update tests passed!");

  } finally {
    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Run tests
runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
