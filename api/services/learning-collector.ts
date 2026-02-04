/**
 * Learning Collector Service
 *
 * Collects learning signals from API operations for cross-tool learning.
 * All emissions are async and non-blocking to avoid impacting API performance.
 *
 * Signal types mirror those defined in learning/signals.ts but are implemented
 * here with Deno-compatible I/O.
 */

import * as path from "https://deno.land/std@0.208.0/path/mod.ts";

// Default Loki directory
const DEFAULT_LOKI_DIR = ".loki";

// -----------------------------------------------------------------------------
// Signal Type Definitions (mirroring learning/signals.ts)
// -----------------------------------------------------------------------------

export const SignalType = {
  USER_PREFERENCE: "user_preference",
  ERROR_PATTERN: "error_pattern",
  SUCCESS_PATTERN: "success_pattern",
  TOOL_EFFICIENCY: "tool_efficiency",
  WORKFLOW_PATTERN: "workflow_pattern",
  CONTEXT_RELEVANCE: "context_relevance",
} as const;

export type SignalType = (typeof SignalType)[keyof typeof SignalType];

export const SignalSource = {
  CLI: "cli",
  API: "api",
  VSCODE: "vscode",
  MCP: "mcp",
  MEMORY: "memory",
  DASHBOARD: "dashboard",
} as const;

export type SignalSource = (typeof SignalSource)[keyof typeof SignalSource];

