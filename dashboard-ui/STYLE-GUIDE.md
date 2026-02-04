# Loki Mode Dashboard Style Guide

Comprehensive styling reference for Loki Mode dashboard components. Ensures consistent appearance and behavior across browser, VS Code webview, and CLI contexts.

## Quick Start

```javascript
import { UnifiedThemeManager, BASE_STYLES, THEMES } from './core/loki-unified-styles.js';

// Initialize theme system
UnifiedThemeManager.init();

// Get CSS for components
const css = UnifiedThemeManager.generateCSS();
```

## Theme System

### Available Themes

| Theme | Context | Description |
|-------|---------|-------------|
| `light` | Browser/CLI | Anthropic design language - light cream background |
| `dark` | Browser/CLI | Dark mode with warm grays |
| `high-contrast` | Accessibility | Maximum contrast for visibility |
| `vscode-light` | VS Code | Maps to VS Code light theme variables |
| `vscode-dark` | VS Code | Maps to VS Code dark theme variables |

### Theme Detection

The system automatically detects the appropriate theme:

```javascript
// Get current theme (auto-detects context)
const theme = UnifiedThemeManager.getTheme();

// Detect context
const context = UnifiedThemeManager.detectContext();
// Returns: 'browser' | 'vscode' | 'cli'
```

### Theme Switching

```javascript
// Set theme explicitly
UnifiedThemeManager.setTheme('dark');

// Toggle between light/dark
const newTheme = UnifiedThemeManager.toggle();

// Listen for theme changes
window.addEventListener('loki-theme-change', (e) => {
  console.log('New theme:', e.detail.theme);
  console.log('Context:', e.detail.context);
});
```

## CSS Custom Properties

### Background Colors

```css
--loki-bg-primary     /* Main background */
--loki-bg-secondary   /* Secondary surfaces */
--loki-bg-tertiary    /* Elevated surfaces */
--loki-bg-card        /* Card backgrounds */
--loki-bg-hover       /* Hover state */
--loki-bg-active      /* Active state */
--loki-bg-overlay     /* Modal overlays */
```

### Text Colors

```css
--loki-text-primary   /* Primary text */
--loki-text-secondary /* Secondary text */
--loki-text-muted     /* Muted/placeholder text */
--loki-text-disabled  /* Disabled text */
--loki-text-inverse   /* Text on accent backgrounds */
```

### Accent Colors

```css
--loki-accent         /* Primary accent */
--loki-accent-hover   /* Accent hover state */
--loki-accent-active  /* Accent active state */
--loki-accent-light   /* Lighter accent */
--loki-accent-muted   /* Muted accent background */
```

### Semantic Colors

```css
/* Success */
--loki-success        /* Success color */
--loki-success-muted  /* Success background */

/* Warning */
--loki-warning        /* Warning color */
--loki-warning-muted  /* Warning background */

/* Error */
--loki-error          /* Error color */
--loki-error-muted    /* Error background */

/* Info */
--loki-info           /* Info color */
--loki-info-muted     /* Info background */
```

### Border Colors

```css
--loki-border         /* Default border */
--loki-border-light   /* Lighter border */
--loki-border-focus   /* Focus ring color */
```

### Model-Specific Colors

```css
--loki-opus           /* Opus model indicator */
--loki-sonnet         /* Sonnet model indicator */
--loki-haiku          /* Haiku model indicator */
```

### Shadows

```css
--loki-shadow-sm      /* Small shadow */
--loki-shadow-md      /* Medium shadow */
--loki-shadow-lg      /* Large shadow */
--loki-shadow-focus   /* Focus ring shadow */
```

## Design Tokens

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--loki-space-xs` | 4px | Tight spacing, icon gaps |
| `--loki-space-sm` | 8px | Small padding, list gaps |
| `--loki-space-md` | 12px | Default padding |
| `--loki-space-lg` | 16px | Card padding, section gaps |
| `--loki-space-xl` | 24px | Large sections |
| `--loki-space-2xl` | 32px | Page sections |
| `--loki-space-3xl` | 48px | Hero sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--loki-radius-none` | 0 | No radius |
| `--loki-radius-sm` | 4px | Small elements |
| `--loki-radius-md` | 6px | Buttons, inputs |
| `--loki-radius-lg` | 8px | Cards |
| `--loki-radius-xl` | 10px | Large cards |
| `--loki-radius-full` | 9999px | Pills, circles |

