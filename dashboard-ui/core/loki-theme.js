/**
 * Loki Mode Theme Management
 *
 * Provides theme utilities for Loki Mode web components.
 * Supports light/dark mode with Anthropic design language.
 *
 * NOTE: For new features, prefer importing from loki-unified-styles.js
 * which provides additional themes (high-contrast, vscode-*) and
 * enhanced functionality. This file is maintained for backwards compatibility.
 *
 * @see ./loki-unified-styles.js for the unified theme system
 */

// Import unified styles for enhanced functionality
import {
  THEMES as UNIFIED_THEMES,
  UnifiedThemeManager,
  BASE_STYLES,
  generateThemeCSS,
  generateTokensCSS,
  KeyboardHandler,
  KEYBOARD_SHORTCUTS,
  ARIA_PATTERNS,
} from './loki-unified-styles.js';

// Re-export unified styles for convenience
export {
  UnifiedThemeManager,
  BASE_STYLES,
  KeyboardHandler,
  KEYBOARD_SHORTCUTS,
  ARIA_PATTERNS,
};

/**
 * Anthropic Design Language CSS Variables
 * Based on anthropic.com color system
 *
 * @deprecated Use THEMES from loki-unified-styles.js instead
 */
export const THEME_VARIABLES = {
  light: {
    // Background colors
    '--loki-bg-primary': '#faf9f0',
    '--loki-bg-secondary': '#f5f4eb',
    '--loki-bg-tertiary': '#eeeddf',
    '--loki-bg-card': '#ffffff',
    '--loki-bg-hover': '#f0efe6',

    // Accent colors
    '--loki-accent': '#d97757',
    '--loki-accent-light': '#e8956f',
    '--loki-accent-muted': 'rgba(217, 119, 87, 0.12)',

    // Text colors
    '--loki-text-primary': '#1a1a1a',
    '--loki-text-secondary': '#5c5c5c',
    '--loki-text-muted': '#8a8a8a',

    // Border colors
    '--loki-border': '#e5e3de',
    '--loki-border-light': '#d4d2cb',

    // Status colors
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

    // Model colors
    '--loki-opus': '#d97706',
    '--loki-sonnet': '#4f46e5',
    '--loki-haiku': '#059669',

    // Transition
    '--loki-transition': '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  dark: {
    // Background colors
    '--loki-bg-primary': '#131314',
    '--loki-bg-secondary': '#1a1a1b',
    '--loki-bg-tertiary': '#232325',
    '--loki-bg-card': '#1e1e20',
    '--loki-bg-hover': '#2a2a2d',

    // Accent colors
    '--loki-accent': '#d97757',
    '--loki-accent-light': '#e8956f',
    '--loki-accent-muted': 'rgba(217, 119, 87, 0.15)',

    // Text colors
    '--loki-text-primary': '#f5f5f5',
    '--loki-text-secondary': '#a1a1a6',
    '--loki-text-muted': '#6b6b70',

    // Border colors
    '--loki-border': '#2d2d30',
    '--loki-border-light': '#3d3d42',

    // Status colors
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

    // Transition
    '--loki-transition': '0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  }
};

/**
 * Common styles shared across all components
 *
 * @deprecated Use BASE_STYLES from loki-unified-styles.js instead
 */
export const COMMON_STYLES = `
  :host {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
  }

  :host *, :host *::before, :host *::after {
    box-sizing: border-box;
  }

  .mono {
    font-family: 'JetBrains Mono', monospace;
  }

  /* Button base styles */
  .btn {
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--loki-transition);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
  }

  .btn-primary {
    background: var(--loki-accent);
    color: white;
  }

  .btn-primary:hover {
    background: var(--loki-accent-light);
  }

  .btn-secondary {
    background: var(--loki-bg-tertiary);
    color: var(--loki-text-primary);
    border: 1px solid var(--loki-border);
  }

  .btn-secondary:hover {
    background: var(--loki-bg-hover);
  }

  /* Status dot */
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-dot.active {
    background: var(--loki-green);
    animation: pulse 2s infinite;
  }
  .status-dot.idle { background: var(--loki-text-muted); }
  .status-dot.paused { background: var(--loki-yellow); }
  .status-dot.stopped { background: var(--loki-red); }
  .status-dot.error { background: var(--loki-red); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Card base */
  .card {
    background: var(--loki-bg-card);
    border: 1px solid var(--loki-border);
    border-radius: 10px;
    padding: 16px;
    transition: all var(--loki-transition);
  }

  .card:hover {
    border-color: var(--loki-border-light);
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--loki-text-muted);
    font-size: 12px;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--loki-bg-primary); }
  ::-webkit-scrollbar-thumb { background: var(--loki-border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--loki-border-light); }
`;

/**
 * LokiTheme class for managing theme state
 *
 * NOTE: For new projects, prefer using UnifiedThemeManager from
 * loki-unified-styles.js which supports additional themes and contexts.
 * This class is maintained for backwards compatibility.
 */
export class LokiTheme {
  static STORAGE_KEY = 'loki-theme';

  /**
   * Get the current theme
   * @returns {string} Theme name (now supports all unified themes)
   */
  static getTheme() {
    // Delegate to UnifiedThemeManager for enhanced context detection
    return UnifiedThemeManager.getTheme();
  }

  /**
   * Set the theme
   * @param {string} theme - Theme name (light, dark, high-contrast, vscode-light, vscode-dark)
   */
  static setTheme(theme) {
    // Delegate to UnifiedThemeManager
    UnifiedThemeManager.setTheme(theme);
  }

  /**
   * Toggle between light and dark theme
   * @returns {string} The new theme
   */
  static toggle() {
    return UnifiedThemeManager.toggle();
  }

  /**
   * Get CSS variables for a theme
   * @param {string} theme - Theme name
   * @returns {object} CSS variables object
   */
  static getVariables(theme = null) {
    const t = theme || LokiTheme.getTheme();
    // Support both legacy THEME_VARIABLES and unified THEMES
    return UNIFIED_THEMES[t] || THEME_VARIABLES[t] || THEME_VARIABLES.light;
  }

  /**
   * Generate CSS string from theme variables
   * @param {string} theme - Theme name
   * @returns {string} CSS string
   */
  static toCSSString(theme = null) {
    const t = theme || LokiTheme.getTheme();
    // Use unified CSS generation for better output
    if (UNIFIED_THEMES[t]) {
      return generateThemeCSS(t);
    }
    // Fallback to legacy format
    const vars = LokiTheme.getVariables(t);
    return Object.entries(vars)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n');
  }

  /**
   * Apply theme variables to an element
   * @param {HTMLElement} element - Element to apply styles to
   * @param {string} theme - Optional theme override
   */
  static applyToElement(element, theme = null) {
    const vars = LokiTheme.getVariables(theme);
    for (const [key, value] of Object.entries(vars)) {
      element.style.setProperty(key, value);
    }
  }

  /**
   * Initialize theme system
   * Sets up system preference listener and applies initial theme
   */
  static init() {
    // Delegate to UnifiedThemeManager for enhanced initialization
    UnifiedThemeManager.init();
  }

  /**
   * Detect current context
   * @returns {'browser'|'vscode'|'cli'} Current context
   */
  static detectContext() {
    return UnifiedThemeManager.detectContext();
  }

  /**
   * Get all available themes
   * @returns {string[]} Array of theme names
   */
  static getAvailableThemes() {
    return Object.keys(UNIFIED_THEMES);
  }
}

/**
 * Base class for Loki web components with theme support
 *
 * Enhanced with unified styles support including:
 * - All theme variants (light, dark, high-contrast, vscode-*)
 * - Keyboard shortcut handling
 * - ARIA pattern helpers
 */
export class LokiElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._theme = LokiTheme.getTheme();
    this._themeChangeHandler = this._onThemeChange.bind(this);
    this._keyboardHandler = new KeyboardHandler();
  }

  connectedCallback() {
    window.addEventListener('loki-theme-change', this._themeChangeHandler);
    this._applyTheme();
    this._setupKeyboardHandling();
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener('loki-theme-change', this._themeChangeHandler);
    this._keyboardHandler.detach(this);
  }

  _onThemeChange(e) {
    this._theme = e.detail.theme;
    this._applyTheme();
    if (this.onThemeChange) {
      this.onThemeChange(this._theme);
    }
  }

  _applyTheme() {
    LokiTheme.applyToElement(this.shadowRoot.host, this._theme);
    // Also set data attribute for CSS-based theming
    this.setAttribute('data-loki-theme', this._theme);
  }

  /**
   * Setup keyboard shortcut handling
   * Override in subclass to register component-specific shortcuts
   */
  _setupKeyboardHandling() {
    this._keyboardHandler.attach(this);
    // Subclasses can register shortcuts via:
    // this._keyboardHandler.register('action.name', handler);
  }

  /**
   * Register a keyboard shortcut
   * @param {string} action - Action name from KEYBOARD_SHORTCUTS
   * @param {Function} handler - Handler function
   */
  registerShortcut(action, handler) {
    this._keyboardHandler.register(action, handler);
  }

  /**
   * Get the base styles for the component (enhanced with all themes)
   * @returns {string} CSS string with all theme variants
   */
  getBaseStyles() {
    const tokens = generateTokensCSS();

    return `
      /* Design tokens */
      :host {
        ${tokens}
      }

      /* Light theme (default) */
      :host {
        ${generateThemeCSS('light')}
      }

      /* Dark theme via system preference */
      @media (prefers-color-scheme: dark) {
        :host {
          ${generateThemeCSS('dark')}
        }
      }

      /* Explicit theme attributes */
      :host([theme="dark"]),
      :host([data-loki-theme="dark"]) {
        ${generateThemeCSS('dark')}
      }

      :host([theme="light"]),
      :host([data-loki-theme="light"]) {
        ${generateThemeCSS('light')}
      }

      :host([theme="high-contrast"]),
      :host([data-loki-theme="high-contrast"]) {
        ${generateThemeCSS('high-contrast')}
      }

      :host([theme="vscode-light"]),
      :host([data-loki-theme="vscode-light"]) {
        ${generateThemeCSS('vscode-light')}
      }

      :host([theme="vscode-dark"]),
      :host([data-loki-theme="vscode-dark"]) {
        ${generateThemeCSS('vscode-dark')}
      }

      /* Reduced motion preference */
      @media (prefers-reduced-motion: reduce) {
        :host *,
        :host *::before,
        :host *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }

      ${BASE_STYLES}
    `;
  }

  /**
   * Get ARIA attributes for a pattern
   * @param {string} patternName - Pattern name from ARIA_PATTERNS
   * @returns {object} ARIA attributes object
   */
  getAriaPattern(patternName) {
    return ARIA_PATTERNS[patternName] || {};
  }

  /**
   * Apply ARIA attributes to an element
   * @param {HTMLElement} element - Target element
   * @param {string} patternName - Pattern name
   */
  applyAriaPattern(element, patternName) {
    const pattern = this.getAriaPattern(patternName);
    for (const [key, value] of Object.entries(pattern)) {
      if (key === 'role') {
        element.setAttribute('role', value);
      } else {
        // Convert camelCase to kebab-case for aria attributes
        const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        element.setAttribute(attrName, value);
      }
    }
  }

  /**
   * Override in subclass to render component
   */
  render() {
    // Override in subclass
  }
}

export default LokiTheme;
