# Simplify Code

Review and simplify the codebase (Boris Cherny's "code-simplifier" subagent).

## Tasks
1. Find overly complex functions (>50 lines)
2. Identify duplicated logic
3. Spot unused imports/variables
4. Look for nested conditionals that can be flattened
5. Find opportunities to extract helper functions

## Guidelines
- Prefer readability over cleverness
- Extract only when there's clear benefit
- Maintain existing API contracts
- Add tests for any refactored code

Provide a list of simplification opportunities with file:line references.
