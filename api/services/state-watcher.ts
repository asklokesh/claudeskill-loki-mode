/**
 * State Watcher Service
 *
 * Watches .loki/ directory for state changes and emits events.
 * Uses StateManager for centralized state access with caching and subscriptions.
 */

import {
  eventBus,
  emitSessionEvent,
  emitPhaseEvent,
  emitTaskEvent,
  emitLogEvent,
  emitHeartbeat,
} from "./event-bus.ts";
import type { Session, Task } from "../types/api.ts";
import { StateManager, ManagedFile, type StateChange } from "../../state/manager.ts";

interface WatchedState {
  sessions: Map<string, Session>;
  tasks: Map<string, Task[]>;
  lastModified: Map<string, number>;
}

class StateWatcher {
  private lokiDir: string;
  private watchDir: string;
  private watcher: Deno.FsWatcher | null = null;
  private state: WatchedState;
  private debounceTimers: Map<string, number> = new Map();
  private debounceDelay = 100; // ms
  private heartbeatInterval: number | null = null;
  private startTime: Date;
  private stateManager: StateManager;

  constructor() {
    this.lokiDir = Deno.env.get("LOKI_DIR") ||
      new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
    this.watchDir = `${this.lokiDir}/.loki`;
    this.state = {
      sessions: new Map(),
      tasks: new Map(),
      lastModified: new Map(),
    };
    this.startTime = new Date();
    // Initialize StateManager with the .loki directory
    this.stateManager = new StateManager({
      lokiDir: this.watchDir,
      enableWatch: true,
      enableEvents: true,
    });
  }

  /**
   * Start watching the .loki directory
   */
  async start(): Promise<void> {
    // Ensure .loki directory exists
    try {
      await Deno.mkdir(this.watchDir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    // Initial state load
    await this.loadInitialState();

    // Start file watcher
    this.watcher = Deno.watchFs(this.watchDir, { recursive: true });

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.emitHeartbeat();
    }, 10000); // Every 10 seconds

    // Process watch events
    this.processWatchEvents();

    console.log(`State watcher started, monitoring: ${this.watchDir}`);
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Stop the state manager
    this.stateManager.stop();

    console.log("State watcher stopped");
  }

  /**
   * Get current state snapshot
   */
  getState(): WatchedState {
    return this.state;
  }

  /**
   * Load initial state from .loki directory
   */
  private async loadInitialState(): Promise<void> {
    // Load sessions
    try {
      const sessionsDir = `${this.watchDir}/sessions`;
      for await (const entry of Deno.readDir(sessionsDir)) {
        if (entry.isDirectory) {
          await this.loadSession(entry.name);
        }
      }
    } catch {
      // Sessions directory may not exist
    }

    // Load current state file using StateManager
    const stateData = this.stateManager.getState("state.json");
    if (stateData && stateData.currentSession) {
      // Emit initial state event
      emitLogEvent(
        "info",
        stateData.currentSession as string,
        `State watcher loaded session: ${stateData.currentSession}`
      );
    }
  }

  /**
   * Load a specific session
   */
  private async loadSession(sessionId: string): Promise<void> {
    try {
      // Use StateManager for session file access
      const sessionData = this.stateManager.getState(`sessions/${sessionId}/session.json`);
      if (sessionData) {
        const session = sessionData as Session;
        this.state.sessions.set(sessionId, session);

        // Load tasks
        await this.loadTasks(sessionId);
      }
    } catch {
      // Session may not have a valid state file
    }
  }

  /**
   * Load tasks for a session
   */
  private async loadTasks(sessionId: string): Promise<void> {
    try {
      // Use StateManager for tasks file access
      const tasksData = this.stateManager.getState(`sessions/${sessionId}/tasks.json`);
      if (tasksData) {
        this.state.tasks.set(sessionId, (tasksData.tasks as Task[]) || []);
      }
    } catch {
      // Tasks file may not exist
    }
  }

  /**
   * Process file system watch events
   */
  private async processWatchEvents(): Promise<void> {
    if (!this.watcher) return;

    for await (const event of this.watcher) {
      for (const path of event.paths) {
        this.handleFileChange(path, event.kind);
      }
    }
  }

