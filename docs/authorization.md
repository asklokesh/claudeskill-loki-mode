# Authorization Guide

Role-based access control (RBAC) for Loki Mode (v5.37.0).

## Overview

Loki Mode implements a four-tier RBAC system that controls access to dashboard operations, API endpoints, and agent actions. RBAC integrates with both token-based authentication and OIDC/SSO.

## Role Definitions

### Admin

Full access to all operations and configuration.

**Scopes:** `*` (all)

**Permissions:**
- Start/stop/pause/resume sessions
- Create/update/delete tasks
- Modify configuration
- Generate/revoke tokens
- View audit logs
- Manage users and roles
- Access all API endpoints

**Use Cases:**
- System administrators
- DevOps engineers
- Project owners

### Operator

Day-to-day operations without configuration changes.

**Scopes:** `control`, `read`, `write`

**Permissions:**
- Start/stop/pause/resume sessions
- Create/update tasks
- View dashboard and logs
- Execute agent actions
- Access metrics endpoint

**Cannot:**
- Modify system configuration
- Manage tokens or users
- View audit logs (except their own actions)

**Use Cases:**
- Developers
- CI/CD pipelines
- Automated workflows

### Viewer

Read-only access to dashboard and logs.

**Scopes:** `read`

**Permissions:**
- View dashboard status
- View task queue
- View logs and events
- View metrics
- View agent activity

**Cannot:**
- Start/stop sessions
- Create/modify tasks
- Access audit logs
- Modify any state

**Use Cases:**
- Stakeholders
- Project managers
- External observers

### Auditor

Security and compliance monitoring.

**Scopes:** `read`, `audit`

**Permissions:**
- View dashboard status
- View task queue and logs
- Access audit logs
- View agent action history
- Export compliance reports

**Cannot:**
- Start/stop sessions
- Create/modify tasks
- Modify configuration

**Use Cases:**
- Security teams
- Compliance officers
- Internal auditors

## Configuration

### Enable RBAC

```bash
export LOKI_RBAC_ENABLED=true
loki start ./prd.md
```

### Assign Roles via Tokens

```bash
# Generate token with role
loki enterprise token generate dev-1 --role operator --expires 30
loki enterprise token generate viewer-1 --role viewer --expires 90
loki enterprise token generate auditor-1 --role auditor --expires 180
loki enterprise token generate admin-1 --role admin --expires 365
```

### Configuration File

```yaml
# .loki/config.yaml
enterprise:
  rbac:
    enabled: true
    default_role: viewer  # Default for OIDC users without role mapping
    enforce_mfa: false    # Require MFA for admin role (future)
  roles:
    admin:
      scopes: ["*"]
    operator:
      scopes: ["control", "read", "write"]
    viewer:
      scopes: ["read"]
    auditor:
      scopes: ["read", "audit"]
```

### OIDC Role Mapping

Map OIDC claims to Loki roles:

```yaml
enterprise:
  rbac:
    oidc_role_mapping:
      # Map Google Groups to roles
      google:
        admins@example.com: admin
        devops@example.com: operator
        viewers@example.com: viewer
      # Map Azure AD groups to roles
      azure:
        12345678-abcd-1234-abcd-123456789abc: admin  # Group Object ID
        87654321-dcba-4321-dcba-987654321cba: operator
```

## Scope-Based Access Control

### Scope Hierarchy

```
* (all)
├── control
│   ├── write
│   │   └── read
│   └── read
├── audit
│   └── read
└── read
```

Scopes are additive:
- `control` automatically includes `write` and `read`
- `write` automatically includes `read`
- `audit` requires separate grant (not included in `*`)

### Endpoint Permissions

| Endpoint | Required Scope | Roles with Access |
|----------|----------------|-------------------|
| `GET /api/status` | `read` | All roles |
| `GET /api/tasks` | `read` | All roles |
| `GET /api/logs` | `read` | All roles |
| `GET /metrics` | `read` | All roles |
| `POST /api/tasks` | `write` | Operator, Admin |
| `PATCH /api/tasks/:id` | `write` | Operator, Admin |
| `POST /api/control/start` | `control` | Operator, Admin |
| `POST /api/control/stop` | `control` | Operator, Admin |
| `GET /api/audit` | `audit` | Auditor, Admin |
| `POST /api/enterprise/tokens` | `*` | Admin only |
| `DELETE /api/enterprise/tokens/:id` | `*` | Admin only |
| `POST /api/config` | `*` | Admin only |

## Custom Roles

Define custom roles for specific use cases:

```yaml
# .loki/config.yaml
enterprise:
  rbac:
    custom_roles:
      # Read-only with metrics access
      metrics_viewer:
        scopes: ["read"]
        description: "View metrics and dashboard only"

      # Task management only
      task_manager:
        scopes: ["read", "write"]
        description: "Create and update tasks, no session control"

      # Security analyst
      security_analyst:
        scopes: ["read", "audit"]
        description: "View audit logs and security events"
```

Generate token with custom role:

```bash
loki enterprise token generate metrics-bot --role metrics_viewer
```

## Permission Checks

### CLI

