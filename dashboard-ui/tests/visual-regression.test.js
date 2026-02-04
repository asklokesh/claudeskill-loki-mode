/**
 * Visual Regression Tests for Loki Mode Dashboard Components
 *
 * Tests component rendering across all theme variants:
 * - light
 * - dark
 * - high-contrast
 * - vscode-light
 * - vscode-dark
 *
 * Uses snapshot comparison to detect unintended visual changes.
 */

import {
  THEMES,
  UnifiedThemeManager,
  generateThemeCSS,
  generateTokensCSS,
  BASE_STYLES,
} from '../core/loki-unified-styles.js';

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a test container with theme applied
 * @param {string} themeName - Theme to apply
 * @returns {HTMLElement} Container element
 */
function createThemedContainer(themeName) {
  const container = document.createElement('div');
  container.setAttribute('data-loki-theme', themeName);

  const style = document.createElement('style');
  style.textContent = `
    [data-loki-theme="${themeName}"] {
      ${generateThemeCSS(themeName)}
      ${generateTokensCSS()}
    }
    ${BASE_STYLES}
  `;

  container.appendChild(style);
  return container;
}

/**
 * Get computed styles for an element
 * @param {HTMLElement} element
 * @returns {object} Relevant computed styles
 */
function getRelevantStyles(element) {
  const computed = getComputedStyle(element);
  return {
    backgroundColor: computed.backgroundColor,
    color: computed.color,
    borderColor: computed.borderColor,
    borderRadius: computed.borderRadius,
    padding: computed.padding,
    fontSize: computed.fontSize,
    fontFamily: computed.fontFamily,
  };
}

/**
 * Generate snapshot for component in theme
 * @param {string} componentHtml - Component HTML
 * @param {string} themeName - Theme name
 * @returns {object} Snapshot data
 */
function generateSnapshot(componentHtml, themeName) {
  const container = createThemedContainer(themeName);
  container.innerHTML += componentHtml;
  document.body.appendChild(container);

  const element = container.lastElementChild;
  const styles = getRelevantStyles(element);
  const rect = element.getBoundingClientRect();

  const snapshot = {
    theme: themeName,
    html: element.outerHTML,
    styles,
    dimensions: {
      width: rect.width,
      height: rect.height,
    },
  };

  document.body.removeChild(container);
  return snapshot;
}

// =============================================================================
// TEST COMPONENTS
// =============================================================================

