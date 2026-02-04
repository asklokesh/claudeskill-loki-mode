# Loki Mode Dashboard Feature Matrix

Complete documentation of all dashboard features and their availability across contexts.

## Contexts

| Context | Description | Theme Support | Full Features |
|---------|-------------|---------------|---------------|
| Browser | Standalone in browser | All 5 themes | Yes |
| VS Code Webview | Embedded in VS Code | vscode-light, vscode-dark, high-contrast | Yes |
| CLI Embedded | Future: CLI HTML output | light, dark | Limited |

## Components

### Task Board (loki-task-board)

Kanban-style task board with drag-and-drop support.

| Feature | Description | Browser | VS Code | CLI | Notes |
|---------|-------------|---------|---------|-----|-------|
| View Tasks | Display tasks in Kanban columns | Yes | Yes | Yes | Core feature |
| Create Task | Add new tasks via button | Yes | Yes | No | Emits `add-task` event |
| Move Task | Drag-drop between columns | Yes | Yes | No | Disabled in readonly mode |
| Filter Tasks | Filter by project ID | Yes | Yes | Yes | Via `project-id` attribute |
| Readonly Mode | Disable all editing | Yes | Yes | N/A | Via `readonly` attribute |
| Task Click | Click to view details | Yes | Yes | Yes | Emits `task-click` event |
| Refresh | Reload tasks from API | Yes | Yes | Yes | Via refresh button |
| Keyboard Nav | Navigate with arrow keys | Yes | Yes | Limited | Tab through cards |

