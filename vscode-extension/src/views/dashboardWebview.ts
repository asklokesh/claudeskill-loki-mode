/**
 * Dashboard Webview Provider
 * Embeds the Loki Mode dashboard components in a VS Code sidebar panel
 * Provides task board, session control, log stream, and memory browser
 */

import * as vscode from 'vscode';
import { LokiApiClient } from '../api/client';
import { logger } from '../utils/logger';
import { getNonce } from '../utils/webview';

// Types for dashboard data
interface DashboardTask {
    id: string;
    title: string;
    description: string;
    status: 'backlog' | 'pending' | 'in_progress' | 'review' | 'done';
    priority: 'critical' | 'high' | 'medium' | 'low';
    type: 'feature' | 'bug' | 'chore' | 'docs' | 'test';
    assignee?: string;
    createdAt: string;
    updatedAt: string;
}

interface DashboardSession {
    id: string;
    status: 'running' | 'paused' | 'stopped';
    provider: 'claude' | 'codex' | 'gemini';
    startTime: string;
    tasksCompleted: number;
    tasksPending: number;
}

interface DashboardMemory {
    patterns: Array<{ id: string; pattern: string; category: string; confidence: number }>;
    episodes: Array<{ id: string; goal: string; outcome: string; timestamp: string }>;
    skills: Array<{ id: string; name: string; successRate: number }>;
    tokenStats: { total: number; savings: number };
}

interface LogEntry {
    timestamp: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    source?: string;
}

interface DashboardState {
    activeTab: 'tasks' | 'sessions' | 'logs' | 'memory';
    tasks: DashboardTask[];
    sessions: DashboardSession[];
    logs: LogEntry[];
    memory: DashboardMemory;
    isConnected: boolean;
    lastUpdated: Date;
}

