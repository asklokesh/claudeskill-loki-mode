# Alternative Installation Methods

The primary installation method is git clone (see [README](../README.md#installation)). These alternatives serve specific use cases.

---

## npm (Secondary)

**Status**: Working. Version tracks releases automatically.

```bash
npm install -g loki-mode
```

**Limitation**: Installs to `node_modules`, not `~/.claude/skills/`. To use as a Claude Code skill, you must symlink:

```bash
npm install -g loki-mode
ln -sf "$(npm root -g)/loki-mode" ~/.claude/skills/loki-mode
```

**Best for**: CI/CD pipelines, programmatic access via `loki` CLI.

---

## Homebrew (Secondary)

**Status**: Working. Tap and formula exist, version current.

```bash
brew tap asklokesh/tap
brew install loki-mode
```

**Limitation**: Installs the `loki` CLI binary only. Does NOT install the Claude Code skill. To use with Claude Code, also run:

```bash
git clone https://github.com/asklokesh/loki-mode.git ~/.claude/skills/loki-mode
```

**Best for**: Users who want the `loki` CLI wrapper for autonomous mode (`loki start`, `loki stop`, `loki cleanup`).

---

## Docker (Secondary)

**Status**: Image exists on Docker Hub. Tags: `latest`, version-specific (e.g., `5.49.1`).

```bash
docker pull asklokesh/loki-mode:latest
```

**Limitation**: Claude Code is an interactive CLI that requires API keys and terminal access. Running it inside a Docker container is not the standard workflow. Docker is useful for:

- CI/CD sandbox execution (running `loki` in isolated environments)
- Testing Loki Mode without modifying your local system
- Air-gapped environments with pre-built images

**Not recommended for**: Interactive Claude Code sessions. Use the git clone method instead.

See [DOCKER_README.md](../DOCKER_README.md) for Docker-specific usage instructions.

---

## GitHub Action (Secondary)

**Status**: Working. Adds automated AI code review to pull requests.

```yaml
# .github/workflows/loki-review.yml
name: Loki Code Review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: asklokesh/loki-mode@v5
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          mode: review
          provider: claude
          max_iterations: 3
          budget_limit: '5.00'
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

**Prerequisites:**
- API key for your provider (set as repository secret): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY`
- The action auto-installs `loki-mode` and `@anthropic-ai/claude-code`

**Action Inputs:**

| Input | Default | Description |
|-------|---------|-------------|
| `mode` | `review` | `review`, `fix`, or `test` |
| `provider` | `claude` | `claude`, `codex`, or `gemini` |
| `budget_limit` | `5.00` | Max cost in USD |
| `max_iterations` | `3` | Max RARV cycles |
| `github_token` | (required) | GitHub token for PR comments |
| `prd_file` | | Path to PRD file (for fix/test modes) |

**Modes:**

| Mode | Description |
|------|-------------|
| `review` | Analyze PR diff, post structured review as PR comment |
| `fix` | Automatically fix issues found in the codebase |
| `test` | Run autonomous test generation and validation |

**Best for**: Automated PR review and CI/CD integration.

---

## GitHub Release Download (Secondary)

**Status**: Working. Release assets available for each version.

```bash
# Download and extract to skills directory
curl -sL https://github.com/asklokesh/loki-mode/archive/refs/tags/v5.49.1.tar.gz | tar xz
mv loki-mode-5.49.1 ~/.claude/skills/loki-mode
```

**Best for**: Offline or air-gapped environments, pinned version deployments.

---

## VS Code Extension (Secondary)

**Status**: Available on VS Code Marketplace.

Search for "Loki Mode" in VS Code Extensions, or:

```bash
code --install-extension asklokesh.loki-mode
```

**Best for**: VS Code users who want dashboard integration within their editor.
