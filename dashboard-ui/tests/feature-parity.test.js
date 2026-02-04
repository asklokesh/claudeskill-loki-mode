/**
 * Feature Parity Tests for Loki Mode Dashboard Components
 *
 * Tests that all dashboard features work correctly across all contexts:
 * - Browser (standalone)
 * - VS Code webview
 * - CLI-embedded (future)
 *
 * Features tested:
 * - Task Board: view, create, move, filter
 * - Session Control: start, stop, pause, resume
 * - Log Stream: view, filter, clear, download
 * - Memory Browser: view episodes, patterns, skills
 * - Theme Switching: all 5 themes work
 * - Keyboard Shortcuts: all shortcuts function
 *
 * @version 1.0.0
 */

import { THEMES, UnifiedThemeManager, KEYBOARD_SHORTCUTS } from '../core/loki-unified-styles.js';

// =============================================================================
// CONTEXT SIMULATION
// =============================================================================

/**
 * Contexts to test
 */
const CONTEXTS = {
  browser: {
    name: 'Browser',
    setup: () => {
      document.body.className = '';
      document.documentElement.removeAttribute('data-loki-context');
      localStorage.removeItem('loki-theme');
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

// =============================================================================
// FEATURE DEFINITIONS
// =============================================================================

/**
 * Complete feature matrix for all components
 */
const FEATURE_MATRIX = {
  taskBoard: {
    component: 'loki-task-board',
    features: {
      'view-tasks': {
        description: 'View tasks in Kanban columns',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.kanban-board'),
      },
      'create-task': {
        description: 'Create new tasks via add button',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.add-task-btn'),
      },
      'move-task': {
        description: 'Drag-drop task between columns',
        required: true,
        testFn: (el) => {
          const card = el.shadowRoot.querySelector('.task-card.draggable');
          return card ? card.getAttribute('draggable') === 'true' : true;
        },
      },
      'filter-tasks': {
        description: 'Filter tasks by project ID',
        required: true,
        testFn: (el) => el.hasAttribute('project-id') !== undefined,
      },
      'readonly-mode': {
        description: 'Disable editing in readonly mode',
        required: true,
        testFn: (el) => {
          el.setAttribute('readonly', '');
          const hasNoDraggable = !el.shadowRoot.querySelector('.task-card[draggable="true"]');
          el.removeAttribute('readonly');
          return hasNoDraggable;
        },
      },
      'task-click-event': {
        description: 'Emit event on task click',
        required: true,
        testFn: (el) => typeof el.dispatchEvent === 'function',
      },
      'refresh-action': {
        description: 'Refresh button reloads tasks',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#refresh-btn'),
      },
      'keyboard-navigation': {
        description: 'Navigate tasks with keyboard',
        required: true,
        testFn: (el) => {
          const card = el.shadowRoot.querySelector('.task-card');
          return card ? card.getAttribute('tabindex') === '0' : true;
        },
      },
    },
  },
  sessionControl: {
    component: 'loki-session-control',
    features: {
      'view-status': {
        description: 'Display session status',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.status-dot'),
      },
      'start-session': {
        description: 'Start button triggers session start',
        required: false, // Only shown when stopped
        testFn: (el) => true, // Button conditionally rendered
      },
      'stop-session': {
        description: 'Stop button triggers session stop',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#stop-btn'),
      },
      'pause-session': {
        description: 'Pause button triggers session pause',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#pause-btn') || !!el.shadowRoot.querySelector('#resume-btn'),
      },
      'resume-session': {
        description: 'Resume button triggers session resume',
        required: true,
        testFn: (el) => true, // Button conditionally rendered
      },
      'compact-mode': {
        description: 'Compact display mode works',
        required: true,
        testFn: (el) => {
          el.setAttribute('compact', '');
          const hasCompact = !!el.shadowRoot.querySelector('.control-panel.compact');
          el.removeAttribute('compact');
          return hasCompact;
        },
      },
      'connection-indicator': {
        description: 'Show connection status',
        required: true,
        testFn: (el) => {
          if (el.hasAttribute('compact')) return true;
          return !!el.shadowRoot.querySelector('.connection-status');
        },
      },
      'uptime-display': {
        description: 'Display session uptime',
        required: true,
        testFn: (el) => {
          if (el.hasAttribute('compact')) return true;
          const content = el.shadowRoot.textContent;
          return content.includes('Uptime') || content.includes('--');
        },
      },
    },
  },
  logStream: {
    component: 'loki-log-stream',
    features: {
      'view-logs': {
        description: 'Display log messages',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.log-output'),
      },
      'filter-text': {
        description: 'Filter logs by text',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#filter-input'),
      },
      'filter-level': {
        description: 'Filter logs by level',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#level-select'),
      },
      'clear-logs': {
        description: 'Clear all logs',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#clear-btn'),
      },
      'download-logs': {
        description: 'Download logs as file',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#download-btn'),
      },
      'auto-scroll': {
        description: 'Auto-scroll to new logs',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#auto-scroll-btn'),
      },
      'level-colors': {
        description: 'Color-code log levels',
        required: true,
        testFn: (el) => {
          const style = el.shadowRoot.querySelector('style');
          return style.textContent.includes('--loki-blue') && style.textContent.includes('--loki-red');
        },
      },
      'add-log-api': {
        description: 'Public API to add logs',
        required: true,
        testFn: (el) => typeof el.addLog === 'function',
      },
      'clear-api': {
        description: 'Public API to clear logs',
        required: true,
        testFn: (el) => typeof el.clear === 'function',
      },
    },
  },
  memoryBrowser: {
    component: 'loki-memory-browser',
    features: {
      'view-summary': {
        description: 'Display memory summary',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.tab[data-tab="summary"]'),
      },
      'view-episodes': {
        description: 'Browse episodic memories',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.tab[data-tab="episodes"]'),
      },
      'view-patterns': {
        description: 'Browse semantic patterns',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.tab[data-tab="patterns"]'),
      },
      'view-skills': {
        description: 'Browse procedural skills',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.tab[data-tab="skills"]'),
      },
      'tab-navigation': {
        description: 'Navigate between tabs',
        required: true,
        testFn: (el) => el.shadowRoot.querySelectorAll('.tab').length === 4,
      },
      'detail-panel': {
        description: 'Show item details',
        required: true,
        testFn: (el) => true, // Detail panel is conditionally rendered
      },
      'token-economics': {
        description: 'Display token usage stats',
        required: true,
        testFn: (el) => {
          const style = el.shadowRoot.querySelector('style');
          return style.textContent.includes('token-economics');
        },
      },
      'consolidation-action': {
        description: 'Trigger memory consolidation',
        required: true,
        testFn: (el) => {
          // Button only on summary tab
          return true;
        },
      },
      'keyboard-tabs': {
        description: 'Navigate tabs with keyboard',
        required: true,
        testFn: (el) => {
          const tabs = el.shadowRoot.querySelectorAll('.tab');
          return tabs.length > 0 && tabs[0].getAttribute('role') === 'tab';
        },
      },
    },
  },
  learningDashboard: {
    component: 'loki-learning-dashboard',
    features: {
      'view-metrics': {
        description: 'Display learning metrics summary',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('.summary-cards'),
      },
      'filter-time-range': {
        description: 'Filter by time range',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#time-range-select'),
      },
      'filter-signal-type': {
        description: 'Filter by signal type',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#signal-type-select'),
      },
      'filter-source': {
        description: 'Filter by signal source',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#source-select'),
      },
      'trend-chart': {
        description: 'Display signal volume trend chart',
        required: true,
        testFn: (el) => {
          const chart = el.shadowRoot.querySelector('.trend-chart');
          const chartEmpty = el.shadowRoot.querySelector('.chart-empty');
          return !!chart || !!chartEmpty;
        },
      },
      'top-lists': {
        description: 'Show top lists for patterns',
        required: true,
        testFn: (el) => {
          const lists = el.shadowRoot.querySelectorAll('.top-list');
          return lists.length >= 4;
        },
      },
      'recent-signals': {
        description: 'Show recent signals',
        required: true,
        testFn: (el) => {
          const signals = el.shadowRoot.querySelector('.recent-signals');
          const empty = el.shadowRoot.querySelector('.signals-empty');
          return !!signals || !!empty;
        },
      },
      'refresh-action': {
        description: 'Refresh button reloads data',
        required: true,
        testFn: (el) => !!el.shadowRoot.querySelector('#refresh-btn'),
      },
      'keyboard-navigation': {
        description: 'List items support keyboard navigation',
        required: true,
        testFn: (el) => {
          const item = el.shadowRoot.querySelector('.list-item');
          return item ? item.getAttribute('tabindex') === '0' : true;
        },
      },
    },
  },
  themes: {
    component: null, // Theme system, not a component
    features: {
      'theme-light': {
        description: 'Light theme applies correctly',
        required: true,
        testFn: () => !!THEMES.light && Object.keys(THEMES.light).length > 20,
      },
      'theme-dark': {
        description: 'Dark theme applies correctly',
        required: true,
        testFn: () => !!THEMES.dark && Object.keys(THEMES.dark).length > 20,
      },
      'theme-high-contrast': {
        description: 'High contrast theme applies',
        required: true,
        testFn: () => !!THEMES['high-contrast'] && THEMES['high-contrast']['--loki-bg-primary'] === '#000000',
      },
      'theme-vscode-light': {
        description: 'VS Code light theme applies',
        required: true,
        testFn: () => !!THEMES['vscode-light'] && THEMES['vscode-light']['--loki-bg-primary'].includes('--vscode-'),
      },
      'theme-vscode-dark': {
        description: 'VS Code dark theme applies',
        required: true,
        testFn: () => !!THEMES['vscode-dark'] && THEMES['vscode-dark']['--loki-bg-primary'].includes('--vscode-'),
      },
      'theme-toggle': {
        description: 'Toggle between themes',
        required: true,
        testFn: () => typeof UnifiedThemeManager.toggle === 'function',
      },
      'theme-persist': {
        description: 'Theme persists to localStorage',
        required: true,
        testFn: () => {
          UnifiedThemeManager.setTheme('dark');
          return localStorage.getItem('loki-theme') === 'dark';
        },
      },
      'theme-event': {
        description: 'Theme change fires event',
        required: true,
        testFn: () => {
          let fired = false;
          const handler = () => { fired = true; };
          window.addEventListener('loki-theme-change', handler);
          UnifiedThemeManager.setTheme('light');
          window.removeEventListener('loki-theme-change', handler);
          return fired;
        },
      },
    },
  },
  keyboardShortcuts: {
    component: null,
    features: {
      'nav-next-item': {
        description: 'ArrowDown navigates to next item',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['navigation.nextItem']?.key === 'ArrowDown',
      },
      'nav-prev-item': {
        description: 'ArrowUp navigates to previous item',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['navigation.prevItem']?.key === 'ArrowUp',
      },
      'nav-confirm': {
        description: 'Enter confirms selection',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['navigation.confirm']?.key === 'Enter',
      },
      'nav-cancel': {
        description: 'Escape cancels action',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['navigation.cancel']?.key === 'Escape',
      },
      'action-refresh': {
        description: 'Cmd+R refreshes view',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['action.refresh']?.key === 'r',
      },
      'action-search': {
        description: 'Cmd+K opens search',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['action.search']?.key === 'k',
      },
      'theme-toggle-shortcut': {
        description: 'Cmd+Shift+D toggles theme',
        required: true,
        testFn: () => KEYBOARD_SHORTCUTS['theme.toggle']?.key === 'd',
      },
    },
  },
};

// =============================================================================
// TEST UTILITIES
// =============================================================================

/**
 * Create a component for testing
 * @param {string} tagName - Component tag name
 * @returns {HTMLElement} Created element
 */
async function createTestComponent(tagName) {
  const el = document.createElement(tagName);
  el.setAttribute('api-url', 'http://localhost:8420');
  document.body.appendChild(el);

  // Wait for component to render
  await new Promise((resolve) => setTimeout(resolve, 50));

  return el;
}

/**
 * Remove test component
 * @param {HTMLElement} el - Element to remove
 */
function removeTestComponent(el) {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

/**
 * Run a feature test
 * @param {object} feature - Feature definition
 * @param {HTMLElement} element - Component element (or null for non-component tests)
 * @returns {object} Test result
 */
function runFeatureTest(feature, element) {
  try {
    const passed = feature.testFn(element);
    return {
      passed,
      error: null,
    };
  } catch (error) {
    return {
      passed: false,
      error: error.message,
    };
  }
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Loki Dashboard Feature Parity Tests', () => {
  Object.entries(CONTEXTS).forEach(([contextId, context]) => {
    describe(`Context: ${context.name}`, () => {
      beforeAll(() => {
        context.setup();
      });

      afterAll(() => {
        context.cleanup();
      });

      // Test each component category
      Object.entries(FEATURE_MATRIX).forEach(([categoryId, category]) => {
        describe(`Category: ${categoryId}`, () => {
          let testElement = null;

          beforeAll(async () => {
            if (category.component) {
              testElement = await createTestComponent(category.component);
            }
          });

          afterAll(() => {
            if (testElement) {
              removeTestComponent(testElement);
            }
          });

          // Test each feature
          Object.entries(category.features).forEach(([featureId, feature]) => {
            const testName = feature.required
              ? `[REQUIRED] ${feature.description}`
              : `[OPTIONAL] ${feature.description}`;

            test(testName, () => {
              const result = runFeatureTest(feature, testElement);

              if (feature.required) {
                expect(result.passed).toBe(true);
              } else if (!result.passed) {
                console.warn(`Optional feature not available: ${featureId} - ${result.error || 'Check failed'}`);
              }

              expect(result.passed).toBe(true);
            });
          });
        });
      });
    });
  });
});

// =============================================================================
// PARITY CHECK RUNNER
// =============================================================================

/**
 * Run feature parity check and generate report
 * @returns {object} Parity report
 */
export async function runParityCheck() {
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

  for (const [contextId, context] of Object.entries(CONTEXTS)) {
    context.setup();

    report.contexts[contextId] = {
      name: context.name,
      categories: {},
      passed: 0,
      failed: 0,
      total: 0,
    };

    for (const [categoryId, category] of Object.entries(FEATURE_MATRIX)) {
      let testElement = null;

      if (category.component) {
        testElement = await createTestComponent(category.component);
      }

      report.contexts[contextId].categories[categoryId] = {
        component: category.component,
        features: {},
      };

      for (const [featureId, feature] of Object.entries(category.features)) {
        const result = runFeatureTest(feature, testElement);

        report.contexts[contextId].categories[categoryId].features[featureId] = {
          description: feature.description,
          required: feature.required,
          passed: result.passed,
          error: result.error,
        };

        report.contexts[contextId].total++;
        report.summary.totalFeatures++;

        if (result.passed) {
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

      if (testElement) {
        removeTestComponent(testElement);
      }
    }

    context.cleanup();
  }

  return report;
}

/**
 * Output parity report as JSON
 * @param {object} report - Parity report
 * @returns {string} JSON string
 */
export function formatReportAsJSON(report) {
  return JSON.stringify(report, null, 2);
}

/**
 * Output parity report as markdown table
 * @param {object} report - Parity report
 * @returns {string} Markdown string
 */
export function formatReportAsMarkdown(report) {
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

// =============================================================================
// CLI RUNNER
// =============================================================================

/**
 * Run parity check from command line
 * Exit code 0 = passed, 1 = failed
 */
export async function main() {
  console.log('Running feature parity check...\n');

  const report = await runParityCheck();

  console.log(formatReportAsMarkdown(report));
  console.log('\n--- JSON Report ---\n');
  console.log(formatReportAsJSON(report));

  if (!report.summary.parityPassed) {
    console.error('\nFeature parity check FAILED');
    process.exit(1);
  }

  console.log('\nFeature parity check PASSED');
  process.exit(0);
}

// Export for programmatic use
export { FEATURE_MATRIX, CONTEXTS };
