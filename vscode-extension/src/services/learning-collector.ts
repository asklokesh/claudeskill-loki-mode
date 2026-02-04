/**
 * Loki Mode Learning Collector Service
 *
 * Collects learning signals from VS Code extension operations and
 * writes them to .loki/learning/signals/ for cross-tool learning.
 *
 * Implements SYN-020 from the SYNERGY-ROADMAP.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

// -----------------------------------------------------------------------------
// Signal Types (matches learning/signals.ts)
// -----------------------------------------------------------------------------

export const SignalType = {
  USER_PREFERENCE: 'user_preference',
  ERROR_PATTERN: 'error_pattern',
  SUCCESS_PATTERN: 'success_pattern',
  WORKFLOW_PATTERN: 'workflow_pattern',
} as const;

export type SignalType = (typeof SignalType)[keyof typeof SignalType];

export const SignalSource = {
  VSCODE: 'vscode',
} as const;

export type SignalSource = (typeof SignalSource)[keyof typeof SignalSource];

export const Outcome = {
  SUCCESS: 'success',
  FAILURE: 'failure',
  PARTIAL: 'partial',
  UNKNOWN: 'unknown',
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

// -----------------------------------------------------------------------------
// Signal Interfaces
// -----------------------------------------------------------------------------

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

interface WorkflowPatternSignal extends LearningSignal {
  type: typeof SignalType.WORKFLOW_PATTERN;
  workflow_name: string;
  steps: string[];
  parallel_steps: string[][];
  branching_conditions: Record<string, string>;
  total_duration_seconds: number;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function generateId(): string {
  return 'sig-' + Math.random().toString(36).substring(2, 10);
}

function getTimestamp(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------------------
// Learning Collector Class
// -----------------------------------------------------------------------------

/**
 * LearningCollector service for VS Code extension.
 *
 * Tracks user behaviors and emits learning signals:
 * - Command usage (most used commands)
 * - File edits (which files are edited)
 * - Panel views (which views are opened)
 * - Error patterns (extension errors)
 * - Success patterns (successful operations)
 * - Workflow patterns (multi-step workflows)
 */
export class LearningCollector implements vscode.Disposable {
  private lokiDir: string | null = null;
  private commandUsage: Map<string, number> = new Map();
  private fileEdits: Map<string, number> = new Map();
  private panelViews: Map<string, number> = new Map();
  private workflowStartTimes: Map<string, number> = new Map();
  private workflowSteps: Map<string, string[]> = new Map();
  private disposables: vscode.Disposable[] = [];
  private writeQueue: LearningSignal[] = [];
  private isWriting = false;

  constructor() {
    this.initializeLokiDir();
    this.setupEventListeners();
  }

