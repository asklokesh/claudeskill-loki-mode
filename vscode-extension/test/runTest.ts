/**
 * Test runner for VS Code extension tests
 * Can run outside of VS Code for unit tests
 */

import * as path from 'path';
import * as fs from 'fs';

// Simple test framework for running tests outside VS Code
interface TestCase {
    name: string;
    fn: () => void | Promise<void>;
}

interface TestSuite {
    name: string;
    tests: TestCase[];
}

const suites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

// Test DSL functions
function describe(name: string, fn: () => void): void {
    const suite: TestSuite = { name, tests: [] };
    suites.push(suite);
    const previousSuite = currentSuite;
    currentSuite = suite;
    fn();
    currentSuite = previousSuite;
}

function it(name: string, fn: () => void | Promise<void>): void {
    if (currentSuite) {
        currentSuite.tests.push({ name, fn });
    }
}

// Basic assertion library
const assert = {
    ok(value: unknown, message?: string): void {
        if (!value) {
            throw new Error(message || `Expected truthy value but got ${value}`);
        }
    },
    strictEqual<T>(actual: T, expected: T, message?: string): void {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected} but got ${actual}`);
        }
    },
    deepStrictEqual<T>(actual: T, expected: T, message?: string): void {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
    }
};

// Make test DSL available globally
(global as Record<string, unknown>).describe = describe;
(global as Record<string, unknown>).it = it;
(global as Record<string, unknown>).assert = assert;

async function runTests(): Promise<void> {
    console.log('Running Loki Mode VS Code Extension Tests\n');
    console.log('='.repeat(50));

    // Import test files
    const testDir = path.join(__dirname, 'suite');
    if (fs.existsSync(testDir)) {
        const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.ts') || f.endsWith('.test.js'));

        for (const file of testFiles) {
            try {
                // Clear require cache for fresh import
                const testPath = path.join(testDir, file);
                delete require.cache[require.resolve(testPath)];
                require(testPath);
            } catch (e) {
                console.error(`Failed to load test file ${file}:`, e);
            }
        }
    }

    let totalPassed = 0;
    let totalFailed = 0;

    for (const suite of suites) {
        console.log(`\n${suite.name}`);

        for (const test of suite.tests) {
            try {
                await test.fn();
                console.log(`  [PASS] ${test.name}`);
                totalPassed++;
            } catch (e) {
                const error = e instanceof Error ? e.message : String(e);
                console.log(`  [FAIL] ${test.name}`);
                console.log(`         ${error}`);
                totalFailed++;
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Results: ${totalPassed} passed, ${totalFailed} failed`);

    if (totalFailed > 0) {
        process.exit(1);
    }
}

// Run tests
runTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
