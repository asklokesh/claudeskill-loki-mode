/**
 * Loki Mode Memory Integration Service
 *
 * Integrates VS Code file edits with the Loki memory system.
 * Records meaningful code changes as episodic memories for cross-tool learning.
 *
 * Implements SYN-011 from the SYNERGY-ROADMAP.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

// -----------------------------------------------------------------------------
// Types and Interfaces
// -----------------------------------------------------------------------------

/**
 * Change types for file edits
 */
export const ChangeType = {
  ADDITION: 'addition',
  DELETION: 'deletion',
  MODIFICATION: 'modification',
  REFACTOR: 'refactor',
} as const;

export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

/**
 * A single code change within a file edit
 */
interface CodeChange {
  rangeOffset: number;
  rangeLength: number;
  text: string;
  lineNumber: number;
  changeType: ChangeType;
}

/**
 * Aggregated edit for a file within the debounce window
 */
interface AggregatedEdit {
  filePath: string;
  relativePath: string;
  languageId: string;
  changes: CodeChange[];
  firstChangeTime: number;
  lastChangeTime: number;
  linesAdded: number;
  linesDeleted: number;
  charactersAdded: number;
  charactersDeleted: number;
}

/**
 * Episode trace format for memory storage (matches memory/schemas.py)
 */
interface EpisodeTrace {
  id: string;
  task_id: string;
  timestamp: string;
  duration_seconds: number;
  agent: string;
  context: {
    phase: string;
    goal: string;
    files_involved: string[];
  };
  action_log: Array<{
    t: number;
    action: string;
    target: string;
    result: string;
  }>;
  outcome: 'success' | 'failure' | 'partial';
  errors_encountered: Array<{
    type: string;
    message: string;
    resolution: string;
  }>;
  artifacts_produced: string[];
  files_read: string[];
  files_modified: string[];
  importance: number;
  access_count: number;
  // Extension-specific fields for code edits
  task_type?: string;
  edit_summary?: {
    change_type: ChangeType;
    lines_added: number;
    lines_deleted: number;
    characters_added: number;
    characters_deleted: number;
    patterns_detected: string[];
  };
  surrounding_context?: {
    before: string;
    after: string;
  };
}

/**
 * Edit pattern statistics
 */
interface EditPatternStats {
  fileEditCounts: Map<string, number>;
  changeTypeCounts: Map<ChangeType, number>;
  hourlyActivity: Map<number, number>;
  languageEditCounts: Map<string, number>;
  lastUpdated: number;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function generateId(): string {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 10);
  return `ep-${timestamp}-${random}`;
}

function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Determine the change type based on content changes
 */
function detectChangeType(
  addedChars: number,
  deletedChars: number,
  addedLines: number,
  deletedLines: number
): ChangeType {
  // Pure addition
  if (deletedChars === 0 && addedChars > 0) {
    return ChangeType.ADDITION;
  }

  // Pure deletion
  if (addedChars === 0 && deletedChars > 0) {
    return ChangeType.DELETION;
  }

  // Refactor: similar amount of content changed (within 20% ratio)
  if (addedChars > 0 && deletedChars > 0) {
    const ratio = Math.min(addedChars, deletedChars) / Math.max(addedChars, deletedChars);
    if (ratio > 0.8 && (addedLines === deletedLines || Math.abs(addedLines - deletedLines) <= 2)) {
      return ChangeType.REFACTOR;
    }
  }

  return ChangeType.MODIFICATION;
}

/**
 * Detect code patterns in the edited content
 */
