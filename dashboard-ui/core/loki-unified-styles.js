/**
 * Loki Mode Unified Style System
 *
 * Provides consistent styling across all contexts:
 * - Browser (standalone)
 * - VS Code webview (light/dark/high-contrast)
 * - CLI-embedded HTML
 *
 * @version 1.0.0
 */

// =============================================================================
// THEME DEFINITIONS
// =============================================================================

/**
 * Complete theme definitions with all CSS custom properties
 * Themes: light, dark, high-contrast, vscode-light, vscode-dark
 */
export const THEMES = {
  // Standard light theme (Anthropic design language)
  light: {
    // Background layers
    '--loki-bg-primary': '#faf9f0',
    '--loki-bg-secondary': '#f5f4eb',
    '--loki-bg-tertiary': '#eeeddf',
    '--loki-bg-card': '#ffffff',
    '--loki-bg-hover': '#f0efe6',
    '--loki-bg-active': '#e8e7dc',
    '--loki-bg-overlay': 'rgba(0, 0, 0, 0.5)',

    // Accent colors
    '--loki-accent': '#d97757',
    '--loki-accent-hover': '#c56a4c',
    '--loki-accent-active': '#b35d40',
    '--loki-accent-light': '#e8956f',
    '--loki-accent-muted': 'rgba(217, 119, 87, 0.12)',

    // Text hierarchy
    '--loki-text-primary': '#1a1a1a',
    '--loki-text-secondary': '#5c5c5c',
    '--loki-text-muted': '#8a8a8a',
    '--loki-text-disabled': '#b0b0b0',
    '--loki-text-inverse': '#ffffff',

    // Border colors
    '--loki-border': '#e5e3de',
    '--loki-border-light': '#d4d2cb',
    '--loki-border-focus': '#d97757',

    // Status colors - semantic
    '--loki-success': '#16a34a',
    '--loki-success-muted': 'rgba(22, 163, 74, 0.12)',
    '--loki-warning': '#ca8a04',
    '--loki-warning-muted': 'rgba(202, 138, 4, 0.12)',
    '--loki-error': '#dc2626',
    '--loki-error-muted': 'rgba(220, 38, 38, 0.12)',
    '--loki-info': '#2563eb',
    '--loki-info-muted': 'rgba(37, 99, 235, 0.12)',

    // Legacy aliases (for backwards compatibility)
    '--loki-green': '#16a34a',
    '--loki-green-muted': 'rgba(22, 163, 74, 0.12)',
    '--loki-yellow': '#ca8a04',
    '--loki-yellow-muted': 'rgba(202, 138, 4, 0.12)',
    '--loki-red': '#dc2626',
    '--loki-red-muted': 'rgba(220, 38, 38, 0.12)',
    '--loki-blue': '#2563eb',
    '--loki-blue-muted': 'rgba(37, 99, 235, 0.12)',
    '--loki-purple': '#9333ea',
    '--loki-purple-muted': 'rgba(147, 51, 234, 0.12)',

    // Model-specific colors
    '--loki-opus': '#d97706',
    '--loki-sonnet': '#4f46e5',
    '--loki-haiku': '#059669',

    // Shadow definitions
    '--loki-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
    '--loki-shadow-md': '0 4px 6px rgba(0, 0, 0, 0.07)',
    '--loki-shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
    '--loki-shadow-focus': '0 0 0 3px rgba(217, 119, 87, 0.3)',
  },

  // Standard dark theme
  dark: {
    // Background layers
    '--loki-bg-primary': '#131314',
    '--loki-bg-secondary': '#1a1a1b',
    '--loki-bg-tertiary': '#232325',
    '--loki-bg-card': '#1e1e20',
    '--loki-bg-hover': '#2a2a2d',
    '--loki-bg-active': '#333336',
    '--loki-bg-overlay': 'rgba(0, 0, 0, 0.7)',

    // Accent colors
    '--loki-accent': '#d97757',
    '--loki-accent-hover': '#e08668',
    '--loki-accent-active': '#e8956f',
    '--loki-accent-light': '#e8956f',
    '--loki-accent-muted': 'rgba(217, 119, 87, 0.15)',

    // Text hierarchy
    '--loki-text-primary': '#f5f5f5',
    '--loki-text-secondary': '#a1a1a6',
    '--loki-text-muted': '#6b6b70',
    '--loki-text-disabled': '#4a4a4f',
    '--loki-text-inverse': '#1a1a1a',

    // Border colors
    '--loki-border': '#2d2d30',
    '--loki-border-light': '#3d3d42',
    '--loki-border-focus': '#d97757',

    // Status colors - semantic
    '--loki-success': '#22c55e',
    '--loki-success-muted': 'rgba(34, 197, 94, 0.15)',
    '--loki-warning': '#eab308',
    '--loki-warning-muted': 'rgba(234, 179, 8, 0.15)',
    '--loki-error': '#ef4444',
    '--loki-error-muted': 'rgba(239, 68, 68, 0.15)',
    '--loki-info': '#3b82f6',
    '--loki-info-muted': 'rgba(59, 130, 246, 0.15)',

    // Legacy aliases
    '--loki-green': '#22c55e',
    '--loki-green-muted': 'rgba(34, 197, 94, 0.15)',
    '--loki-yellow': '#eab308',
    '--loki-yellow-muted': 'rgba(234, 179, 8, 0.15)',
    '--loki-red': '#ef4444',
    '--loki-red-muted': 'rgba(239, 68, 68, 0.15)',
    '--loki-blue': '#3b82f6',
    '--loki-blue-muted': 'rgba(59, 130, 246, 0.15)',
    '--loki-purple': '#a855f7',
    '--loki-purple-muted': 'rgba(168, 85, 247, 0.15)',

    // Model colors
    '--loki-opus': '#f59e0b',
    '--loki-sonnet': '#6366f1',
    '--loki-haiku': '#10b981',

    // Shadows
    '--loki-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
    '--loki-shadow-md': '0 4px 6px rgba(0, 0, 0, 0.4)',
    '--loki-shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.5)',
    '--loki-shadow-focus': '0 0 0 3px rgba(217, 119, 87, 0.4)',
  },

  // High contrast theme (accessibility)
  'high-contrast': {
    // Background layers - pure black/white
    '--loki-bg-primary': '#000000',
    '--loki-bg-secondary': '#0a0a0a',
    '--loki-bg-tertiary': '#141414',
    '--loki-bg-card': '#0a0a0a',
    '--loki-bg-hover': '#1a1a1a',
    '--loki-bg-active': '#242424',
    '--loki-bg-overlay': 'rgba(0, 0, 0, 0.9)',

    // High contrast accent
    '--loki-accent': '#ff9d7a',
    '--loki-accent-hover': '#ffb396',
    '--loki-accent-active': '#ffc9b2',
    '--loki-accent-light': '#ffb396',
    '--loki-accent-muted': 'rgba(255, 157, 122, 0.25)',

    // High contrast text
    '--loki-text-primary': '#ffffff',
    '--loki-text-secondary': '#e0e0e0',
    '--loki-text-muted': '#b0b0b0',
    '--loki-text-disabled': '#666666',
    '--loki-text-inverse': '#000000',

    // High contrast borders
    '--loki-border': '#ffffff',
    '--loki-border-light': '#cccccc',
    '--loki-border-focus': '#ff9d7a',

    // High contrast status colors
    '--loki-success': '#4ade80',
    '--loki-success-muted': 'rgba(74, 222, 128, 0.25)',
    '--loki-warning': '#fde047',
    '--loki-warning-muted': 'rgba(253, 224, 71, 0.25)',
    '--loki-error': '#f87171',
    '--loki-error-muted': 'rgba(248, 113, 113, 0.25)',
    '--loki-info': '#60a5fa',
    '--loki-info-muted': 'rgba(96, 165, 250, 0.25)',

    // Legacy aliases
    '--loki-green': '#4ade80',
    '--loki-green-muted': 'rgba(74, 222, 128, 0.25)',
    '--loki-yellow': '#fde047',
    '--loki-yellow-muted': 'rgba(253, 224, 71, 0.25)',
    '--loki-red': '#f87171',
    '--loki-red-muted': 'rgba(248, 113, 113, 0.25)',
    '--loki-blue': '#60a5fa',
    '--loki-blue-muted': 'rgba(96, 165, 250, 0.25)',
    '--loki-purple': '#c084fc',
    '--loki-purple-muted': 'rgba(192, 132, 252, 0.25)',

    // Model colors
    '--loki-opus': '#fbbf24',
    '--loki-sonnet': '#818cf8',
    '--loki-haiku': '#34d399',

    // High contrast shadows (using outlines instead)
    '--loki-shadow-sm': 'none',
    '--loki-shadow-md': 'none',
    '--loki-shadow-lg': 'none',
    '--loki-shadow-focus': '0 0 0 3px #ff9d7a',
  },

  // VS Code Light theme - maps VS Code variables
  'vscode-light': {
    '--loki-bg-primary': 'var(--vscode-editor-background, #ffffff)',
    '--loki-bg-secondary': 'var(--vscode-sideBar-background, #f3f3f3)',
    '--loki-bg-tertiary': 'var(--vscode-input-background, #ffffff)',
    '--loki-bg-card': 'var(--vscode-editor-background, #ffffff)',
    '--loki-bg-hover': 'var(--vscode-list-hoverBackground, #e8e8e8)',
    '--loki-bg-active': 'var(--vscode-list-activeSelectionBackground, #0060c0)',
    '--loki-bg-overlay': 'rgba(0, 0, 0, 0.4)',

    '--loki-accent': 'var(--vscode-focusBorder, #0066cc)',
    '--loki-accent-hover': 'var(--vscode-button-hoverBackground, #0055aa)',
    '--loki-accent-active': 'var(--vscode-button-background, #007acc)',
    '--loki-accent-light': 'var(--vscode-focusBorder, #0066cc)',
    '--loki-accent-muted': 'var(--vscode-editor-selectionBackground, rgba(0, 102, 204, 0.2))',

    '--loki-text-primary': 'var(--vscode-foreground, #333333)',
    '--loki-text-secondary': 'var(--vscode-descriptionForeground, #717171)',
    '--loki-text-muted': 'var(--vscode-disabledForeground, #a0a0a0)',
    '--loki-text-disabled': 'var(--vscode-disabledForeground, #cccccc)',
    '--loki-text-inverse': 'var(--vscode-button-foreground, #ffffff)',

    '--loki-border': 'var(--vscode-widget-border, #c8c8c8)',
    '--loki-border-light': 'var(--vscode-widget-border, #e0e0e0)',
    '--loki-border-focus': 'var(--vscode-focusBorder, #0066cc)',

    '--loki-success': 'var(--vscode-testing-iconPassed, #388a34)',
    '--loki-success-muted': 'rgba(56, 138, 52, 0.15)',
    '--loki-warning': 'var(--vscode-editorWarning-foreground, #bf8803)',
    '--loki-warning-muted': 'rgba(191, 136, 3, 0.15)',
    '--loki-error': 'var(--vscode-errorForeground, #e51400)',
    '--loki-error-muted': 'rgba(229, 20, 0, 0.15)',
    '--loki-info': 'var(--vscode-editorInfo-foreground, #1a85ff)',
    '--loki-info-muted': 'rgba(26, 133, 255, 0.15)',

    '--loki-green': 'var(--vscode-testing-iconPassed, #388a34)',
    '--loki-green-muted': 'rgba(56, 138, 52, 0.15)',
    '--loki-yellow': 'var(--vscode-editorWarning-foreground, #bf8803)',
    '--loki-yellow-muted': 'rgba(191, 136, 3, 0.15)',
    '--loki-red': 'var(--vscode-errorForeground, #e51400)',
    '--loki-red-muted': 'rgba(229, 20, 0, 0.15)',
    '--loki-blue': 'var(--vscode-editorInfo-foreground, #1a85ff)',
    '--loki-blue-muted': 'rgba(26, 133, 255, 0.15)',
    '--loki-purple': '#9333ea',
    '--loki-purple-muted': 'rgba(147, 51, 234, 0.15)',

    '--loki-opus': '#d97706',
    '--loki-sonnet': '#4f46e5',
    '--loki-haiku': '#059669',

    '--loki-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
    '--loki-shadow-md': '0 2px 4px rgba(0, 0, 0, 0.1)',
    '--loki-shadow-lg': '0 4px 8px rgba(0, 0, 0, 0.15)',
    '--loki-shadow-focus': '0 0 0 2px var(--vscode-focusBorder, #0066cc)',
  },

  // VS Code Dark theme
  'vscode-dark': {
    '--loki-bg-primary': 'var(--vscode-editor-background, #1e1e1e)',
    '--loki-bg-secondary': 'var(--vscode-sideBar-background, #252526)',
    '--loki-bg-tertiary': 'var(--vscode-input-background, #3c3c3c)',
    '--loki-bg-card': 'var(--vscode-editor-background, #1e1e1e)',
    '--loki-bg-hover': 'var(--vscode-list-hoverBackground, #2a2d2e)',
    '--loki-bg-active': 'var(--vscode-list-activeSelectionBackground, #094771)',
    '--loki-bg-overlay': 'rgba(0, 0, 0, 0.6)',

    '--loki-accent': 'var(--vscode-focusBorder, #007fd4)',
    '--loki-accent-hover': 'var(--vscode-button-hoverBackground, #1177bb)',
    '--loki-accent-active': 'var(--vscode-button-background, #0e639c)',
    '--loki-accent-light': 'var(--vscode-focusBorder, #007fd4)',
    '--loki-accent-muted': 'var(--vscode-editor-selectionBackground, rgba(0, 127, 212, 0.25))',

    '--loki-text-primary': 'var(--vscode-foreground, #cccccc)',
    '--loki-text-secondary': 'var(--vscode-descriptionForeground, #9d9d9d)',
    '--loki-text-muted': 'var(--vscode-disabledForeground, #6b6b6b)',
    '--loki-text-disabled': 'var(--vscode-disabledForeground, #4d4d4d)',
    '--loki-text-inverse': 'var(--vscode-button-foreground, #ffffff)',

    '--loki-border': 'var(--vscode-widget-border, #454545)',
    '--loki-border-light': 'var(--vscode-widget-border, #5a5a5a)',
    '--loki-border-focus': 'var(--vscode-focusBorder, #007fd4)',

    '--loki-success': 'var(--vscode-testing-iconPassed, #89d185)',
    '--loki-success-muted': 'rgba(137, 209, 133, 0.2)',
    '--loki-warning': 'var(--vscode-editorWarning-foreground, #cca700)',
    '--loki-warning-muted': 'rgba(204, 167, 0, 0.2)',
    '--loki-error': 'var(--vscode-errorForeground, #f48771)',
    '--loki-error-muted': 'rgba(244, 135, 113, 0.2)',
    '--loki-info': 'var(--vscode-editorInfo-foreground, #75beff)',
    '--loki-info-muted': 'rgba(117, 190, 255, 0.2)',

    '--loki-green': 'var(--vscode-testing-iconPassed, #89d185)',
    '--loki-green-muted': 'rgba(137, 209, 133, 0.2)',
    '--loki-yellow': 'var(--vscode-editorWarning-foreground, #cca700)',
    '--loki-yellow-muted': 'rgba(204, 167, 0, 0.2)',
    '--loki-red': 'var(--vscode-errorForeground, #f48771)',
    '--loki-red-muted': 'rgba(244, 135, 113, 0.2)',
    '--loki-blue': 'var(--vscode-editorInfo-foreground, #75beff)',
    '--loki-blue-muted': 'rgba(117, 190, 255, 0.2)',
    '--loki-purple': '#c084fc',
    '--loki-purple-muted': 'rgba(192, 132, 252, 0.2)',

    '--loki-opus': '#f59e0b',
    '--loki-sonnet': '#818cf8',
    '--loki-haiku': '#34d399',

    '--loki-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
    '--loki-shadow-md': '0 2px 4px rgba(0, 0, 0, 0.4)',
    '--loki-shadow-lg': '0 4px 8px rgba(0, 0, 0, 0.5)',
    '--loki-shadow-focus': '0 0 0 2px var(--vscode-focusBorder, #007fd4)',
  },
};

