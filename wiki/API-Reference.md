# API Reference

Complete REST API and WebSocket documentation.

---

## Overview

Loki Mode provides two API servers:

| Server | Port | Technology | Purpose |
|--------|------|------------|---------|
| **HTTP API** | 8420 | Deno/TypeScript | Session management, events, tasks |
| **Dashboard API** | Auto | Python/FastAPI | Project management, Kanban, registry |

---

## HTTP API Server (Port 8420)

Start the server:
```bash
loki serve
# or
loki api start --port 8420
```

### Authentication

When enterprise auth is enabled (`LOKI_ENTERPRISE_AUTH=true`):

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8420/api/status
```

---

### Health Endpoints

#### `GET /health`
Basic health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T12:00:00Z"
}
```

#### `GET /health/ready`
Kubernetes readiness probe.

#### `GET /health/live`
Kubernetes liveness probe.

---

### Status Endpoints

#### `GET /api/status`
Detailed system status.

**Response:**
```json
{
  "status": "running",
  "version": "5.13.1",
  "provider": "claude",
  "session": {
    "id": "abc123",
    "phase": "development",
    "iteration": 5,
    "startedAt": "2026-02-02T10:00:00Z"
  },
  "agents": {
    "active": 3,
    "total": 10
  }
}
```

---

### Session Endpoints

#### `POST /api/sessions`
Start a new session.

**Request Body:**
```json
{
  "prd": "path/to/prd.md",
  "provider": "claude",
  "options": {
    "parallel": false,
    "sandbox": false
  }
}
```

**Response:**
```json
{
  "id": "session-123",
  "status": "starting",
  "createdAt": "2026-02-02T12:00:00Z"
}
```

#### `GET /api/sessions`
List all sessions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

#### `GET /api/sessions/{id}`
Get session details.

#### `POST /api/sessions/{id}/stop`
Stop a session.

#### `POST /api/sessions/{id}/pause`
Pause a session.

#### `POST /api/sessions/{id}/resume`
Resume a paused session.

#### `POST /api/sessions/{id}/input`
Inject human input directive.

**Request Body:**
```json
{
  "message": "Focus on the authentication module first"
}
```

#### `DELETE /api/sessions/{id}`
Delete a session.

---

### Task Endpoints

#### `GET /api/tasks`
List all tasks.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: pending, active, completed, failed |
| `limit` | number | Max results |

#### `GET /api/tasks/active`
List currently active tasks.

#### `GET /api/tasks/queue`
List queued tasks.

#### `GET /api/sessions/{id}/tasks`
List tasks for a session.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `limit` | number | Max results |
| `offset` | number | Pagination offset |

#### `GET /api/sessions/{id}/tasks/{taskId}`
Get specific task details.

---

### Event Endpoints (SSE)

#### `GET /api/events`
Server-Sent Events stream for real-time updates.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | string | Filter by session |
| `types` | string | Comma-separated event types |
| `history` | boolean | Include historical events |
| `minLevel` | string | Minimum log level |

**Event Types:**
- `session.started`
- `session.completed`
- `session.failed`
- `phase.started`
- `phase.completed`
- `task.started`
- `task.completed`
- `agent.spawned`
- `agent.completed`
- `error`
- `warning`

**Example:**
```javascript
const events = new EventSource('/api/events?types=task.completed,error');
events.onmessage = (e) => console.log(JSON.parse(e.data));
```

#### `GET /api/events/history`
Get historical events.

#### `GET /api/events/stats`
Get event statistics.

---

## Dashboard API (FastAPI)

Start the dashboard:
```bash
loki dashboard start
```

### Project Endpoints

#### `GET /api/projects`
List all projects.

**Response:**
```json
[
  {
    "id": "proj-1",
    "name": "my-app",
    "path": "/path/to/my-app",
    "status": "active",
    "taskCount": 15
  }
]
```

#### `POST /api/projects`
Create a new project.

**Request Body:**
```json
{
  "name": "my-app",
  "path": "/path/to/my-app",
  "description": "My application"
}
```

#### `GET /api/projects/{id}`
Get project details.

#### `PUT /api/projects/{id}`
Update project.

#### `DELETE /api/projects/{id}`
Delete project.

---

### Task Endpoints (Dashboard)

#### `GET /api/tasks`
List all tasks (cross-project).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `project_id` | string | Filter by project |
| `status` | string | Filter by status |
| `column` | string | Filter by Kanban column |

#### `POST /api/tasks`
Create a task.

**Request Body:**
```json
{
  "project_id": "proj-1",
  "title": "Implement login",
  "description": "Add user authentication",
  "column": "backlog",
  "priority": "high"
}
```

#### `GET /api/tasks/{id}`
Get task details.

#### `PUT /api/tasks/{id}`
Update task.

#### `DELETE /api/tasks/{id}`
Delete task.

#### `POST /api/tasks/{id}/move`
Move task to different column.

**Request Body:**
```json
{
  "column": "in_progress",
  "position": 0
}
```

---

### WebSocket

#### `WS /ws`
Real-time dashboard updates.

**Message Types:**
```json
{
  "type": "task.updated",
  "data": {
    "id": "task-1",
    "column": "in_progress"
  }
}
```

---

### Registry Endpoints

#### `GET /api/registry/projects`
List registered projects.

#### `POST /api/registry/projects`
Register a project.

**Request Body:**
```json
{
  "path": "/path/to/project",
  "name": "my-project"
}
```

#### `GET /api/registry/projects/{id}`
Get registry entry.

#### `DELETE /api/registry/projects/{id}`
Unregister project.

#### `GET /api/registry/projects/{id}/health`
Check project health.

#### `GET /api/registry/discover`
Auto-discover projects with `.loki` directories.

#### `POST /api/registry/sync`
Sync all registered projects.

#### `GET /api/registry/tasks`
Query tasks across all projects.

#### `GET /api/registry/learnings`
Retrieve shared learnings.

---

### Enterprise Endpoints

#### `GET /api/enterprise/status`
Get enterprise feature status.

**Response:**
```json
{
  "auth_enabled": true,
  "audit_enabled": true,
  "features": ["tokens", "audit", "registry"]
}
```

#### `POST /api/enterprise/tokens`
Generate API token.

**Request Body:**
```json
{
  "name": "ci-bot",
  "scopes": ["read", "write"],
  "expires_days": 30
}
```

**Response:**
```json
{
  "id": "tok-123",
  "token": "loki_abc123...",
  "name": "ci-bot",
  "scopes": ["read", "write"],
  "expires_at": "2026-03-02T12:00:00Z"
}
```

#### `GET /api/enterprise/tokens`
List tokens.

#### `DELETE /api/enterprise/tokens/{id}`
Revoke token.

#### `GET /api/enterprise/audit`
Get audit log entries.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | string | Start timestamp |
| `end` | string | End timestamp |
| `action` | string | Filter by action |
| `limit` | number | Max results |

#### `GET /api/enterprise/audit/summary`
Get audit summary statistics.

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Session not found",
    "details": {}
  }
}
```

**Common Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request body |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

When rate limiting is enabled:

**Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706875200
```

**Rate Limit Exceeded Response:**
```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "retry_after": 60
  }
}
```
