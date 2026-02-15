# OpenClaw Integration

Multi-agent coordination protocol integration for Loki Mode (v5.38.0).

## Overview

OpenClaw is a standardized protocol for multi-agent coordination across different AI systems. Loki Mode's OpenClaw bridge enables:

- **Cross-system orchestration** - Coordinate Loki Mode agents with other agent frameworks
- **Standardized communication** - Common message format for agent-to-agent communication
- **Shared task queues** - Distribute work across multiple orchestrators
- **State synchronization** - Keep agent state consistent across systems

Compatible with:
- AutoGPT
- MetaGPT
- CrewAI
- LangGraph agents
- Custom agent frameworks implementing the OpenClaw protocol

## Quick Start

```bash
# Enable OpenClaw bridge
export LOKI_OPENCLAW_ENABLED=true
export LOKI_OPENCLAW_ENDPOINT=http://openclaw-server:8080

# Start with OpenClaw integration
loki start --openclaw ./prd.md
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOKI_OPENCLAW_ENABLED` | `false` | Enable OpenClaw bridge |
| `LOKI_OPENCLAW_ENDPOINT` | - | OpenClaw server endpoint URL (required) |
| `LOKI_OPENCLAW_AGENT_ID` | `loki-{pid}` | Unique agent ID for this Loki instance |
| `LOKI_OPENCLAW_NAMESPACE` | `default` | Namespace for multi-tenant deployments |
| `LOKI_OPENCLAW_HEARTBEAT` | `30` | Heartbeat interval in seconds |
| `LOKI_OPENCLAW_TIMEOUT` | `120` | Message timeout in seconds |

### Configuration File

```yaml
# .loki/config.yaml
openclaw:
  enabled: true
  endpoint: http://openclaw-server:8080
  agent_id: loki-primary
  namespace: production
  heartbeat_interval: 30
  message_timeout: 120
  features:
    task_sharing: true
    state_sync: true
    capabilities_discovery: true
```

## OpenClaw Protocol

### Message Format

OpenClaw uses JSON messages over HTTP/WebSocket:

```json
{
  "protocol_version": "1.0",
  "message_type": "task_offer",
  "agent_id": "loki-12345",
  "namespace": "default",
  "timestamp": "2026-02-15T14:30:00Z",
  "payload": {
    "task_id": "task-abc123",
    "task_type": "code_review",
    "priority": "high",
    "deadline": "2026-02-15T16:00:00Z",
    "requirements": {
      "model": "opus",
      "skills": ["code_review", "security_audit"]
    }
  }
}
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `register` | Loki → OpenClaw | Agent registration with capabilities |
| `heartbeat` | Loki → OpenClaw | Keep-alive signal |
| `task_offer` | OpenClaw → Loki | Task offered for execution |
| `task_accept` | Loki → OpenClaw | Accept task offer |
| `task_reject` | Loki → OpenClaw | Reject task offer |
| `task_update` | Loki → OpenClaw | Progress update |
| `task_complete` | Loki → OpenClaw | Task completion |
| `state_sync` | Bidirectional | State synchronization |
| `capability_query` | OpenClaw → Loki | Query agent capabilities |

## Agent Registration

When OpenClaw bridge starts, Loki Mode registers with the OpenClaw server:

```json
{
  "message_type": "register",
  "agent_id": "loki-12345",
  "payload": {
    "name": "Loki Mode",
    "version": "5.42.2",
    "provider": "claude",
    "capabilities": [
      "full_stack_development",
      "code_review",
      "testing",
      "deployment",
      "business_operations"
    ],
    "agent_types": [
      "eng-frontend", "eng-backend", "eng-qa",
      "ops-devops", "ops-sre", "biz-marketing"
    ],
    "max_concurrent_tasks": 10,
    "supported_models": ["opus", "sonnet", "haiku"]
  }
}
```

## Task Coordination

### Receiving Tasks

Loki Mode receives tasks from OpenClaw:

```json
{
  "message_type": "task_offer",
  "payload": {
    "task_id": "external-task-123",
    "task_type": "code_review",
    "description": "Review authentication module",
    "files": ["src/auth.py", "tests/test_auth.py"],
    "priority": "high",
    "deadline": "2026-02-15T16:00:00Z"
  }
}
```

Loki Mode evaluates and responds:

```json
{
  "message_type": "task_accept",
  "payload": {
    "task_id": "external-task-123",
    "assigned_agent": "review-code",
    "estimated_duration": 600
  }
}
```

### Offering Tasks

Loki Mode can offer tasks to other agents via OpenClaw:

```json
{
  "message_type": "task_offer",
  "payload": {
    "task_id": "loki-task-456",
    "task_type": "data_analysis",
    "description": "Analyze user behavior logs",
    "requirements": {
      "skills": ["data_science", "ml"],
      "estimated_cost": 0.50
    }
  }
}
```

## State Synchronization

### Shared State

Loki Mode synchronizes key state with OpenClaw:

- Active agents and their status
- Task queue (pending, in-progress, completed)
- Session metadata (iteration, cost, uptime)
- Resource utilization (memory, CPU, tokens)

```json
{
  "message_type": "state_sync",
  "payload": {
    "session_status": "running",
    "iteration": 42,
    "agents_active": 12,
    "tasks_pending": 5,
    "tasks_in_progress": 8,
    "tasks_completed": 127,
    "cost_usd": 2.34
  }
}
```

### Conflict Resolution

When state conflicts occur:

1. **Last-write-wins** - Default strategy
2. **Merge** - For additive operations (task queue append)
3. **Reject** - For conflicting updates (agent status)

## Capability Discovery

Other agents can query Loki Mode's capabilities:

```json
{
  "message_type": "capability_query",
  "payload": {
    "query_type": "supports_task_type",
    "task_type": "frontend_development"
  }
}
```

Response:

```json
{
  "message_type": "capability_response",
  "payload": {
    "supported": true,
    "agent_types": ["eng-frontend"],
    "confidence": 0.95,
    "estimated_cost": 0.10
  }
}
```

## API Endpoints

Loki Mode exposes OpenClaw endpoints on the dashboard server:

```bash
# Get OpenClaw status
GET http://localhost:57374/api/openclaw/status