**Attributes:**
- `api-url` - API base URL (default: http://localhost:8420)
- `project-id` - Filter by project
- `theme` - Theme override
- `readonly` - Disable editing

**Events:**
- `task-moved` - Task moved between columns
- `add-task` - Add button clicked
- `task-click` - Task card clicked

---

### Session Control (loki-session-control)

Control panel for Loki Mode session management.

| Feature | Description | Browser | VS Code | CLI | Notes |
|---------|-------------|---------|---------|-----|-------|
| View Status | Display session status | Yes | Yes | Yes | Core feature |
| Start Session | Start new session | Yes | Yes | No | Emits `session-start` event |
| Stop Session | Stop running session | Yes | Yes | Yes | Emits `session-stop` event |
| Pause Session | Pause running session | Yes | Yes | No | Emits `session-pause` event |
| Resume Session | Resume paused session | Yes | Yes | No | Emits `session-resume` event |
| Compact Mode | Minimal display | Yes | Yes | Yes | Via `compact` attribute |
| Connection Status | Show API connection | Yes | Yes | Yes | Only in full mode |
| Uptime Display | Show session duration | Yes | Yes | Yes | Only in full mode |
| Agent Count | Show active agents | Yes | Yes | Yes | Only in full mode |

**Attributes:**
- `api-url` - API base URL
- `theme` - Theme override
- `compact` - Use compact display

**Events:**
- `session-start` - Start clicked
- `session-pause` - Pause clicked
- `session-resume` - Resume clicked
- `session-stop` - Stop clicked

---

### Log Stream (loki-log-stream)

Real-time log display with filtering and export.

| Feature | Description | Browser | VS Code | CLI | Notes |
|---------|-------------|---------|---------|-----|-------|
| View Logs | Display log messages | Yes | Yes | Yes | Core feature |
| Filter Text | Search in log content | Yes | Yes | Yes | Real-time filter |
| Filter Level | Filter by severity | Yes | Yes | Yes | info/warning/error/etc |
| Clear Logs | Remove all logs | Yes | Yes | Yes | Via clear button |
| Download Logs | Export as text file | Yes | Yes | No | Browser download API |
| Auto-scroll | Scroll to latest | Yes | Yes | Yes | Toggle button |
| Level Colors | Color-coded levels | Yes | Yes | Yes | Theme-aware colors |
| Add Log API | Programmatic add | Yes | Yes | Yes | `addLog(msg, level)` |
| Clear API | Programmatic clear | Yes | Yes | Yes | `clear()` |
| Max Lines | Limit log buffer | Yes | Yes | Yes | Via `max-lines` attr |

**Attributes:**
- `api-url` - API base URL
- `max-lines` - Maximum lines to keep (default: 500)
- `auto-scroll` - Enable auto-scroll
- `theme` - Theme override
- `log-file` - Path for file-based polling

**Events:**
- `log-received` - New log added
- `logs-cleared` - Logs cleared

**Public API:**
- `addLog(message, level)` - Add a log entry
- `clear()` - Clear all logs

---

### Memory Browser (loki-memory-browser)

Browser for the memory system (episodic, semantic, procedural).

| Feature | Description | Browser | VS Code | CLI | Notes |
|---------|-------------|---------|---------|-----|-------|
| View Summary | Memory stats overview | Yes | Yes | Yes | Default tab |
| View Episodes | Browse episodic memories | Yes | Yes | Yes | Interaction traces |
| View Patterns | Browse semantic patterns | Yes | Yes | Yes | Learned patterns |
| View Skills | Browse procedural skills | Yes | Yes | Yes | Learned procedures |
| Tab Navigation | Switch between tabs | Yes | Yes | Yes | Click or keyboard |
| Detail Panel | View item details | Yes | Yes | Limited | Slide-out panel |
| Token Economics | Usage statistics | Yes | Yes | Yes | In summary |
| Consolidation | Trigger memory consolidation | Yes | Yes | No | Admin action |
| Keyboard Tabs | Arrow key navigation | Yes | Yes | Limited | Left/right arrows |
| Search | Search within tab | Planned | Planned | No | Future feature |

**Attributes:**
- `api-url` - API base URL
- `theme` - Theme override
- `tab` - Initial tab (summary/episodes/patterns/skills)

**Events:**
- `episode-select` - Episode clicked
- `pattern-select` - Pattern clicked
- `skill-select` - Skill clicked

---

## Theme System

### Available Themes

| Theme | Description | Contexts | Notes |
|-------|-------------|----------|-------|
| light | Anthropic light design | Browser, CLI | Default for light system preference |
| dark | Anthropic dark design | Browser, CLI | Default for dark system preference |
| high-contrast | WCAG AA compliant | VS Code, Browser | Pure black/white |
| vscode-light | Maps VS Code variables | VS Code | Auto-detected |
| vscode-dark | Maps VS Code variables | VS Code | Auto-detected |

### Theme Features

| Feature | Description | Browser | VS Code | CLI | Notes |
|---------|-------------|---------|---------|-----|-------|
| Light Theme | Standard light mode | Yes | Yes | Yes | |
| Dark Theme | Standard dark mode | Yes | Yes | Yes | |
| High Contrast | Accessibility mode | Yes | Yes | No | |
| VS Code Light | VS Code integration | N/A | Yes | N/A | Auto-detected |
| VS Code Dark | VS Code integration | N/A | Yes | N/A | Auto-detected |
| Theme Toggle | Switch themes | Yes | Yes | No | Cmd+Shift+D |
| Theme Persist | Save to localStorage | Yes | No | No | VS Code uses native |
| Theme Event | Change notification | Yes | Yes | Yes | `loki-theme-change` |
| System Detect | Detect OS preference | Yes | No | Yes | VS Code uses own |

---

## Keyboard Shortcuts

### Navigation

| Shortcut | Action | Browser | VS Code | CLI | Notes |
|----------|--------|---------|---------|-----|-------|
| ArrowDown | Next item | Yes | Yes | Limited | Within lists |
| ArrowUp | Previous item | Yes | Yes | Limited | Within lists |
| Tab | Next section | Yes | Yes | Yes | Standard nav |
| Shift+Tab | Previous section | Yes | Yes | Yes | Standard nav |
| Enter | Confirm/activate | Yes | Yes | Yes | Buttons, cards |
| Escape | Cancel/close | Yes | Yes | Yes | Dialogs, panels |

### Actions

| Shortcut | Action | Browser | VS Code | CLI | Notes |
|----------|--------|---------|---------|-----|-------|
| Cmd+R | Refresh | Yes | Conflict | No | May conflict with VS Code |
| Cmd+K | Search | Planned | Conflict | No | VS Code command palette |
| Cmd+S | Save | Planned | Conflict | No | |
| Cmd+W | Close | Planned | Conflict | No | |

### Theme

| Shortcut | Action | Browser | VS Code | CLI | Notes |
|----------|--------|---------|---------|-----|-------|
| Cmd+Shift+D | Toggle theme | Yes | Yes | No | |

### Tasks

| Shortcut | Action | Browser | VS Code | CLI | Notes |
|----------|--------|---------|---------|-----|-------|
| Cmd+N | Create task | Planned | Conflict | No | |
| Cmd+Enter | Complete task | Planned | Yes | No | |

### View

| Shortcut | Action | Browser | VS Code | CLI | Notes |
|----------|--------|---------|---------|-----|-------|
| Cmd+Shift+L | Toggle logs | Planned | Yes | No | |
| Cmd+Shift+M | Toggle memory | Planned | Yes | No | |

---

## Accessibility

### ARIA Support

| Pattern | Components | Notes |
|---------|------------|-------|
| button | All buttons | role="button", tabIndex=0 |
| tablist/tab/tabpanel | Memory Browser | Proper tab navigation |
| list/listitem | Task cards, episodes | Screen reader navigation |
| log | Log Stream | role="log", aria-live="polite" |
| status | Session Control | role="status" for updates |
| dialog | Future modals | role="dialog", aria-modal |

### Screen Reader Support

| Feature | Status | Notes |
|---------|--------|-------|
| Task descriptions | Yes | aria-label on cards |
| Status announcements | Yes | aria-live regions |
| Log updates | Yes | Polite live region |
| Theme changes | Yes | Announced via event |
| Focus management | Yes | Focus trapping in modals |

### Visual Accessibility

| Feature | Status | Notes |
|---------|--------|-------|
| High contrast theme | Yes | Pure black/white |
| Focus indicators | Yes | 2px outline on focus-visible |
| Color-independent status | Partial | Some rely on color alone |
| Reduced motion | Yes | Respects prefers-reduced-motion |

---

## Limitations by Context

### VS Code Webview Limitations

1. **No file download** - Download API not fully supported
2. **Shortcut conflicts** - Some shortcuts conflict with VS Code
3. **Theme locked** - Theme follows VS Code, cannot override
4. **Limited localStorage** - Webview storage restrictions

### CLI Embedded Limitations

1. **No interactivity** - Static HTML output
2. **No WebSocket** - Polling only for updates
3. **No drag-drop** - Mouse events limited
4. **No keyboard shortcuts** - CLI handles input
5. **Simplified themes** - Only light/dark

### Browser Full Support

All features are available in standalone browser context.

---

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial feature matrix |
| 1.1.0 | Added unified theme system, VS Code themes |
| 1.2.0 | Added keyboard shortcuts, ARIA patterns |

---

## Testing

Run feature parity tests:

```bash
npm run test:parity
```

This verifies all features work in all contexts.

See `tests/feature-parity.test.js` for implementation details.
