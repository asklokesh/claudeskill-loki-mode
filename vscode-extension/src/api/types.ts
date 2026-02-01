/**
 * Loki Mode API Types
 * TypeScript interfaces for the HTTP API and SSE events
 */

// =============================================================================
// Core Domain Types
// =============================================================================

/**
 * Execution phase in the Loki workflow
 */
export type Phase =
    | 'idle'
    | 'initializing'
    | 'planning'
    | 'implementing'
    | 'testing'
    | 'reviewing'
    | 'deploying'
    | 'completed'
    | 'failed'
    | 'paused';

/**
 * Task status within a session
 */
export type TaskStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'skipped';

/**
 * Session state
 */
export type SessionState =
    | 'running'
    | 'paused'
    | 'stopped'
    | 'completed'
    | 'failed';

/**
 * Provider type for multi-provider support
 */
export type Provider = 'claude' | 'codex' | 'gemini';

/**
 * A task within the Loki workflow
 */
export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    phase: Phase;
    startedAt?: string;
    completedAt?: string;
    error?: string;
    output?: string;
    subtasks?: Task[];
}

/**
 * Current session status (matches server response format)
 * Server returns: { status, pid, provider, prd, startedAt, uptime, dashboard }
 */
export interface SessionStatus {
    status: 'running' | 'stopped' | 'idle';
    pid: number | null;
    provider: Provider | null;
    prd: string | null;
    startedAt: string | null;
    uptime: number | null;
    dashboard: string | null;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Base API response
 */
export interface ApiResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
    status: 'ok' | 'error';
    version: string;
    uptime: number;
    timestamp: string;
}

/**
 * Status endpoint response
 */
export interface StatusResponse extends ApiResponse {
    data: SessionStatus;
}

/**
 * Start session response
 */
export interface StartResponse extends ApiResponse {
    data: {
        sessionId: string;
        provider: Provider;
        prdPath: string;
        startedAt: string;
    };
}

/**
 * Stop session response
 */
export interface StopResponse extends ApiResponse {
    data: {
        sessionId: string;
        stoppedAt: string;
        tasksCompleted: number;
        totalTasks: number;
    };
}

/**
 * Pause session response
 */
export interface PauseResponse extends ApiResponse {
    data: {
        sessionId: string;
        pausedAt: string;
        phase: Phase;
    };
}

/**
 * Resume session response
 */
export interface ResumeResponse extends ApiResponse {
    data: {
        sessionId: string;
        resumedAt: string;
        phase: Phase;
    };
}

/**
 * Input injection response
 */
export interface InputResponse extends ApiResponse {
    data: {
        received: boolean;
        queuePosition?: number;
    };
}

// =============================================================================
// API Request Types
// =============================================================================

/**
 * Start session request body
 */
export interface StartRequest {
    prd: string;
    provider?: Provider;
    options?: StartOptions;
}

/**
 * Options for starting a session
 */
export interface StartOptions {
    dryRun?: boolean;
    verbose?: boolean;
    skipTests?: boolean;
    skipDeploy?: boolean;
    parallel?: boolean;
    maxAgents?: number;
}

/**
 * Input injection request body
 */
export interface InputRequest {
    input: string;
    targetTask?: string;
}

// =============================================================================
// SSE Event Types
// =============================================================================

/**
 * Base SSE event
 */
export interface BaseEvent {
    type: string;
    timestamp: string;
    sessionId: string;
}

/**
 * Session started event
 */
export interface SessionStartedEvent extends BaseEvent {
    type: 'session:started';
    data: {
        provider: Provider;
        prdPath: string;
    };
}

/**
 * Session stopped event
 */
export interface SessionStoppedEvent extends BaseEvent {
    type: 'session:stopped';
    data: {
        reason: 'user' | 'completed' | 'error';
        tasksCompleted: number;
        totalTasks: number;
    };
}

/**
 * Session paused event
 */
export interface SessionPausedEvent extends BaseEvent {
    type: 'session:paused';
    data: {
        phase: Phase;
    };
}

/**
 * Session resumed event
 */
export interface SessionResumedEvent extends BaseEvent {
    type: 'session:resumed';
    data: {
        phase: Phase;
    };
}