# Send message to OpenClaw server
POST http://localhost:57374/api/openclaw/send
{
  "message_type": "task_offer",
  "payload": {...}
}

# Query capabilities
GET http://localhost:57374/api/openclaw/capabilities

# Get received messages
GET http://localhost:57374/api/openclaw/messages?limit=50
```

## CLI Commands

```bash
# Check OpenClaw connection status
loki openclaw status

# Send test message
loki openclaw test

# List received messages
loki openclaw messages

# Query registered agents
loki openclaw agents

# Disconnect from OpenClaw
loki openclaw disconnect
```

## Examples

### Multi-System Workflow

```
MetaGPT (Planning)
    ↓
    Sends task via OpenClaw
    ↓
Loki Mode (Implementation)
    ↓
    Sends result via OpenClaw
    ↓
AutoGPT (Testing)
    ↓
    Sends report via OpenClaw
    ↓
CrewAI (Deployment)
```

### Task Distribution

```yaml
# Distribute tasks across multiple Loki instances
openclaw:
  enabled: true
  endpoint: http://openclaw-lb:8080
  features:
    task_sharing: true

# Loki instance 1 (frontend)
agents:
  - eng-frontend
  - eng-mobile

# Loki instance 2 (backend)
agents:
  - eng-backend
  - eng-database

# Loki instance 3 (ops)
agents:
  - ops-devops
  - ops-sre
```

### Cross-Framework Integration

```python
# AutoGPT sending task to Loki via OpenClaw
import requests

openclaw_url = "http://openclaw-server:8080/tasks"
task = {
    "task_type": "code_review",
    "description": "Review API implementation",
    "files": ["api/routes.py"],
    "target_agent": "loki-12345"
}

response = requests.post(openclaw_url, json=task)
print(f"Task sent: {response.json()}")

# Wait for completion
task_id = response.json()["task_id"]
while True:
    status = requests.get(f"{openclaw_url}/{task_id}").json()
    if status["status"] == "completed":
        print(f"Result: {status['result']}")
        break
    time.sleep(10)
```

## OpenClaw Server Setup

### Docker Deployment

```yaml
# docker-compose.yml
version: '3.8'
services:
  openclaw-server:
    image: openclaw/server:latest
    ports:
      - "8080:8080"
    environment:
      - OPENCLAW_LOG_LEVEL=info
      - OPENCLAW_AUTH_ENABLED=false
    volumes:
      - openclaw-data:/data

  loki-mode-1:
    image: asklokesh/loki-mode:latest
    environment:
      - LOKI_OPENCLAW_ENABLED=true
      - LOKI_OPENCLAW_ENDPOINT=http://openclaw-server:8080
      - LOKI_OPENCLAW_AGENT_ID=loki-frontend
    depends_on:
      - openclaw-server

  loki-mode-2:
    image: asklokesh/loki-mode:latest
    environment:
      - LOKI_OPENCLAW_ENABLED=true
      - LOKI_OPENCLAW_ENDPOINT=http://openclaw-server:8080
      - LOKI_OPENCLAW_AGENT_ID=loki-backend
    depends_on:
      - openclaw-server