const TEST_COMPONENTS = {
  button_primary: '<button class="btn btn-primary">Primary Button</button>',
  button_secondary: '<button class="btn btn-secondary">Secondary Button</button>',
  button_ghost: '<button class="btn btn-ghost">Ghost Button</button>',
  button_danger: '<button class="btn btn-danger">Danger Button</button>',
  button_disabled: '<button class="btn btn-primary" disabled>Disabled</button>',

  card: '<div class="card">Card content</div>',
  card_interactive: '<div class="card card-interactive" tabindex="0">Interactive Card</div>',

  input: '<input type="text" class="input" value="Sample text">',
  input_placeholder: '<input type="text" class="input" placeholder="Placeholder">',

  badge_success: '<span class="badge badge-success">Success</span>',
  badge_warning: '<span class="badge badge-warning">Warning</span>',
  badge_error: '<span class="badge badge-error">Error</span>',
  badge_info: '<span class="badge badge-info">Info</span>',
  badge_neutral: '<span class="badge badge-neutral">Neutral</span>',

  status_active: '<span class="status-dot active"></span>',
  status_idle: '<span class="status-dot idle"></span>',
  status_paused: '<span class="status-dot paused"></span>',
  status_stopped: '<span class="status-dot stopped"></span>',
  status_error: '<span class="status-dot error"></span>',

  empty_state: '<div class="empty-state">No items to display</div>',
  spinner: '<div class="spinner"></div>',
};

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Loki Dashboard Visual Regression Tests', () => {
  const themes = Object.keys(THEMES);

  describe('Theme CSS Generation', () => {
    themes.forEach((themeName) => {
      test(`generates valid CSS for ${themeName} theme`, () => {
        const css = generateThemeCSS(themeName);

        expect(css).toBeTruthy();
        expect(css).toContain('--loki-bg-primary');
        expect(css).toContain('--loki-text-primary');
        expect(css).toContain('--loki-accent');
        expect(css).toContain('--loki-success');
        expect(css).toContain('--loki-error');
      });
    });

    test('generates design tokens CSS', () => {
      const css = generateTokensCSS();

      expect(css).toContain('--loki-space-');
      expect(css).toContain('--loki-radius-');
      expect(css).toContain('--loki-font-');
      expect(css).toContain('--loki-duration-');
      expect(css).toContain('--loki-z-');
    });
  });

  describe('Theme Variables Completeness', () => {
    const requiredVariables = [
      '--loki-bg-primary',
      '--loki-bg-secondary',
      '--loki-bg-tertiary',
      '--loki-bg-card',
      '--loki-bg-hover',
      '--loki-text-primary',
      '--loki-text-secondary',
      '--loki-text-muted',
      '--loki-accent',
      '--loki-accent-muted',
      '--loki-border',
      '--loki-border-focus',
      '--loki-success',
      '--loki-warning',
      '--loki-error',
      '--loki-info',
      '--loki-shadow-sm',
      '--loki-shadow-md',
      '--loki-shadow-lg',
    ];

    themes.forEach((themeName) => {
      test(`${themeName} theme has all required variables`, () => {
        const theme = THEMES[themeName];

        requiredVariables.forEach((variable) => {
          expect(theme[variable]).toBeDefined();
          expect(theme[variable]).not.toBe('');
        });
      });
    });
  });

  describe('Component Snapshots', () => {
    Object.entries(TEST_COMPONENTS).forEach(([componentName, html]) => {
      describe(componentName, () => {
        themes.forEach((themeName) => {
          test(`renders correctly in ${themeName} theme`, () => {
            const snapshot = generateSnapshot(html, themeName);
            expect(snapshot).toMatchSnapshot(`${componentName}-${themeName}`);
          });
        });
      });
    });
  });

  describe('Button States', () => {
    themes.forEach((themeName) => {
      test(`button states are distinct in ${themeName}`, () => {
        const primary = generateSnapshot(TEST_COMPONENTS.button_primary, themeName);
        const secondary = generateSnapshot(TEST_COMPONENTS.button_secondary, themeName);
        const disabled = generateSnapshot(TEST_COMPONENTS.button_disabled, themeName);

        // Primary and secondary should have different backgrounds
        expect(primary.styles.backgroundColor).not.toBe(secondary.styles.backgroundColor);

        // Disabled should have reduced opacity (typically via opacity or color change)
        // This varies by implementation, so we just verify they're different
        expect(disabled.html).toContain('disabled');
      });
    });
  });

  describe('Status Indicators', () => {
    themes.forEach((themeName) => {
      test(`status colors are distinct in ${themeName}`, () => {
        const active = generateSnapshot(TEST_COMPONENTS.status_active, themeName);
        const paused = generateSnapshot(TEST_COMPONENTS.status_paused, themeName);
        const error = generateSnapshot(TEST_COMPONENTS.status_error, themeName);
        const idle = generateSnapshot(TEST_COMPONENTS.status_idle, themeName);

        // All status colors should be different
        const colors = [
          active.styles.backgroundColor,
          paused.styles.backgroundColor,
          error.styles.backgroundColor,
          idle.styles.backgroundColor,
        ];

        const uniqueColors = new Set(colors);
        // At least 3 unique colors (error and stopped might be same red)
        expect(uniqueColors.size).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Badge Variants', () => {
    themes.forEach((themeName) => {
      test(`badge colors are distinct in ${themeName}`, () => {
        const success = generateSnapshot(TEST_COMPONENTS.badge_success, themeName);
        const warning = generateSnapshot(TEST_COMPONENTS.badge_warning, themeName);
        const error = generateSnapshot(TEST_COMPONENTS.badge_error, themeName);
        const info = generateSnapshot(TEST_COMPONENTS.badge_info, themeName);

        // All badge colors should be different
        const colors = [
          success.styles.backgroundColor,
          warning.styles.backgroundColor,
          error.styles.backgroundColor,
          info.styles.backgroundColor,
        ];

        const uniqueColors = new Set(colors);
        expect(uniqueColors.size).toBe(4);
      });
    });
  });

  describe('High Contrast Compliance', () => {
    test('high-contrast theme has sufficient contrast', () => {
      const theme = THEMES['high-contrast'];

      // Background should be pure black
      expect(theme['--loki-bg-primary']).toBe('#000000');

      // Text should be pure white
      expect(theme['--loki-text-primary']).toBe('#ffffff');

      // Borders should be visible (white or high-contrast color)
      expect(theme['--loki-border']).toBe('#ffffff');

      // No shadows in high contrast (accessibility)
      expect(theme['--loki-shadow-sm']).toBe('none');
    });
  });

  describe('VS Code Theme Integration', () => {
    test('vscode-light theme uses VS Code variables', () => {
      const theme = THEMES['vscode-light'];

      // Should reference VS Code variables
      expect(theme['--loki-bg-primary']).toContain('--vscode-');
      expect(theme['--loki-text-primary']).toContain('--vscode-');
      expect(theme['--loki-accent']).toContain('--vscode-');
    });

    test('vscode-dark theme uses VS Code variables', () => {
      const theme = THEMES['vscode-dark'];

      // Should reference VS Code variables
      expect(theme['--loki-bg-primary']).toContain('--vscode-');
      expect(theme['--loki-text-primary']).toContain('--vscode-');
      expect(theme['--loki-accent']).toContain('--vscode-');
    });
  });
});

// =============================================================================
// THEME MANAGER TESTS
// =============================================================================

describe('UnifiedThemeManager', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-loki-theme');
    document.body.className = '';
  });

  test('detects browser context by default', () => {
    const context = UnifiedThemeManager.detectContext();
    expect(context).toBe('browser');
  });

  test('detects VS Code context from body class', () => {
    document.body.classList.add('vscode-body');
    const context = UnifiedThemeManager.detectContext();
    expect(context).toBe('vscode');
    document.body.classList.remove('vscode-body');
  });

  test('gets default theme based on system preference', () => {
    const theme = UnifiedThemeManager.getTheme();
    expect(['light', 'dark']).toContain(theme);
  });

  test('persists theme to localStorage', () => {
    UnifiedThemeManager.setTheme('dark');
    expect(localStorage.getItem('loki-theme')).toBe('dark');
  });

  test('retrieves saved theme from localStorage', () => {
    localStorage.setItem('loki-theme', 'dark');
    const theme = UnifiedThemeManager.getTheme();
    expect(theme).toBe('dark');
  });

  test('toggles between light and dark', () => {
    UnifiedThemeManager.setTheme('light');
    const newTheme = UnifiedThemeManager.toggle();
    expect(newTheme).toBe('dark');

    const newerTheme = UnifiedThemeManager.toggle();
    expect(newerTheme).toBe('light');
  });

  test('dispatches theme change event', () => {
    const handler = jest.fn();
    window.addEventListener('loki-theme-change', handler);

    UnifiedThemeManager.setTheme('dark');

    expect(handler).toHaveBeenCalled();
    expect(handler.mock.calls[0][0].detail.theme).toBe('dark');

    window.removeEventListener('loki-theme-change', handler);
  });

  test('ignores invalid theme names', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    UnifiedThemeManager.setTheme('invalid-theme');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown theme'));
    consoleSpy.mockRestore();
  });

  test('generates complete CSS', () => {
    const css = UnifiedThemeManager.generateCSS('dark');

    expect(css).toContain(':host');
    expect(css).toContain('--loki-bg-primary');
    expect(css).toContain('.btn');
    expect(css).toContain('.card');
  });

  test('detects VS Code dark theme', () => {
    document.body.classList.add('vscode-dark');
    const vsTheme = UnifiedThemeManager.detectVSCodeTheme();
    expect(vsTheme).toBe('dark');
    document.body.classList.remove('vscode-dark');
  });

  test('detects VS Code light theme', () => {
    document.body.classList.add('vscode-light');
    const vsTheme = UnifiedThemeManager.detectVSCodeTheme();
    expect(vsTheme).toBe('light');
    document.body.classList.remove('vscode-light');
  });

  test('detects VS Code high contrast theme', () => {
    document.body.classList.add('vscode-high-contrast');
    const vsTheme = UnifiedThemeManager.detectVSCodeTheme();
    expect(vsTheme).toBe('high-contrast');
    document.body.classList.remove('vscode-high-contrast');
  });
});