function detectCodePatterns(changes: CodeChange[], languageId: string): string[] {
  const patterns: string[] = [];
  const allText = changes.map((c) => c.text).join('\n');

  // Language-specific patterns
  if (languageId === 'typescript' || languageId === 'javascript') {
    if (/\bfunction\s+\w+/.test(allText)) patterns.push('function_definition');
    if (/\bclass\s+\w+/.test(allText)) patterns.push('class_definition');
    if (/\basync\b/.test(allText)) patterns.push('async_code');
    if (/\bawait\b/.test(allText)) patterns.push('await_usage');
    if (/\bimport\s+/.test(allText)) patterns.push('import_statement');
    if (/\bexport\s+/.test(allText)) patterns.push('export_statement');
    if (/\btry\s*\{/.test(allText)) patterns.push('error_handling');
    if (/\bcatch\s*\(/.test(allText)) patterns.push('error_handling');
    if (/\bthrow\s+/.test(allText)) patterns.push('error_throwing');
    if (/\binterface\s+\w+/.test(allText)) patterns.push('interface_definition');
    if (/\btype\s+\w+\s*=/.test(allText)) patterns.push('type_alias');
    if (/\b(describe|it|test)\s*\(/.test(allText)) patterns.push('test_code');
  }

  if (languageId === 'python') {
    if (/\bdef\s+\w+/.test(allText)) patterns.push('function_definition');
    if (/\bclass\s+\w+/.test(allText)) patterns.push('class_definition');
    if (/\basync\s+def\b/.test(allText)) patterns.push('async_code');
    if (/\bawait\b/.test(allText)) patterns.push('await_usage');
    if (/\bimport\s+/.test(allText)) patterns.push('import_statement');
    if (/\bfrom\s+\w+\s+import/.test(allText)) patterns.push('import_statement');
    if (/\btry\s*:/.test(allText)) patterns.push('error_handling');
    if (/\bexcept\s+/.test(allText)) patterns.push('error_handling');
    if (/\braise\s+/.test(allText)) patterns.push('error_throwing');
    if (/\bdef\s+test_/.test(allText)) patterns.push('test_code');
    if (/@\w+/.test(allText)) patterns.push('decorator_usage');
  }

  // Generic patterns
  if (/TODO|FIXME|HACK|XXX/.test(allText)) patterns.push('todo_comment');
  if (/\bconsole\.(log|error|warn|debug)/.test(allText)) patterns.push('debug_logging');
  if (/\bprint\s*\(/.test(allText) && languageId === 'python') patterns.push('debug_logging');

  return [...new Set(patterns)]; // Remove duplicates
}

/**
 * Check if a change is meaningful (not just whitespace)
 */
function isMeaningfulChange(change: CodeChange): boolean {
  const text = change.text;

  // Empty change
  if (text.length === 0 && change.rangeLength === 0) {
    return false;
  }

  // Pure whitespace
  if (/^\s*$/.test(text) && change.rangeLength === 0) {
    return false;
  }

  // Single character (likely typing)
  if (text.length === 1 && change.rangeLength === 0) {
    return false;
  }

  return true;
}

// -----------------------------------------------------------------------------
// FileEditMemoryIntegration Class
// -----------------------------------------------------------------------------

/**
 * FileEditMemoryIntegration service for VS Code extension.
 *
 * Tracks meaningful file edits and stores them as episodic memories:
 * - Debounces rapid edits (aggregates within 5s window)
 * - Filters out whitespace-only changes
 * - Detects code patterns and change types
 * - Tracks edit statistics for pattern analysis
 */
export class FileEditMemoryIntegration implements vscode.Disposable {
  private lokiDir: string | null = null;
  private disposables: vscode.Disposable[] = [];
  private pendingEdits: Map<string, AggregatedEdit> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private stats: EditPatternStats;
  private writeQueue: EpisodeTrace[] = [];
  private isWriting = false;

  // Configuration
  private readonly DEBOUNCE_MS = 5000; // 5 second debounce window
  private readonly MIN_CHANGES_TO_RECORD = 1; // Minimum number of meaningful changes
  private readonly CONTEXT_LINES = 3; // Lines of context to capture

  constructor() {
    this.stats = {
      fileEditCounts: new Map(),
      changeTypeCounts: new Map(),
      hourlyActivity: new Map(),
      languageEditCounts: new Map(),
      lastUpdated: Date.now(),
    };

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
   * Setup VS Code event listeners for text document changes
   */
  private setupEventListeners(): void {
    // Track document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.scheme === 'file') {
          this.handleDocumentChange(event);
        }
      })
    );

    // Track document saves (trigger flush for that file)
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.uri.scheme === 'file') {
          this.flushPendingEdit(document.uri.fsPath);
        }
      })
    );

    // Track workspace folder changes
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        this.initializeLokiDir();
      })
    );

    logger.debug('FileEditMemoryIntegration: Event listeners initialized');
  }

  /**
   * Handle a text document change event
   */
  private handleDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const filePath = event.document.uri.fsPath;
    const relativePath = this.getRelativePath(filePath);

    // Skip non-workspace files and certain file types
    if (this.shouldSkipFile(filePath)) {
      return;
    }

    // Process each content change
    for (const change of event.contentChanges) {
      const lineNumber = change.range.start.line + 1;
      const addedText = change.text;
      const deletedLength = change.rangeLength;

      // Determine change type for this individual change
      const changeType: ChangeType =
        deletedLength === 0
          ? ChangeType.ADDITION
          : addedText.length === 0
            ? ChangeType.DELETION
            : ChangeType.MODIFICATION;

      const codeChange: CodeChange = {
        rangeOffset: change.rangeOffset,
        rangeLength: change.rangeLength,
        text: change.text,
        lineNumber,
        changeType,
      };

      // Skip non-meaningful changes
      if (!isMeaningfulChange(codeChange)) {
        continue;
      }

      // Aggregate the edit
      this.aggregateEdit(filePath, relativePath, event.document.languageId, codeChange);
    }
  }

  /**
   * Aggregate an edit into the pending edits map
   */
  private aggregateEdit(
    filePath: string,
    relativePath: string,
    languageId: string,
    change: CodeChange
  ): void {
    const now = Date.now();

    let aggregated = this.pendingEdits.get(filePath);
    if (!aggregated) {
      aggregated = {
        filePath,
        relativePath,
        languageId,
        changes: [],
        firstChangeTime: now,
        lastChangeTime: now,
        linesAdded: 0,
        linesDeleted: 0,
        charactersAdded: 0,
        charactersDeleted: 0,
      };
      this.pendingEdits.set(filePath, aggregated);
    }

    // Add the change
    aggregated.changes.push(change);
    aggregated.lastChangeTime = now;

    // Update statistics
    const newLines = (change.text.match(/\n/g) || []).length;
    if (change.changeType === ChangeType.ADDITION) {
      aggregated.linesAdded += newLines;
      aggregated.charactersAdded += change.text.length;
    } else if (change.changeType === ChangeType.DELETION) {
      aggregated.linesDeleted += change.rangeLength > 0 ? 1 : 0; // Approximate
      aggregated.charactersDeleted += change.rangeLength;
    } else {
      aggregated.linesAdded += newLines;
      aggregated.charactersAdded += change.text.length;
      aggregated.charactersDeleted += change.rangeLength;
    }

    // Reset or set debounce timer
    this.resetDebounceTimer(filePath);
  }

  /**
   * Reset the debounce timer for a file
   */
  private resetDebounceTimer(filePath: string): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushPendingEdit(filePath);
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * Flush pending edits for a file and create an episode
   */
  private flushPendingEdit(filePath: string): void {
    const aggregated = this.pendingEdits.get(filePath);
    if (!aggregated || aggregated.changes.length < this.MIN_CHANGES_TO_RECORD) {
      this.pendingEdits.delete(filePath);
      this.debounceTimers.delete(filePath);
      return;
    }

    // Clear the pending edit
    this.pendingEdits.delete(filePath);
    const timer = this.debounceTimers.get(filePath);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(filePath);
    }

    // Create and save the episode
    this.createAndSaveEpisode(aggregated);

    // Update global statistics
    this.updateStats(aggregated);
  }

  /**
   * Create an episode trace from aggregated edits
   */
  private async createAndSaveEpisode(aggregated: AggregatedEdit): Promise<void> {
    const now = new Date();
    const durationSeconds = Math.round((aggregated.lastChangeTime - aggregated.firstChangeTime) / 1000);

    // Determine overall change type
    const changeType = detectChangeType(
      aggregated.charactersAdded,
      aggregated.charactersDeleted,
      aggregated.linesAdded,
      aggregated.linesDeleted
    );

    // Detect code patterns
    const patterns = detectCodePatterns(aggregated.changes, aggregated.languageId);

    // Get surrounding context
    const context = await this.getSurroundingContext(aggregated.filePath, aggregated.changes);

    // Build action log
    const actionLog = aggregated.changes.map((change, index) => ({
      t: index,
      action: `${change.changeType}_code`,
      target: `line ${change.lineNumber}`,
      result: change.text.substring(0, 100) + (change.text.length > 100 ? '...' : ''),
    }));

    const episode: EpisodeTrace = {
      id: generateId(),
      task_id: `edit-${aggregated.relativePath.replace(/[/\\]/g, '-')}`,
      timestamp: new Date(aggregated.firstChangeTime).toISOString(),
      duration_seconds: durationSeconds,
      agent: 'vscode',
      context: {
        phase: 'ACT',
        goal: `Edit ${aggregated.relativePath}`,
        files_involved: [aggregated.relativePath],
      },
      action_log: actionLog,
      outcome: 'success',
      errors_encountered: [],
      artifacts_produced: [],
      files_read: [],
      files_modified: [aggregated.relativePath],
      importance: this.calculateImportance(aggregated, patterns),
      access_count: 0,
      task_type: 'code_edit',
      edit_summary: {
        change_type: changeType,
        lines_added: aggregated.linesAdded,
        lines_deleted: aggregated.linesDeleted,
        characters_added: aggregated.charactersAdded,
        characters_deleted: aggregated.charactersDeleted,
        patterns_detected: patterns,
      },
      surrounding_context: context,
    };

    // Queue for writing
    this.writeQueue.push(episode);
    this.processWriteQueue();

    logger.debug(
      `FileEditMemoryIntegration: Created episode for ${aggregated.relativePath} ` +
        `(${aggregated.changes.length} changes, ${changeType})`
    );
  }

  /**
   * Get surrounding code context for the changes
   */
  private async getSurroundingContext(
    filePath: string,
    changes: CodeChange[]
  ): Promise<{ before: string; after: string }> {
    try {
      const document = await vscode.workspace.openTextDocument(filePath);
      const lines = document.getText().split('\n');

      // Find the range of affected lines
      const affectedLines = changes.map((c) => c.lineNumber);
      const minLine = Math.max(0, Math.min(...affectedLines) - this.CONTEXT_LINES);
      const maxLine = Math.min(lines.length, Math.max(...affectedLines) + this.CONTEXT_LINES);

      // Get context (limit to avoid huge episodes)
      const before = lines.slice(minLine, Math.min(...affectedLines) - 1).join('\n');
      const after = lines.slice(Math.max(...affectedLines), maxLine).join('\n');

      return {
        before: before.substring(0, 500),
        after: after.substring(0, 500),
      };
    } catch {
      return { before: '', after: '' };
    }
  }

  /**
   * Calculate importance score for an edit episode
   */
  private calculateImportance(aggregated: AggregatedEdit, patterns: string[]): number {
    let importance = 0.3; // Base importance for any edit

    // Boost for amount of change
    if (aggregated.linesAdded + aggregated.linesDeleted > 10) {
      importance += 0.1;
    }
    if (aggregated.linesAdded + aggregated.linesDeleted > 50) {
      importance += 0.1;
    }

    // Boost for detected patterns
    if (patterns.includes('function_definition') || patterns.includes('class_definition')) {
      importance += 0.15;
    }
    if (patterns.includes('test_code')) {
      importance += 0.1;
    }
    if (patterns.includes('error_handling')) {
      importance += 0.05;
    }

    // Boost for certain file types
    if (/\.(ts|tsx|py|js|jsx)$/.test(aggregated.filePath)) {
      importance += 0.05;
    }

    // Cap at 0.9
    return Math.min(0.9, importance);
  }

  /**
   * Process the write queue
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      while (this.writeQueue.length > 0) {
        const episode = this.writeQueue.shift();
        if (episode) {
          await this.writeEpisode(episode);
        }
      }
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Write an episode to disk
   */
  private async writeEpisode(episode: EpisodeTrace): Promise<void> {
    if (!this.lokiDir) {
      logger.debug('FileEditMemoryIntegration: No loki directory available');
      return;
    }

    // Determine storage path
    const dateStr = episode.timestamp.slice(0, 10); // YYYY-MM-DD
    const episodicDir = path.join(this.lokiDir, 'memory', 'episodic', dateStr);

    try {
      // Create directory if needed
      if (!fs.existsSync(episodicDir)) {
        fs.mkdirSync(episodicDir, { recursive: true });
      }

      const filePath = path.join(episodicDir, `task-${episode.id}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(episode, null, 2));

      logger.debug(`FileEditMemoryIntegration: Episode saved ${episode.id}`);
    } catch (error) {
      logger.error(`FileEditMemoryIntegration: Failed to write episode ${episode.id}`, error);
    }
  }

  /**
   * Update global edit statistics
   */
  private updateStats(aggregated: AggregatedEdit): void {
    const now = new Date();

    // File edit counts
    const currentCount = this.stats.fileEditCounts.get(aggregated.relativePath) || 0;
    this.stats.fileEditCounts.set(aggregated.relativePath, currentCount + 1);

    // Change type counts
    const changeType = detectChangeType(
      aggregated.charactersAdded,
      aggregated.charactersDeleted,
      aggregated.linesAdded,
      aggregated.linesDeleted
    );
    const typeCount = this.stats.changeTypeCounts.get(changeType) || 0;
    this.stats.changeTypeCounts.set(changeType, typeCount + 1);

    // Hourly activity
    const hour = now.getHours();
    const hourCount = this.stats.hourlyActivity.get(hour) || 0;
    this.stats.hourlyActivity.set(hour, hourCount + 1);

    // Language edit counts
    const langCount = this.stats.languageEditCounts.get(aggregated.languageId) || 0;
    this.stats.languageEditCounts.set(aggregated.languageId, langCount + 1);

    this.stats.lastUpdated = Date.now();
  }

  /**
   * Check if a file should be skipped
   */
  private shouldSkipFile(filePath: string): boolean {
    // Skip node_modules
    if (filePath.includes('node_modules')) {
      return true;
    }

    // Skip .git directory
    if (filePath.includes('.git')) {
      return true;
    }

    // Skip .loki directory (avoid recursion)
    if (filePath.includes('.loki')) {
      return true;
    }

    // Skip common build/cache directories
    if (/\/(dist|build|out|coverage|__pycache__|\.cache|\.vscode|\.idea)\//i.test(filePath)) {
      return true;
    }

    // Skip lock files and generated files
    if (/\.(lock|lockb|min\.js|min\.css|bundle\.)/.test(filePath)) {
      return true;
    }

    return false;
  }

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

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get files most frequently edited
   */
  getMostEditedFiles(limit = 10): Array<{ file: string; count: number }> {
    return Array.from(this.stats.fileEditCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([file, count]) => ({ file, count }));
  }

  /**
   * Get change type distribution
   */
  getChangeTypeDistribution(): Record<ChangeType, number> {
    const result: Record<string, number> = {};
    for (const type of Object.values(ChangeType)) {
      result[type] = this.stats.changeTypeCounts.get(type) || 0;
    }
    return result as Record<ChangeType, number>;
  }

  /**
   * Get hourly activity pattern
   */
  getHourlyActivityPattern(): Array<{ hour: number; edits: number }> {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      edits: this.stats.hourlyActivity.get(hour) || 0,
    }));
  }

  /**
   * Get language edit distribution
   */
  getLanguageEditDistribution(): Array<{ language: string; count: number }> {
    return Array.from(this.stats.languageEditCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([language, count]) => ({ language, count }));
  }

  /**
   * Get all statistics
   */
  getStatistics(): {
    mostEditedFiles: Array<{ file: string; count: number }>;
    changeTypes: Record<ChangeType, number>;
    hourlyActivity: Array<{ hour: number; edits: number }>;
    languageDistribution: Array<{ language: string; count: number }>;
    lastUpdated: number;
  } {
    return {
      mostEditedFiles: this.getMostEditedFiles(),
      changeTypes: this.getChangeTypeDistribution(),
      hourlyActivity: this.getHourlyActivityPattern(),
      languageDistribution: this.getLanguageEditDistribution(),
      lastUpdated: this.stats.lastUpdated,
    };
  }

  /**
   * Flush all pending edits immediately
   */
  flushAll(): void {
    for (const filePath of this.pendingEdits.keys()) {
      this.flushPendingEdit(filePath);
    }
  }

  /**
   * Dispose and clean up resources
   */
  dispose(): void {
    // Flush any remaining edits
    this.flushAll();

    // Clear timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Dispose event listeners
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];

    logger.debug('FileEditMemoryIntegration: Disposed');
  }
}

// -----------------------------------------------------------------------------
// Singleton Instance
// -----------------------------------------------------------------------------

let instance: FileEditMemoryIntegration | null = null;

/**
 * Get the singleton FileEditMemoryIntegration instance
 */
export function getFileEditMemoryIntegration(): FileEditMemoryIntegration {
  if (!instance) {
    instance = new FileEditMemoryIntegration();
  }
  return instance;
}

/**
 * Dispose the singleton instance
 */
export function disposeFileEditMemoryIntegration(): void {
  if (instance) {
    instance.dispose();
    instance = null;
  }
}
