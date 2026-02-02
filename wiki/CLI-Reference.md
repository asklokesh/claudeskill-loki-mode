# CLI Reference

Complete reference for all Loki Mode CLI commands.

---

## Global Options

```bash
loki [command] [options]

Options:
  --version, -v    Show version number
  --help, -h       Show help
```

---

## Core Commands

### `loki start`

Start autonomous execution.

```bash
loki start [PRD_FILE] [OPTIONS]
```

**Arguments:**
- `PRD_FILE` - Path to PRD markdown file (optional)

**Options:**
| Option | Description |
|--------|-------------|
| `--provider {claude\|codex\|gemini}` | Select AI provider |
| `--parallel` | Enable parallel mode with git worktrees |
| `--bg, --background` | Run in background |
| `--simple` | Force simple complexity (3 phases) |
| `--complex` | Force complex complexity (8 phases) |
| `--github` | Enable GitHub issue import |
| `--no-dashboard` | Disable web dashboard |
| `--sandbox` | Run in Docker sandbox |

**Examples:**
```bash
# Basic start
loki start ./my-prd.md

# With provider selection
loki start ./prd.md --provider codex

# Background with parallel mode
loki start ./prd.md --background --parallel

# In sandbox mode
loki start ./prd.md --sandbox
```

---

### `loki stop`

Stop execution immediately.

```bash
loki stop
```

---

### `loki pause`

Pause after current session completes.

```bash
loki pause
```

---

### `loki resume`

Resume paused execution.

```bash
loki resume
```

---

### `loki status`

Show current session status.

```bash
loki status
```

**Output includes:**
- Current phase
- Iteration count
- Active agents
- Task queue status

---

### `loki logs`

View session logs.

```bash
loki logs [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--follow, -f` | Follow logs in real-time |
| `--lines, -n N` | Show last N lines (default: 50) |

**Examples:**
```bash
loki logs
loki logs -f
loki logs -n 100
```

---

### `loki reset`

Reset session state.

```bash
loki reset [TYPE]
```

**Types:**
| Type | Description |
|------|-------------|
| `all` | Reset all state (default) |
| `retries` | Reset only retry counter |
| `failed` | Clear failed task queue |

**Examples:**
```bash
loki reset
loki reset retries
loki reset failed
```

---

## Provider Commands

### `loki provider`

Manage AI providers.

```bash
loki provider [SUBCOMMAND]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `show` | Display current provider |
| `set {claude\|codex\|gemini}` | Set default provider |
| `list` | List available providers |
| `info [provider]` | Get provider information |

**Examples:**
```bash
loki provider show
loki provider set codex
loki provider list
loki provider info gemini
```

---

## Dashboard Commands

### `loki dashboard`

Manage the web dashboard.

```bash
loki dashboard [SUBCOMMAND] [OPTIONS]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `start [--port PORT]` | Start dashboard server |
| `stop` | Stop dashboard server |
| `status` | Get dashboard status |
| `url [--format {url\|json}]` | Get dashboard URL |
| `open` | Open dashboard in browser |

**Examples:**
```bash
loki dashboard start
loki dashboard start --port 8080
loki dashboard open
loki dashboard status
```

---

## API Server Commands

### `loki serve` / `loki api`

Manage the HTTP API server.

```bash
loki serve [OPTIONS]
loki api [SUBCOMMAND] [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--port PORT` | Server port (default: 8420) |
| `--host HOST` | Server host (default: localhost) |
| `--no-auth` | Disable authentication |
| `--no-cors` | Disable CORS |

**Subcommands (api):**
| Command | Description |
|---------|-------------|
| `start` | Start API server |
| `stop` | Stop API server |
| `status` | Get server status |

**Examples:**
```bash
loki serve
loki serve --port 9000 --host 0.0.0.0
loki api start
loki api status
```

---

## GitHub Integration

### `loki issue`

Convert GitHub issues to PRDs.