  /**
   * Handle a file change with debouncing
   */
  private handleFileChange(
    path: string,
    kind: Deno.FsEvent["kind"]
  ): void {
    // Debounce rapid changes to the same file
    const existingTimer = this.debounceTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(path);
      this.processFileChange(path, kind);
    }, this.debounceDelay);

    this.debounceTimers.set(path, timer);
  }

  /**
   * Process a debounced file change
   */
  private async processFileChange(
    path: string,
    kind: Deno.FsEvent["kind"]
  ): Promise<void> {
    const relativePath = path.replace(this.watchDir + "/", "");

    // Skip non-relevant files
    if (!relativePath.endsWith(".json") && !relativePath.endsWith(".log")) {
      return;
    }

    // Parse path to determine what changed
    const parts = relativePath.split("/");

    // Handle session state changes
    if (parts[0] === "sessions" && parts.length >= 3) {
      const sessionId = parts[1];
      const fileName = parts[2];

      switch (fileName) {
        case "session.json":
          await this.handleSessionChange(sessionId, kind);
          break;
        case "tasks.json":
          await this.handleTasksChange(sessionId, kind);
          break;
        case "phase.json":
          await this.handlePhaseChange(sessionId);
          break;
        case "agents.json":
          await this.handleAgentsChange(sessionId);
          break;
      }
    }

    // Handle global state changes
    if (relativePath === "state.json") {
      await this.handleGlobalStateChange();
    }

    // Handle log file changes
    if (relativePath.endsWith(".log")) {
      await this.handleLogChange(path);
    }
  }

  /**
   * Handle session state changes
   */
  private async handleSessionChange(
    sessionId: string,
    kind: Deno.FsEvent["kind"]
  ): Promise<void> {
    if (kind === "remove") {
      const oldSession = this.state.sessions.get(sessionId);
      this.state.sessions.delete(sessionId);

      if (oldSession) {
        emitSessionEvent("session:stopped", sessionId, {
          status: "stopped",
          message: "Session removed",
        });
      }
      return;
    }

    try {
      // Use StateManager to read session file
      const sessionData = this.stateManager.getState(`sessions/${sessionId}/session.json`);
      if (!sessionData) {
        return;
      }
      const newSession = sessionData as Session;
      const oldSession = this.state.sessions.get(sessionId);

      this.state.sessions.set(sessionId, newSession);

      // Detect status changes
      if (!oldSession) {
        emitSessionEvent("session:started", sessionId, {
          status: newSession.status,
          message: "Session created",
        });
      } else if (oldSession.status !== newSession.status) {
        const eventType = this.getSessionEventType(newSession.status);
        emitSessionEvent(eventType, sessionId, {
          status: newSession.status,
          message: `Status changed from ${oldSession.status} to ${newSession.status}`,
        });
      }

      // Detect phase changes
      if (oldSession && oldSession.currentPhase !== newSession.currentPhase) {
        if (newSession.currentPhase) {
          emitPhaseEvent("phase:started", sessionId, {
            phase: newSession.currentPhase,
            previousPhase: oldSession.currentPhase || undefined,
          });
        }
      }
    } catch (err) {
      console.error(`Error loading session ${sessionId}:`, err);
    }
  }

  /**
   * Handle task changes
   */
  private async handleTasksChange(sessionId: string): Promise<void> {
    try {
      // Use StateManager to read tasks file
      const tasksData = this.stateManager.getState(`sessions/${sessionId}/tasks.json`);
      const newTasks = (tasksData?.tasks as Task[]) || [];
      const oldTasks = this.state.tasks.get(sessionId) || [];

      this.state.tasks.set(sessionId, newTasks);

      // Detect new tasks
      const oldTaskIds = new Set(oldTasks.map((t: Task) => t.id));
      for (const task of newTasks) {
        if (!oldTaskIds.has(task.id)) {
          emitTaskEvent("task:created", sessionId, {
            taskId: task.id,
            title: task.title || (task as unknown as { subject?: string }).subject || "Untitled",
            status: task.status || "pending",
          });
        }
      }

      // Detect task status changes
      const oldTaskMap = new Map(oldTasks.map((t: Task) => [t.id, t]));
      for (const task of newTasks) {
        const oldTask = oldTaskMap.get(task.id);
        if (oldTask && oldTask.status !== task.status) {
          const eventType = this.getTaskEventType(task.status);
          emitTaskEvent(eventType, sessionId, {
            taskId: task.id,
            title: task.title || (task as unknown as { subject?: string }).subject || "Untitled",
            status: task.status,
            output: task.output,
            error: task.error,
          });
        }
      }
    } catch (err) {
      console.error(`Error loading tasks for ${sessionId}:`, err);
    }
  }

  /**
   * Handle phase changes
   */
  private async handlePhaseChange(sessionId: string): Promise<void> {
    try {
      // Use StateManager to read phase file
      const phaseData = this.stateManager.getState(`sessions/${sessionId}/phase.json`);
      if (!phaseData) {
        return;
      }

      emitPhaseEvent("phase:started", sessionId, {
        phase: phaseData.current as string,
        previousPhase: phaseData.previous as string | undefined,
        progress: phaseData.progress as number | undefined,
      });
    } catch (err) {
      console.error(`Error loading phase for ${sessionId}:`, err);
    }
  }

  /**
   * Handle agent changes
   */
  private async handleAgentsChange(sessionId: string): Promise<void> {
    try {
      // Use StateManager to read agents file
      const agentsData = this.stateManager.getState(`sessions/${sessionId}/agents.json`);
      if (!agentsData) {
        return;
      }

      // Emit events for active agents
      const activeAgents = (agentsData.active as Array<{ id: string; type: string; model?: string; task?: string }>) || [];
      for (const agent of activeAgents) {
        eventBus.publish("agent:spawned", sessionId, {
          agentId: agent.id,
          type: agent.type,
          model: agent.model,
          task: agent.task,
        });
      }
    } catch (err) {
      console.error(`Error loading agents for ${sessionId}:`, err);
    }
  }

  /**
   * Handle global state changes
   */
  private async handleGlobalStateChange(): Promise<void> {
    try {
      // Use StateManager to read global state file
      const stateData = this.stateManager.getState("state.json");
      if (!stateData) {
        return;
      }

      emitLogEvent(
        "info",
        (stateData.currentSession as string) || "global",
        `Global state updated: ${JSON.stringify(stateData).slice(0, 100)}...`
      );
    } catch (err) {
      console.error("Error loading global state:", err);
    }
  }

  /**
   * Handle log file changes (tail new entries)
   */
  private async handleLogChange(logPath: string): Promise<void> {
    const lastPos = this.state.lastModified.get(logPath) || 0;

    try {
      const stat = await Deno.stat(logPath);
      const newPos = stat.size;

      if (newPos > lastPos) {
        // Read new content
        const file = await Deno.open(logPath, { read: true });
        await file.seek(lastPos, Deno.SeekMode.Start);

        const buffer = new Uint8Array(newPos - lastPos);
        await file.read(buffer);
        file.close();

        const newContent = new TextDecoder().decode(buffer);
        const lines = newContent.split("\n").filter((l) => l.trim());

        // Extract session ID from path
        const match = logPath.match(/sessions\/([^/]+)/);
        const sessionId = match ? match[1] : "global";

        for (const line of lines) {
          emitLogEvent("info", sessionId, line);
        }

        this.state.lastModified.set(logPath, newPos);
      }
    } catch {
      // Log file may have been deleted
    }
  }

  /**
   * Emit heartbeat with current stats
   */
  private emitHeartbeat(): void {
    const uptime = Date.now() - this.startTime.getTime();
    let activeAgents = 0;
    let queuedTasks = 0;

    for (const session of this.state.sessions.values()) {
      if (session.status === "running") {
        const tasks = this.state.tasks.get(session.id) || [];
        queuedTasks += tasks.filter(
          (t) => t.status === "pending" || t.status === "queued"
        ).length;
      }
    }

    // Get active session for heartbeat
    const activeSessions = Array.from(this.state.sessions.values()).filter(
      (s) => s.status === "running"
    );

    for (const session of activeSessions) {
      emitHeartbeat(session.id, { uptime, activeAgents, queuedTasks });
    }
  }

  /**
   * Map session status to event type
   */
  private getSessionEventType(
    status: string
  ): "session:started" | "session:paused" | "session:resumed" | "session:stopped" | "session:completed" | "session:failed" {
    const map: Record<string, "session:started" | "session:paused" | "session:resumed" | "session:stopped" | "session:completed" | "session:failed"> = {
      starting: "session:started",
      running: "session:resumed",
      paused: "session:paused",
      stopping: "session:stopped",
      stopped: "session:stopped",
      completed: "session:completed",
      failed: "session:failed",
    };
    return map[status] || "session:started";
  }

  /**
   * Map task status to event type
   */
  private getTaskEventType(
    status: string
  ): "task:created" | "task:started" | "task:progress" | "task:completed" | "task:failed" {
    const map: Record<string, "task:created" | "task:started" | "task:progress" | "task:completed" | "task:failed"> = {
      pending: "task:created",
      queued: "task:created",
      running: "task:started",
      "in progress": "task:started",
      completed: "task:completed",
      done: "task:completed",
      failed: "task:failed",
    };
    return map[status.toLowerCase()] || "task:progress";
  }
}

// Singleton instance
export const stateWatcher = new StateWatcher();
