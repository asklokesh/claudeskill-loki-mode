# Enterprise Features

Comprehensive guide to Loki Mode's enterprise capabilities.

---

## Overview

All enterprise features are **opt-in** and disabled by default. This ensures:
- Zero configuration for individual developers
- No overhead for startups
- Full control for enterprises when needed

---

## Token-Based Authentication

Secure API access with scoped, expiring tokens.

### Enable Authentication

```bash
export LOKI_ENTERPRISE_AUTH=true
```

### Generate Tokens

```bash
# Basic token
loki enterprise token generate my-token

# With scopes and expiration
loki enterprise token generate ci-bot --scopes "read,write" --expires 30
```

**Output:**
```
Token generated successfully!

Name:    ci-bot
ID:      tok-abc123
Token:   loki_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Scopes:  read, write
Expires: 2026-03-02

IMPORTANT: Save this token - it won't be shown again!
```

### Manage Tokens

```bash
# List active tokens
loki enterprise token list

# List all tokens (including revoked)
loki enterprise token list --all

# Revoke a token
loki enterprise token revoke ci-bot
```

### Use Tokens with API

```bash
curl -H "Authorization: Bearer loki_xxx..." \
     http://localhost:8420/api/status
```

### Token Storage

Tokens are stored in `~/.loki/dashboard/tokens.json` with:
- SHA256 hashed token values
- 0600 file permissions
- Constant-time comparison (timing attack protection)

---

## Audit Logging

Compliance-ready audit trails for all operations.

### Enable Audit Logging

```bash
export LOKI_ENTERPRISE_AUDIT=true
```

### View Audit Logs

```bash
# Summary
loki enterprise audit summary

# Recent entries
loki enterprise audit tail
```

### Audit Log Format

Logs are stored in JSONL format at `~/.loki/dashboard/audit/`:

```json
{
  "timestamp": "2026-02-02T12:00:00Z",
  "action": "session.start",
  "user": "token:ci-bot",
  "resource": "session:sess-123",
  "details": {
    "prd": "my-app.md",
    "provider": "claude"
  },
  "ip": "192.168.1.100"
}
```

### Tracked Actions

| Action | Description |
|--------|-------------|
| `session.start` | Session started |
| `session.stop` | Session stopped |
| `session.pause` | Session paused |
| `token.generate` | Token created |
| `token.revoke` | Token revoked |
| `config.change` | Configuration changed |
| `project.register` | Project registered |
| `task.create` | Task created |
| `task.update` | Task modified |

### API Access

```bash
# Get audit entries
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:8420/api/enterprise/audit?limit=100"

# Get summary
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:8420/api/enterprise/audit/summary"
```

### Log Rotation

Logs are automatically rotated:
- Daily rotation
- 30-day retention (configurable)
- Compressed archives

---

## Docker Sandbox

Isolated execution environment for security-sensitive deployments.

### Enable Sandbox

```bash
# Via environment
export LOKI_SANDBOX_MODE=true
loki start ./prd.md

# Via CLI flag
loki start ./prd.md --sandbox
```

### Sandbox Commands

```bash
# Start sandbox container
loki sandbox start

# Check status
loki sandbox status

# View logs
loki sandbox logs --follow

# Interactive shell
loki sandbox shell

# Stop sandbox
loki sandbox stop

# Rebuild image
loki sandbox build
```

### Security Features

| Feature | Description |
|---------|-------------|
| **Seccomp Profiles** | System call filtering |
| **Resource Limits** | CPU/memory constraints |
| **Network Isolation** | Restricted network access |
| **Read-only Filesystem** | Immutable base system |
| **Non-root User** | Runs as `appuser` |

### Dockerfile

```dockerfile
FROM python:3.11-slim

# Create non-root user
RUN useradd -m -s /bin/bash appuser

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=appuser:appuser . /app
WORKDIR /app

# Switch to non-root user
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8420/health')"

EXPOSE 8420
CMD ["python", "-m", "dashboard.server"]
```

