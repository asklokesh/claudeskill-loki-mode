import * as vscode from 'vscode';

/**
 * Represents a task in the Loki Mode task tree
 */
export interface LokiTask {
    id: string;
    title: string;
    description: string;
    status: 'in_progress' | 'pending' | 'completed';
    startedAt?: string;
    completedAt?: string;
}

/**
 * Tree item representing a task or status group
 */
export class TaskItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly task?: LokiTask,
        public readonly isGroup: boolean = false
    ) {
        super(label, collapsibleState);

        if (task) {
            this.tooltip = task.description;
            this.description = this.getStatusDescription(task.status);
            this.contextValue = `task-${task.status}`;
            this.iconPath = this.getStatusIcon(task.status);
            this.id = task.id;
        } else if (isGroup) {
            this.contextValue = 'taskGroup';
        }
    }

    private getStatusIcon(status: string): vscode.ThemeIcon {
        switch (status) {
            case 'in_progress':
                return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
            case 'pending':
                return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.blue'));
            case 'completed':
                return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getStatusDescription(status: string): string {
        switch (status) {
            case 'in_progress':
                return 'Running';
            case 'pending':
                return 'Waiting';
            case 'completed':
                return 'Done';
            default:
                return '';
        }
    }
}

/**
 * Tree data provider for Loki Mode tasks
 * Groups tasks by status: In Progress, Pending, Completed
 */
export class TaskTreeProvider implements vscode.TreeDataProvider<TaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private tasks: LokiTask[] = [];
    private apiEndpoint: string;

    constructor(apiEndpoint?: string) {
        this.apiEndpoint = apiEndpoint || 'http://localhost:9898';
    }

    /**
     * Refresh the task tree by fetching latest data from API
     */
    async refresh(): Promise<void> {
        try {
            await this.fetchTasks();
        } catch (error) {
            console.error('Failed to fetch tasks:', error);
        }
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update tasks directly (for use with WebSocket updates)
     */
    updateTasks(tasks: LokiTask[]): void {
        this.tasks = tasks;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Set the API endpoint
     */
    setApiEndpoint(endpoint: string): void {
        this.apiEndpoint = endpoint;
    }

    /**
     * Get the count of tasks by status
     */
    getTaskCounts(): { inProgress: number; pending: number; completed: number; total: number } {
        const inProgress = this.tasks.filter(t => t.status === 'in_progress').length;
        const pending = this.tasks.filter(t => t.status === 'pending').length;
        const completed = this.tasks.filter(t => t.status === 'completed').length;
        return {
            inProgress,
            pending,
            completed,
            total: this.tasks.length
        };
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TaskItem): Thenable<TaskItem[]> {
        if (!element) {
            // Root level - return status groups
            return Promise.resolve(this.getStatusGroups());
        }

        // Return tasks for this status group
        return Promise.resolve(this.getTasksForGroup(element.label as string));
    }

    private getStatusGroups(): TaskItem[] {
        const groups: TaskItem[] = [];
        const counts = this.getTaskCounts();

        // Only show groups that have tasks
        if (counts.inProgress > 0) {
            const item = new TaskItem(
                'In Progress',
                vscode.TreeItemCollapsibleState.Expanded,
                undefined,
                true
            );
            item.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
            item.description = `${counts.inProgress}`;
            groups.push(item);
        }

        if (counts.pending > 0) {
            const item = new TaskItem(
                'Pending',
                vscode.TreeItemCollapsibleState.Expanded,
                undefined,
                true
            );
            item.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.blue'));
            item.description = `${counts.pending}`;
            groups.push(item);
        }

        if (counts.completed > 0) {
            const item = new TaskItem(
                'Completed',
                vscode.TreeItemCollapsibleState.Collapsed,
                undefined,
                true
            );
            item.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
            item.description = `${counts.completed}`;
            groups.push(item);
        }

        // Show empty state if no tasks
        if (groups.length === 0) {
            const emptyItem = new TaskItem(
                'No tasks yet',
                vscode.TreeItemCollapsibleState.None,
                undefined,
                false
            );
            emptyItem.iconPath = new vscode.ThemeIcon('info');
            emptyItem.description = 'Start a session to see tasks';
            groups.push(emptyItem);
        }

        return groups;
    }

    private getTasksForGroup(groupLabel: string): TaskItem[] {
        let statusFilter: string;

        switch (groupLabel) {
            case 'In Progress':
                statusFilter = 'in_progress';
                break;
            case 'Pending':
                statusFilter = 'pending';
                break;
            case 'Completed':
                statusFilter = 'completed';
                break;
            default:
                return [];
        }

        return this.tasks
            .filter(task => task.status === statusFilter)
            .map(task => new TaskItem(
                task.title,
                vscode.TreeItemCollapsibleState.None,
                task,
                false
            ));
    }

    private async fetchTasks(): Promise<void> {
        try {
            const response = await fetch(`${this.apiEndpoint}/tasks`);
            if (response.ok) {
                const data = await response.json() as { tasks?: LokiTask[] };
                this.tasks = data.tasks || [];
            } else {
                // API not available or error - keep existing tasks
                console.warn('Task API returned non-OK status:', response.status);
            }
        } catch (error) {
            // API not available - this is normal when no session is running
            console.debug('Task API not available:', error);
        }
    }
}