volumes:
  openclaw-data:
```

### Kubernetes Deployment

```yaml
apiVersion: v1
kind: Service
metadata:
  name: openclaw-server
spec:
  selector:
    app: openclaw
  ports:
    - port: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: openclaw
  template:
    metadata:
      labels:
        app: openclaw
    spec:
      containers:
      - name: openclaw
        image: openclaw/server:latest
        ports:
        - containerPort: 8080
        env:
        - name: OPENCLAW_REDIS_URL
          value: redis://redis:6379
```

## Security

### Authentication

```bash
# Enable OpenClaw authentication
export LOKI_OPENCLAW_AUTH_TOKEN=your-secret-token

# Or use mutual TLS
export LOKI_OPENCLAW_TLS_CERT=/path/to/client-cert.pem
export LOKI_OPENCLAW_TLS_KEY=/path/to/client-key.pem
export LOKI_OPENCLAW_TLS_CA=/path/to/ca-cert.pem
```

### Authorization

```yaml
openclaw:
  authorization:
    enabled: true
    allowed_agents:
      - autogpt-production
      - metagpt-staging
    allowed_namespaces:
      - production
      - staging
```

### Encryption

```bash
# Use HTTPS for OpenClaw endpoint
export LOKI_OPENCLAW_ENDPOINT=https://openclaw-server:8443

# Enable message encryption
export LOKI_OPENCLAW_ENCRYPT_MESSAGES=true
export LOKI_OPENCLAW_ENCRYPTION_KEY=your-encryption-key
```

## Monitoring

### Metrics

OpenClaw bridge exposes metrics:

```
loki_openclaw_connected{agent_id="loki-12345"} 1
loki_openclaw_messages_sent_total{type="task_offer"} 42
loki_openclaw_messages_received_total{type="task_accept"} 38
loki_openclaw_tasks_completed_total 35
loki_openclaw_latency_seconds{operation="send"} 0.015
```

### Health Checks

```bash
# Check OpenClaw connection
curl http://localhost:57374/api/openclaw/health

# Response
{
  "connected": true,
  "server": "http://openclaw-server:8080",
  "last_heartbeat": "2026-02-15T14:30:00Z",
  "latency_ms": 15,
  "messages_pending": 0
}
```

## Troubleshooting

### Connection Issues

```bash
# Test OpenClaw server connectivity
curl http://openclaw-server:8080/health

# Check Loki OpenClaw status
loki openclaw status

# View connection logs
loki enterprise audit tail --event openclaw.connect

# Reconnect manually
loki openclaw reconnect
```

### Message Delivery Failures

```bash
# Check message queue
loki openclaw messages --status failed

# Retry failed messages
loki openclaw retry

# View OpenClaw logs
docker logs openclaw-server
```

### Performance Issues

```bash
# Check message latency
curl http://localhost:57374/metrics | grep loki_openclaw_latency

# Monitor message queue size
loki openclaw status | grep messages_pending

# Increase heartbeat interval to reduce traffic
export LOKI_OPENCLAW_HEARTBEAT=60
```

## Best Practices

1. **Use namespaces** to isolate environments (dev, staging, production)
2. **Enable authentication** in production deployments
3. **Monitor message latency** and set appropriate timeouts
4. **Implement retry logic** for transient failures
5. **Use task priorities** for critical workloads
6. **Set up health checks** for automatic reconnection
7. **Log all OpenClaw messages** for audit trail

## Limitations

- OpenClaw protocol is still evolving (v1.0 spec)
- Not all agent frameworks support OpenClaw yet
- Message size limited to 1MB
- Synchronous task completion only (async planned for v2.0)
- No built-in conflict resolution for complex state updates

## See Also

- [Agent Types](../references/agent-types.md) - 41 Loki Mode agent types
- [GitHub Integration](../skills/github-integration.md) - Issue and PR automation
- [Enterprise Features](../wiki/Enterprise-Features.md) - Multi-project orchestration
- [API Reference](../wiki/API-Reference.md) - Complete API documentation