### Typography

```css
/* Font Families */
--loki-font-sans      /* UI text: Inter, system fallback */
--loki-font-mono      /* Code: JetBrains Mono */

/* Font Sizes */
--loki-text-xs        /* 10px - Tiny labels */
--loki-text-sm        /* 11px - Small text */
--loki-text-base      /* 12px - Default body */
--loki-text-md        /* 13px - Emphasized body */
--loki-text-lg        /* 14px - Section headers */
--loki-text-xl        /* 16px - Page headers */
--loki-text-2xl       /* 18px - Titles */
--loki-text-3xl       /* 24px - Large titles */
```

### Animation

```css
/* Duration */
--loki-duration-fast    /* 100ms - Quick feedback */
--loki-duration-normal  /* 200ms - Standard transitions */
--loki-duration-slow    /* 300ms - Deliberate animations */

/* Easing */
--loki-easing-default   /* Standard ease-out */
--loki-transition       /* Combined duration + easing */
```

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--loki-z-dropdown` | 100 | Dropdown menus |
| `--loki-z-sticky` | 200 | Sticky headers |
| `--loki-z-modal` | 300 | Modal dialogs |
| `--loki-z-popover` | 400 | Popovers |
| `--loki-z-tooltip` | 500 | Tooltips |
| `--loki-z-toast` | 600 | Toast notifications |

## Component Classes

### Buttons

```html
<!-- Primary button -->
<button class="btn btn-primary">Action</button>

<!-- Secondary button -->
<button class="btn btn-secondary">Cancel</button>

<!-- Ghost button -->
<button class="btn btn-ghost">Link</button>

<!-- Danger button -->
<button class="btn btn-danger">Delete</button>

<!-- Size variants -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-lg">Large</button>

<!-- Disabled state -->
<button class="btn btn-primary" disabled>Disabled</button>
```

### Cards

```html
<!-- Basic card -->
<div class="card">
  Card content
</div>

<!-- Interactive card -->
<div class="card card-interactive" tabindex="0">
  Clickable card
</div>
```

### Inputs

```html
<input type="text" class="input" placeholder="Enter text...">
```

### Badges

```html
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-info">Info</span>
<span class="badge badge-neutral">Neutral</span>
```

### Status Indicators

```html
<span class="status-dot active"></span>  <!-- Green, pulsing -->
<span class="status-dot idle"></span>    <!-- Gray -->
<span class="status-dot paused"></span>  <!-- Yellow -->
<span class="status-dot stopped"></span> <!-- Red -->
<span class="status-dot error"></span>   <!-- Red -->
<span class="status-dot offline"></span> <!-- Gray -->
```

### Empty State

```html
<div class="empty-state">
  No items to display
</div>
```

### Loading Spinner

```html
<div class="spinner"></div>
```

## Keyboard Navigation

### Standard Shortcuts

All components support consistent keyboard navigation:

| Shortcut | Action |
|----------|--------|
| `ArrowDown` / `ArrowUp` | Navigate items |
| `Tab` / `Shift+Tab` | Navigate sections |
| `Enter` | Confirm/activate |
| `Escape` | Cancel/close |
| `Cmd+R` | Refresh |
| `Cmd+K` | Search |
| `Cmd+Shift+D` | Toggle theme |

### Implementation

```javascript
import { KeyboardHandler, KEYBOARD_SHORTCUTS } from './core/loki-unified-styles.js';

const keyboard = new KeyboardHandler();

// Register handlers
keyboard.register('action.refresh', () => {
  console.log('Refresh triggered');
});

keyboard.register('theme.toggle', () => {
  UnifiedThemeManager.toggle();
});

// Attach to element
keyboard.attach(myElement);
```

## Accessibility (ARIA)

### Common Patterns

```javascript
import { ARIA_PATTERNS } from './core/loki-unified-styles.js';

// Button pattern
<button {...ARIA_PATTERNS.button}>Click me</button>

// Tab list pattern
<div {...ARIA_PATTERNS.tablist}>
  <button {...ARIA_PATTERNS.tab} aria-selected="true">Tab 1</button>
  <button {...ARIA_PATTERNS.tab}>Tab 2</button>