---

## Project Registry

Multi-project orchestration and cross-project learning.

### Register Projects

```bash
# Register a project
loki projects register ~/projects/my-app

# Auto-discover projects
loki projects discover

# List registered projects
loki projects list
```

### Project Health

```bash
# Check all projects
loki projects health

# Sync project data
loki projects sync
```

### Cross-Project Tasks

Query tasks across all registered projects:

```bash
curl "http://localhost:8420/api/registry/tasks?status=in_progress"
```

### Shared Learnings

Access learnings from all projects:

```bash
# CLI
loki memory list
loki memory search "authentication"

# API
curl "http://localhost:8420/api/registry/learnings"
```

---

## Staged Autonomy

Approval gates for sensitive operations.

### Enable Staged Autonomy

```bash
export LOKI_STAGED_AUTONOMY=true
```

### Autonomy Modes

| Mode | Description |
|------|-------------|
| `perpetual` | Full autonomy (default) |
| `checkpoint` | Approval at phase boundaries |
| `supervised` | Approval for each operation |

```bash
export LOKI_AUTONOMY_MODE=checkpoint
```

### Manual Approval

When staged autonomy is enabled:

1. Loki pauses before execution
2. Review proposed changes
3. Approve or reject

```bash
# Check pending approvals
loki status

# Approve and continue
loki resume

# Reject and stop
loki stop
```

---

## Path & Command Restrictions

### Allowed Paths

Restrict which directories agents can modify:

```bash
export LOKI_ALLOWED_PATHS="/app/src,/app/tests"
```

### Blocked Commands

Block dangerous shell commands:

```bash
export LOKI_BLOCKED_COMMANDS="rm -rf /,dd if=,mkfs,shutdown"
```

**Default Blocked:**
- `rm -rf /`
- `dd if=`
- `mkfs`
- `:(){ :|:& };:` (fork bomb)

---

## Enterprise Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  loki-mode:
    image: asklokesh/loki-mode:latest
    ports:
      - "8420:8420"
      - "57374:57374"
    environment:
      - LOKI_ENTERPRISE_AUTH=true
      - LOKI_ENTERPRISE_AUDIT=true
      - LOKI_API_HOST=0.0.0.0
    volumes:
      - loki-data:/home/appuser/.loki
      - ./projects:/projects:ro
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8420/health')"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  loki-data:
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: loki-mode
spec:
  replicas: 1
  selector:
    matchLabels:
      app: loki-mode
  template:
    metadata:
      labels:
        app: loki-mode
    spec:
      containers:
      - name: loki-mode
        image: asklokesh/loki-mode:latest
        ports:
        - containerPort: 8420
        - containerPort: 57374
        env:
        - name: LOKI_ENTERPRISE_AUTH
          value: "true"
        - name: LOKI_ENTERPRISE_AUDIT
          value: "true"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8420
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8420
          initialDelaySeconds: 5
          periodSeconds: 10
```

---

## Best Practices

### Security Checklist

- [ ] Enable `LOKI_ENTERPRISE_AUTH` for API access
- [ ] Enable `LOKI_ENTERPRISE_AUDIT` for compliance
- [ ] Use `LOKI_SANDBOX_MODE` for untrusted code
- [ ] Set `LOKI_ALLOWED_PATHS` to restrict access
- [ ] Configure `LOKI_BLOCKED_COMMANDS` for safety
- [ ] Use `LOKI_STAGED_AUTONOMY` for sensitive ops
- [ ] Rotate tokens regularly
- [ ] Review audit logs periodically

### Token Management

- Generate separate tokens for each integration
- Use minimal scopes (principle of least privilege)
- Set expiration dates
- Revoke unused tokens immediately
- Never commit tokens to version control

### Audit Compliance

- Enable audit logging before production use
- Configure log retention per compliance requirements
- Set up log forwarding to SIEM
- Regular audit log review