```bash
loki issue [URL|NUMBER] [OPTIONS]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--repo OWNER/REPO` | Specify repository |
| `--start` | Start Loki Mode after generating PRD |
| `--dry-run` | Preview without saving |
| `--output FILE` | Custom output path |

**Examples:**
```bash
# From URL
loki issue https://github.com/owner/repo/issues/123

# From number (auto-detect repo)
loki issue 123

# Generate and start
loki issue 123 --start

# Preview only
loki issue 123 --dry-run
```

### `loki import`

Import GitHub issues as tasks.

```bash
loki import
```

---

## Memory Commands

### `loki memory`

Manage cross-project learnings.

```bash
loki memory [SUBCOMMAND] [OPTIONS]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `list` | List all learnings |
| `show {patterns\|mistakes\|successes}` | Display specific type |
| `search QUERY` | Search learnings |
| `stats` | Show statistics |

**Options:**
| Option | Description |
|--------|-------------|
| `--limit N` | Limit results |

**Examples:**
```bash
loki memory list
loki memory show patterns --limit 10
loki memory search "authentication"
loki memory stats
```

---

## Project Registry Commands

### `loki projects`

Manage cross-project registry.

```bash
loki projects [SUBCOMMAND]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `list` | List registered projects |
| `show PROJECT` | Show project details |
| `register PROJECT` | Register new project |
| `discover` | Auto-discover projects |
| `sync` | Sync project data |
| `health` | Check project health |

**Examples:**
```bash
loki projects list
loki projects discover
loki projects register ~/projects/my-app
loki projects health
```

---

## Notification Commands

### `loki notify`

Manage notifications.

```bash
loki notify [SUBCOMMAND] [MESSAGE]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `test [MESSAGE]` | Test all channels |
| `slack MESSAGE` | Send to Slack |
| `discord MESSAGE` | Send to Discord |
| `webhook MESSAGE` | Send to webhook |
| `status` | Show configuration |

**Examples:**
```bash
loki notify status
loki notify test "Hello from Loki!"
loki notify slack "Build complete"
```

---

## Sandbox Commands

### `loki sandbox`

Manage Docker sandbox.

```bash
loki sandbox [SUBCOMMAND]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `start` | Start sandbox container |
| `stop` | Stop sandbox |
| `status` | Check status |
| `logs [--follow]` | View logs |
| `shell` | Open interactive shell |
| `build` | Build sandbox image |

**Examples:**
```bash
loki sandbox start
loki sandbox logs -f
loki sandbox shell
```

---

## Enterprise Commands

### `loki enterprise`

Manage enterprise features.

```bash
loki enterprise [SUBCOMMAND]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `status` | Show enterprise status |
| `token generate NAME [OPTIONS]` | Create API token |
| `token list [--all]` | List tokens |
| `token revoke {ID\|NAME}` | Revoke token |
| `audit summary` | Audit summary |
| `audit tail` | Recent audit entries |

**Token Options:**
| Option | Description |
|--------|-------------|
| `--scopes SCOPES` | Token scopes (default: *) |
| `--expires DAYS` | Expiration in days |

**Examples:**
```bash
loki enterprise status
loki enterprise token generate ci-bot --scopes "read,write" --expires 30
loki enterprise token list
loki enterprise token revoke ci-bot
loki enterprise audit summary
```

---

## Configuration Commands

### `loki config`

Manage configuration.

```bash
loki config [SUBCOMMAND]
```

**Subcommands:**

| Command | Description |
|---------|-------------|
| `show` | Display current config |
| `init` | Initialize config file |
| `edit` | Edit in default editor |
| `path` | Show config file path |

**Examples:**
```bash
loki config show
loki config init
loki config edit
```

---

## Utility Commands

### `loki version`

Show version information.

```bash
loki version
loki --version
loki -v
```

### `loki help`

Show help information.

```bash
loki help
loki --help
loki -h
loki [command] --help
```