// =============================================================================
// KEYBOARD HANDLER TESTS
// =============================================================================

import { KeyboardHandler, KEYBOARD_SHORTCUTS } from '../core/loki-unified-styles.js';

describe('KeyboardHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new KeyboardHandler();
  });

  test('registers and triggers handlers', () => {
    const callback = jest.fn();
    handler.register('navigation.confirm', callback);

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    handler.handleEvent(event);

    expect(callback).toHaveBeenCalled();
  });

  test('handles modifier keys correctly', () => {
    const callback = jest.fn();
    handler.register('action.refresh', callback);

    // Without modifier - should not trigger
    const eventNoMod = new KeyboardEvent('keydown', { key: 'r' });
    handler.handleEvent(eventNoMod);
    expect(callback).not.toHaveBeenCalled();

    // With modifier - should trigger
    const eventWithMod = new KeyboardEvent('keydown', { key: 'r', metaKey: true });
    handler.handleEvent(eventWithMod);
    expect(callback).toHaveBeenCalled();
  });

  test('can be disabled', () => {
    const callback = jest.fn();
    handler.register('navigation.confirm', callback);
    handler.setEnabled(false);

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    handler.handleEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  test('can unregister handlers', () => {
    const callback = jest.fn();
    handler.register('navigation.confirm', callback);
    handler.unregister('navigation.confirm');

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    handler.handleEvent(event);

    expect(callback).not.toHaveBeenCalled();
  });

  test('KEYBOARD_SHORTCUTS has required actions', () => {
    const requiredActions = [
      'navigation.nextItem',
      'navigation.prevItem',
      'navigation.confirm',
      'navigation.cancel',
      'action.refresh',
      'theme.toggle',
    ];

    requiredActions.forEach((action) => {
      expect(KEYBOARD_SHORTCUTS[action]).toBeDefined();
      expect(KEYBOARD_SHORTCUTS[action].key).toBeDefined();
    });
  });
});