/**
 * Phase started event
 */
export interface PhaseStartedEvent extends BaseEvent {
    type: 'phase:started';
    data: {
        phase: Phase;
        previousPhase: Phase;
    };
}

/**
 * Phase completed event
 */
export interface PhaseCompletedEvent extends BaseEvent {
    type: 'phase:completed';
    data: {
        phase: Phase;
        duration: number;
        tasksCompleted: number;
    };
}

/**
 * Task started event
 */
export interface TaskStartedEvent extends BaseEvent {
    type: 'task:started';
    data: {
        task: Task;
    };
}

/**
 * Task progress event
 */
export interface TaskProgressEvent extends BaseEvent {
    type: 'task:progress';
    data: {
        taskId: string;
        progress: number;
        message: string;
    };
}

/**
 * Task completed event
 */
export interface TaskCompletedEvent extends BaseEvent {
    type: 'task:completed';
    data: {
        task: Task;
        duration: number;
    };
}

/**
 * Task failed event
 */
export interface TaskFailedEvent extends BaseEvent {
    type: 'task:failed';
    data: {
        task: Task;
        error: string;
        recoverable: boolean;
    };
}

/**
 * Log event for real-time output
 */
export interface LogEvent extends BaseEvent {
    type: 'log';
    data: {
        level: 'debug' | 'info' | 'warn' | 'error';
        message: string;
        source?: string;
    };
}

/**
 * Error event
 */
export interface ErrorEvent extends BaseEvent {
    type: 'error';
    data: {
        code: string;
        message: string;
        fatal: boolean;
    };
}

/**
 * Heartbeat event for connection health
 */
export interface HeartbeatEvent extends BaseEvent {
    type: 'heartbeat';
    data: {
        uptime: number;
        memoryUsage: number;
    };
}

/**
 * Status poll event (used by VS Code extension polling)
 */
export interface StatusPollEvent {
    type: 'status';
    timestamp: string;
    data: StatusResponse;
}

/**
 * Connection error event (used by VS Code extension polling)
 */
export interface ConnectionErrorEvent {
    type: 'connection:error';
    timestamp: string;
    data: {
        message: string;
        code: string;
    };
}

/**
 * Union type of all SSE events
 */
export type LokiEvent =
    | SessionStartedEvent
    | SessionStoppedEvent
    | SessionPausedEvent
    | SessionResumedEvent
    | PhaseStartedEvent
    | PhaseCompletedEvent
    | TaskStartedEvent
    | TaskProgressEvent
    | TaskCompletedEvent
    | TaskFailedEvent
    | LogEvent
    | ErrorEvent
    | HeartbeatEvent
    | StatusPollEvent
    | ConnectionErrorEvent;

/**
 * Event type string literals
 */
export type LokiEventType = LokiEvent['type'];

/**
 * Callback for SSE event handling
 */
export type EventCallback = (event: LokiEvent) => void;

/**
 * Typed event callbacks for specific event types
 */
export interface EventCallbacks {
    'session:started'?: (event: SessionStartedEvent) => void;
    'session:stopped'?: (event: SessionStoppedEvent) => void;
    'session:paused'?: (event: SessionPausedEvent) => void;
    'session:resumed'?: (event: SessionResumedEvent) => void;
    'phase:started'?: (event: PhaseStartedEvent) => void;
    'phase:completed'?: (event: PhaseCompletedEvent) => void;
    'task:started'?: (event: TaskStartedEvent) => void;
    'task:progress'?: (event: TaskProgressEvent) => void;
    'task:completed'?: (event: TaskCompletedEvent) => void;
    'task:failed'?: (event: TaskFailedEvent) => void;
    'log'?: (event: LogEvent) => void;
    'error'?: (event: ErrorEvent) => void;
    'heartbeat'?: (event: HeartbeatEvent) => void;
    'status'?: (event: StatusPollEvent) => void;
    'connection:error'?: (event: ConnectionErrorEvent) => void;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Disposable interface for cleanup
 */
export interface Disposable {
    dispose(): void;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
    baseUrl: string;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}

/**
 * Error types from the API
 */
export interface ApiError extends Error {
    code: string;
    statusCode?: number;
    response?: unknown;
}
