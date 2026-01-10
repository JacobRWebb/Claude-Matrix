# Matrix Code Review

Matrix Review is a structured code review system that analyzes changes through a five-phase pipeline, calculating impact scope, inferring intent, and producing actionable feedback with confidence scores.

---

## Overview

Traditional code reviews depend heavily on reviewer context and can miss systemic issues. Matrix Review addresses this by:

1. Calculating the "blast radius" of changes
2. Understanding what the code is trying to accomplish
3. Asking probing questions about edge cases
4. Investigating each concern with codebase context
5. Consolidating findings with confidence scores

The result is a consistent, thorough review that catches issues human reviewers might miss.

---

## The Five-Phase Pipeline

### Phase 1: Context Mapping (Blast Radius)

Before reviewing code, Matrix determines the scope of impact.

**Identify Changed Code**
Depending on the target:
- File path → Read and diff against git history
- "staged" → Analyze `git diff --cached`
- PR number → Fetch diff via GitHub API

**Find All Callers**
For each exported function or class in changed files:
1. Query the code index for files that import it
2. Build a dependency graph of affected code
3. Trace second-degree dependencies

**Calculate Impact Score**
```
Impact Score: 7/10 (medium-high)

Direct changes: 3 files
├── src/utils/auth.ts (modified)
├── src/utils/session.ts (modified)
└── src/api/login.ts (modified)

First-degree impact: 8 files
├── src/middleware/authenticate.ts (imports auth)
├── src/handlers/user.ts (imports session)
└── ... 6 more files

Second-degree impact: 12 files
└── Files importing first-degree modules
```

This tells reviewers: "These 3 files changed, but 20 files could be affected."

### Phase 2: Intent Inference

Understanding what the change is trying to accomplish.

**Gather Context**
- Commit messages (if available)
- PR description (for PR reviews)
- Code comments and docstrings
- Function naming patterns

**Classify Change Type**
| Type | Description |
|------|-------------|
| bugfix | Correcting incorrect behavior |
| feature | Adding new functionality |
| refactor | Restructuring without behavior change |
| performance | Optimization |
| security | Security improvement |
| cleanup | Code quality improvement |

**Summarize Intent**
```
Intent: Security improvement

This change adds rate limiting to the authentication endpoint
to prevent brute force attacks. The approach uses a sliding
window counter stored in Redis.
```

### Phase 3: Socratic Questioning

Generating probing questions to guide investigation.

**Edge Cases**
- What happens with null or undefined inputs?
- Empty collections?
- Boundary conditions (zero, negative, max values)?
- Unicode or special characters in strings?

**Error Handling**
- Are errors properly caught and handled?
- Are error messages helpful for debugging?
- Is error state properly cleaned up?
- Do resources get released on failure?

**Testing Coverage**
- Are the changes covered by existing tests?
- Are edge cases tested?
- Should new tests be added?
- Are integration tests needed?

**Security Considerations**
- Input validation present?
- Authentication/authorization checked?
- Data properly sanitized?
- Secrets protected?

### Phase 4: Targeted Investigation

For each concern from Phase 3, Matrix investigates.

**Check Existing Patterns**
Using the code index to find how similar code handles the concern:
```
Looking for: error handling in API routes
Found: src/api/users.ts uses try-catch with custom ErrorHandler
Found: src/api/products.ts uses middleware error boundary
Pattern: Consistent error middleware usage expected
```

**Verify Assumptions**
- Read related files to understand context
- Check test files for expected behavior
- Examine type definitions for contracts

**Research If Needed**
- Query Matrix memory for past issues with similar code
- Look up patterns in external documentation
- Check for known security vulnerabilities

### Phase 5: Reflection & Consolidation

Producing the final review output.

**Calculate Confidence Score**
| Score | Meaning |
|-------|---------|
| 5/5 | No issues found, ready to merge |
| 4/5 | Minor suggestions only, approve with optional changes |
| 3/5 | Some issues that should be addressed but not blocking |
| 2/5 | Important issues that need attention before merge |
| 1/5 | Critical bugs that will cause incorrect behavior |