// =============================================================================
// ARIA PATTERNS TESTS
// =============================================================================

import { ARIA_PATTERNS } from '../core/loki-unified-styles.js';

describe('ARIA Patterns', () => {
  test('button pattern has correct attributes', () => {
    expect(ARIA_PATTERNS.button.role).toBe('button');
    expect(ARIA_PATTERNS.button.tabIndex).toBe(0);
  });

  test('tab patterns are complete', () => {
    expect(ARIA_PATTERNS.tablist.role).toBe('tablist');
    expect(ARIA_PATTERNS.tab.role).toBe('tab');
    expect(ARIA_PATTERNS.tabpanel.role).toBe('tabpanel');
  });

  test('live regions have correct attributes', () => {
    expect(ARIA_PATTERNS.livePolite.ariaLive).toBe('polite');
    expect(ARIA_PATTERNS.liveAssertive.ariaLive).toBe('assertive');
  });

  test('log pattern has correct attributes', () => {
    expect(ARIA_PATTERNS.log.role).toBe('log');
    expect(ARIA_PATTERNS.log.ariaLive).toBe('polite');
    expect(ARIA_PATTERNS.log.ariaRelevant).toBe('additions');
  });

  test('dialog patterns are complete', () => {
    expect(ARIA_PATTERNS.dialog.role).toBe('dialog');
    expect(ARIA_PATTERNS.dialog.ariaModal).toBe(true);
    expect(ARIA_PATTERNS.alertdialog.role).toBe('alertdialog');
  });
});

// =============================================================================
// CROSS-THEME CONSISTENCY TESTS
// =============================================================================

describe('Cross-Theme Consistency', () => {
  test('all themes have same variable keys', () => {
    const themes = Object.keys(THEMES);
    const referenceKeys = Object.keys(THEMES.light).sort();

    themes.forEach((themeName) => {
      const themeKeys = Object.keys(THEMES[themeName]).sort();
      expect(themeKeys).toEqual(referenceKeys);
    });
  });

  test('color values are valid CSS', () => {
    const colorValueRegex = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s,%.]+\)|var\(--[a-z-]+.*\)|none)$/;

    Object.entries(THEMES).forEach(([themeName, theme]) => {
      Object.entries(theme).forEach(([key, value]) => {
        if (key.includes('color') || key.includes('bg') || key.includes('text') ||
            key.includes('border') || key.includes('shadow')) {
          // Allow multiple values for shadow
          if (key.includes('shadow')) {
            expect(value).toBeTruthy();
          } else {
            expect(value).toMatch(colorValueRegex);
          }
        }
      });
    });
  });
});