// =============================================================================
// DESIGN TOKENS
// =============================================================================

/**
 * Consistent spacing scale (in pixels)
 */
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

/**
 * Consistent border radius scale
 */
export const RADIUS = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  full: '9999px',
};

/**
 * Typography scale
 */
export const TYPOGRAPHY = {
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
  },
  fontSize: {
    xs: '10px',
    sm: '11px',
    base: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    '2xl': '18px',
    '3xl': '24px',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },
};

/**
 * Animation timings
 */
export const ANIMATION = {
  duration: {
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
};

/**
 * Responsive breakpoints
 */
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

/**
 * Z-index scale
 */
export const Z_INDEX = {
  base: '0',
  dropdown: '100',
  sticky: '200',
  modal: '300',
  popover: '400',
  tooltip: '500',
  toast: '600',
};

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================

/**
 * Unified keyboard shortcuts across all contexts
 */
export const KEYBOARD_SHORTCUTS = {
  // Navigation
  'navigation.nextItem': { key: 'ArrowDown', modifiers: [] },
  'navigation.prevItem': { key: 'ArrowUp', modifiers: [] },
  'navigation.nextSection': { key: 'Tab', modifiers: [] },
  'navigation.prevSection': { key: 'Tab', modifiers: ['Shift'] },
  'navigation.confirm': { key: 'Enter', modifiers: [] },
  'navigation.cancel': { key: 'Escape', modifiers: [] },

  // Actions
  'action.refresh': { key: 'r', modifiers: ['Meta'] },
  'action.search': { key: 'k', modifiers: ['Meta'] },
  'action.save': { key: 's', modifiers: ['Meta'] },
  'action.close': { key: 'w', modifiers: ['Meta'] },

  // Theme
  'theme.toggle': { key: 'd', modifiers: ['Meta', 'Shift'] },

  // Tasks
  'task.create': { key: 'n', modifiers: ['Meta'] },
  'task.complete': { key: 'Enter', modifiers: ['Meta'] },

  // View
  'view.toggleLogs': { key: 'l', modifiers: ['Meta', 'Shift'] },
  'view.toggleMemory': { key: 'm', modifiers: ['Meta', 'Shift'] },
};

// =============================================================================
// ARIA PATTERNS
// =============================================================================

/**
 * Common ARIA patterns for accessibility
 */
export const ARIA_PATTERNS = {
  // Button patterns
  button: {
    role: 'button',
    tabIndex: 0,
  },

  // Tab patterns
  tablist: {
    role: 'tablist',
  },
  tab: {
    role: 'tab',
    ariaSelected: false,
    tabIndex: -1,
  },
  tabpanel: {
    role: 'tabpanel',
    tabIndex: 0,
  },

  // List patterns
  list: {
    role: 'list',
  },
  listitem: {
    role: 'listitem',
  },

  // Live regions
  livePolite: {
    ariaLive: 'polite',
    ariaAtomic: true,
  },
  liveAssertive: {
    ariaLive: 'assertive',
    ariaAtomic: true,
  },

  // Dialog patterns
  dialog: {
    role: 'dialog',
    ariaModal: true,
  },
  alertdialog: {
    role: 'alertdialog',
    ariaModal: true,
  },

  // Status patterns
  status: {
    role: 'status',
    ariaLive: 'polite',
  },
  alert: {
    role: 'alert',
    ariaLive: 'assertive',
  },

  // Log pattern
  log: {
    role: 'log',
    ariaLive: 'polite',
    ariaRelevant: 'additions',
  },
};

// =============================================================================
// CSS GENERATION
// =============================================================================

/**
 * Generate CSS custom properties from a theme
 * @param {string} themeName - Theme name
 * @returns {string} CSS string
 */
export function generateThemeCSS(themeName) {
  const theme = THEMES[themeName];
  if (!theme) return '';

  return Object.entries(theme)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n    ');
}

/**
 * Generate complete CSS variables string including design tokens
 */
export function generateTokensCSS() {
  return `
    /* Spacing */
    --loki-space-xs: ${SPACING.xs};
    --loki-space-sm: ${SPACING.sm};
    --loki-space-md: ${SPACING.md};
    --loki-space-lg: ${SPACING.lg};
    --loki-space-xl: ${SPACING.xl};
    --loki-space-2xl: ${SPACING['2xl']};
    --loki-space-3xl: ${SPACING['3xl']};

    /* Border Radius */
    --loki-radius-none: ${RADIUS.none};
    --loki-radius-sm: ${RADIUS.sm};
    --loki-radius-md: ${RADIUS.md};
    --loki-radius-lg: ${RADIUS.lg};
    --loki-radius-xl: ${RADIUS.xl};
    --loki-radius-full: ${RADIUS.full};

    /* Typography */
    --loki-font-sans: ${TYPOGRAPHY.fontFamily.sans};
    --loki-font-mono: ${TYPOGRAPHY.fontFamily.mono};
    --loki-text-xs: ${TYPOGRAPHY.fontSize.xs};
    --loki-text-sm: ${TYPOGRAPHY.fontSize.sm};
    --loki-text-base: ${TYPOGRAPHY.fontSize.base};
    --loki-text-md: ${TYPOGRAPHY.fontSize.md};
    --loki-text-lg: ${TYPOGRAPHY.fontSize.lg};
    --loki-text-xl: ${TYPOGRAPHY.fontSize.xl};
    --loki-text-2xl: ${TYPOGRAPHY.fontSize['2xl']};
    --loki-text-3xl: ${TYPOGRAPHY.fontSize['3xl']};

    /* Animation */
    --loki-duration-fast: ${ANIMATION.duration.fast};
    --loki-duration-normal: ${ANIMATION.duration.normal};
    --loki-duration-slow: ${ANIMATION.duration.slow};
    --loki-easing-default: ${ANIMATION.easing.default};
    --loki-transition: ${ANIMATION.duration.normal} ${ANIMATION.easing.default};

    /* Z-Index */
    --loki-z-dropdown: ${Z_INDEX.dropdown};
    --loki-z-sticky: ${Z_INDEX.sticky};
    --loki-z-modal: ${Z_INDEX.modal};
    --loki-z-popover: ${Z_INDEX.popover};
    --loki-z-tooltip: ${Z_INDEX.tooltip};
    --loki-z-toast: ${Z_INDEX.toast};
  `;
}

/**
 * Generate base styles shared across all components
 */
export const BASE_STYLES = `
  /* Reset and base */
  :host {
    font-family: var(--loki-font-sans);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    box-sizing: border-box;
    color: var(--loki-text-primary);
  }

  :host *, :host *::before, :host *::after {
    box-sizing: border-box;
  }

  /* Monospace utility */
  .mono {
    font-family: var(--loki-font-mono);
  }

  /* Focus visible outline */
  :focus-visible {
    outline: 2px solid var(--loki-border-focus);
    outline-offset: 2px;
  }

  :focus:not(:focus-visible) {
    outline: none;
  }

  /* Button base */
  .btn {
    padding: var(--loki-space-sm) var(--loki-space-md);
    border-radius: var(--loki-radius-md);
    font-size: var(--loki-text-md);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--loki-transition);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--loki-space-xs);
    border: 1px solid transparent;
    text-decoration: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .btn-primary {
    background: var(--loki-accent);
    color: var(--loki-text-inverse);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--loki-accent-hover);
  }

  .btn-primary:active:not(:disabled) {
    background: var(--loki-accent-active);
  }

  .btn-secondary {
    background: var(--loki-bg-tertiary);
    color: var(--loki-text-primary);
    border-color: var(--loki-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--loki-bg-hover);
    border-color: var(--loki-border-light);
  }

  .btn-ghost {
    background: transparent;
    color: var(--loki-text-secondary);
  }

  .btn-ghost:hover:not(:disabled) {
    background: var(--loki-bg-hover);
    color: var(--loki-text-primary);
  }

  .btn-danger {
    background: var(--loki-error);
    color: var(--loki-text-inverse);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--loki-red);
    filter: brightness(1.1);
  }

  /* Button sizes */
  .btn-sm {
    padding: var(--loki-space-xs) var(--loki-space-sm);
    font-size: var(--loki-text-sm);
  }

  .btn-lg {
    padding: var(--loki-space-md) var(--loki-space-lg);
    font-size: var(--loki-text-lg);
  }

  /* Status indicators */
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--loki-radius-full);
    flex-shrink: 0;
  }

  .status-dot.active {
    background: var(--loki-success);
    animation: pulse 2s infinite;
  }
  .status-dot.idle { background: var(--loki-text-muted); }
  .status-dot.paused { background: var(--loki-warning); }
  .status-dot.stopped { background: var(--loki-error); }
  .status-dot.error { background: var(--loki-error); }
  .status-dot.offline { background: var(--loki-text-muted); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Card base */
  .card {
    background: var(--loki-bg-card);
    border: 1px solid var(--loki-border);
    border-radius: var(--loki-radius-xl);
    padding: var(--loki-space-lg);
    transition: all var(--loki-transition);
  }

  .card:hover {
    border-color: var(--loki-border-light);
  }

  .card-interactive {
    cursor: pointer;
  }

  .card-interactive:hover {
    transform: translateY(-1px);
    box-shadow: var(--loki-shadow-md);
  }

  /* Input base */
  .input {
    width: 100%;
    padding: var(--loki-space-sm) var(--loki-space-md);
    background: var(--loki-bg-tertiary);
    border: 1px solid var(--loki-border);
    border-radius: var(--loki-radius-md);
    font-size: var(--loki-text-base);
    color: var(--loki-text-primary);
    transition: all var(--loki-transition);
  }

  .input::placeholder {
    color: var(--loki-text-muted);
  }

  .input:hover:not(:disabled) {
    border-color: var(--loki-border-light);
  }

  .input:focus {
    outline: none;
    border-color: var(--loki-border-focus);
    box-shadow: var(--loki-shadow-focus);
  }

  .input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Badge */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px var(--loki-space-sm);
    border-radius: var(--loki-radius-sm);
    font-size: var(--loki-text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .badge-success {
    background: var(--loki-success-muted);
    color: var(--loki-success);
  }

  .badge-warning {
    background: var(--loki-warning-muted);
    color: var(--loki-warning);
  }

  .badge-error {
    background: var(--loki-error-muted);
    color: var(--loki-error);
  }

  .badge-info {
    background: var(--loki-info-muted);
    color: var(--loki-info);
  }

  .badge-neutral {
    background: var(--loki-bg-tertiary);
    color: var(--loki-text-secondary);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: var(--loki-space-xl);
    color: var(--loki-text-muted);
    font-size: var(--loki-text-base);
  }

  /* Loading spinner */
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--loki-border);
    border-top-color: var(--loki-accent);
    border-radius: var(--loki-radius-full);
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: var(--loki-bg-primary);
    border-radius: var(--loki-radius-sm);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--loki-border);
    border-radius: var(--loki-radius-sm);
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--loki-border-light);
  }

  /* Screen reader only */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Responsive utilities */
  @media (max-width: ${BREAKPOINTS.md}) {
    .hide-mobile { display: none !important; }
  }

  @media (min-width: ${BREAKPOINTS.md}) {
    .hide-desktop { display: none !important; }
  }
`;

// =============================================================================
// THEME MANAGER
// =============================================================================

/**
 * Unified Theme Manager for all contexts
 */
export class UnifiedThemeManager {
  static STORAGE_KEY = 'loki-theme';
  static CONTEXT_KEY = 'loki-context';

  /**
   * Detect current context
   * @returns {'browser'|'vscode'|'cli'} Current context
   */
  static detectContext() {
    // Check for VS Code webview
    if (typeof acquireVsCodeApi !== 'undefined' ||
        document.body.classList.contains('vscode-body') ||
        getComputedStyle(document.documentElement).getPropertyValue('--vscode-editor-background')) {
      return 'vscode';
    }

    // Check for CLI context (could be via env var or data attribute)
    if (document.documentElement.dataset.lokiContext === 'cli') {
      return 'cli';
    }

    return 'browser';
  }

  /**
   * Detect VS Code theme type
   * @returns {'light'|'dark'|'high-contrast'|null}
   */
  static detectVSCodeTheme() {
    const body = document.body;

    if (body.classList.contains('vscode-high-contrast')) {
      return 'high-contrast';
    }
    if (body.classList.contains('vscode-dark')) {
      return 'dark';
    }
    if (body.classList.contains('vscode-light')) {
      return 'light';
    }

    // Fallback: check background color
    const bgColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--vscode-editor-background');
    if (bgColor) {
      const rgb = bgColor.match(/\d+/g);
      if (rgb) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        return brightness > 128 ? 'light' : 'dark';
      }
    }

    return null;
  }

  /**
   * Get the appropriate theme based on context
   * @returns {string} Theme name
   */
  static getTheme() {
    const context = UnifiedThemeManager.detectContext();

    if (context === 'vscode') {
      const vsTheme = UnifiedThemeManager.detectVSCodeTheme();
      if (vsTheme === 'high-contrast') return 'high-contrast';
      return vsTheme === 'dark' ? 'vscode-dark' : 'vscode-light';
    }

    // Browser/CLI: check localStorage, then system preference
    const saved = localStorage.getItem(UnifiedThemeManager.STORAGE_KEY);
    if (saved && THEMES[saved]) return saved;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /**
   * Set theme
   * @param {string} theme - Theme name
   */
  static setTheme(theme) {
    if (!THEMES[theme]) {
      console.warn(`Unknown theme: ${theme}`);
      return;
    }

    localStorage.setItem(UnifiedThemeManager.STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-loki-theme', theme);

    // Dispatch event for components
    window.dispatchEvent(new CustomEvent('loki-theme-change', {
      detail: { theme, context: UnifiedThemeManager.detectContext() }
    }));
  }

  /**
   * Toggle between light and dark theme
   * @returns {string} New theme
   */
  static toggle() {
    const current = UnifiedThemeManager.getTheme();
    let next;

    if (current.includes('dark') || current === 'high-contrast') {
      next = current.startsWith('vscode') ? 'vscode-light' : 'light';
    } else {
      next = current.startsWith('vscode') ? 'vscode-dark' : 'dark';
    }

    UnifiedThemeManager.setTheme(next);
    return next;
  }

  /**
   * Get CSS variables for current theme
   * @param {string} theme - Optional theme override
   * @returns {object} CSS variables
   */
  static getVariables(theme = null) {
    const t = theme || UnifiedThemeManager.getTheme();
    return THEMES[t] || THEMES.light;
  }

  /**
   * Generate complete CSS for a theme
   * @param {string} theme - Theme name
   * @returns {string} CSS string
   */
  static generateCSS(theme = null) {
    const t = theme || UnifiedThemeManager.getTheme();
    return `
      :host {
        ${generateThemeCSS(t)}
        ${generateTokensCSS()}
      }
      ${BASE_STYLES}
    `;
  }

  /**
   * Initialize theme system
   */
  static init() {
    const theme = UnifiedThemeManager.getTheme();
    document.documentElement.setAttribute('data-loki-theme', theme);

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!localStorage.getItem(UnifiedThemeManager.STORAGE_KEY)) {
        UnifiedThemeManager.setTheme(UnifiedThemeManager.getTheme());
      }
    });

    // VS Code theme change observer
    if (UnifiedThemeManager.detectContext() === 'vscode') {
      const observer = new MutationObserver(() => {
        const newTheme = UnifiedThemeManager.getTheme();
        document.documentElement.setAttribute('data-loki-theme', newTheme);
        window.dispatchEvent(new CustomEvent('loki-theme-change', {
          detail: { theme: newTheme, context: 'vscode' }
        }));
      });

      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }
}