**Format Review Output**
```markdown
# Matrix Review

## Summary
This PR adds rate limiting to authentication endpoints using
Redis-backed sliding window counters to prevent brute force attacks.

## Key Changes
- Added RateLimiter class with configurable windows
- Integrated limiter into auth middleware
- Added Redis connection pooling

## Critical Issues Found

### 1. Race Condition in Counter Increment
The increment and check operations are not atomic, allowing
requests to slip through during high concurrency.

Affected: src/services/rate-limiter.ts:42

### 2. Missing Redis Connection Error Handling
If Redis is unavailable, requests fail silently without fallback.

Affected: src/services/rate-limiter.ts:15

## Additional Issues
- Missing unit tests for edge cases
- Redis key prefix could collide with other services

## Positive Aspects
- Clean separation of concerns
- Good documentation
- Consistent with existing middleware patterns

## Confidence Score: 2/5
Cannot approve due to race condition (critical) and missing
error handling (important). Core functionality is sound but
needs these fixes before merge.

**Files requiring attention:**
src/services/rate-limiter.ts (critical issues #1, #2)
```

**Per-File Scoring**
```markdown
| Filename | Score | Overview |
|----------|-------|----------|
| src/services/rate-limiter.ts | 2/5 | Race condition, missing error handling |
| src/middleware/auth.ts | 4/5 | Minor: could use more descriptive error |
| src/config/redis.ts | 5/5 | Clean implementation |
```

---

## Depth Levels

### Quick (2-3 comments)
- Single-pass review
- Main issues only
- Best for: Small changes, typo fixes, simple refactors

### Standard (5-10 comments)
- Full pipeline execution
- Balanced coverage
- Best for: Most changes, feature PRs, bug fixes

### Thorough (10+ comments)
- Deep analysis
- Edge cases examined
- Security review included
- Best for: Security-sensitive code, core infrastructure, public APIs

---

## Integration with Matrix Memory

### Learning from Reviews
When the review spots a pattern worth remembering:
```
matrix_store({
  problem: "Race condition in Redis increment operations",
  solution: "Use MULTI/EXEC or Lua scripts for atomic operations",
  scope: "global",
  category: "bugfix"
})
```

### Using Past Knowledge
Reviews check Matrix memory for:
- Past issues with similar code patterns
- Known gotchas in the libraries being used
- Repository-specific conventions

### Feedback Loop
If a recalled solution helped during review:
```
matrix_reward({
  solutionId: "sol_abc123",
  outcome: "success",
  notes: "Correctly identified atomic operation need"
})
```

---

## Usage Examples

**Review a specific file:**
```
/matrix:review src/utils/auth.ts standard
```

**Review staged changes:**
```
/matrix:review staged thorough
```

**Review a pull request:**
```
/matrix:review 123 quick
```

**Review with output to file:**
```
/matrix:review src/critical-service.ts thorough > ~/Downloads/review.md
```

---

## Blast Radius Visualization

The blast radius analysis helps prioritize review effort:

```
Low Impact (1-3)
└── Change is isolated, few or no dependents

Medium Impact (4-6)
└── Change affects multiple files but contained to one domain

High Impact (7-8)
└── Change affects core utilities or shared components

Critical Impact (9-10)
└── Change to authentication, data layer, or public API
```

High impact changes warrant more thorough review even for "simple" modifications.

---

## How It Differs from IDE Reviews

| Aspect | IDE/GitHub Review | Matrix Review |
|--------|-------------------|---------------|
| Scope | Line-by-line diff | Blast radius + dependencies |
| Context | Manual file navigation | Automatic codebase search |
| Patterns | Reviewer memory | Matrix memory + index |
| Questions | Reviewer experience | Systematic checklist |
| Output | Inline comments | Structured report |
| Learning | None | Stores patterns for future |

---

## Best Practices

**When to Use Thorough Reviews**
- Authentication/authorization changes
- Database schema modifications
- Public API changes
- Security-related code
- Core infrastructure

**When Quick Reviews Suffice**
- Documentation updates
- Test additions (not changes)
- Dependency version bumps
- Style/formatting fixes

**Combining with Human Review**
Matrix Review is best used to:
1. Get initial structured feedback
2. Identify areas needing human attention
3. Ensure systematic coverage
4. Document the review for future reference

---

## Summary

Matrix Review provides structured code review through:
1. **Blast radius analysis** - Understanding change impact
2. **Intent inference** - Knowing what code tries to do
3. **Socratic questioning** - Systematic concern identification
4. **Targeted investigation** - Context-aware analysis
5. **Confidence scoring** - Clear merge recommendations

The result is consistent, thorough reviews that catch issues early and learn from each iteration.
