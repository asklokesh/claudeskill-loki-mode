#!/bin/bash
#===============================================================================
# Playwright Smoke Test Module (v5.46.0)
#
# Runs lightweight smoke tests against a running user application to verify
# it loads correctly. Advisory only - failures do NOT block iterations or
# council approval.
#
# Functions:
#   playwright_verify_init()        - Check/install Playwright
#   playwright_verify_app(url)      - Run smoke test against URL
#   playwright_verify_should_run()  - Check if verification should run
#   playwright_verify_summary()     - One-line summary for prompt injection
#   playwright_verify_as_evidence() - Formatted output for council evidence
#
# Environment Variables:
#   LOKI_PLAYWRIGHT_ENABLED    - Enable/disable (default: true)
#   LOKI_PLAYWRIGHT_INTERVAL   - Run every N iterations (default: 5)
#   LOKI_PLAYWRIGHT_TIMEOUT    - Page load timeout in ms (default: 15000)
#
# Data:
#   .loki/verification/playwright-results.json  - Last results
#   .loki/verification/screenshots/             - Captured screenshots
#
#===============================================================================

# Configuration
PLAYWRIGHT_ENABLED=${LOKI_PLAYWRIGHT_ENABLED:-true}
PLAYWRIGHT_INTERVAL=${LOKI_PLAYWRIGHT_INTERVAL:-5}
# Guard against zero/negative interval (division by zero in modulo)
if [ "$PLAYWRIGHT_INTERVAL" -le 0 ] 2>/dev/null; then
    PLAYWRIGHT_INTERVAL=5
fi
PLAYWRIGHT_TIMEOUT=${LOKI_PLAYWRIGHT_TIMEOUT:-15000}
# Derive seconds for the outer timeout wrapper (add buffer for browser startup)
PLAYWRIGHT_TIMEOUT_SEC=$(( (PLAYWRIGHT_TIMEOUT / 1000) + 15 ))

# Internal state
PLAYWRIGHT_VERIFY_DIR=""
PLAYWRIGHT_RESULTS_FILE=""
PLAYWRIGHT_LAST_VERIFY_ITERATION=0
PLAYWRIGHT_AVAILABLE=false
PLAYWRIGHT_MAX_SCREENSHOTS=10

#===============================================================================
# Initialization
#===============================================================================

playwright_verify_init() {
    # Check if npx playwright is available; attempt chromium install if needed.
    # Returns 0 if playwright available, 1 if not.

    if [ "$PLAYWRIGHT_ENABLED" != "true" ]; then
        return 1
    fi

    PLAYWRIGHT_VERIFY_DIR=".loki/verification"
    PLAYWRIGHT_RESULTS_FILE="${PLAYWRIGHT_VERIFY_DIR}/playwright-results.json"
    mkdir -p "${PLAYWRIGHT_VERIFY_DIR}/screenshots"

    # Check if playwright is accessible via npx
    if ! npx playwright --version &>/dev/null; then
        log_warn "Playwright not found via npx - smoke tests disabled"
        PLAYWRIGHT_AVAILABLE=false
        return 1
    fi

    # Check if chromium browser is installed; attempt install if not
    if ! npx playwright install --dry-run chromium &>/dev/null; then
        log_info "Installing Playwright chromium browser..."
        if ! timeout 60 npx playwright install chromium &>/dev/null; then
            log_warn "Failed to install Playwright chromium - smoke tests disabled"
            PLAYWRIGHT_AVAILABLE=false
            return 1
        fi
    fi

    PLAYWRIGHT_AVAILABLE=true
    log_info "Playwright smoke tests initialized (every ${PLAYWRIGHT_INTERVAL} iterations, ${PLAYWRIGHT_TIMEOUT}ms timeout)"
    return 0
}

#===============================================================================
# Interval Control
#===============================================================================

playwright_verify_should_run() {
    # Returns 0 (true) if verification should run this iteration
    if [ "$PLAYWRIGHT_ENABLED" != "true" ]; then
        return 1
    fi

    if [ "$PLAYWRIGHT_AVAILABLE" != "true" ]; then
        return 1
    fi

    local current_iteration="${ITERATION_COUNT:-0}"
    if [ "$current_iteration" -eq 0 ]; then
        return 1
    fi

    if [ $((current_iteration % PLAYWRIGHT_INTERVAL)) -ne 0 ]; then
        return 1
    fi

    # Don't verify same iteration twice
    if [ "$current_iteration" -eq "$PLAYWRIGHT_LAST_VERIFY_ITERATION" ]; then
        return 1
    fi

    return 0
}

#===============================================================================
# Smoke Test
#===============================================================================

