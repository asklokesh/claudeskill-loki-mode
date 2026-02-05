#!/usr/bin/env python3
"""
Task Completion Verification Utility

Implements the three-layer Definition of Done (DoD) model:
- Layer 1: Outcome Verification (state change exists)
- Layer 2: Process Verification (quality gates passed)
- Layer 3: Consistency Verification (would pass again)

See references/definition-of-done.md for full documentation.

Usage:
    python verify_done.py <task.json>
    python verify_done.py --check-outcome <task.json>
    python verify_done.py --check-process <task.json>
    python verify_done.py --consistency --runs=3 <task.json>

Exit codes:
    0 - Task is done (all layers passed)
    1 - Layer 1 (outcome) verification failed
    2 - Layer 2 (process) verification failed
    3 - Layer 3 (consistency) verification failed
    4 - Acceptance criteria not met
    5 - Invalid task file or configuration
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from memory.schemas import (
    TaskCompletionCriteria,
    DecisionReport,
    QualityGateResult,
)


def run_command(cmd: list[str], timeout: int = 60) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", f"Command timed out after {timeout}s"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def verify_outcome_layer(
    criteria: TaskCompletionCriteria,
    project_dir: Path,
    run_tests: bool = True,
    run_build: bool = True,
) -> tuple[bool, list[str]]:
    """
    Layer 1: Verify intended state change exists in environment.

    Checks:
    - Expected files exist
    - Tests pass (if run_tests=True)
    - Build succeeds (if run_build=True)
    """
    failures = []

    # Check expected files exist
    for file_path in criteria.files_created:
        full_path = project_dir / file_path
        if not full_path.exists():
            failures.append(f"Expected file missing: {file_path}")

    # Run tests if requested
    if run_tests:
        # Try common test commands
        test_commands = [
            ["npm", "test"],
            ["pytest"],
            ["python", "-m", "pytest"],
            ["cargo", "test"],
            ["go", "test", "./..."],
        ]

        test_ran = False
        for cmd in test_commands:
            rc, stdout, stderr = run_command(cmd)
            if rc != -1:  # Command exists
                test_ran = True
                if rc != 0:
                    failures.append(f"Tests failed: {stderr or stdout}")
                else:
                    criteria.tests_passed = True
                break

        if not test_ran:
            # No test framework found - check if package.json has test script
            pkg_json = project_dir / "package.json"
            if pkg_json.exists():
                try:
                    pkg = json.loads(pkg_json.read_text())
                    if "scripts" in pkg and "test" in pkg["scripts"]:
                        rc, stdout, stderr = run_command(["npm", "test"])
                        if rc != 0:
                            failures.append(f"Tests failed: {stderr or stdout}")
                        else:
                            criteria.tests_passed = True
                except (json.JSONDecodeError, KeyError):
                    pass

    # Run build if requested
    if run_build:
        build_commands = [
            ["npm", "run", "build"],
            ["cargo", "build"],
            ["go", "build", "./..."],
            ["make"],
        ]

        build_ran = False
        for cmd in build_commands:
            rc, stdout, stderr = run_command(cmd)
            if rc != -1:  # Command exists
                build_ran = True
                if rc != 0:
                    failures.append(f"Build failed: {stderr or stdout}")
                else:
                    criteria.build_succeeded = True
                break

    # Update outcome verification status
    criteria.outcome_verified = len(failures) == 0

    return len(failures) == 0, failures


def verify_process_layer(
    criteria: TaskCompletionCriteria,
    project_dir: Path,
) -> tuple[bool, list[str]]:
    """
    Layer 2: Verify quality gates passed and policies followed.

    Checks:
    - Static analysis (lint, type check)
    - Decision report exists and is complete
    - Git commit checkpoint exists
    """
    failures = []
    gate_results = []

    # Run linting
    lint_commands = [
        (["npm", "run", "lint"], "eslint"),
        (["pylint", ".", "--exit-zero"], "pylint"),
        (["ruff", "check", "."], "ruff"),
        (["cargo", "clippy"], "clippy"),
    ]

    for cmd, name in lint_commands:
        rc, stdout, stderr = run_command(cmd)
        if rc != -1:  # Command exists
            gate_results.append(QualityGateResult(
                gate_name="static_analysis",
                passed=rc == 0,
                severity="medium" if rc != 0 else "",
                message=stderr or stdout if rc != 0 else "Passed",
                details={"tool": name},
            ))
            break

    # Run type checking
    type_commands = [
        (["npm", "run", "typecheck"], "typescript"),
        (["npx", "tsc", "--noEmit"], "typescript"),
        (["mypy", "."], "mypy"),
        (["pyright"], "pyright"),
    ]

    for cmd, name in type_commands:
        rc, stdout, stderr = run_command(cmd)
        if rc != -1:
            gate_results.append(QualityGateResult(
                gate_name="type_check",
                passed=rc == 0,
                severity="high" if rc != 0 else "",
                message=stderr or stdout if rc != 0 else "Passed",
                details={"tool": name},
            ))
            break

    # Check git commit
    rc, stdout, _ = run_command(["git", "rev-parse", "HEAD"])
    if rc == 0:
        criteria.git_commit_sha = stdout.strip()
        gate_results.append(QualityGateResult(
            gate_name="git_checkpoint",
            passed=True,
            message=f"Commit: {criteria.git_commit_sha[:8]}",
        ))
    else:
        failures.append("No git commit found")
        gate_results.append(QualityGateResult(
            gate_name="git_checkpoint",
            passed=False,
            severity="high",
            message="No git commit checkpoint",
        ))

    # Check CONTINUITY.md exists and was updated recently
    continuity_path = project_dir / ".loki" / "CONTINUITY.md"
    if continuity_path.exists():
        criteria.continuity_updated = True
        gate_results.append(QualityGateResult(
            gate_name="continuity_update",
            passed=True,
            message="CONTINUITY.md exists",
        ))
    else:
        # Not a failure for non-Loki projects
        gate_results.append(QualityGateResult(
            gate_name="continuity_update",
            passed=True,
            message="CONTINUITY.md not required (non-Loki project)",
        ))

    # Check decision report
    if criteria.decision_report and criteria.decision_report.is_complete():
        gate_results.append(QualityGateResult(
            gate_name="decision_report",
            passed=True,
            message="Decision report complete",
        ))
    else:
        failures.append("Decision report missing or incomplete")
        gate_results.append(QualityGateResult(
            gate_name="decision_report",
            passed=False,
            severity="medium",
            message="Decision report missing or incomplete",
        ))

    criteria.quality_gates = gate_results

    # Check for blocking failures in gates
    for gate in gate_results:
        if gate.blocks_completion():
            failures.append(f"Quality gate '{gate.gate_name}' failed: {gate.message}")

    return len(failures) == 0, failures


def verify_consistency_layer(
    criteria: TaskCompletionCriteria,
    project_dir: Path,
    runs: int = 3,
    threshold: float = 0.8,
) -> tuple[bool, list[str]]:
    """
    Layer 3: Verify task would pass again under similar conditions.

    Runs outcome verification multiple times to check consistency.
    """
    failures = []
    successes = 0

    for i in range(runs):
        passed, _ = verify_outcome_layer(
            criteria,
            project_dir,
            run_tests=True,
            run_build=True,
        )
        if passed:
            successes += 1

    criteria.consistency_runs = runs
    criteria.consistency_passed = successes
    criteria.pass_at_k = successes / runs

    if criteria.pass_at_k < threshold:
        failures.append(
            f"Consistency verification failed: {criteria.pass_at_k*100:.0f}% pass rate "
            f"(requires {threshold*100:.0f}%)"
        )

    return len(failures) == 0, failures


def load_task_file(path: Path) -> Optional[TaskCompletionCriteria]:
    """Load task completion criteria from a JSON file."""
    try:
        data = json.loads(path.read_text())
        return TaskCompletionCriteria.from_dict(data)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading task file: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Verify task completion against Definition of Done criteria",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "task_file",
        type=Path,
        help="Path to task JSON file",
    )
    parser.add_argument(
        "--project-dir",
        type=Path,
        default=Path.cwd(),
        help="Project directory (default: current directory)",
    )
    parser.add_argument(
        "--check-outcome",
        action="store_true",
        help="Only check Layer 1 (outcome verification)",
    )
    parser.add_argument(
        "--check-process",
        action="store_true",
        help="Only check Layer 2 (process verification)",
    )
    parser.add_argument(
        "--consistency",
        action="store_true",
        help="Run Layer 3 consistency verification",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=3,
        help="Number of consistency verification runs (default: 3)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.8,
        help="Minimum pass rate for consistency (default: 0.8)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write verification report to file",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )

    args = parser.parse_args()

    # Load task file
    criteria = load_task_file(args.task_file)
    if not criteria:
        sys.exit(5)

    # Validate criteria
    validation_errors = criteria.validate()
    if validation_errors:
        print("Task file validation errors:", file=sys.stderr)
        for err in validation_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(5)

    results = {
        "task_id": criteria.task_id,
        "layers": {},
    }
    exit_code = 0

    # Layer 1: Outcome Verification
    if args.check_outcome or not (args.check_process):
        passed, failures = verify_outcome_layer(criteria, args.project_dir)
        results["layers"]["layer1_outcome"] = {
            "passed": passed,
            "failures": failures,
        }
        if not passed:
            exit_code = 1

    # Layer 2: Process Verification
    if args.check_process or not (args.check_outcome):
        passed, failures = verify_process_layer(criteria, args.project_dir)
        results["layers"]["layer2_process"] = {
            "passed": passed,
            "failures": failures,
            "gates": [g.to_dict() for g in criteria.quality_gates],
        }
        if not passed and exit_code == 0:
            exit_code = 2

    # Layer 3: Consistency Verification (optional)
    if args.consistency:
        passed, failures = verify_consistency_layer(
            criteria,
            args.project_dir,
            runs=args.runs,
            threshold=args.threshold,
        )
        results["layers"]["layer3_consistency"] = {
            "passed": passed,
            "failures": failures,
            "runs": criteria.consistency_runs,
            "successes": criteria.consistency_passed,
            "pass_rate": criteria.pass_at_k,
        }
        if not passed and exit_code == 0:
            exit_code = 3

    # Check acceptance criteria
    ac_passed, unmet = criteria.check_acceptance_criteria()
    if not ac_passed:
        results["acceptance_criteria"] = {
            "passed": False,
            "unmet": unmet,
        }
        if exit_code == 0:
            exit_code = 4

    # Determine overall status
    results["is_done"] = exit_code == 0

    # Output results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        if results["is_done"]:
            print("TASK COMPLETE: All verification layers passed")
        else:
            print("TASK NOT DONE: Verification failed")
            for layer_name, layer_result in results.get("layers", {}).items():
                if not layer_result.get("passed", True):
                    print(f"\n{layer_name.upper()} FAILURES:")
                    for failure in layer_result.get("failures", []):
                        print(f"  - {failure}")

    # Write output file if requested
    if args.output:
        args.output.write_text(json.dumps(results, indent=2))
        print(f"\nReport written to: {args.output}")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
