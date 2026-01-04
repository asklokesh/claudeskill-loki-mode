# Code Review

Run the 3-reviewer parallel code review (Loki Mode quality system).

## Reviewers
1. **Security Reviewer**: Check for vulnerabilities, secrets, injection risks
2. **Architecture Reviewer**: Assess design patterns, maintainability, SOLID
3. **Performance Reviewer**: Identify bottlenecks, N+1 queries, memory leaks

## Output Format
```json
{
  "security": { "issues": [], "assessment": "PASS|FAIL" },
  "architecture": { "issues": [], "assessment": "PASS|FAIL" },
  "performance": { "issues": [], "assessment": "PASS|FAIL" },
  "overall": "PASS|FAIL"
}
```

## Severity Handling
- Critical/High/Medium: BLOCK - must fix before proceeding
- Low/Cosmetic: Add TODO comment, continue