```bash
# Check current permissions
loki enterprise rbac check

# Check specific permission
loki enterprise rbac check --scope control

# List permissions for role
loki enterprise rbac permissions --role operator
```

### API

```bash
# Check token permissions
curl -H "Authorization: Bearer $LOKI_TOKEN" \
     http://localhost:57374/api/enterprise/rbac/check

# Response:
{
  "role": "operator",
  "scopes": ["control", "read", "write"],
  "permissions": {
    "can_start_session": true,
    "can_stop_session": true,
    "can_create_tasks": true,
    "can_modify_config": false,
    "can_manage_tokens": false
  }
}
```

## Agent Action Authorization

Control which roles can trigger agent actions:

```yaml
enterprise:
  rbac:
    agent_actions:
      git_commit:
        required_scope: control
      cli_invoke:
        required_scope: control
      file_write:
        required_scope: write
      file_read:
        required_scope: read
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOKI_RBAC_ENABLED` | `false` | Enable RBAC system |
| `LOKI_RBAC_DEFAULT_ROLE` | `viewer` | Default role for OIDC users |
| `LOKI_RBAC_STRICT_MODE` | `false` | Deny access when role is undefined (vs default to viewer) |
| `LOKI_RBAC_AUDIT_CHECKS` | `true` | Log all permission checks to audit log |

## Examples

### Multi-Environment Setup

```bash
# Production - strict RBAC
export LOKI_RBAC_ENABLED=true
export LOKI_RBAC_STRICT_MODE=true
export LOKI_RBAC_DEFAULT_ROLE=viewer

# Development - relaxed RBAC
export LOKI_RBAC_ENABLED=false

# Staging - moderate RBAC
export LOKI_RBAC_ENABLED=true
export LOKI_RBAC_DEFAULT_ROLE=operator
```

### Team-Based Access

```yaml
# .loki/config.yaml
enterprise:
  rbac:
    oidc_role_mapping:
      google:
        engineering@company.com: operator
        qa@company.com: operator
        product@company.com: viewer
        security@company.com: auditor
        devops@company.com: admin
```

### Service Account Tokens

```bash
# CI/CD pipeline token
loki enterprise token generate github-actions \
  --role operator \
  --scopes "control,read,write" \
  --expires 365

# Monitoring system token
loki enterprise token generate datadog \
  --role viewer \
  --scopes "read" \
  --expires 9999

# Security scanner token
loki enterprise token generate security-scanner \
  --role auditor \
  --scopes "read,audit" \
  --expires 180
```

## Best Practices

### Principle of Least Privilege

1. Start with minimal permissions (viewer role)
2. Grant additional scopes only as needed
3. Use custom roles for specific use cases
4. Review and audit role assignments quarterly
5. Remove unused tokens immediately

### Role Assignment

1. Use OIDC role mapping for human users
2. Use token-based roles for automation
3. Separate production and development roles
4. Document role assignments and justifications
5. Rotate credentials regularly

### Auditing

1. Enable `LOKI_RBAC_AUDIT_CHECKS` to log permission checks
2. Review audit logs for unauthorized access attempts
3. Monitor for privilege escalation attempts
4. Alert on admin role usage in production
5. Generate compliance reports monthly

## Troubleshooting

### Permission Denied Errors

```bash
# Check token role and scopes
loki enterprise token list

# Verify required scope for operation
loki enterprise rbac permissions --role <your-role>

# Check audit log for denial reason
loki enterprise audit tail --event permission.denied

# Generate new token with correct role
loki enterprise token revoke <old-token>
loki enterprise token generate <name> --role operator
```

### OIDC Role Mapping Not Working

```bash
# Verify OIDC claims contain group information
# Check identity provider configuration

# Test with explicit token role first
loki enterprise token generate test-admin --role admin

# Check RBAC configuration
cat .loki/config.yaml | grep -A 10 rbac

# View OIDC claims in audit log
loki enterprise audit tail --event auth.oidc.success
```

### Scope Confusion

```bash
# List all scopes for a role
loki enterprise rbac permissions --role operator

# Check if scope is implied by hierarchy
# control -> write -> read
# audit (separate, not included in control)

# Test specific permission
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:57374/api/enterprise/rbac/check?scope=control
```

## Migration Guide

### Upgrading from Token-Only to RBAC

1. Enable RBAC in audit mode first:
```bash
export LOKI_RBAC_ENABLED=true
export LOKI_RBAC_STRICT_MODE=false  # Allow during migration
```

2. Assign roles to existing tokens:
```bash
for token in $(loki enterprise token list --format json | jq -r '.[].id'); do
  loki enterprise token update $token --role operator
done
```

3. Test permissions:
```bash
loki enterprise rbac check
```

4. Enable strict mode:
```bash
export LOKI_RBAC_STRICT_MODE=true
```

5. Monitor audit logs for denials and adjust roles as needed.

## See Also

- [Authentication Guide](authentication.md) - Token and OIDC setup
- [Audit Logging](audit-logging.md) - Track permission checks
- [Enterprise Features](../wiki/Enterprise-Features.md) - Complete enterprise guide
- [Network Security](network-security.md) - Additional security controls
