# Loki Mode Dashboard UI Components

Reusable web components for building Loki Mode dashboard interfaces. Built with vanilla JavaScript ES6 modules, Shadow DOM encapsulation, and Anthropic design language.

## Components

### loki-task-board

Kanban-style task board with drag-and-drop support.

```html
<loki-task-board
  api-url="http://localhost:8420"
  project-id="1"
  theme="dark"
  readonly
></loki-task-board>
```

**Attributes:**
- `api-url` - API base URL (default: http://localhost:8420)
- `project-id` - Filter tasks by project ID
- `theme` - 'light' or 'dark' (default: auto-detect)
- `readonly` - Disable drag-drop and editing

**Events:**
- `task-moved` - Fired when a task is moved between columns
- `add-task` - Fired when add task button is clicked
- `task-click` - Fired when a task card is clicked

### loki-session-control

Control panel for Loki Mode session with start/stop/pause buttons.

```html
<loki-session-control
  api-url="http://localhost:8420"
  theme="dark"
  compact
></loki-session-control>
```

**Attributes:**
- `api-url` - API base URL (default: http://localhost:8420)
- `theme` - 'light' or 'dark' (default: auto-detect)
- `compact` - Show compact version

**Events:**
- `session-start` - Fired when start is clicked
- `session-pause` - Fired when pause is clicked
- `session-resume` - Fired when resume is clicked
- `session-stop` - Fired when stop is clicked

### loki-log-stream

Real-time log display with filtering and auto-scroll.

```html
<loki-log-stream
  api-url="http://localhost:8420"
  max-lines="500"
  auto-scroll
  theme="dark"
></loki-log-stream>
```

**Attributes:**
- `api-url` - API base URL (default: http://localhost:8420)
- `max-lines` - Maximum number of log lines to keep (default: 500)
- `auto-scroll` - Enable auto-scroll to bottom
- `theme` - 'light' or 'dark' (default: auto-detect)
- `log-file` - Path to log file (for file-based updates)

**Events:**
- `log-received` - Fired when a new log message is received
- `logs-cleared` - Fired when logs are cleared

**Public API:**
- `addLog(message, level)` - Add a log entry programmatically
- `clear()` - Clear all logs

### loki-memory-browser

Browser for the Loki Mode memory system.

```html
<loki-memory-browser
  api-url="http://localhost:8420"
  theme="dark"
  tab="summary"
></loki-memory-browser>
```

**Attributes:**
- `api-url` - API base URL (default: http://localhost:8420)
- `theme` - 'light' or 'dark' (default: auto-detect)
- `tab` - Initial tab ('summary' | 'episodes' | 'patterns' | 'skills')

**Events:**
- `episode-select` - Fired when an episode is selected
- `pattern-select` - Fired when a pattern is selected
- `skill-select` - Fired when a skill is selected

## Core Utilities

### UnifiedThemeManager (Recommended)

Multi-context theme management with support for browser, VS Code, and CLI contexts.

```javascript
import { UnifiedThemeManager, THEMES } from './dashboard-ui/index.js';

// Initialize with context auto-detection
UnifiedThemeManager.init();

// Get current theme (auto-detects VS Code themes)
const theme = UnifiedThemeManager.getTheme();
// Returns: 'light' | 'dark' | 'high-contrast' | 'vscode-light' | 'vscode-dark'

// Detect context
const context = UnifiedThemeManager.detectContext();
// Returns: 'browser' | 'vscode' | 'cli'

// Set theme explicitly
UnifiedThemeManager.setTheme('dark');
UnifiedThemeManager.setTheme('high-contrast'); // High contrast mode
UnifiedThemeManager.setTheme('vscode-dark');   // VS Code dark

// Toggle between light/dark
const newTheme = UnifiedThemeManager.toggle();

// Listen for theme changes
window.addEventListener('loki-theme-change', (e) => {
  console.log('Theme:', e.detail.theme, 'Context:', e.detail.context);
});
```

**Available Themes:**
- `light` - Standard light theme (Anthropic design language)
- `dark` - Standard dark theme
- `high-contrast` - Accessibility-focused high contrast
- `vscode-light` - Maps to VS Code light theme
- `vscode-dark` - Maps to VS Code dark theme

### LokiTheme (Legacy)

Backwards-compatible theme management. Now delegates to UnifiedThemeManager.

```javascript
import { LokiTheme } from './core/loki-theme.js';

// Initialize theme (detects system preference)
LokiTheme.init();

// Get current theme
const theme = LokiTheme.getTheme();

// Set theme (now supports all unified themes)
LokiTheme.setTheme('dark');

// Toggle theme
LokiTheme.toggle();

// Get CSS variables for theme
const vars = LokiTheme.getVariables('dark');
```

### LokiApiClient

Unified API client for Loki Mode.

```javascript
import { getApiClient, ApiEvents } from './core/loki-api-client.js';

const api = getApiClient({ baseUrl: 'http://localhost:8420' });

// Connect to WebSocket for real-time updates
await api.connect();

// Listen for events
api.addEventListener(ApiEvents.TASK_UPDATED, (e) => {
  console.log('Task updated:', e.detail);
});

// REST API calls
const tasks = await api.listTasks({ projectId: 1 });
const status = await api.getStatus();
const memory = await api.getMemorySummary();

// Polling mode (fallback when WebSocket unavailable)
api.startPolling((status) => {
  console.log('Status update:', status);
});
```

### LokiState

Client-side state management with localStorage persistence.

```javascript
import { getState, createStore } from './core/loki-state.js';

const state = getState();

// Get/set state
state.set('ui.theme', 'dark');
const theme = state.get('ui.theme');

// Subscribe to changes
const unsubscribe = state.subscribe('ui.theme', (value, oldValue) => {
  console.log('Theme changed:', value);
});

// Local tasks
state.addLocalTask({ title: 'My task', status: 'pending' });
state.moveLocalTask('local-123', 'in_progress');

// Create a store bound to a specific path
const themeStore = createStore('ui.theme');
themeStore.set('dark');
themeStore.subscribe(console.log);
```

## Usage

### Direct Import (ES Modules)

```html
<script type="module">
  import { LokiTheme } from './dashboard-ui/core/loki-theme.js';
  import './dashboard-ui/components/loki-task-board.js';
  import './dashboard-ui/components/loki-session-control.js';

  LokiTheme.init();
</script>

<loki-task-board api-url="http://localhost:8420"></loki-task-board>
<loki-session-control></loki-session-control>
```

### Import All

```javascript
import {
  LokiTheme,
  LokiApiClient,
  LokiState,
  LokiTaskBoard,
  LokiSessionControl,
  LokiLogStream,
  LokiMemoryBrowser,
} from './dashboard-ui/index.js';
```

## Design Language

Components follow the Anthropic design language with:

- Cream/dark theme colors
- Inter font for UI, JetBrains Mono for code
- Smooth transitions (0.2s cubic-bezier)
- Consistent spacing and border radius
- Status colors: green (success), yellow (warning), red (error), blue (info), purple (review)

For comprehensive documentation, see [STYLE-GUIDE.md](./STYLE-GUIDE.md).

### Keyboard Shortcuts

All components support consistent keyboard navigation:

| Shortcut | Action |
|----------|--------|
| ArrowDown/Up | Navigate items |
| Tab/Shift+Tab | Navigate sections |
| Enter | Confirm/activate |
| Escape | Cancel/close |
| Cmd+R | Refresh |
| Cmd+Shift+D | Toggle theme |

### Accessibility (ARIA)

Components include proper ARIA patterns:

```javascript
import { ARIA_PATTERNS } from './dashboard-ui/index.js';

// Apply to custom elements
element.setAttribute('role', ARIA_PATTERNS.button.role);
```

### VS Code Integration

Components auto-detect VS Code context and apply appropriate themes:

```javascript
// Automatic detection
const context = UnifiedThemeManager.detectContext();
if (context === 'vscode') {
  // VS Code theme variables are mapped automatically
}
```

## Demo

Open `dashboard-ui/index.html` in a browser to see all components in action.

```bash
# Start a local server
python3 -m http.server 8000 --directory /path/to/loki-mode

# Open http://localhost:8000/dashboard-ui/
```

## Browser Support

- Chrome 67+
- Firefox 63+
- Safari 10.1+
- Edge 79+

Requires JavaScript ES6 module support and Custom Elements v1.

## Testing

Run visual regression tests to verify component appearance across all themes:

```bash
npm run test:visual
```

Tests cover:
- All 5 theme variants (light, dark, high-contrast, vscode-light, vscode-dark)
- All component states (buttons, cards, badges, status indicators)
- Theme variable completeness
- ARIA pattern correctness
- Keyboard handler functionality

## Files

```
dashboard-ui/
  index.js                      # Main exports
  README.md                     # This file
  STYLE-GUIDE.md               # Comprehensive styling documentation
  core/
    loki-theme.js              # Theme management (legacy + unified)
    loki-unified-styles.js     # Unified style system (NEW)
    loki-api-client.js         # API client
    loki-state.js              # State management
  components/
    loki-task-board.js         # Kanban task board
    loki-session-control.js    # Session controls
    loki-log-stream.js         # Log viewer
    loki-memory-browser.js     # Memory browser
  tests/
    visual-regression.test.js  # Visual regression tests
```
