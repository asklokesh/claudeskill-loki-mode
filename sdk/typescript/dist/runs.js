"use strict";
/**
 * Autonomi SDK - Run Management
 *
 * Run-related operations. These are implemented as methods on AutonomiClient
 * directly (see client.ts). This module re-exports the relevant types and
 * documents the run management interface for reference.
 *
 * Run methods on AutonomiClient:
 *   - listRuns(projectId?, status?): Promise<Run[]>
 *   - getRun(runId): Promise<Run>
 *   - cancelRun(runId): Promise<Run>
 *   - replayRun(runId): Promise<Run>
 *   - getRunTimeline(runId): Promise<RunEvent[]>
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=runs.js.map