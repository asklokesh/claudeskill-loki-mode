/**
 * Loki Mode Learning System - TypeScript Signal Types
 *
 * This module defines the learning signal types for cross-tool learning.
 * Compatible with the Python implementation in signals.py.
 *
 * See docs/SYNERGY-ROADMAP.md for full architecture documentation.
 */

import * as fs from "fs";
import * as path from "path";

// -----------------------------------------------------------------------------
// Enums (as const objects for runtime + type usage)
// -----------------------------------------------------------------------------

/**
 * Categories of learning signals.
 */
export const SignalType = {
  USER_PREFERENCE: "user_preference",
  ERROR_PATTERN: "error_pattern",
  SUCCESS_PATTERN: "success_pattern",
  TOOL_EFFICIENCY: "tool_efficiency",
  WORKFLOW_PATTERN: "workflow_pattern",
  CONTEXT_RELEVANCE: "context_relevance",
} as const;

export type SignalType = (typeof SignalType)[keyof typeof SignalType];

/**
 * Sources that can emit learning signals.
 */
export const SignalSource = {
  CLI: "cli",
  API: "api",
  VSCODE: "vscode",
  MCP: "mcp",
  MEMORY: "memory",
  DASHBOARD: "dashboard",
} as const;

export type SignalSource = (typeof SignalSource)[keyof typeof SignalSource];

/**
 * Outcome states for learning signals.
 */