  /**
   * Initialize the .loki directory path from workspace
   */
  private initializeLokiDir(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.lokiDir = path.join(workspaceFolders[0].uri.fsPath, '.loki');
    }
  }

  /**
   * Setup VS Code event listeners for automatic signal collection
   */
  private setupEventListeners(): void {
    // Track document changes (file edits)
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.scheme === 'file') {
          this.trackFileEdit(event.document.uri.fsPath);
        }
      })
    );

    // Track active editor changes (panel views)
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === 'file') {
          this.trackPanelView(editor.document.uri.fsPath);
        }
      })
    );

    // Track workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.initializeLokiDir();
      })
    );

    logger.debug('LearningCollector: Event listeners initialized');
  }

  /**
   * Get the signals directory, creating it if necessary
   */
  private getSignalsDir(): string | null {
    if (!this.lokiDir) {
      return null;
    }

    const signalsDir = path.join(this.lokiDir, 'learning', 'signals');

    try {
      if (!fs.existsSync(signalsDir)) {
        fs.mkdirSync(signalsDir, { recursive: true });
      }
      return signalsDir;
    } catch (error) {
      logger.error('LearningCollector: Failed to create signals directory', error);
      return null;
    }
  }

  /**
   * Non-blocking async signal emission
   */
  private async emitSignalAsync(signal: LearningSignal): Promise<void> {
    this.writeQueue.push(signal);
    this.processWriteQueue();
  }

  /**
   * Process the write queue without blocking
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const signal = this.writeQueue.shift();
        if (signal) {
          await this.writeSignal(signal);
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Write a signal to disk
   */
  private async writeSignal(signal: LearningSignal): Promise<void> {
    const signalsDir = this.getSignalsDir();
    if (!signalsDir) {
      logger.debug('LearningCollector: No signals directory available');
      return;
    }

    const timestampStr = signal.timestamp.replace(/:/g, '-');
    const signalFile = path.join(signalsDir, `${timestampStr}_${signal.id}.json`);

    try {
      await fs.promises.writeFile(signalFile, JSON.stringify(signal, null, 2));
      logger.debug(`LearningCollector: Signal emitted ${signal.id} (${signal.type})`);
    } catch (error) {
      logger.error(`LearningCollector: Failed to write signal ${signal.id}`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Public Signal Emission Methods
  // ---------------------------------------------------------------------------

  /**
   * Track command execution and emit UserPreferenceSignal
   */
  trackCommand(commandId: string, alternatives: string[] = []): void {
    const count = (this.commandUsage.get(commandId) || 0) + 1;
    this.commandUsage.set(commandId, count);

    const signal: UserPreferenceSignal = {
      id: generateId(),
      type: SignalType.USER_PREFERENCE,
      source: SignalSource.VSCODE,
      action: 'command_executed',
      context: {
        commandId,
        executionCount: count,
        editor: vscode.window.activeTextEditor?.document.languageId || 'unknown',
      },
      outcome: Outcome.SUCCESS,
      confidence: 0.9,
      timestamp: getTimestamp(),
      metadata: {
        vscodeVersion: vscode.version,
      },
      preference_key: 'command_choice',
      preference_value: commandId,
      alternatives_rejected: alternatives,
    };

    this.emitSignalAsync(signal);
  }

  /**
   * Emit UserPreferenceSignal for user settings changes
   */
  emitUserPreference(
    preferenceKey: string,
    preferenceValue: unknown,
    alternativesRejected: unknown[] = [],
    context: Record<string, unknown> = {}
  ): void {
    const signal: UserPreferenceSignal = {
      id: generateId(),
      type: SignalType.USER_PREFERENCE,
      source: SignalSource.VSCODE,
      action: 'preference_set',
      context: {
        ...context,
        editor: vscode.window.activeTextEditor?.document.languageId || 'unknown',
      },
      outcome: Outcome.SUCCESS,
      confidence: 0.9,
      timestamp: getTimestamp(),
      metadata: {
        vscodeVersion: vscode.version,
      },
      preference_key: preferenceKey,
      preference_value: preferenceValue,
      alternatives_rejected: alternativesRejected,
    };

    this.emitSignalAsync(signal);
  }

  /**
   * Track file edits
   */
  private trackFileEdit(filePath: string): void {
    const relativePath = this.getRelativePath(filePath);
    const count = (this.fileEdits.get(relativePath) || 0) + 1;
    this.fileEdits.set(relativePath, count);

    // Only emit signals for significant edit counts to reduce noise
    if (count % 10 === 0) {
      this.emitUserPreference(
        'file_edit_frequency',
        { path: relativePath, editCount: count },
        [],
        { fileType: path.extname(filePath) }
      );
    }
  }

  /**
   * Track panel/view opens
   */
  private trackPanelView(filePath: string): void {
    const relativePath = this.getRelativePath(filePath);
    const count = (this.panelViews.get(relativePath) || 0) + 1;
    this.panelViews.set(relativePath, count);
  }

  /**
   * Track custom panel view (for webviews and custom views)
   */
  trackPanelViewCustom(panelId: string): void {
    const count = (this.panelViews.get(panelId) || 0) + 1;
    this.panelViews.set(panelId, count);

    this.emitUserPreference(
      'panel_view',
      { panelId, viewCount: count },
      [],
      { panelType: 'custom' }
    );
  }

  /**
   * Emit ErrorPatternSignal for extension errors
   */
  emitErrorPattern(
    errorType: string,
    errorMessage: string,
    options: {
      resolution?: string;
      stackTrace?: string;
      recoverySteps?: string[];
      context?: Record<string, unknown>;
    } = {}
  ): void {
    const signal: ErrorPatternSignal = {
      id: generateId(),
      type: SignalType.ERROR_PATTERN,
      source: SignalSource.VSCODE,
      action: 'error_occurred',
      context: {
        ...options.context,
        editor: vscode.window.activeTextEditor?.document.languageId || 'unknown',
      },
      outcome: options.resolution ? Outcome.SUCCESS : Outcome.FAILURE,
      confidence: 0.8,
      timestamp: getTimestamp(),
      metadata: {
        vscodeVersion: vscode.version,
      },
      error_type: errorType,
      error_message: errorMessage,
      resolution: options.resolution || '',
      stack_trace: options.stackTrace,
      recovery_steps: options.recoverySteps || [],
    };

    this.emitSignalAsync(signal);
  }

  /**
   * Emit SuccessPatternSignal for successful operations
   */
  emitSuccessPattern(
    patternName: string,
    actionSequence: string[],
    options: {
      preconditions?: string[];
      postconditions?: string[];
      durationSeconds?: number;
      context?: Record<string, unknown>;
    } = {}
  ): void {
    const signal: SuccessPatternSignal = {
      id: generateId(),
      type: SignalType.SUCCESS_PATTERN,
      source: SignalSource.VSCODE,
      action: 'operation_succeeded',
      context: {
        ...options.context,
        editor: vscode.window.activeTextEditor?.document.languageId || 'unknown',
      },
      outcome: Outcome.SUCCESS,
      confidence: 0.85,
      timestamp: getTimestamp(),
      metadata: {
        vscodeVersion: vscode.version,
      },
      pattern_name: patternName,
      action_sequence: actionSequence,
      preconditions: options.preconditions || [],
      postconditions: options.postconditions || [],
      duration_seconds: options.durationSeconds || 0,
    };

    this.emitSignalAsync(signal);
  }

  /**
   * Start tracking a multi-step workflow
   */
  startWorkflow(workflowName: string): void {
    this.workflowStartTimes.set(workflowName, Date.now());
    this.workflowSteps.set(workflowName, []);
    logger.debug(`LearningCollector: Started workflow ${workflowName}`);
  }

  /**
   * Add a step to an active workflow
   */
  addWorkflowStep(workflowName: string, stepName: string): void {
    const steps = this.workflowSteps.get(workflowName);
    if (steps) {
      steps.push(stepName);
    }
  }

  /**
   * Complete a workflow and emit WorkflowPatternSignal
   */
  completeWorkflow(
    workflowName: string,
    options: {
      outcome?: Outcome;
      parallelSteps?: string[][];
      branchingConditions?: Record<string, string>;
      context?: Record<string, unknown>;
    } = {}
  ): void {
    const startTime = this.workflowStartTimes.get(workflowName);
    const steps = this.workflowSteps.get(workflowName);

    if (!startTime || !steps) {
      logger.warn(`LearningCollector: Unknown workflow ${workflowName}`);
      return;
    }

    const durationSeconds = (Date.now() - startTime) / 1000;

    const signal: WorkflowPatternSignal = {
      id: generateId(),
      type: SignalType.WORKFLOW_PATTERN,
      source: SignalSource.VSCODE,
      action: 'workflow_completed',
      context: {
        ...options.context,
        editor: vscode.window.activeTextEditor?.document.languageId || 'unknown',
      },
      outcome: options.outcome || Outcome.SUCCESS,
      confidence: 0.85,
      timestamp: getTimestamp(),
      metadata: {
        vscodeVersion: vscode.version,
      },
      workflow_name: workflowName,
      steps,
      parallel_steps: options.parallelSteps || [],
      branching_conditions: options.branchingConditions || {},
      total_duration_seconds: durationSeconds,
    };

    this.emitSignalAsync(signal);

    // Clean up workflow tracking
    this.workflowStartTimes.delete(workflowName);
    this.workflowSteps.delete(workflowName);

    logger.debug(`LearningCollector: Completed workflow ${workflowName} (${durationSeconds}s)`);
  }

  /**
   * Cancel a workflow without emitting a signal
   */
  cancelWorkflow(workflowName: string): void {
    this.workflowStartTimes.delete(workflowName);
    this.workflowSteps.delete(workflowName);
    logger.debug(`LearningCollector: Cancelled workflow ${workflowName}`);
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /**
   * Get relative path from workspace root
   */
  private getRelativePath(filePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      if (filePath.startsWith(workspaceRoot)) {
        return filePath.substring(workspaceRoot.length + 1);
      }
    }
    return path.basename(filePath);
  }

  /**
   * Get usage statistics
   */
  getStatistics(): {
    commandUsage: Record<string, number>;
    fileEdits: Record<string, number>;
    panelViews: Record<string, number>;
  } {
    return {
      commandUsage: Object.fromEntries(this.commandUsage),
      fileEdits: Object.fromEntries(this.fileEdits),
      panelViews: Object.fromEntries(this.panelViews),
    };
  }

  /**
   * Get most used commands
   */
  getMostUsedCommands(limit = 10): Array<{ command: string; count: number }> {
    return Array.from(this.commandUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([command, count]) => ({ command, count }));
  }

  /**
   * Get most edited files
   */
  getMostEditedFiles(limit = 10): Array<{ file: string; count: number }> {
    return Array.from(this.fileEdits.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([file, count]) => ({ file, count }));
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    logger.debug('LearningCollector: Disposed');
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

let instance: LearningCollector | null = null;

/**
 * Get the singleton LearningCollector instance
 */
export function getLearningCollector(): LearningCollector {
  if (!instance) {
    instance = new LearningCollector();
  }
  return instance;
}

/**
 * Dispose the singleton instance
 */
export function disposeLearningCollector(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
