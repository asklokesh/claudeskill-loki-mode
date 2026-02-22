/**
 * Autonomi SDK - Main Client
 *
 * Core client class for interacting with the Autonomi Control Plane API.
 * Uses Node.js built-in fetch (Node 18+). No external dependencies.
 */
import type { ClientOptions, Project, Task, ApiKey, AuditEntry, AuditQueryParams, AuditVerifyResult, Run, RunEvent, Tenant } from './types.js';
export declare class AutonomiClient {
    private baseUrl;
    private token?;
    private timeout;
    constructor(options: ClientOptions);
    _request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T>;
    getStatus(): Promise<Record<string, unknown>>;
    listProjects(): Promise<Project[]>;
    getProject(projectId: number): Promise<Project>;
    createProject(name: string, description?: string): Promise<Project>;
    listTasks(projectId?: number, status?: string): Promise<Task[]>;
    getTask(taskId: number): Promise<Task>;
    createTask(projectId: number, title: string, description?: string): Promise<Task>;
    listApiKeys(): Promise<ApiKey[]>;
    createApiKey(name: string, role?: string): Promise<ApiKey & {
        token: string;
    }>;
    rotateApiKey(identifier: string, gracePeriodHours?: number): Promise<Record<string, unknown>>;
    deleteApiKey(identifier: string): Promise<void>;
    listRuns(projectId?: number, status?: string): Promise<Run[]>;
    getRun(runId: number): Promise<Run>;
    cancelRun(runId: number): Promise<Run>;
    replayRun(runId: number): Promise<Run>;
    getRunTimeline(runId: number): Promise<RunEvent[]>;
    listTenants(): Promise<Tenant[]>;
    getTenant(tenantId: number): Promise<Tenant>;
    createTenant(name: string, description?: string): Promise<Tenant>;
    deleteTenant(tenantId: number): Promise<void>;
    queryAudit(params?: AuditQueryParams): Promise<AuditEntry[]>;
    verifyAudit(): Promise<AuditVerifyResult>;
}
//# sourceMappingURL=client.d.ts.map