export const Outcome = {
  SUCCESS: "success",
  FAILURE: "failure",
  PARTIAL: "partial",
  UNKNOWN: "unknown",
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

// -----------------------------------------------------------------------------
// Base Signal Interface
// -----------------------------------------------------------------------------

/**
 * Base interface for all learning signals.
 *
 * A learning signal represents an observation that can be used
 * to improve system behavior over time.
 */
export interface LearningSignal {
  /** Unique identifier (e.g., "sig-abc12345") */
  id: string;
  /** Category of signal */
  type: SignalType;
  /** Origin of the signal */
  source: SignalSource;
  /** The action or event that triggered the signal */
  action: string;
  /** Contextual information about the signal */
  context: Record<string, unknown>;
  /** Result of the action */
  outcome: Outcome;
  /** Confidence in the signal's reliability (0.0-1.0) */
  confidence: number;
  /** ISO timestamp when the signal was created */
  timestamp: string;
  /** Additional signal-specific data */
  metadata: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Specialized Signal Interfaces
// -----------------------------------------------------------------------------

/**
 * Signal for user preference learning.
 */
export interface UserPreferenceSignal extends LearningSignal {
  type: typeof SignalType.USER_PREFERENCE;
  /** The preference being expressed (e.g., "code_style") */
  preference_key: string;
  /** The preferred value or option */
  preference_value: unknown;
  /** Other options that were not chosen */
  alternatives_rejected: unknown[];
}

/**
 * Signal for error pattern learning.
 */
export interface ErrorPatternSignal extends LearningSignal {
  type: typeof SignalType.ERROR_PATTERN;
  /** Category of error (e.g., "TypeScript compilation") */
  error_type: string;
  /** The error message */
  error_message: string;
  /** How the error was resolved (if known) */
  resolution: string;
  /** Optional stack trace or error details */
  stack_trace?: string;
  /** Steps taken to recover from the error */
  recovery_steps: string[];
}

/**
 * Signal for success pattern learning.
 */
export interface SuccessPatternSignal extends LearningSignal {
  type: typeof SignalType.SUCCESS_PATTERN;
  /** Human-readable name for the pattern */
  pattern_name: string;
  /** Ordered list of actions that led to success */
  action_sequence: string[];
  /** Conditions that were true before success */
  preconditions: string[];
  /** Conditions that were true after success */
  postconditions: string[];
  /** How long the successful sequence took */
  duration_seconds: number;
}

/**
 * Signal for tool efficiency learning.
 */
export interface ToolEfficiencySignal extends LearningSignal {
  type: typeof SignalType.TOOL_EFFICIENCY;
  /** Name of the tool */
  tool_name: string;
  /** Number of tokens consumed */
  tokens_used: number;
  /** Execution time in milliseconds */
  execution_time_ms: number;
  /** Historical success rate for this tool (0.0-1.0) */
  success_rate: number;
  /** Other tools that could have been used */
  alternative_tools: string[];
}

/**
 * Signal for workflow pattern learning.
 */
export interface WorkflowPatternSignal extends LearningSignal {
  type: typeof SignalType.WORKFLOW_PATTERN;
  /** Human-readable name for the workflow */
  workflow_name: string;
  /** Ordered list of workflow steps */
  steps: string[];
  /** Steps that can run in parallel (list of step groups) */
  parallel_steps: string[][];
  /** Conditions that determine workflow branches */
  branching_conditions: Record<string, string>;
  /** Total workflow execution time */
  total_duration_seconds: number;
}

/**
 * Signal for context relevance learning.
 */
export interface ContextRelevanceSignal extends LearningSignal {
  type: typeof SignalType.CONTEXT_RELEVANCE;
  /** The query used to retrieve context */
  query: string;
  /** IDs of retrieved context items */
  retrieved_context_ids: string[];
  /** IDs marked as relevant by the user/system */
  relevant_ids: string[];
  /** IDs marked as irrelevant */
  irrelevant_ids: string[];
  /** Precision of retrieval (relevant/retrieved) */
  precision: number;
  /** Recall of retrieval (relevant/total_relevant) */
  recall: number;
}

/**
 * Union type for all signal types
 */
export type AnyLearningSignal =
  | LearningSignal
  | UserPreferenceSignal
  | ErrorPatternSignal
  | SuccessPatternSignal
  | ToolEfficiencySignal
  | WorkflowPatternSignal
  | ContextRelevanceSignal;

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a learning signal.
 */
export function validateSignal(signal: LearningSignal): ValidationResult {
  const errors: string[] = [];

  if (!signal.id) {
    errors.push("LearningSignal.id is required");
  }

  if (!signal.action || !signal.action.trim()) {
    errors.push("LearningSignal.action is required");
  }

  if (signal.confidence < 0.0 || signal.confidence > 1.0) {
    errors.push("LearningSignal.confidence must be between 0.0 and 1.0");
  }

  // Type-specific validation
  if (signal.type === SignalType.USER_PREFERENCE) {
    const s = signal as UserPreferenceSignal;
    if (!s.preference_key) {
      errors.push("UserPreferenceSignal.preference_key is required");
    }
  }

  if (signal.type === SignalType.ERROR_PATTERN) {
    const s = signal as ErrorPatternSignal;
    if (!s.error_type) {
      errors.push("ErrorPatternSignal.error_type is required");
    }
    if (!s.error_message) {
      errors.push("ErrorPatternSignal.error_message is required");
    }
  }

  if (signal.type === SignalType.SUCCESS_PATTERN) {
    const s = signal as SuccessPatternSignal;
    if (!s.pattern_name) {
      errors.push("SuccessPatternSignal.pattern_name is required");
    }
    if (!s.action_sequence || s.action_sequence.length === 0) {
      errors.push("SuccessPatternSignal.action_sequence must have at least one action");
    }
    if (s.duration_seconds < 0) {
      errors.push("SuccessPatternSignal.duration_seconds must be non-negative");
    }
  }

  if (signal.type === SignalType.TOOL_EFFICIENCY) {
    const s = signal as ToolEfficiencySignal;
    if (!s.tool_name) {
      errors.push("ToolEfficiencySignal.tool_name is required");
    }
    if (s.tokens_used < 0) {
      errors.push("ToolEfficiencySignal.tokens_used must be non-negative");
    }
    if (s.execution_time_ms < 0) {
      errors.push("ToolEfficiencySignal.execution_time_ms must be non-negative");
    }
    if (s.success_rate < 0.0 || s.success_rate > 1.0) {
      errors.push("ToolEfficiencySignal.success_rate must be between 0.0 and 1.0");
    }
  }

  if (signal.type === SignalType.WORKFLOW_PATTERN) {
    const s = signal as WorkflowPatternSignal;
    if (!s.workflow_name) {
      errors.push("WorkflowPatternSignal.workflow_name is required");
    }
    if (!s.steps || s.steps.length === 0) {
      errors.push("WorkflowPatternSignal.steps must have at least one step");
    }
    if (s.total_duration_seconds < 0) {
      errors.push("WorkflowPatternSignal.total_duration_seconds must be non-negative");
    }
  }

  if (signal.type === SignalType.CONTEXT_RELEVANCE) {
    const s = signal as ContextRelevanceSignal;
    if (!s.query) {
      errors.push("ContextRelevanceSignal.query is required");
    }
    if (s.precision < 0.0 || s.precision > 1.0) {
      errors.push("ContextRelevanceSignal.precision must be between 0.0 and 1.0");
    }
    if (s.recall < 0.0 || s.recall > 1.0) {
      errors.push("ContextRelevanceSignal.recall must be between 0.0 and 1.0");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// -----------------------------------------------------------------------------
// Signal Factory
// -----------------------------------------------------------------------------

/**
 * Generate a short unique ID
 */
function generateId(): string {
  return "sig-" + Math.random().toString(36).substring(2, 10);
}

/**
 * Get current ISO timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Create a base learning signal with defaults
 */
export function createSignal(
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

/**
 * Create a user preference signal
 */
export function createUserPreferenceSignal(
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

/**
 * Create an error pattern signal
 */
export function createErrorPatternSignal(
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

/**
 * Create a success pattern signal
 */
export function createSuccessPatternSignal(
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

/**
 * Create a tool efficiency signal
 */
export function createToolEfficiencySignal(
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

/**
 * Create a workflow pattern signal
 */
export function createWorkflowPatternSignal(
  source: SignalSource,
  action: string,
  workflowName: string,
  steps: string[],
  options: Partial<WorkflowPatternSignal> = {}
): WorkflowPatternSignal {
  const base = createSignal(SignalType.WORKFLOW_PATTERN, source, action, {
    ...options,
    outcome: options.outcome || Outcome.SUCCESS,
    confidence: options.confidence ?? 0.85,
  });
  return {
    ...base,
    type: SignalType.WORKFLOW_PATTERN,
    workflow_name: workflowName,
    steps,
    parallel_steps: options.parallel_steps || [],
    branching_conditions: options.branching_conditions || {},
    total_duration_seconds: options.total_duration_seconds || 0,
  };
}

/**
 * Create a context relevance signal
 */
export function createContextRelevanceSignal(
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

// -----------------------------------------------------------------------------
// Signal I/O
// -----------------------------------------------------------------------------

/**
 * Get the signals directory path.
 */
export function getSignalsDir(lokiDir: string = ".loki"): string {
  const signalsDir = path.join(lokiDir, "learning", "signals");
  if (!fs.existsSync(signalsDir)) {
    fs.mkdirSync(signalsDir, { recursive: true });
  }
  return signalsDir;
}

/**
 * Emit a learning signal to storage.
 */
export function emitSignal(signal: LearningSignal, lokiDir: string = ".loki"): string {
  const validation = validateSignal(signal);
  if (!validation.valid) {
    throw new Error(`Invalid signal: ${validation.errors.join("; ")}`);
  }

  const signalsDir = getSignalsDir(lokiDir);
  const timestampStr = signal.timestamp.replace(/:/g, "-");
  const signalFile = path.join(signalsDir, `${timestampStr}_${signal.id}.json`);

  try {
    fs.writeFileSync(signalFile, JSON.stringify(signal, null, 2));
  } catch (e) {
    throw new Error(`Failed to write signal: ${e}`);
  }

  return signal.id;
}

/**
 * Parse signal type from string
 */
function parseSignalType(data: Record<string, unknown>): AnyLearningSignal {
  const signalType = data.type as SignalType;
  const base: LearningSignal = {
    id: (data.id as string) || "",
    type: signalType,
    source: (data.source as SignalSource) || SignalSource.CLI,
    action: (data.action as string) || "",
    context: (data.context as Record<string, unknown>) || {},
    outcome: (data.outcome as Outcome) || Outcome.UNKNOWN,
    confidence: (data.confidence as number) ?? 0.8,
    timestamp: (data.timestamp as string) || getTimestamp(),
    metadata: (data.metadata as Record<string, unknown>) || {},
  };

  switch (signalType) {
    case SignalType.USER_PREFERENCE:
      return {
        ...base,
        type: SignalType.USER_PREFERENCE,
        preference_key: (data.preference_key as string) || "",
        preference_value: data.preference_value,
        alternatives_rejected: (data.alternatives_rejected as unknown[]) || [],
      } as UserPreferenceSignal;

    case SignalType.ERROR_PATTERN:
      return {
        ...base,
        type: SignalType.ERROR_PATTERN,
        error_type: (data.error_type as string) || "",
        error_message: (data.error_message as string) || "",
        resolution: (data.resolution as string) || "",
        stack_trace: data.stack_trace as string | undefined,
        recovery_steps: (data.recovery_steps as string[]) || [],
      } as ErrorPatternSignal;

    case SignalType.SUCCESS_PATTERN:
      return {
        ...base,
        type: SignalType.SUCCESS_PATTERN,
        pattern_name: (data.pattern_name as string) || "",
        action_sequence: (data.action_sequence as string[]) || [],
        preconditions: (data.preconditions as string[]) || [],
        postconditions: (data.postconditions as string[]) || [],
        duration_seconds: (data.duration_seconds as number) || 0,
      } as SuccessPatternSignal;

    case SignalType.TOOL_EFFICIENCY:
      return {
        ...base,
        type: SignalType.TOOL_EFFICIENCY,
        tool_name: (data.tool_name as string) || "",
        tokens_used: (data.tokens_used as number) || 0,
        execution_time_ms: (data.execution_time_ms as number) || 0,
        success_rate: (data.success_rate as number) ?? 1.0,
        alternative_tools: (data.alternative_tools as string[]) || [],
      } as ToolEfficiencySignal;

    case SignalType.WORKFLOW_PATTERN:
      return {
        ...base,
        type: SignalType.WORKFLOW_PATTERN,
        workflow_name: (data.workflow_name as string) || "",
        steps: (data.steps as string[]) || [],
        parallel_steps: (data.parallel_steps as string[][]) || [],
        branching_conditions: (data.branching_conditions as Record<string, string>) || {},
        total_duration_seconds: (data.total_duration_seconds as number) || 0,
      } as WorkflowPatternSignal;

    case SignalType.CONTEXT_RELEVANCE:
      return {
        ...base,
        type: SignalType.CONTEXT_RELEVANCE,
        query: (data.query as string) || "",
        retrieved_context_ids: (data.retrieved_context_ids as string[]) || [],
        relevant_ids: (data.relevant_ids as string[]) || [],
        irrelevant_ids: (data.irrelevant_ids as string[]) || [],
        precision: (data.precision as number) || 0.0,
        recall: (data.recall as number) || 0.0,
      } as ContextRelevanceSignal;

    default:
      return base;
  }
}

/**
 * Read signals from storage.
 */
export function getSignals(options: {
  lokiDir?: string;
  signalType?: SignalType;
  source?: SignalSource;
  since?: Date;
  limit?: number;
} = {}): AnyLearningSignal[] {
  const {
    lokiDir = ".loki",
    signalType,
    source,
    since,
    limit = 100,
  } = options;

  const signalsDir = getSignalsDir(lokiDir);
  const signals: AnyLearningSignal[] = [];

  try {
    const files = fs.readdirSync(signalsDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();

    for (const file of files) {
      if (signals.length >= limit) {
        break;
      }

      try {
        const filepath = path.join(signalsDir, file);
        const data = JSON.parse(fs.readFileSync(filepath, "utf-8")) as Record<string, unknown>;
        const signal = parseSignalType(data);

        // Filter by type
        if (signalType && signal.type !== signalType) {
          continue;
        }

        // Filter by source
        if (source && signal.source !== source) {
          continue;
        }

        // Filter by time
        if (since && new Date(signal.timestamp) < since) {
          continue;
        }

        signals.push(signal);
      } catch {
        continue;
      }
    }
  } catch {
    // Directory might not exist
  }

  return signals;
}

/**
 * Get a specific signal by ID.
 */
export function getSignalById(signalId: string, lokiDir: string = ".loki"): AnyLearningSignal | null {
  const signalsDir = getSignalsDir(lokiDir);

  try {
    const files = fs.readdirSync(signalsDir).filter((f) => f.includes(signalId));

    for (const file of files) {
      try {
        const filepath = path.join(signalsDir, file);
        const data = JSON.parse(fs.readFileSync(filepath, "utf-8")) as Record<string, unknown>;
        return parseSignalType(data);
      } catch {
        continue;
      }
    }
  } catch {
    // Directory might not exist
  }

  return null;
}

/**
 * Clear old signals from storage.
 */
export function clearSignals(lokiDir: string = ".loki", olderThanDays: number = 30): number {
  const signalsDir = getSignalsDir(lokiDir);
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let count = 0;

  try {
    const files = fs.readdirSync(signalsDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const filepath = path.join(signalsDir, file);
        const stats = fs.statSync(filepath);
        if (stats.mtimeMs < cutoff) {
          fs.unlinkSync(filepath);
          count++;
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Directory might not exist
  }

  return count;
}