</div>
<div {...ARIA_PATTERNS.tabpanel}>Content</div>

// Live region
<div {...ARIA_PATTERNS.livePolite}>
  Status updates appear here
</div>

// Log output
<div {...ARIA_PATTERNS.log}>
  Log entries...
</div>
```

### Focus Management

- All interactive elements must be focusable
- Use `tabindex="0"` for custom interactive elements
- Use `tabindex="-1"` for programmatically focused elements
- Provide visible focus indicators

```css
/* Focus visible outline (included in base styles) */
:focus-visible {
  outline: 2px solid var(--loki-border-focus);
  outline-offset: 2px;
}
```

### Screen Reader Support

```html
<!-- Screen reader only text -->
<span class="sr-only">Additional context for screen readers</span>

<!-- Live regions for dynamic content -->
<div role="status" aria-live="polite">
  Task completed
</div>

<div role="alert" aria-live="assertive">
  Error: Connection lost
</div>
```

## VS Code Integration

### Theme Detection

VS Code themes are automatically detected via:
1. Body class: `vscode-dark`, `vscode-light`, `vscode-high-contrast`
2. CSS variables: `--vscode-*`

### Variable Mapping

VS Code variables are mapped to Loki variables:

```css
/* VS Code -> Loki mapping */
--vscode-editor-background    -> --loki-bg-primary
--vscode-sideBar-background   -> --loki-bg-secondary
--vscode-foreground           -> --loki-text-primary
--vscode-focusBorder          -> --loki-accent
--vscode-errorForeground      -> --loki-error
```

### High Contrast Support

High contrast mode provides:
- Pure black background (#000000)
- High contrast borders (white)
- No shadows (replaced with outlines)
- Increased color saturation

## Responsive Design

### Breakpoints

| Breakpoint | Width | Typical Device |
|------------|-------|----------------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |
| `2xl` | 1536px | Wide screens |

### Utility Classes

```html
<!-- Hide on mobile -->
<div class="hide-mobile">Desktop only</div>

<!-- Hide on desktop -->
<div class="hide-desktop">Mobile only</div>
```

### Media Queries

```css
/* Mobile first */
.element {
  padding: var(--loki-space-sm);
}

@media (min-width: 768px) {
  .element {
    padding: var(--loki-space-lg);
  }
}
```

## Migration from loki-theme.js

The unified styles system is backwards compatible. To migrate:

1. Update imports:
```javascript
// Old
import { LokiTheme, LokiElement } from './core/loki-theme.js';

// New
import { UnifiedThemeManager, LokiElement } from './core/loki-unified-styles.js';
// Or for full compatibility:
import { LokiTheme, LokiElement } from './core/loki-theme.js'; // Still works
```

2. Theme methods map directly:
- `LokiTheme.getTheme()` -> `UnifiedThemeManager.getTheme()`
- `LokiTheme.setTheme()` -> `UnifiedThemeManager.setTheme()`
- `LokiTheme.toggle()` -> `UnifiedThemeManager.toggle()`
- `LokiTheme.init()` -> `UnifiedThemeManager.init()`

3. CSS variables are unchanged - all existing variables work.

## Testing

### Visual Regression

Components include snapshot tests for each theme variant. Run:

```bash
npm run test:visual
```

### Theme Testing

```javascript
// Test all themes
import { THEMES } from './core/loki-unified-styles.js';

for (const themeName of Object.keys(THEMES)) {
  UnifiedThemeManager.setTheme(themeName);
  // Assert component renders correctly
}
```

### Accessibility Testing

```javascript
// Check ARIA attributes
expect(element.getAttribute('role')).toBe('button');
expect(element.getAttribute('aria-label')).toBeTruthy();

// Check focus management
element.focus();
expect(document.activeElement).toBe(element);
```

## Best Practices

1. **Use semantic color variables** - Prefer `--loki-success` over `--loki-green`
2. **Use spacing tokens** - Never use arbitrary pixel values
3. **Support keyboard navigation** - All interactive elements must work with keyboard
4. **Test all themes** - Verify appearance in light, dark, and high-contrast
5. **Use ARIA patterns** - Follow the provided patterns for accessibility
6. **Respect reduced motion** - Check `prefers-reduced-motion` for animations

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