export class DashboardWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = 'loki-dashboard';
    private static readonly REFRESH_INTERVAL = 3000;
    private static readonly MAX_LOGS = 200;

    private _view?: vscode.WebviewView;
    private _state: DashboardState;
    private _refreshTimer?: ReturnType<typeof setInterval>;
    private _disposables: vscode.Disposable[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _apiClient: LokiApiClient
    ) {
        this._state = {
            activeTab: 'tasks',
            tasks: [],
            sessions: [],
            logs: [],
            memory: {
                patterns: [],
                episodes: [],
                skills: [],
                tokenStats: { total: 0, savings: 0 }
            },
            isConnected: false,
            lastUpdated: new Date()
        };
    }

    public dispose(): void {
        this._stopAutoRefresh();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'media'),
                vscode.Uri.joinPath(this._extensionUri, 'dist')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        const messageHandler = webviewView.webview.onDidReceiveMessage(
            async (message) => this._handleMessage(message),
            undefined,
            this._disposables
        );
        this._disposables.push(messageHandler);

        // Handle visibility changes
        const visibilityHandler = webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._refreshAllData();
                this._startAutoRefresh();
            } else {
                this._stopAutoRefresh();
            }
        });
        this._disposables.push(visibilityHandler);

        // Cleanup on dispose
        webviewView.onDidDispose(() => {
            this._stopAutoRefresh();
        });
    }

    private async _handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
        switch (message.type) {
            case 'ready':
                await this._refreshAllData();
                this._startAutoRefresh();
                break;

            case 'setActiveTab':
                this._state.activeTab = message.tab as DashboardState['activeTab'];
                this._updateWebview();
                break;

            case 'refreshData':
                await this._refreshAllData();
                break;

            case 'startSession':
                await this._startSession(message.provider as string);
                break;

            case 'stopSession':
                await this._stopSession();
                break;

            case 'pauseSession':
                await this._pauseSession();
                break;

            case 'resumeSession':
                await this._resumeSession();
                break;

            case 'moveTask':
                await this._moveTask(
                    message.taskId as string,
                    message.newStatus as DashboardTask['status']
                );
                break;

            case 'viewTaskDetails':
                this._showTaskDetails(message.taskId as string);
                break;

            case 'viewPatternDetails':
                this._showPatternDetails(message.patternId as string);
                break;

            case 'viewEpisodeDetails':
                this._showEpisodeDetails(message.episodeId as string);
                break;

            case 'clearLogs':
                this._state.logs = [];
                this._updateWebview();
                break;

            case 'setLogFilter':
                // Log filter is handled client-side, just acknowledge
                break;
        }
    }

    private async _refreshAllData(): Promise<void> {
        try {
            const isHealthy = await this._apiClient.health();
            this._state.isConnected = isHealthy;

            if (!isHealthy) {
                this._updateWebview();
                return;
            }

            // Fetch data in parallel
            const [tasks, status, logs, memory] = await Promise.allSettled([
                this._fetchTasks(),
                this._fetchStatus(),
                this._fetchLogs(),
                this._fetchMemory()
            ]);

            if (tasks.status === 'fulfilled') {
                this._state.tasks = tasks.value;
            }

            if (status.status === 'fulfilled') {
                this._state.sessions = status.value;
            }

            if (logs.status === 'fulfilled') {
                this._state.logs = logs.value;
            }

            if (memory.status === 'fulfilled') {
                this._state.memory = memory.value;
            }

            this._state.lastUpdated = new Date();
            this._updateWebview();

        } catch (error) {
            logger.error('Failed to refresh dashboard data:', error);
            this._state.isConnected = false;
            this._updateWebview();
        }
    }

    private async _fetchTasks(): Promise<DashboardTask[]> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            const response = await fetch(`${baseUrl}/api/tasks`);
            if (!response.ok) return [];

            const data = await response.json() as { tasks?: unknown[] };
            if (!data.tasks || !Array.isArray(data.tasks)) return [];

            return data.tasks.map((t: unknown) => {
                const task = t as Record<string, unknown>;
                return {
                    id: String(task.id || ''),
                    title: String(task.title || ''),
                    description: String(task.description || ''),
                    status: this._normalizeTaskStatus(String(task.status || 'pending')),
                    priority: this._normalizeTaskPriority(String(task.priority || 'medium')),
                    type: this._normalizeTaskType(String(task.type || 'feature')),
                    assignee: task.assignee ? String(task.assignee) : undefined,
                    createdAt: String(task.created_at || task.createdAt || new Date().toISOString()),
                    updatedAt: String(task.updated_at || task.updatedAt || new Date().toISOString())
                };
            });
        } catch {
            return [];
        }
    }

    private _normalizeTaskStatus(status: string): DashboardTask['status'] {
        const validStatuses: DashboardTask['status'][] = ['backlog', 'pending', 'in_progress', 'review', 'done'];
        const normalized = status.toLowerCase().replace(/-/g, '_');
        return validStatuses.includes(normalized as DashboardTask['status'])
            ? normalized as DashboardTask['status']
            : 'pending';
    }

    private _normalizeTaskPriority(priority: string): DashboardTask['priority'] {
        const validPriorities: DashboardTask['priority'][] = ['critical', 'high', 'medium', 'low'];
        return validPriorities.includes(priority as DashboardTask['priority'])
            ? priority as DashboardTask['priority']
            : 'medium';
    }

    private _normalizeTaskType(type: string): DashboardTask['type'] {
        const validTypes: DashboardTask['type'][] = ['feature', 'bug', 'chore', 'docs', 'test'];
        return validTypes.includes(type as DashboardTask['type'])
            ? type as DashboardTask['type']
            : 'feature';
    }

    private async _fetchStatus(): Promise<DashboardSession[]> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            const response = await fetch(`${baseUrl}/status`);
            if (!response.ok) return [];

            const data = await response.json() as Record<string, unknown>;
            const sessions: DashboardSession[] = [];

            if (data.running) {
                sessions.push({
                    id: String(data.session_id || 'current'),
                    status: data.paused ? 'paused' : 'running',
                    provider: this._normalizeProvider(String(data.provider || 'claude')),
                    startTime: String(data.start_time || new Date().toISOString()),
                    tasksCompleted: Number(data.tasks_completed || data.tasksCompleted || 0),
                    tasksPending: Number(data.tasks_pending || data.tasksPending || 0)
                });
            }

            return sessions;
        } catch {
            return [];
        }
    }

    private _normalizeProvider(provider: string): DashboardSession['provider'] {
        const validProviders: DashboardSession['provider'][] = ['claude', 'codex', 'gemini'];
        return validProviders.includes(provider as DashboardSession['provider'])
            ? provider as DashboardSession['provider']
            : 'claude';
    }

    private async _fetchLogs(): Promise<LogEntry[]> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            const response = await fetch(`${baseUrl}/logs?limit=${DashboardWebviewProvider.MAX_LOGS}`);
            if (!response.ok) return this._state.logs;

            const data = await response.json() as { logs?: unknown[] };
            if (!data.logs || !Array.isArray(data.logs)) return this._state.logs;

            return data.logs.map((l: unknown) => {
                const log = l as Record<string, unknown>;
                return {
                    timestamp: String(log.timestamp || new Date().toISOString()),
                    level: this._normalizeLogLevel(String(log.level || 'info')),
                    message: String(log.message || ''),
                    source: log.source ? String(log.source) : undefined
                };
            });
        } catch {
            return this._state.logs;
        }
    }

    private _normalizeLogLevel(level: string): LogEntry['level'] {
        const validLevels: LogEntry['level'][] = ['debug', 'info', 'warn', 'error'];
        const normalized = level.toLowerCase();
        if (normalized === 'warning') return 'warn';
        return validLevels.includes(normalized as LogEntry['level'])
            ? normalized as LogEntry['level']
            : 'info';
    }

    private async _fetchMemory(): Promise<DashboardMemory> {
        try {
            const baseUrl = this._apiClient.baseUrl;

            const [patternsRes, episodesRes, skillsRes, economicsRes] = await Promise.allSettled([
                fetch(`${baseUrl}/api/memory/patterns`),
                fetch(`${baseUrl}/api/memory/episodes`),
                fetch(`${baseUrl}/api/memory/skills`),
                fetch(`${baseUrl}/api/memory/economics`)
            ]);

            const memory: DashboardMemory = {
                patterns: [],
                episodes: [],
                skills: [],
                tokenStats: { total: 0, savings: 0 }
            };

            if (patternsRes.status === 'fulfilled' && patternsRes.value.ok) {
                const data = await patternsRes.value.json() as { patterns?: unknown[] };
                memory.patterns = (data.patterns || []).slice(0, 10).map((p: unknown) => {
                    const pattern = p as Record<string, unknown>;
                    return {
                        id: String(pattern.id || ''),
                        pattern: String(pattern.pattern || ''),
                        category: String(pattern.category || ''),
                        confidence: Number(pattern.confidence || 0)
                    };
                });
            }

            if (episodesRes.status === 'fulfilled' && episodesRes.value.ok) {
                const data = await episodesRes.value.json() as { episodes?: unknown[] };
                memory.episodes = (data.episodes || []).slice(0, 5).map((e: unknown) => {
                    const episode = e as Record<string, unknown>;
                    return {
                        id: String(episode.id || ''),
                        goal: String(episode.goal || ''),
                        outcome: String(episode.outcome || ''),
                        timestamp: String(episode.timestamp || '')
                    };
                });
            }

            if (skillsRes.status === 'fulfilled' && skillsRes.value.ok) {
                const data = await skillsRes.value.json() as { skills?: unknown[] };
                memory.skills = (data.skills || []).slice(0, 5).map((s: unknown) => {
                    const skill = s as Record<string, unknown>;
                    return {
                        id: String(skill.id || ''),
                        name: String(skill.name || ''),
                        successRate: Number(skill.success_rate || skill.successRate || 0)
                    };
                });
            }

            if (economicsRes.status === 'fulfilled' && economicsRes.value.ok) {
                const data = await economicsRes.value.json() as Record<string, unknown>;
                memory.tokenStats = {
                    total: Number(data.total_tokens || data.total || 0),
                    savings: Number(data.savings_percent || data.savings || 0)
                };
            }

            return memory;
        } catch {
            return this._state.memory;
        }
    }

    private async _startSession(provider: string): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            await fetch(`${baseUrl}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider })
            });
            await this._refreshAllData();
            vscode.window.showInformationMessage(`Loki Mode started with ${provider}`);
        } catch (error) {
            logger.error('Failed to start session:', error);
            vscode.window.showErrorMessage('Failed to start Loki Mode session');
        }
    }

    private async _stopSession(): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            await fetch(`${baseUrl}/stop`, { method: 'POST' });
            await this._refreshAllData();
            vscode.window.showInformationMessage('Loki Mode stopped');
        } catch (error) {
            logger.error('Failed to stop session:', error);
            vscode.window.showErrorMessage('Failed to stop Loki Mode session');
        }
    }

    private async _pauseSession(): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            await fetch(`${baseUrl}/pause`, { method: 'POST' });
            await this._refreshAllData();
            vscode.window.showInformationMessage('Loki Mode paused');
        } catch (error) {
            logger.error('Failed to pause session:', error);
            vscode.window.showErrorMessage('Failed to pause Loki Mode session');
        }
    }

    private async _resumeSession(): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            await fetch(`${baseUrl}/resume`, { method: 'POST' });
            await this._refreshAllData();
            vscode.window.showInformationMessage('Loki Mode resumed');
        } catch (error) {
            logger.error('Failed to resume session:', error);
            vscode.window.showErrorMessage('Failed to resume Loki Mode session');
        }
    }

    private async _moveTask(taskId: string, newStatus: DashboardTask['status']): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            await fetch(`${baseUrl}/api/tasks/${taskId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            await this._refreshAllData();
        } catch (error) {
            logger.error('Failed to move task:', error);
            vscode.window.showErrorMessage('Failed to move task');
        }
    }

    private async _showTaskDetails(taskId: string): Promise<void> {
        const task = this._state.tasks.find(t => t.id === taskId);
        if (task) {
            const content = JSON.stringify(task, null, 2);
            const doc = await vscode.workspace.openTextDocument({
                content,
                language: 'json'
            });
            await vscode.window.showTextDocument(doc, { preview: true });
        }
    }

    private async _showPatternDetails(patternId: string): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            const response = await fetch(`${baseUrl}/api/memory/patterns/${patternId}`);
            if (response.ok) {
                const pattern = await response.json();
                const content = JSON.stringify(pattern, null, 2);
                const doc = await vscode.workspace.openTextDocument({
                    content,
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        } catch (error) {
            logger.error('Failed to fetch pattern details:', error);
        }
    }

    private async _showEpisodeDetails(episodeId: string): Promise<void> {
        try {
            const baseUrl = this._apiClient.baseUrl;
            const response = await fetch(`${baseUrl}/api/memory/episodes/${episodeId}`);
            if (response.ok) {
                const episode = await response.json();
                const content = JSON.stringify(episode, null, 2);
                const doc = await vscode.workspace.openTextDocument({
                    content,
                    language: 'json'
                });
                await vscode.window.showTextDocument(doc, { preview: true });
            }
        } catch (error) {
            logger.error('Failed to fetch episode details:', error);
        }
    }

    private _startAutoRefresh(): void {
        if (this._refreshTimer) return;
        this._refreshTimer = setInterval(() => {
            this._refreshAllData();
        }, DashboardWebviewProvider.REFRESH_INTERVAL);
    }

    private _stopAutoRefresh(): void {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = undefined;
        }
    }

    private _updateWebview(): void {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateState',
                state: this._state
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>Loki Dashboard</title>
    <style>
        :root {
            --loki-orange: #e5714f;
            --loki-orange-hover: #d4603e;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Tabs */
        .tabs {
            display: flex;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-sideBar-background);
            flex-shrink: 0;
        }
        .tab {
            flex: 1;
            padding: 8px 4px;
            text-align: center;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: var(--vscode-descriptionForeground);
            transition: all 0.15s;
        }
        .tab:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .tab.active {
            color: var(--loki-orange);
            border-bottom-color: var(--loki-orange);
        }

        /* Content */
        .content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }
        .panel { display: none; }
        .panel.active { display: block; }

        /* Connection Status */
        .connection-status {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            font-size: 11px;
            background: var(--vscode-sideBar-background);
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        .status-dot.connected { background: var(--vscode-testing-iconPassed); }
        .status-dot.disconnected { background: var(--vscode-testing-iconFailed); }

        /* Task Board */
        .task-board {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 8px;
        }
        .task-column {
            flex: 0 0 140px;
            min-width: 140px;
        }
        .column-header {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--vscode-descriptionForeground);
            padding: 6px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .column-count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 1px 6px;
            border-radius: 10px;
            font-size: 9px;
        }
        .task-list {
            min-height: 100px;
            padding: 4px;
            border-radius: 4px;
            background: var(--vscode-editor-inactiveSelectionBackground);
        }
        .task-card {
            background: var(--vscode-editor-background);
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 6px;
            cursor: pointer;
            border-left: 3px solid transparent;
            transition: all 0.15s;
        }
        .task-card:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .task-card.priority-critical { border-left-color: #ef4444; }
        .task-card.priority-high { border-left-color: #f97316; }
        .task-card.priority-medium { border-left-color: #eab308; }
        .task-card.priority-low { border-left-color: #22c55e; }
        .task-title {
            font-size: 11px;
            font-weight: 500;
            margin-bottom: 4px;
            line-height: 1.3;
        }
        .task-meta {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }
        .task-tag {
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }

        /* Session Control */
        .session-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
        }
        .session-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .session-status {
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
        }
        .session-status.running {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }
        .session-status.paused {
            background: var(--vscode-editorWarning-foreground);
            color: white;
        }
        .session-status.stopped {
            background: var(--vscode-descriptionForeground);
            color: white;
        }
        .session-provider {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .session-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 12px 0;
        }
        .stat-item {
            text-align: center;
            padding: 8px;
            background: var(--vscode-editor-background);
            border-radius: 4px;
        }
        .stat-value {
            font-size: 16px;
            font-weight: 600;
            color: var(--loki-orange);
        }
        .stat-label {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
        }
        .session-controls {
            display: flex;
            gap: 6px;
        }
        .control-btn {
            flex: 1;
            padding: 6px 8px;
            font-size: 11px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.15s;
        }
        .control-btn.primary {
            background: var(--loki-orange);
            color: white;
        }
        .control-btn.primary:hover {
            background: var(--loki-orange-hover);
        }
        .control-btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .control-btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        .control-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        /* Provider Select */
        .provider-select {
            margin-bottom: 12px;
        }
        .provider-select label {
            display: block;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
        }
        .provider-select select {
            width: 100%;
            padding: 6px 8px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            font-size: 12px;
        }

        /* Logs */
        .logs-toolbar {
            display: flex;
            gap: 8px;
            margin-bottom: 8px;
            align-items: center;
        }
        .logs-toolbar select {
            padding: 4px 8px;
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            font-size: 11px;
        }
        .logs-toolbar button {
            padding: 4px 8px;
            font-size: 11px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        .log-container {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 11px;
            max-height: 400px;
            overflow-y: auto;
        }
        .log-entry {
            display: flex;
            gap: 8px;
            padding: 3px 6px;
            border-radius: 2px;
        }
        .log-entry:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .log-timestamp {
            color: var(--vscode-descriptionForeground);
            white-space: nowrap;
        }
        .log-level {
            font-weight: 600;
            text-transform: uppercase;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 2px;
            white-space: nowrap;
        }
        .log-level.debug { color: var(--vscode-debugIcon-pauseForeground); }
        .log-level.info { color: var(--vscode-editorInfo-foreground); background: var(--vscode-editorInfo-background); }
        .log-level.warn { color: var(--vscode-editorWarning-foreground); background: var(--vscode-editorWarning-background); }
        .log-level.error { color: var(--vscode-editorError-foreground); background: var(--vscode-editorError-background); }
        .log-message {
            flex: 1;
            word-break: break-word;
        }

        /* Memory */
        .memory-section {
            margin-bottom: 16px;
        }
        .section-title {
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .memory-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            padding: 8px;
            margin-bottom: 6px;
            cursor: pointer;
            transition: background 0.15s;
        }
        .memory-card:hover {
            background: var(--vscode-list-hoverBackground);
        }
        .memory-card-title {
            font-weight: 500;
            font-size: 11px;
            margin-bottom: 4px;
            display: flex;
            justify-content: space-between;
        }
        .memory-card-meta {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        .token-stats {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 16px;
        }
        .confidence-badge {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 4px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        .confidence-badge.high {
            background: var(--vscode-testing-iconPassed);
            color: white;
        }

        /* Empty State */
        .empty-state {
            text-align: center;
            padding: 24px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state svg {
            width: 40px;
            height: 40px;
            margin-bottom: 12px;
            opacity: 0.5;
        }

        /* Last Updated */
        .last-updated {
            text-align: center;
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            padding: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div class="connection-status">
        <span class="status-dot disconnected" id="statusDot"></span>
        <span id="statusText">Disconnected</span>
    </div>

    <div class="tabs">
        <div class="tab active" data-tab="tasks">Tasks</div>
        <div class="tab" data-tab="sessions">Sessions</div>
        <div class="tab" data-tab="logs">Logs</div>
        <div class="tab" data-tab="memory">Memory</div>
    </div>

    <div class="content">
        <!-- Tasks Panel -->
        <div class="panel active" id="panel-tasks">
            <div class="task-board" id="taskBoard">
                <div class="empty-state">
                    <p>Loading tasks...</p>
                </div>
            </div>
        </div>

        <!-- Sessions Panel -->
        <div class="panel" id="panel-sessions">
            <div class="provider-select">
                <label>Provider</label>
                <select id="providerSelect">
                    <option value="claude">Claude</option>
                    <option value="codex">Codex</option>
                    <option value="gemini">Gemini</option>
                </select>
            </div>
            <div id="sessionsList">
                <div class="session-card">
                    <div class="session-header">
                        <span class="session-status stopped">No Session</span>
                    </div>
                    <div class="session-controls">
                        <button class="control-btn primary" id="startBtn">Start</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Logs Panel -->
        <div class="panel" id="panel-logs">
            <div class="logs-toolbar">
                <select id="logFilter">
                    <option value="all">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                </select>
                <button id="clearLogsBtn">Clear</button>
                <span id="logCount" style="margin-left: auto; font-size: 10px; color: var(--vscode-descriptionForeground);">0 entries</span>
            </div>
            <div class="log-container" id="logContainer">
                <div class="empty-state">
                    <p>No logs available</p>
                </div>
            </div>
        </div>

        <!-- Memory Panel -->
        <div class="panel" id="panel-memory">
            <div class="memory-section">
                <div class="section-title">Token Economics</div>
                <div class="token-stats">
                    <div class="stat-item">
                        <div class="stat-value" id="totalTokens">-</div>
                        <div class="stat-label">Total Tokens</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value" id="tokenSavings" style="color: var(--vscode-testing-iconPassed)">-</div>
                        <div class="stat-label">Savings</div>
                    </div>
                </div>
            </div>
            <div class="memory-section">
                <div class="section-title">Patterns <span class="column-count" id="patternCount">0</span></div>
                <div id="patternsList"></div>
            </div>
            <div class="memory-section">
                <div class="section-title">Episodes <span class="column-count" id="episodeCount">0</span></div>
                <div id="episodesList"></div>
            </div>
            <div class="memory-section">
                <div class="section-title">Skills <span class="column-count" id="skillCount">0</span></div>
                <div id="skillsList"></div>
            </div>
        </div>
    </div>

    <div class="last-updated" id="lastUpdated">-</div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        let state = null;
        let logFilter = 'all';

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('panel-' + tabName).classList.add('active');
                vscode.postMessage({ type: 'setActiveTab', tab: tabName });
            });
        });

        // Session controls
        document.getElementById('startBtn').addEventListener('click', () => {
            const provider = document.getElementById('providerSelect').value;
            vscode.postMessage({ type: 'startSession', provider });
        });

        // Log controls
        document.getElementById('logFilter').addEventListener('change', (e) => {
            logFilter = e.target.value;
            renderLogs();
        });

        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'clearLogs' });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateState') {
                state = message.state;
                updateUI();
            }
        });

        function updateUI() {
            if (!state) return;

            // Connection status
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            statusDot.className = 'status-dot ' + (state.isConnected ? 'connected' : 'disconnected');
            statusText.textContent = state.isConnected ? 'Connected' : 'Disconnected';

            // Tasks
            renderTasks();

            // Sessions
            renderSessions();

            // Logs
            renderLogs();

            // Memory
            renderMemory();

            // Last updated
            document.getElementById('lastUpdated').textContent =
                'Updated: ' + new Date(state.lastUpdated).toLocaleTimeString();
        }

        function renderTasks() {
            const columns = ['backlog', 'pending', 'in_progress', 'review', 'done'];
            const columnTitles = { backlog: 'Backlog', pending: 'Pending', in_progress: 'In Progress', review: 'Review', done: 'Done' };

            const boardHtml = columns.map(status => {
                const tasks = state.tasks.filter(t => t.status === status);
                return \`
                    <div class="task-column">
                        <div class="column-header">
                            <span>\${columnTitles[status]}</span>
                            <span class="column-count">\${tasks.length}</span>
                        </div>
                        <div class="task-list" data-status="\${status}">
                            \${tasks.length === 0 ? '' : tasks.map(task => \`
                                <div class="task-card priority-\${task.priority}" data-task-id="\${escapeAttr(task.id)}" onclick="viewTask('\${escapeAttr(task.id)}')">
                                    <div class="task-title">\${escapeHtml(truncate(task.title, 40))}</div>
                                    <div class="task-meta">
                                        <span class="task-tag">\${escapeHtml(task.type)}</span>
                                        <span class="task-tag">\${escapeHtml(task.priority)}</span>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
            }).join('');

            document.getElementById('taskBoard').innerHTML = boardHtml || '<div class="empty-state"><p>No tasks</p></div>';
        }

        function renderSessions() {
            const sessions = state.sessions;
            if (sessions.length === 0) {
                document.getElementById('sessionsList').innerHTML = \`
                    <div class="session-card">
                        <div class="session-header">
                            <span class="session-status stopped">No Session</span>
                        </div>
                        <div class="session-controls">
                            <button class="control-btn primary" onclick="startSession()">Start</button>
                        </div>
                    </div>
                \`;
                return;
            }

            const session = sessions[0];
            document.getElementById('sessionsList').innerHTML = \`
                <div class="session-card">
                    <div class="session-header">
                        <span class="session-status \${session.status}">\${session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
                        <span class="session-provider">\${escapeHtml(session.provider)}</span>
                    </div>
                    <div class="session-stats">
                        <div class="stat-item">
                            <div class="stat-value">\${session.tasksCompleted}</div>
                            <div class="stat-label">Completed</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">\${session.tasksPending}</div>
                            <div class="stat-label">Pending</div>
                        </div>
                    </div>
                    <div class="session-controls">
                        \${session.status === 'running' ? \`
                            <button class="control-btn secondary" onclick="pauseSession()">Pause</button>
                            <button class="control-btn secondary" onclick="stopSession()">Stop</button>
                        \` : session.status === 'paused' ? \`
                            <button class="control-btn primary" onclick="resumeSession()">Resume</button>
                            <button class="control-btn secondary" onclick="stopSession()">Stop</button>
                        \` : \`
                            <button class="control-btn primary" onclick="startSession()">Start</button>
                        \`}
                    </div>
                </div>
            \`;
        }

        function renderLogs() {
            const logs = logFilter === 'all' ? state.logs : state.logs.filter(l => l.level === logFilter);
            document.getElementById('logCount').textContent = logs.length + ' entries';

            if (logs.length === 0) {
                document.getElementById('logContainer').innerHTML = '<div class="empty-state"><p>No logs available</p></div>';
                return;
            }

            document.getElementById('logContainer').innerHTML = logs.map(log => \`
                <div class="log-entry">
                    <span class="log-timestamp">\${formatTime(log.timestamp)}</span>
                    <span class="log-level \${log.level}">\${log.level}</span>
                    <span class="log-message">\${escapeHtml(log.message)}</span>
                </div>
            \`).join('');
        }

        function renderMemory() {
            const memory = state.memory;

            // Token stats
            document.getElementById('totalTokens').textContent = formatNumber(memory.tokenStats.total);
            document.getElementById('tokenSavings').textContent = memory.tokenStats.savings.toFixed(1) + '%';

            // Patterns
            document.getElementById('patternCount').textContent = memory.patterns.length;
            document.getElementById('patternsList').innerHTML = memory.patterns.length === 0
                ? '<div class="empty-state"><p>No patterns</p></div>'
                : memory.patterns.map(p => \`
                    <div class="memory-card" onclick="viewPattern('\${escapeAttr(p.id)}')">
                        <div class="memory-card-title">
                            <span>\${escapeHtml(truncate(p.pattern, 40))}</span>
                            <span class="confidence-badge \${p.confidence > 0.8 ? 'high' : ''}">\${(p.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div class="memory-card-meta">\${escapeHtml(p.category)}</div>
                    </div>
                \`).join('');

            // Episodes
            document.getElementById('episodeCount').textContent = memory.episodes.length;
            document.getElementById('episodesList').innerHTML = memory.episodes.length === 0
                ? '<div class="empty-state"><p>No episodes</p></div>'
                : memory.episodes.map(e => \`
                    <div class="memory-card" onclick="viewEpisode('\${escapeAttr(e.id)}')">
                        <div class="memory-card-title">
                            <span>\${escapeHtml(truncate(e.goal, 40))}</span>
                            <span class="confidence-badge" style="\${e.outcome === 'success' ? 'background: var(--vscode-testing-iconPassed); color: white;' : ''}">\${escapeHtml(e.outcome)}</span>
                        </div>
                        <div class="memory-card-meta">\${formatTime(e.timestamp)}</div>
                    </div>
                \`).join('');

            // Skills
            document.getElementById('skillCount').textContent = memory.skills.length;
            document.getElementById('skillsList').innerHTML = memory.skills.length === 0
                ? '<div class="empty-state"><p>No skills</p></div>'
                : memory.skills.map(s => \`
                    <div class="memory-card">
                        <div class="memory-card-title">
                            <span>\${escapeHtml(s.name)}</span>
                            <span class="confidence-badge">\${(s.successRate * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                \`).join('');
        }

        // Action handlers
        function viewTask(id) {
            vscode.postMessage({ type: 'viewTaskDetails', taskId: id });
        }

        function viewPattern(id) {
            vscode.postMessage({ type: 'viewPatternDetails', patternId: id });
        }

        function viewEpisode(id) {
            vscode.postMessage({ type: 'viewEpisodeDetails', episodeId: id });
        }

        function startSession() {
            const provider = document.getElementById('providerSelect').value;
            vscode.postMessage({ type: 'startSession', provider });
        }

        function stopSession() {
            vscode.postMessage({ type: 'stopSession' });
        }

        function pauseSession() {
            vscode.postMessage({ type: 'pauseSession' });
        }

        function resumeSession() {
            vscode.postMessage({ type: 'resumeSession' });
        }

        // Utility functions
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }

        function escapeAttr(text) {
            return (text || '').replace(/'/g, "\\\\'").replace(/"/g, '\\\\"');
        }

        function truncate(text, len) {
            return !text ? '' : text.length > len ? text.substring(0, len) + '...' : text;
        }

        function formatNumber(n) {
            return n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' :
                   n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
        }

        function formatTime(ts) {
            if (!ts) return '-';
            try {
                return new Date(ts).toLocaleTimeString();
            } catch {
                return ts;
            }
        }

        // Notify extension that webview is ready
        vscode.postMessage({ type: 'ready' });
    </script>
</body>
</html>`;
    }
}
