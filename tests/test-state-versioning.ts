/**
 * Test state versioning functionality (SYN-015)
 *
 * Run with: npx ts-node tests/test-state-versioning.ts
 */

import * as fs from "fs";
import * as path from "path";
import {
  StateManager,
  resetStateManager,
  VersionInfo,
  DEFAULT_VERSION_RETENTION,
} from "../state/manager";

const TEST_DIR = fs.mkdtempSync("/tmp/test-versioning-");
const LOKI_DIR = path.join(TEST_DIR, ".loki");

let passed = 0;
let failed = 0;

function logPass(name: string): void {
  console.log(`PASS: ${name}`);
  passed++;
}

function logFail(name: string, reason: string): void {
  console.log(`FAIL: ${name} - ${reason}`);
  failed++;
}

function cleanup(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

async function testVersionCreation(): Promise<void> {
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 10,
  });

  try {
    // Set initial state
    manager.setState("test/versioning.json", { value: 1, name: "first" });

    // Update state multiple times
    manager.setState("test/versioning.json", { value: 2, name: "second" });
    manager.setState("test/versioning.json", { value: 3, name: "third" });

    // Check version count (should be 2 - first and second were saved)
    const count = manager.getVersionCount("test/versioning.json");
    if (count === 2) {
      logPass("testVersionCreation");
    } else {
      logFail("testVersionCreation", `expected 2 versions, got ${count}`);
    }
  } finally {
    manager.stop();
  }
}

async function testVersionHistory(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 10,
  });

  try {
    // Set state multiple times
    manager.setState("test/history.json", { step: 1 });
    manager.setState("test/history.json", { step: 2 });
    manager.setState("test/history.json", { step: 3 });

    // Get version history
    const history = manager.getVersionHistory("test/history.json");

    if (history.length === 2) {
      // Check they are sorted newest first
      if (history[0].version > history[1].version) {
        logPass("testVersionHistory");
      } else {
        logFail("testVersionHistory", "history not sorted correctly");
      }
    } else {
      logFail("testVersionHistory", `expected 2 versions, got ${history.length}`);
    }
  } finally {
    manager.stop();
  }
}

async function testGetStateAtVersion(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 10,
  });

  try {
    // Set state multiple times
    manager.setState("test/at_version.json", { data: "version1" });
    manager.setState("test/at_version.json", { data: "version2" });
    manager.setState("test/at_version.json", { data: "version3" });

    // Get state at version 1 (the first saved version)
    const stateV1 = manager.getStateAtVersion("test/at_version.json", 1);

    if (stateV1 && stateV1.data === "version1") {
      logPass("testGetStateAtVersion");
    } else {
      logFail("testGetStateAtVersion", `expected 'version1', got ${JSON.stringify(stateV1)}`);
    }
  } finally {
    manager.stop();
  }
}

async function testRollback(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 10,
  });

  try {
    // Set state multiple times
    manager.setState("test/rollback.json", { phase: "initial" });
    manager.setState("test/rollback.json", { phase: "middle" });
    manager.setState("test/rollback.json", { phase: "final" });

    // Rollback to version 1 (initial state)
    const change = manager.rollback("test/rollback.json", 1);

    if (change === null) {
      logFail("testRollback", "rollback returned null");
      return;
    }

    // Check current state is rolled back
    const current = manager.getState("test/rollback.json");
    if (current && current.phase === "initial") {
      logPass("testRollback");
    } else {
      logFail("testRollback", `expected 'initial', got ${JSON.stringify(current)}`);
    }
  } finally {
    manager.stop();
  }
}

async function testVersionRetention(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 3, // Only keep 3 versions
  });

  try {
    // Create more versions than retention limit
    for (let i = 0; i < 6; i++) {
      manager.setState("test/retention.json", { iteration: i });
    }

    // Should only have 3 versions (retention limit)
    const count = manager.getVersionCount("test/retention.json");
    if (count === 3) {
      logPass("testVersionRetention");
    } else {
      logFail("testVersionRetention", `expected 3 versions, got ${count}`);
    }
  } finally {
    manager.stop();
  }
}

async function testClearVersionHistory(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 10,
  });

  try {
    // Create some versions
    manager.setState("test/clear.json", { v: 1 });
    manager.setState("test/clear.json", { v: 2 });
    manager.setState("test/clear.json", { v: 3 });

    // Clear history
    const removed = manager.clearVersionHistory("test/clear.json");

    if (removed >= 2) {
      const count = manager.getVersionCount("test/clear.json");
      if (count === 0) {
        logPass("testClearVersionHistory");
      } else {
        logFail("testClearVersionHistory", `still have ${count} versions`);
      }
    } else {
      logFail("testClearVersionHistory", `only removed ${removed} versions`);
    }
  } finally {
    manager.stop();
  }
}

async function testDisabledVersioning(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: false, // Disabled
  });

  try {
    // Set state multiple times
    manager.setState("test/disabled.json", { v: 1 });
    manager.setState("test/disabled.json", { v: 2 });
    manager.setState("test/disabled.json", { v: 3 });

    // Should have no versions
    const count = manager.getVersionCount("test/disabled.json");
    if (count === 0) {
      logPass("testDisabledVersioning");
    } else {
      logFail("testDisabledVersioning", `expected 0 versions, got ${count}`);
    }
  } finally {
    manager.stop();
  }
}

async function testRollbackNonexistentVersion(): Promise<void> {
  resetStateManager();
  const manager = new StateManager({
    lokiDir: LOKI_DIR,
    enableWatch: false,
    enableEvents: false,
    enableVersioning: true,
    versionRetention: 10,
  });

  try {
    manager.setState("test/nonexistent.json", { v: 1 });

    // Try to rollback to a version that doesn't exist
    const result = manager.rollback("test/nonexistent.json", 999);

    if (result === null) {
      logPass("testRollbackNonexistentVersion");
    } else {
      logFail("testRollbackNonexistentVersion", "should have returned null");
    }
  } finally {
    manager.stop();
  }
}

async function main(): Promise<void> {
  console.log("Testing state versioning (SYN-015) - TypeScript");
  console.log(`Test directory: ${TEST_DIR}`);
  console.log("");

  try {
    await testVersionCreation();
    await testVersionHistory();
    await testGetStateAtVersion();
    await testRollback();
    await testVersionRetention();
    await testClearVersionHistory();
    await testDisabledVersioning();
    await testRollbackNonexistentVersion();
  } finally {
    cleanup();
  }

  console.log("");
  console.log(`Results: ${passed} passed, ${failed} failed`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Error:", err);
  cleanup();
  process.exit(1);
});