playwright_verify_app() {
    local url="$1"

    if [ -z "$url" ]; then
        log_warn "playwright_verify_app: no URL provided"
        return 0
    fi

    local verify_dir="${PLAYWRIGHT_VERIFY_DIR:-.loki/verification}"
    local screenshots_dir="${verify_dir}/screenshots"
    mkdir -p "$screenshots_dir"

    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H%M%SZ)
    local screenshot_path="${screenshots_dir}/verify-${timestamp}.png"
    local results_file="${verify_dir}/playwright-results.json"
    local script_file="${verify_dir}/.smoke-test.js"

    log_step "Running Playwright smoke test against ${url}..."

    # Generate inline smoke test script
    cat > "$script_file" << 'SMOKE_SCRIPT'
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2];
  const screenshotPath = process.argv[3];
  const resultsPath = process.argv[4];
  const pageTimeout = parseInt(process.argv[5] || '15000', 10);
  const startTime = Date.now();

  const results = {
    verified_at: new Date().toISOString(),
    url: url,
    passed: false,
    checks: {
      page_loads: false,
      no_5xx: false,
      no_console_errors: true,
      has_title: false,
      has_content: false
    },
    screenshot: screenshotPath,
    errors: [],
    duration_ms: 0
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Navigate to URL
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: pageTimeout
    });
    results.checks.page_loads = true;

    // Check HTTP status (no 5xx)
    const status = response ? response.status() : 0;
    results.checks.no_5xx = status < 500;
    if (status >= 500) results.errors.push('HTTP ' + status);

    // Check console errors
    if (consoleErrors.length > 0) {
      results.checks.no_console_errors = false;
      results.errors.push(...consoleErrors.slice(0, 5));
    }

    // Check page title
    const title = await page.title();
    results.checks.has_title = title.length > 0;

    // Check visible content
    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '');
    results.checks.has_content = bodyText.length > 0;

    // Capture screenshot
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Determine overall pass
    results.passed = Object.values(results.checks).every(v => v === true);

  } catch (err) {
    results.errors.push(err.message);
  } finally {
    if (browser) await browser.close();
    results.duration_ms = Date.now() - startTime;

    // Atomic write: temp file then rename
    const fs = require('fs');
    const tmp = resultsPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(results, null, 2));
    fs.renameSync(tmp, resultsPath);
  }

  process.exit(results.passed ? 0 : 1);
})();
SMOKE_SCRIPT

    # Run with outer timeout (never block iteration)
    timeout "${PLAYWRIGHT_TIMEOUT_SEC}" node "$script_file" \
        "$url" "$screenshot_path" "$results_file" "$PLAYWRIGHT_TIMEOUT" 2>/dev/null
    local exit_code=$?

    # Clean up generated script
    rm -f "$script_file"

    # Update tracking state
    PLAYWRIGHT_LAST_VERIFY_ITERATION="${ITERATION_COUNT:-0}"

    # Rotate screenshots: keep only the most recent N
    _playwright_rotate_screenshots "$screenshots_dir"

    # Log result
    if [ -f "$results_file" ]; then
        local summary
        summary=$(playwright_verify_summary 2>/dev/null || true)
        if [ -n "$summary" ]; then
            log_info "Playwright: $summary"
        fi
    elif [ "$exit_code" -eq 124 ]; then
        log_warn "Playwright smoke test timed out after ${PLAYWRIGHT_TIMEOUT_SEC}s"
    else
        log_warn "Playwright smoke test failed (exit $exit_code)"
    fi

    # Never fail the iteration
    return 0
}

#===============================================================================
# Screenshot Rotation
#===============================================================================

_playwright_rotate_screenshots() {
    local dir="$1"
    local max=${PLAYWRIGHT_MAX_SCREENSHOTS}

    # Count existing screenshots
    local count
    count=$(find "$dir" -maxdepth 1 -name 'verify-*.png' 2>/dev/null | wc -l | tr -d ' ')

    if [ "$count" -gt "$max" ]; then
        local to_remove=$((count - max))
        # Remove oldest files (sorted by name, which is timestamp-based)
        find "$dir" -maxdepth 1 -name 'verify-*.png' 2>/dev/null \
            | sort | head -n "$to_remove" \
            | xargs rm -f 2>/dev/null || true
    fi
}

#===============================================================================
# Summary (for prompt injection)
#===============================================================================

playwright_verify_summary() {
    # Returns one-line summary string
    if [ ! -f "$PLAYWRIGHT_RESULTS_FILE" ]; then
        echo ""
        return 0
    fi

    _PW_RESULTS="$PLAYWRIGHT_RESULTS_FILE" python3 -c "
import json, os
try:
    data = json.load(open(os.environ['_PW_RESULTS']))
    checks = data.get('checks', {})
    passed = sum(1 for v in checks.values() if v)
    total = len(checks)
    status = 'PASS' if data.get('passed') else 'FAIL'
    duration = data.get('duration_ms', 0)
    url = data.get('url', '?')
    errors = data.get('errors', [])
    err_detail = ''
    if errors:
        err_detail = ' Errors: ' + '; '.join(errors[:3])
    print(f'{status} {passed}/{total} checks ({duration}ms) {url}{err_detail}')
except Exception:
    print('')
" 2>/dev/null || echo ""
}

#===============================================================================
# Council Evidence (for completion-council.sh)
#===============================================================================

playwright_verify_as_evidence() {
    # Writes formatted smoke test evidence to stdout or appends to file
    local evidence_file="${1:-}"

    if [ ! -f "$PLAYWRIGHT_RESULTS_FILE" ]; then
        return 0
    fi

    {
        echo ""
        echo "## Playwright Smoke Test"
        echo ""

        _PW_RESULTS="$PLAYWRIGHT_RESULTS_FILE" python3 -c "
import json, os
try:
    data = json.load(open(os.environ['_PW_RESULTS']))
    checks = data.get('checks', {})
    status = 'PASS' if data.get('passed') else 'FAIL'
    print(f'Overall: {status} | URL: {data.get(\"url\", \"?\")} | Duration: {data.get(\"duration_ms\", 0)}ms')
    print()
    for name, result in checks.items():
        label = '[PASS]' if result else '[FAIL]'
        print(f'  {label} {name}')
    errors = data.get('errors', [])
    if errors:
        print()
        print('Errors:')
        for e in errors[:5]:
            print(f'  - {e}')
    screenshot = data.get('screenshot', '')
    if screenshot:
        print()
        print(f'Screenshot: {screenshot}')
except Exception:
    print('Playwright data unavailable')
" 2>/dev/null || echo "Playwright data unavailable"
    } >> "${evidence_file:-/dev/stdout}"
}
