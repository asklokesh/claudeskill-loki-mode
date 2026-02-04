#!/usr/bin/env node
/**
 * Dashboard Feature Parity Check Script
 *
 * Runs feature parity tests and outputs results.
 * Exit code 0 = all required features pass
 * Exit code 1 = one or more required features fail
 *
 * Usage:
 *   node scripts/check-parity.js [--json] [--markdown] [--context <context>]
 *
 * Options:
 *   --json       Output as JSON
 *   --markdown   Output as markdown
 *   --context    Test only specific context (browser, vscode, cli)
 *   --quiet      Only output on failure
 *   --report     Write report to file
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, existsSync } from 'fs';

// Get script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup minimal DOM environment for module loading
// (actual DOM tests require jsdom in browser tests)
const createMinimalDOM = () => {
  const mockStorage = {
    _data: {},
    getItem(key) { return this._data[key] || null; },
    setItem(key, value) { this._data[key] = String(value); },
    removeItem(key) { delete this._data[key]; },
    clear() { this._data = {}; },
  };

  const mockElement = {
    className: '',
    removeAttribute() {},
    setAttribute() {},
  };

  return {
    body: mockElement,
    documentElement: mockElement,
    localStorage: mockStorage,
  };
};

// Setup globals only if not already present (Node.js environment)
if (typeof global !== 'undefined' && !global.document) {
  const mockDOM = createMinimalDOM();
  global.document = mockDOM;
  global.localStorage = mockDOM.localStorage;
  global.window = {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    localStorage: mockDOM.localStorage,
  };
  global.matchMedia = global.window.matchMedia;
  global.getComputedStyle = () => ({ getPropertyValue: () => '' });
  global.MutationObserver = class { observe() {} disconnect() {} };
  global.HTMLElement = class {};
  global.customElements = { define: () => {} };
}

// Parse arguments
const args = process.argv.slice(2);
const options = {
  json: args.includes('--json'),
  markdown: args.includes('--markdown'),
  quiet: args.includes('--quiet'),
  context: args.includes('--context') ? args[args.indexOf('--context') + 1] : null,
  report: args.includes('--report') ? args[args.indexOf('--report') + 1] : null,
};

// =============================================================================
// FEATURE DEFINITIONS (matching test file)
// =============================================================================

const CONTEXTS = {
  browser: {
    name: 'Browser',
    setup: () => {
      document.body.className = '';
      document.documentElement.removeAttribute('data-loki-context');
    },
    cleanup: () => {
      document.body.className = '';
    },
  },
  vscode: {
    name: 'VS Code Webview',
    setup: () => {
      document.body.className = 'vscode-body vscode-dark';
      document.documentElement.setAttribute('data-loki-context', 'vscode');
    },
    cleanup: () => {
      document.body.className = '';
      document.documentElement.removeAttribute('data-loki-context');
    },
  },
  cli: {
    name: 'CLI Embedded',
    setup: () => {
      document.body.className = '';
      document.documentElement.setAttribute('data-loki-context', 'cli');
    },
    cleanup: () => {
      document.documentElement.removeAttribute('data-loki-context');
    },
  },
};

// Simplified feature matrix for Node.js testing
// (Full component tests require browser environment)
const FEATURE_MATRIX = {
  themes: {
    component: null,
    features: {
      'theme-light': {
        description: 'Light theme is defined',
        required: true,
        testFn: (THEMES) => !!THEMES?.light && Object.keys(THEMES.light).length > 20,
      },
      'theme-dark': {
        description: 'Dark theme is defined',
        required: true,
        testFn: (THEMES) => !!THEMES?.dark && Object.keys(THEMES.dark).length > 20,
      },
      'theme-high-contrast': {
        description: 'High contrast theme is defined',
        required: true,
        testFn: (THEMES) => !!THEMES?.['high-contrast'],
      },
      'theme-vscode-light': {
        description: 'VS Code light theme is defined',
        required: true,
        testFn: (THEMES) => !!THEMES?.['vscode-light'],
      },
      'theme-vscode-dark': {
        description: 'VS Code dark theme is defined',
        required: true,
        testFn: (THEMES) => !!THEMES?.['vscode-dark'],
      },
      'theme-variables-complete': {
        description: 'All themes have required variables',
        required: true,
        testFn: (THEMES) => {
          const required = ['--loki-bg-primary', '--loki-text-primary', '--loki-accent'];
          return Object.values(THEMES || {}).every(theme =>
            required.every(v => v in theme)
          );
        },
      },
    },
  },
  keyboardShortcuts: {
    component: null,
    features: {
      'nav-next-item': {
        description: 'ArrowDown shortcut defined',
        required: true,
        testFn: (_, KEYBOARD_SHORTCUTS) => KEYBOARD_SHORTCUTS?.['navigation.nextItem']?.key === 'ArrowDown',
      },
      'nav-prev-item': {
        description: 'ArrowUp shortcut defined',
        required: true,
        testFn: (_, KEYBOARD_SHORTCUTS) => KEYBOARD_SHORTCUTS?.['navigation.prevItem']?.key === 'ArrowUp',
      },
      'nav-confirm': {
        description: 'Enter shortcut defined',
        required: true,
        testFn: (_, KEYBOARD_SHORTCUTS) => KEYBOARD_SHORTCUTS?.['navigation.confirm']?.key === 'Enter',
      },
      'nav-cancel': {
        description: 'Escape shortcut defined',
        required: true,
        testFn: (_, KEYBOARD_SHORTCUTS) => KEYBOARD_SHORTCUTS?.['navigation.cancel']?.key === 'Escape',
      },
      'action-refresh': {
        description: 'Refresh shortcut defined',
        required: true,
        testFn: (_, KEYBOARD_SHORTCUTS) => KEYBOARD_SHORTCUTS?.['action.refresh']?.key === 'r',
      },
      'theme-toggle': {
        description: 'Theme toggle shortcut defined',
        required: true,
        testFn: (_, KEYBOARD_SHORTCUTS) => KEYBOARD_SHORTCUTS?.['theme.toggle']?.key === 'd',
      },
    },
  },
  ariaPatterns: {
    component: null,
    features: {
      'button-pattern': {
        description: 'Button ARIA pattern defined',
        required: true,
        testFn: (_, __, ARIA_PATTERNS) => ARIA_PATTERNS?.button?.role === 'button',
      },
      'tab-patterns': {
        description: 'Tab ARIA patterns defined',
        required: true,
        testFn: (_, __, ARIA_PATTERNS) => {
          return ARIA_PATTERNS?.tablist?.role === 'tablist' &&
                 ARIA_PATTERNS?.tab?.role === 'tab' &&
                 ARIA_PATTERNS?.tabpanel?.role === 'tabpanel';
        },
      },
      'log-pattern': {
        description: 'Log ARIA pattern defined',
        required: true,
        testFn: (_, __, ARIA_PATTERNS) => ARIA_PATTERNS?.log?.role === 'log',
      },
      'live-regions': {
        description: 'Live region patterns defined',
        required: true,
        testFn: (_, __, ARIA_PATTERNS) => {
          return ARIA_PATTERNS?.livePolite?.ariaLive === 'polite' &&
                 ARIA_PATTERNS?.liveAssertive?.ariaLive === 'assertive';
        },
      },
    },
  },
  componentFiles: {
    component: null,
    features: {
      'task-board-exists': {
        description: 'Task board component file exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../components/loki-task-board.js')),
      },
      'session-control-exists': {
        description: 'Session control component file exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../components/loki-session-control.js')),
      },
      'log-stream-exists': {
        description: 'Log stream component file exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../components/loki-log-stream.js')),
      },
      'memory-browser-exists': {
        description: 'Memory browser component file exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../components/loki-memory-browser.js')),
      },
      'unified-styles-exists': {
        description: 'Unified styles module exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../core/loki-unified-styles.js')),
      },
      'theme-module-exists': {
        description: 'Theme module exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../core/loki-theme.js')),
      },
      'api-client-exists': {
        description: 'API client module exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../core/loki-api-client.js')),
      },
      'state-module-exists': {
        description: 'State module exists',
        required: true,
        testFn: () => existsSync(join(__dirname, '../core/loki-state.js')),
      },
    },
  },
};

// =============================================================================
// PARITY CHECK
// =============================================================================

async function runParityCheck() {
  let THEMES, KEYBOARD_SHORTCUTS, ARIA_PATTERNS;

  try {
    const unifiedStyles = await import(join(__dirname, '../core/loki-unified-styles.js'));
    THEMES = unifiedStyles.THEMES;
    KEYBOARD_SHORTCUTS = unifiedStyles.KEYBOARD_SHORTCUTS;
    ARIA_PATTERNS = unifiedStyles.ARIA_PATTERNS;
  } catch (error) {
    console.error('Failed to import unified styles:', error.message);
    process.exit(1);
  }

  const report = {
    timestamp: new Date().toISOString(),
    contexts: {},
    summary: {
      totalFeatures: 0,
      passedFeatures: 0,
      failedFeatures: 0,
      parityPassed: true,
    },
  };

  const contextsToTest = options.context
    ? { [options.context]: CONTEXTS[options.context] }
    : CONTEXTS;

  for (const [contextId, context] of Object.entries(contextsToTest)) {
    if (!context) {
      console.error(`Unknown context: ${options.context}`);
      process.exit(1);
    }

    context.setup();

    report.contexts[contextId] = {
      name: context.name,
      categories: {},
      passed: 0,
      failed: 0,
      total: 0,
    };

    for (const [categoryId, category] of Object.entries(FEATURE_MATRIX)) {
      report.contexts[contextId].categories[categoryId] = {
        component: category.component,
        features: {},
      };

      for (const [featureId, feature] of Object.entries(category.features)) {
        let passed = false;
        let error = null;

        try {
          passed = feature.testFn(THEMES, KEYBOARD_SHORTCUTS, ARIA_PATTERNS);
        } catch (e) {
          error = e.message;
        }

        report.contexts[contextId].categories[categoryId].features[featureId] = {
          description: feature.description,
          required: feature.required,
          passed,
          error,
        };

        report.contexts[contextId].total++;
        report.summary.totalFeatures++;

        if (passed) {
          report.contexts[contextId].passed++;
          report.summary.passedFeatures++;
        } else {
          report.contexts[contextId].failed++;
          report.summary.failedFeatures++;

          if (feature.required) {
            report.summary.parityPassed = false;
          }
        }
      }
    }

    context.cleanup();
  }

  return report;
}

// =============================================================================
// OUTPUT FORMATTERS
// =============================================================================

function formatAsJSON(report) {
  return JSON.stringify(report, null, 2);
}

function formatAsMarkdown(report) {
  let md = `# Feature Parity Report\n\n`;
  md += `Generated: ${report.timestamp}\n\n`;
  md += `## Summary\n\n`;
  md += `- Total Features: ${report.summary.totalFeatures}\n`;
  md += `- Passed: ${report.summary.passedFeatures}\n`;
  md += `- Failed: ${report.summary.failedFeatures}\n`;
  md += `- Parity Status: ${report.summary.parityPassed ? 'PASSED' : 'FAILED'}\n\n`;

  for (const [contextId, context] of Object.entries(report.contexts)) {
    md += `## ${context.name}\n\n`;
    md += `| Category | Feature | Required | Status |\n`;
    md += `|----------|---------|----------|--------|\n`;

    for (const [categoryId, category] of Object.entries(context.categories)) {
      for (const [featureId, feature] of Object.entries(category.features)) {
        const status = feature.passed ? 'PASS' : 'FAIL';
        const required = feature.required ? 'Yes' : 'No';
        md += `| ${categoryId} | ${feature.description} | ${required} | ${status} |\n`;
      }
    }

    md += `\n`;
  }

  return md;
}

function formatAsText(report) {
  let text = '';
  text += '='.repeat(60) + '\n';
  text += 'FEATURE PARITY CHECK REPORT\n';
  text += '='.repeat(60) + '\n\n';
  text += `Generated: ${report.timestamp}\n\n`;

  text += 'SUMMARY\n';
  text += '-'.repeat(40) + '\n';
  text += `Total Features: ${report.summary.totalFeatures}\n`;
  text += `Passed: ${report.summary.passedFeatures}\n`;
  text += `Failed: ${report.summary.failedFeatures}\n`;
  text += `Status: ${report.summary.parityPassed ? 'PASSED' : 'FAILED'}\n\n`;

  for (const [contextId, context] of Object.entries(report.contexts)) {
    text += `\n${context.name.toUpperCase()}\n`;
    text += '-'.repeat(40) + '\n';

    for (const [categoryId, category] of Object.entries(context.categories)) {
      text += `\n  ${categoryId}:\n`;

      for (const [featureId, feature] of Object.entries(category.features)) {
        const status = feature.passed ? '[PASS]' : '[FAIL]';
        const required = feature.required ? '*' : ' ';
        text += `    ${status}${required} ${feature.description}\n`;

        if (feature.error) {
          text += `           Error: ${feature.error}\n`;
        }
      }
    }
  }

  text += '\n' + '='.repeat(60) + '\n';
  text += `* = Required feature\n`;
  text += `Overall: ${report.summary.parityPassed ? 'PASSED' : 'FAILED'}\n`;

  return text;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  if (!options.quiet) {
    console.log('Running feature parity check...\n');
  }

  const report = await runParityCheck();

  let output;
  if (options.json) {
    output = formatAsJSON(report);
  } else if (options.markdown) {
    output = formatAsMarkdown(report);
  } else {
    output = formatAsText(report);
  }

  // Write to file if requested
  if (options.report) {
    writeFileSync(options.report, output);
    if (!options.quiet) {
      console.log(`Report written to: ${options.report}\n`);
    }
  }

  // Output to console
  if (!options.quiet || !report.summary.parityPassed) {
    console.log(output);
  }

  // Exit with appropriate code
  if (!report.summary.parityPassed) {
    console.error('\nFeature parity check FAILED\n');
    process.exit(1);
  }

  if (!options.quiet) {
    console.log('\nFeature parity check PASSED\n');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Error running parity check:', error);
  process.exit(1);
});
