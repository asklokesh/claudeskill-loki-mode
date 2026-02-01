import * as vscode from 'vscode';

/**
 * Represents the current Loki Mode session state
 */
export interface LokiSession {
    active: boolean;
    prdPath?: string;
    prdName?: string;
    provider: 'claude' | 'codex' | 'gemini';
    phase: string;
    startedAt?: string;
    pausedAt?: string;
    status: 'idle' | 'running' | 'paused' | 'error';
    errorMessage?: string;
    currentTask?: string;
    completedTasks: number;
    totalTasks: number;
}

/**
 * Tree item representing session information
 */
export class SessionItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly value: string,
        public readonly icon?: string,
        public readonly contextValue?: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.description = value;
        if (icon) {
            this.iconPath = new vscode.ThemeIcon(icon);
        }
        if (contextValue) {
            this.contextValue = contextValue;
        }
    }
}

/**
 * Tree data provider for Loki Mode session information
 * Shows PRD, provider, phase, duration, and current status
 */
export class SessionTreeProvider implements vscode.TreeDataProvider<SessionItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SessionItem | undefined | null | void> = new vscode.EventEmitter<SessionItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SessionItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private session: LokiSession = {
        active: false,
        provider: 'claude',
        phase: 'Idle',
        status: 'idle',
        completedTasks: 0,
        totalTasks: 0
    };

    private apiEndpoint: string;
    private durationInterval?: NodeJS.Timeout;

    constructor(apiEndpoint?: string) {
        this.apiEndpoint = apiEndpoint || 'http://localhost:9898';
    }

    /**
     * Refresh session data from API
     */
    async refresh(): Promise<void> {
        try {
            await this.fetchSession();
        } catch (error) {
            console.error('Failed to fetch session:', error);
        }
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update session directly (for use with WebSocket updates)
     */
    updateSession(session: Partial<LokiSession>): void {
        this.session = { ...this.session, ...session };
        this._onDidChangeTreeData.fire();
        this.updateDurationTimer();
    }

    /**
     * Get the current session state
     */
    getSession(): LokiSession {
        return { ...this.session };
    }

    /**
     * Check if a session is active
     */
    isActive(): boolean {
        return this.session.active;
    }

    /**
     * Set the API endpoint
     */
    setApiEndpoint(endpoint: string): void {
        this.apiEndpoint = endpoint;
    }

    getTreeItem(element: SessionItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SessionItem): Thenable<SessionItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        if (!this.session.active) {
            return Promise.resolve(this.getWelcomeView());
        }

        return Promise.resolve(this.getSessionItems());
    }

    private getWelcomeView(): SessionItem[] {
        const items: SessionItem[] = [];

        const welcomeItem = new SessionItem(
            'No Active Session',
            'Start a session to begin',
            'play',
            'welcome'
        );
        items.push(welcomeItem);

        const startItem = new SessionItem(
            'Start Session',
            'Select a PRD file',
            'rocket',
            'start-action'
        );
        startItem.command = {
            command: 'loki.start',
            title: 'Start Loki Mode Session'
        };
        items.push(startItem);

        return items;
    }

    private getSessionItems(): SessionItem[] {
        const items: SessionItem[] = [];

        // Status with appropriate icon
        const statusIcon = this.getStatusIcon();
        const statusItem = new SessionItem(
            'Status',
            this.formatStatus(),
            statusIcon,
            `session-${this.session.status}`
        );
        items.push(statusItem);

        // PRD file
        if (this.session.prdName || this.session.prdPath) {
            const prdItem = new SessionItem(
                'PRD',
                this.session.prdName || this.session.prdPath || 'Unknown',
                'file-text',
                'session-prd'
            );
            if (this.session.prdPath) {
                prdItem.command = {
                    command: 'vscode.open',
                    title: 'Open PRD',
                    arguments: [vscode.Uri.file(this.session.prdPath)]
                };
            }
            items.push(prdItem);
        }

        // Provider
        const providerIcon = this.getProviderIcon();
        const providerItem = new SessionItem(
            'Provider',
            this.formatProvider(),
            providerIcon,
            'session-provider'
        );
        items.push(providerItem);

        // Current phase
        const phaseItem = new SessionItem(
            'Phase',
            this.session.phase || 'Starting',
            'layers',
            'session-phase'
        );
        items.push(phaseItem);

        // Task progress
        const progressItem = new SessionItem(
            'Progress',
            `${this.session.completedTasks}/${this.session.totalTasks} tasks`,
            'checklist',
            'session-progress'
        );
        items.push(progressItem);

        // Duration
        if (this.session.startedAt) {
            const durationItem = new SessionItem(
                'Duration',
                this.formatDuration(),
                'clock',
                'session-duration'
            );
            items.push(durationItem);
        }

        // Current task
        if (this.session.currentTask) {
            const taskItem = new SessionItem(
                'Current Task',
                this.session.currentTask,
                'sync~spin',
                'session-current-task'
            );
            items.push(taskItem);
        }

        // Error message if present
        if (this.session.errorMessage) {
            const errorItem = new SessionItem(
                'Error',
                this.session.errorMessage,
                'error',
                'session-error'
            );
            items.push(errorItem);
        }

        // Actions separator
        const actionsHeader = new SessionItem(
            '---',
            'Actions',
            undefined,
            undefined
        );
        items.push(actionsHeader);

        // Action buttons based on status
        if (this.session.status === 'running') {
            const pauseItem = new SessionItem(
                'Pause Session',
                '',
                'debug-pause',
                'pause-action'
            );
            pauseItem.command = {
                command: 'loki.pause',
                title: 'Pause Session'
            };
            items.push(pauseItem);
        }

        if (this.session.status === 'paused') {
            const resumeItem = new SessionItem(
                'Resume Session',
                '',
                'debug-continue',
                'resume-action'
            );
            resumeItem.command = {
                command: 'loki.resume',
                title: 'Resume Session'
            };
            items.push(resumeItem);
        }

        if (this.session.active) {
            const stopItem = new SessionItem(
                'Stop Session',
                '',
                'debug-stop',
                'stop-action'
            );
            stopItem.command = {
                command: 'loki.stop',
                title: 'Stop Session'
            };
            items.push(stopItem);
        }

        return items;
    }

    private getStatusIcon(): string {
        switch (this.session.status) {
            case 'running':
                return 'sync~spin';
            case 'paused':
                return 'debug-pause';
            case 'error':
                return 'error';
            case 'idle':
            default:
                return 'circle-outline';
        }
    }

    private formatStatus(): string {
        switch (this.session.status) {
            case 'running':
                return 'Running';
            case 'paused':
                return 'Paused';
            case 'error':
                return 'Error';
            case 'idle':
            default:
                return 'Idle';
        }
    }

    private getProviderIcon(): string {
        switch (this.session.provider) {
            case 'claude':
                return 'hubot';
            case 'codex':
                return 'beaker';
            case 'gemini':
                return 'sparkle';
            default:
                return 'robot';
        }
    }

    private formatProvider(): string {
        switch (this.session.provider) {
            case 'claude':
                return 'Claude Code';
            case 'codex':
                return 'OpenAI Codex';
            case 'gemini':
                return 'Google Gemini';
            default:
                return this.session.provider;
        }
    }

    private formatDuration(): string {
        if (!this.session.startedAt) {
            return '0:00';
        }

        const start = new Date(this.session.startedAt).getTime();
        const now = Date.now();
        const diffMs = now - start;

        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }

    private updateDurationTimer(): void {
        // Clear existing timer
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
            this.durationInterval = undefined;
        }

        // Start new timer if session is running
        if (this.session.active && this.session.status === 'running') {
            this.durationInterval = setInterval(() => {
                this._onDidChangeTreeData.fire();
            }, 1000);
        }
    }

    private async fetchSession(): Promise<void> {
        try {
            const response = await fetch(`${this.apiEndpoint}/status`);
            if (response.ok) {
                const data = await response.json() as Record<string, unknown>;
                this.session = {
                    active: (data.active as boolean) ?? false,
                    prdPath: data.prdPath as string | undefined,
                    prdName: data.prdName as string | undefined,
                    provider: (data.provider as 'claude' | 'codex' | 'gemini') ?? 'claude',
                    phase: (data.phase as string) ?? 'Idle',
                    startedAt: data.startedAt as string | undefined,
                    pausedAt: data.pausedAt as string | undefined,
                    status: (data.status as 'idle' | 'running' | 'paused' | 'error') ?? 'idle',
                    errorMessage: data.errorMessage as string | undefined,
                    currentTask: data.currentTask as string | undefined,
                    completedTasks: (data.completedTasks as number) ?? 0,
                    totalTasks: (data.totalTasks as number) ?? 0
                };
                this.updateDurationTimer();
            } else {
                // API returned error - session may not exist
                this.session = {
                    active: false,
                    provider: 'claude',
                    phase: 'Idle',
                    status: 'idle',
                    completedTasks: 0,
                    totalTasks: 0
                };
            }
        } catch (error) {
            // API not available - this is normal when no session is running
            console.debug('Session API not available:', error);
            this.session = {
                active: false,
                provider: 'claude',
                phase: 'Idle',
                status: 'idle',
                completedTasks: 0,
                totalTasks: 0
            };
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        if (this.durationInterval) {
            clearInterval(this.durationInterval);
        }
    }
}