// =============================================================================
// KEYBOARD HANDLER
// =============================================================================

/**
 * Unified keyboard shortcut handler
 */
export class KeyboardHandler {
  constructor() {
    this._handlers = new Map();
    this._enabled = true;
  }

  /**
   * Register a keyboard shortcut handler
   * @param {string} action - Action name from KEYBOARD_SHORTCUTS
   * @param {Function} handler - Handler function
   */
  register(action, handler) {
    const shortcut = KEYBOARD_SHORTCUTS[action];
    if (!shortcut) {
      console.warn(`Unknown keyboard action: ${action}`);
      return;
    }

    this._handlers.set(action, { shortcut, handler });
  }

  /**
   * Unregister a handler
   * @param {string} action - Action name
   */
  unregister(action) {
    this._handlers.delete(action);
  }

  /**
   * Enable/disable keyboard handling
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this._enabled = enabled;
  }

  /**
   * Handle a keyboard event
   * @param {KeyboardEvent} event
   * @returns {boolean} Whether the event was handled
   */
  handleEvent(event) {
    if (!this._enabled) return false;

    for (const [action, { shortcut, handler }] of this._handlers) {
      if (this._matchesShortcut(event, shortcut)) {
        event.preventDefault();
        event.stopPropagation();
        handler(event);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if event matches shortcut
   * @param {KeyboardEvent} event
   * @param {object} shortcut
   * @returns {boolean}
   */
  _matchesShortcut(event, shortcut) {
    const key = event.key.toLowerCase();
    const modifiers = shortcut.modifiers || [];

    if (key !== shortcut.key.toLowerCase()) return false;

    const hasCtrl = modifiers.includes('Ctrl') || modifiers.includes('Meta');
    const hasShift = modifiers.includes('Shift');
    const hasAlt = modifiers.includes('Alt');

    const ctrlMatch = (event.ctrlKey || event.metaKey) === hasCtrl;
    const shiftMatch = event.shiftKey === hasShift;
    const altMatch = event.altKey === hasAlt;

    return ctrlMatch && shiftMatch && altMatch;
  }

  /**
   * Attach to an element
   * @param {HTMLElement} element
   */
  attach(element) {
    element.addEventListener('keydown', (e) => this.handleEvent(e));
  }

  /**
   * Detach from an element
   * @param {HTMLElement} element
   */
  detach(element) {
    element.removeEventListener('keydown', (e) => this.handleEvent(e));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  THEMES,
  SPACING,
  RADIUS,
  TYPOGRAPHY,
  ANIMATION,
  BREAKPOINTS,
  Z_INDEX,
  KEYBOARD_SHORTCUTS,
  ARIA_PATTERNS,
  BASE_STYLES,
  generateThemeCSS,
  generateTokensCSS,
  UnifiedThemeManager,
  KeyboardHandler,
};