export const Outcome = {
  SUCCESS: "success",
  FAILURE: "failure",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

// Base signal interface
interface LearningSignal {
  id: string;
  type: SignalType;
  source: SignalSource;
  action: string;
  context: Record<string, unknown>;
  outcome: Outcome;
  confidence: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface UserPreferenceSignal extends LearningSignal {
  type: typeof SignalType.USER_PREFERENCE;
  preference_key: string;
  preference_value: unknown;
  alternatives_rejected: unknown[];
}

interface ErrorPatternSignal extends LearningSignal {
  type: typeof SignalType.ERROR_PATTERN;
  error_type: string;
  error_message: string;
  resolution: string;
  stack_trace?: string;
  recovery_steps: string[];
}

interface SuccessPatternSignal extends LearningSignal {
  type: typeof SignalType.SUCCESS_PATTERN;
  pattern_name: string;
  action_sequence: string[];
  preconditions: string[];
  postconditions: string[];
  duration_seconds: number;
}

interface ToolEfficiencySignal extends LearningSignal {
  type: typeof SignalType.TOOL_EFFICIENCY;
  tool_name: string;
  tokens_used: number;
  execution_time_ms: number;
  success_rate: number;
  alternative_tools: string[];
}

interface ContextRelevanceSignal extends LearningSignal {
  type: typeof SignalType.CONTEXT_RELEVANCE;
  query: string;
  retrieved_context_ids: string[];
  relevant_ids: string[];
  irrelevant_ids: string[];
  precision: number;
  recall: number;
}

type AnyLearningSignal =
  | LearningSignal
  | UserPreferenceSignal
  | ErrorPatternSignal
  | SuccessPatternSignal
  | ToolEfficiencySignal
  | ContextRelevanceSignal;

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function generateId(): string {
  return "sig-" + crypto.randomUUID().substring(0, 8);
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function createSignal(
  type: SignalType,
  source: SignalSource,
  action: string,
  options: Partial<LearningSignal> = {}
): LearningSignal {
  return {
    id: options.id || generateId(),
    type,
    source,
    action,
    context: options.context || {},
    outcome: options.outcome || Outcome.UNKNOWN,
    confidence: options.confidence ?? 0.8,
    timestamp: options.timestamp || getTimestamp(),
    metadata: options.metadata || {},
  };
}

function createUserPreferenceSignal(
  source: SignalSource,
  action: string,
  preferenceKey: string,
  preferenceValue: unknown,
  options: Partial<UserPreferenceSignal> = {}
): UserPreferenceSignal {
  const base = createSignal(SignalType.USER_PREFERENCE, source, action, {
    ...options,
    outcome: options.outcome || Outcome.SUCCESS,
    confidence: options.confidence ?? 0.9,
  });
  return {
    ...base,
    type: SignalType.USER_PREFERENCE,
    preference_key: preferenceKey,
    preference_value: preferenceValue,
    alternatives_rejected: options.alternatives_rejected || [],
  };
}

function createErrorPatternSignal(
  source: SignalSource,
  action: string,
  errorType: string,
  errorMessage: string,
  options: Partial<ErrorPatternSignal> = {}
): ErrorPatternSignal {
  const base = createSignal(SignalType.ERROR_PATTERN, source, action, {
    ...options,
    outcome: options.resolution ? Outcome.SUCCESS : Outcome.FAILURE,
    confidence: options.confidence ?? 0.8,
  });
  return {
    ...base,
    type: SignalType.ERROR_PATTERN,
    error_type: errorType,
    error_message: errorMessage,
    resolution: options.resolution || "",
    stack_trace: options.stack_trace,
    recovery_steps: options.recovery_steps || [],
  };
}

function createSuccessPatternSignal(
  source: SignalSource,
  action: string,
  patternName: string,
  actionSequence: string[],
  options: Partial<SuccessPatternSignal> = {}
): SuccessPatternSignal {
  const base = createSignal(SignalType.SUCCESS_PATTERN, source, action, {
    ...options,
    outcome: Outcome.SUCCESS,
    confidence: options.confidence ?? 0.85,
  });
  return {
    ...base,
    type: SignalType.SUCCESS_PATTERN,
    pattern_name: patternName,
    action_sequence: actionSequence,
    preconditions: options.preconditions || [],
    postconditions: options.postconditions || [],
    duration_seconds: options.duration_seconds || 0,
  };
}

function createToolEfficiencySignal(
  source: SignalSource,
  action: string,
  toolName: string,
  options: Partial<ToolEfficiencySignal> = {}
): ToolEfficiencySignal {
  const base = createSignal(SignalType.TOOL_EFFICIENCY, source, action, {
    ...options,
    outcome: options.outcome || Outcome.SUCCESS,
    confidence: options.confidence ?? 0.9,
  });
  return {
    ...base,
    type: SignalType.TOOL_EFFICIENCY,
    tool_name: toolName,
    tokens_used: options.tokens_used || 0,
    execution_time_ms: options.execution_time_ms || 0,
    success_rate: options.success_rate ?? 1.0,
    alternative_tools: options.alternative_tools || [],
  };
}

function createContextRelevanceSignal(
  source: SignalSource,
  action: string,
  query: string,
  retrievedContextIds: string[],
  options: Partial<ContextRelevanceSignal> = {}
): ContextRelevanceSignal {
  const precision = options.precision ?? 0.0;
  let outcome: Outcome;
  if (precision >= 0.8) {
    outcome = Outcome.SUCCESS;
  } else if (precision >= 0.5) {
    outcome = Outcome.PARTIAL;
  } else {
    outcome = Outcome.FAILURE;
  }

  const base = createSignal(SignalType.CONTEXT_RELEVANCE, source, action, {
    ...options,
    outcome,
    confidence: options.confidence ?? 0.8,
  });
  return {
    ...base,
    type: SignalType.CONTEXT_RELEVANCE,
    query,
    retrieved_context_ids: retrievedContextIds,
    relevant_ids: options.relevant_ids || [],
    irrelevant_ids: options.irrelevant_ids || [],
    precision,
    recall: options.recall ?? 0.0,
  };
}

function getSignalsDir(lokiDir: string = ".loki"): string {
  const signalsDir = path.join(lokiDir, "learning", "signals");
  return signalsDir;
}

async function emitSignal(signal: LearningSignal, lokiDir: string = ".loki"): Promise<string> {
  const signalsDir = getSignalsDir(lokiDir);

  // Ensure directory exists
  try {
    await Deno.mkdir(signalsDir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.AlreadyExists)) {
      throw e;
    }
  }

  const timestampStr = signal.timestamp.replace(/:/g, "-");
  const signalFile = path.join(signalsDir, `${timestampStr}_${signal.id}.json`);

  try {
    await Deno.writeTextFile(signalFile, JSON.stringify(signal, null, 2));
  } catch (e) {
    throw new Error(`Failed to write signal: ${e}`);
  }

  return signal.id;
}

// -----------------------------------------------------------------------------
// Learning Collector Class
// -----------------------------------------------------------------------------

/**
 * Learning Collector for API operations.
 *
 * Provides async, non-blocking signal emission with buffering
 * and batch processing for performance.
 */
export class LearningCollector {
  private lokiDir: string;
  private buffer: AnyLearningSignal[] = [];
  private flushIntervalId: ReturnType<typeof setInterval> | null = null;
  private maxBufferSize = 50;
  private flushIntervalMs = 5000;
  private isEnabled = true;

  constructor(lokiDir: string = DEFAULT_LOKI_DIR) {
    this.lokiDir = lokiDir;
    this.startFlushTimer();
  }

  /**
   * Enable or disable signal collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Start the background flush timer
   */
  private startFlushTimer(): void {
    if (this.flushIntervalId !== null) {
      return;
    }
    this.flushIntervalId = setInterval(() => {
      this.flush().catch(console.error);
    }, this.flushIntervalMs);
  }

  /**
   * Stop the background flush timer
   */
  stopFlushTimer(): void {
    if (this.flushIntervalId !== null) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
    }
  }

  /**
   * Flush buffered signals to storage
   */
  async flush(): Promise<number> {
    if (this.buffer.length === 0) {
      return 0;
    }

    const signals = [...this.buffer];
    this.buffer = [];

    let emitted = 0;
    for (const signal of signals) {
      try {
        await emitSignal(signal, this.lokiDir);
        emitted++;
      } catch (error) {
        console.error("Failed to emit signal:", error);
      }
    }

    return emitted;
  }

  /**
   * Queue a signal for async emission
   */
  private queueSignal(signal: AnyLearningSignal): void {
    if (!this.isEnabled) {
      return;
    }

    this.buffer.push(signal);

    // Flush immediately if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch(console.error);
    }
  }

  // ---------------------------------------------------------------------------
  // User Preference Signals
  // ---------------------------------------------------------------------------

  /**
   * Emit a user preference signal.
   *
   * Use when user makes a choice that indicates preference:
   * - Settings changes
   * - Provider selection
   * - Configuration updates
   */
  emitUserPreference(
    action: string,
    preferenceKey: string,
    preferenceValue: unknown,
    options: {
      alternativesRejected?: unknown[];
      context?: Record<string, unknown>;
      confidence?: number;
    } = {}
  ): void {
    const signal = createUserPreferenceSignal(
      SignalSource.API,
      action,
      preferenceKey,
      preferenceValue,
      {
        alternatives_rejected: options.alternativesRejected || [],
        context: options.context || {},
        confidence: options.confidence ?? 0.9,
      }
    );

    this.queueSignal(signal);
  }

  // ---------------------------------------------------------------------------
  // Error Pattern Signals
  // ---------------------------------------------------------------------------

  /**
   * Emit an error pattern signal.
   *
   * Use when an error occurs that could inform future behavior:
   * - API errors
   * - Validation failures
   * - Integration errors
   */
  emitErrorPattern(
    action: string,
    errorType: string,
    errorMessage: string,
    options: {
      resolution?: string;
      stackTrace?: string;
      recoverySteps?: string[];
      context?: Record<string, unknown>;
      confidence?: number;
    } = {}
  ): void {
    const signal = createErrorPatternSignal(
      SignalSource.API,
      action,
      errorType,
      errorMessage,
      {
        resolution: options.resolution || "",
        stack_trace: options.stackTrace,
        recovery_steps: options.recoverySteps || [],
        context: options.context || {},
        confidence: options.confidence ?? 0.8,
      }
    );

    this.queueSignal(signal);
  }

  // ---------------------------------------------------------------------------
  // Success Pattern Signals
  // ---------------------------------------------------------------------------

  /**
   * Emit a success pattern signal.
   *
   * Use when an operation completes successfully:
   * - Session started
   * - Memory retrieved
   * - Task completed
   */
  emitSuccessPattern(
    action: string,
    patternName: string,
    actionSequence: string[],
    options: {
      preconditions?: string[];
      postconditions?: string[];
      durationSeconds?: number;
      context?: Record<string, unknown>;
      confidence?: number;
    } = {}
  ): void {
    const signal = createSuccessPatternSignal(
      SignalSource.API,
      action,
      patternName,
      actionSequence,
      {
        preconditions: options.preconditions || [],
        postconditions: options.postconditions || [],
        duration_seconds: options.durationSeconds || 0,
        context: options.context || {},
        confidence: options.confidence ?? 0.85,
      }
    );

    this.queueSignal(signal);
  }

  // ---------------------------------------------------------------------------
  // Tool Efficiency Signals
  // ---------------------------------------------------------------------------

  /**
   * Emit a tool efficiency signal.
   *
   * Use to track API endpoint performance:
   * - Response times
   * - Token usage
   * - Success rates
   */
  emitToolEfficiency(
    action: string,
    toolName: string,
    options: {
      tokensUsed?: number;
      executionTimeMs?: number;
      successRate?: number;
      alternativeTools?: string[];
      outcome?: Outcome;
      context?: Record<string, unknown>;
      confidence?: number;
    } = {}
  ): void {
    const signal = createToolEfficiencySignal(
      SignalSource.API,
      action,
      toolName,
      {
        tokens_used: options.tokensUsed || 0,
        execution_time_ms: options.executionTimeMs || 0,
        success_rate: options.successRate ?? 1.0,
        alternative_tools: options.alternativeTools || [],
        outcome: options.outcome || Outcome.SUCCESS,
        context: options.context || {},
        confidence: options.confidence ?? 0.9,
      }
    );

    this.queueSignal(signal);
  }

  // ---------------------------------------------------------------------------
  // Context Relevance Signals
  // ---------------------------------------------------------------------------

  /**
   * Emit a context relevance signal.
   *
   * Use when retrieving context/memories:
   * - Memory queries
   * - Pattern lookups
   * - Skill retrieval
   */
  emitContextRelevance(
    action: string,
    query: string,
    retrievedContextIds: string[],
    options: {
      relevantIds?: string[];
      irrelevantIds?: string[];
      precision?: number;
      recall?: number;
      context?: Record<string, unknown>;
      confidence?: number;
    } = {}
  ): void {
    // Calculate precision if not provided
    let precision = options.precision;
    if (precision === undefined && options.relevantIds) {
      const relevantCount = options.relevantIds.length;
      const retrievedCount = retrievedContextIds.length;
      precision = retrievedCount > 0 ? relevantCount / retrievedCount : 0;
    }

    const signal = createContextRelevanceSignal(
      SignalSource.API,
      action,
      query,
      retrievedContextIds,
      {
        relevant_ids: options.relevantIds || [],
        irrelevant_ids: options.irrelevantIds || [],
        precision: precision ?? 0.0,
        recall: options.recall ?? 0.0,
        context: options.context || {},
        confidence: options.confidence ?? 0.8,
      }
    );

    this.queueSignal(signal);
  }

  // ---------------------------------------------------------------------------
  // Convenience Methods
  // ---------------------------------------------------------------------------

  /**
   * Emit a signal for an API request with timing information.
   */
  emitApiRequest(
    endpoint: string,
    method: string,
    startTime: number,
    success: boolean,
    options: {
      statusCode?: number;
      errorMessage?: string;
      context?: Record<string, unknown>;
    } = {}
  ): void {
    const duration = Date.now() - startTime;

    if (success) {
      this.emitToolEfficiency(
        `${method} ${endpoint}`,
        `api:${endpoint.replace(/\//g, ":")}`,
        {
          executionTimeMs: duration,
          outcome: Outcome.SUCCESS,
          context: {
            method,
            endpoint,
            statusCode: options.statusCode || 200,
            ...options.context,
          },
        }
      );
    } else {
      this.emitErrorPattern(
        `${method} ${endpoint}`,
        "api_error",
        options.errorMessage || "Request failed",
        {
          context: {
            method,
            endpoint,
            statusCode: options.statusCode || 500,
            durationMs: duration,
            ...options.context,
          },
        }
      );
    }
  }

  /**
   * Emit a signal for memory retrieval operations.
   */
  emitMemoryRetrieval(
    query: string,
    retrievedIds: string[],
    startTime: number,
    options: {
      taskType?: string;
      relevantIds?: string[];
      context?: Record<string, unknown>;
    } = {}
  ): void {
    const duration = Date.now() - startTime;

    // Emit context relevance signal
    this.emitContextRelevance(
      "memory_retrieve",
      query,
      retrievedIds,
      {
        relevantIds: options.relevantIds,
        context: {
          taskType: options.taskType,
          durationMs: duration,
          resultCount: retrievedIds.length,
          ...options.context,
        },
      }
    );

    // Also emit tool efficiency signal
    this.emitToolEfficiency(
      "memory_retrieve",
      "api:memory:retrieve",
      {
        executionTimeMs: duration,
        outcome: retrievedIds.length > 0 ? Outcome.SUCCESS : Outcome.PARTIAL,
        context: {
          query: query.substring(0, 100),
          resultCount: retrievedIds.length,
          taskType: options.taskType,
        },
      }
    );
  }

  /**
   * Emit a signal for session operations.
   */
  emitSessionOperation(
    operation: "start" | "stop" | "pause" | "resume",
    sessionId: string,
    success: boolean,
    options: {
      provider?: string;
      errorMessage?: string;
      durationMs?: number;
      context?: Record<string, unknown>;
    } = {}
  ): void {
    if (success) {
      this.emitSuccessPattern(
        `session_${operation}`,
        `session_${operation}_success`,
        [`session.${operation}`, "session.update"],
        {
          postconditions: [`session.status.${operation}ed`],
          durationSeconds: (options.durationMs || 0) / 1000,
          context: {
            sessionId,
            provider: options.provider,
            ...options.context,
          },
        }
      );
    } else {
      this.emitErrorPattern(
        `session_${operation}`,
        `session_${operation}_error`,
        options.errorMessage || `Failed to ${operation} session`,
        {
          context: {
            sessionId,
            provider: options.provider,
            ...options.context,
          },
        }
      );
    }
  }

  /**
   * Emit a signal for settings/preference changes.
   */
  emitSettingsChange(
    settingKey: string,
    newValue: unknown,
    oldValue?: unknown,
    options: {
      source?: string;
      context?: Record<string, unknown>;
    } = {}
  ): void {
    this.emitUserPreference(
      "settings_change",
      settingKey,
      newValue,
      {
        alternativesRejected: oldValue !== undefined ? [oldValue] : [],
        context: {
          source: options.source || "api",
          previousValue: oldValue,
          ...options.context,
        },
      }
    );
  }

  /**
   * Get the number of buffered signals
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if the collector is enabled
   */
  isCollectorEnabled(): boolean {
    return this.isEnabled;
  }
}

// Singleton instance
export const learningCollector = new LearningCollector();
