# Matrix Repomix Integration

Repomix is Matrix's external repository packing system that fetches and packages code from GitHub repositories or local directories for context, using a two-phase query-first approach to minimize token consumption.

---

## Overview

When you need to reference code from another repository - perhaps to understand a library's implementation or copy a pattern from an open-source project - Repomix provides it:

1. **Index Phase**: Scan the repository, suggest relevant files
2. **Pack Phase**: Package confirmed files into context

This two-phase approach prevents wasting tokens on irrelevant code. You see what files exist, confirm which ones matter, then only those get packed.

---

## The Two-Phase Flow

### Phase 1: Index

First, Matrix indexes the repository without consuming significant tokens.

**For GitHub repositories:**
```javascript
matrix_repomix({
  target: "vercel/next.js",
  query: "server components implementation"
})
```

**What happens:**
1. Fetch repository tree via GitHub API
2. Filter to code files (skip docs, tests, configs)
3. Run semantic search on file paths
4. Return suggested files based on query relevance

**Output:**
```javascript
{
  phase: "index",
  target: "vercel/next.js",
  totalFiles: 2847,
  totalEstimatedTokens: 4500000,
  suggestedFiles: [
    { path: "packages/next/src/server/app-render/...", estimatedTokens: 8500 },
    { path: "packages/next/src/client/components/...", estimatedTokens: 6200 },
    // ... 13 more files
  ],
  suggestedTokens: 45000,
  message: "Found 2847 code files (~4.5M tokens). Suggesting 15 relevant files (~45k tokens)."
}
```

The index is cached (24 hours by default) so subsequent queries on the same repo are instant.

### Phase 2: Pack

After reviewing suggestions, confirm which files to pack.

```javascript
matrix_repomix({
  target: "vercel/next.js",
  query: "server components implementation",
  confirmedFiles: [
    "packages/next/src/server/app-render/render.tsx",
    "packages/next/src/server/app-render/action-handler.ts"
  ]
})
```

**What happens:**
1. Download only the confirmed files
2. Package into markdown format
3. Cache result for future use
4. Return packed content

**Output:**
```javascript
{
  phase: "pack",
  success: true,
  stats: {
    fileCount: 2,
    totalTokens: 14700,
    totalCharacters: 58800
  },
  content: "# Repository: vercel/next.js\n\n## packages/next/src/server/app-render/render.tsx\n\n```typescript\n..."
}
```

---

## Semantic File Suggestion

How does Matrix know which files are relevant?

### Path-Based Embeddings

File paths are converted to searchable text:
```
packages/next/src/server/app-render/render.tsx
→ "packages next src server app render render tsx"
```

This text is embedded into a vector, enabling semantic matching.

### Query Matching

Your query is also embedded:
```
"server components implementation"
→ [0.23, -0.15, 0.89, ..., 0.42]
```

Files whose path embeddings are similar to your query embedding rank higher.

### Smart Exclusions

Irrelevant files are automatically filtered:

```javascript
const EXCLUDED_PATTERNS = [
  /__tests__/,      // Test directories
  /\.test\./,       // Test files
  /\.spec\./,       // Spec files
  /\/docs\//,       // Documentation
  /\/examples\//,   // Examples
  /\/dist\//,       // Build output
  /node_modules/,   // Dependencies
  /\.json$/,        // Config files
  /\.md$/,          // Markdown files
];
```

---

## Target Types

### GitHub Repositories

Use shorthand format:
```
vercel/next.js
facebook/react
golang/go
```

With specific branch:
```javascript
matrix_repomix({
  target: "vercel/next.js",
  query: "...",
  branch: "canary"
})
```

### Local Directories

Use absolute or relative paths:
```javascript
matrix_repomix({
  target: "/Users/john/projects/library",
  query: "authentication implementation"
})

// Or relative to cwd:
matrix_repomix({
  target: "../other-project",
  query: "database models"
})
```

---

## Caching

### Index Cache

Repository file listings are cached for 24 hours:

```
Key: "index:vercel/next.js:main"
Content: [{ path: "...", size: 1234, estimatedTokens: 308 }, ...]
Expires: +24 hours
```

Benefits:
- Subsequent queries on same repo are instant
- Different queries reuse the index
- Only semantic search runs (fast)

### Pack Cache

Packed content is cached based on target + query + files:

```
Key: sha256("vercel/next.js" + "server components" + ["file1", "file2"])
Content: "# Repository: vercel/next.js\n..."
Expires: +24 hours (configurable)
```

Benefits:
- Same request returns cached result
- No redundant API calls
- Configurable TTL per request

### Cache Management

Expired entries are automatically cleaned on each request.

---

## Token Management

### Estimation

Tokens are estimated from file size:
```
estimatedTokens = Math.round(fileSize / 4)
```

This assumes ~4 characters per token (typical for code).

### Truncation

If packed content exceeds the limit:
```javascript
matrix_repomix({
  target: "...",
  query: "...",
  confirmedFiles: [...],
  maxTokens: 30000  // Default
})
```

Content is truncated with a notice:
```
[TRUNCATED to 30000 tokens]
```

### Budget Awareness

The index phase shows token budgets:
```
Total repository: ~4.5M tokens
Suggested files: ~45k tokens
```

This helps you make informed decisions about what to pack.

---

## Usage Examples

### Learning a Pattern

```
User: "How does Next.js implement server components?"

1. /matrix:repomix vercel/next.js "server components implementation"
2. Review suggested files
3. Confirm relevant ones
4. Get packed code for study
```

### Copying a Feature

```
User: "I want to implement rate limiting like Express does"

1. matrix_repomix({ target: "expressjs/express", query: "rate limiting middleware" })
2. Review: express-rate-limit isn't in express core, but middleware patterns are
3. Pack middleware implementation files
4. Adapt patterns for your project
```

### Debugging Compatibility

```
User: "Why does this library fail with Node 18?"

1. Pack the library's entry point and relevant source
2. Examine for Node.js version-specific code
3. Find the incompatibility
```

### Research Prior Art

```
User: "How do other projects handle this migration?"

1. Pack relevant files from 2-3 similar projects
2. Compare approaches
3. Choose best pattern
```

---

## API Rate Limits

### GitHub API

- **Unauthenticated**: 60 requests/hour
- **With GITHUB_TOKEN**: 5000 requests/hour

To increase limits, set the environment variable:
```bash
export GITHUB_TOKEN="ghp_..."
```

### Rate Limit Handling

If rate limited:
- Error message indicates remaining quota
- Use cached index when available
- Wait or authenticate

---

## Workflow Integration

### With Deep Research

Deep Research can use Repomix for implementation patterns:

```
/matrix:deep-research "how to implement OAuth" exhaustive

Phase 2 (Multi-Source Gathering):
  → WebSearch: Recent articles
  → Context7: Library docs
  → Repomix: Implementation from passport.js repo
```

### With Code Review

Review can reference external patterns:

```
/matrix:review staged

Phase 4 (Investigation):
  "This authentication pattern differs from common approaches.
   See: passport.js implementation (matrix_repomix)..."
```

### With Memory

After packing useful code:

```javascript
matrix_store({
  problem: "OAuth callback handling pattern",
  solution: "Based on passport.js: [packed code reference]",
  scope: "global",
  tags: ["oauth", "authentication", "pattern"]
})
```

---

## Best Practices

### Write Good Queries

```
Bad: "auth"
Good: "OAuth 2.0 authorization code flow implementation"

Bad: "api"
Good: "REST API error handling middleware"
```

### Limit File Count

The default suggestion limit is 15 files. For focused packing:
```javascript
matrix_repomix({
  target: "...",
  query: "...",
  maxFiles: 5  // Tighter focus
})
```

### Use Branch Targeting

For version-specific code:
```javascript
matrix_repomix({
  target: "vercel/next.js",
  query: "...",
  branch: "v13.4.0"  // Specific version tag
})
```

### Cache TTL Adjustment

For rapidly changing repos:
```javascript
matrix_repomix({
  target: "...",
  query: "...",
  cacheTTLHours: 1  // Fresher cache
})
```

---

## Limitations

### File Types

Only source code files are included:
- `.ts`, `.tsx`, `.js`, `.jsx`
- `.py`
- `.go`
- `.rs`
- `.java`, `.kt`
- `.c`, `.cpp`, `.h`
- `.rb`

Config, docs, and media files are excluded.

### File Size

Files larger than 500KB are skipped to avoid overwhelming context.

### Repository Size

Very large repositories (>100k files) may have truncated listings due to GitHub API limits.

### Private Repositories

Private repos require a `GITHUB_TOKEN` with appropriate permissions.

---

## Summary

Repomix enables external code access through:

1. **Two-phase flow** - Index first, pack confirmed files only
2. **Semantic suggestions** - Query-relevant files surfaced
3. **Smart filtering** - Tests, docs, configs excluded
4. **Efficient caching** - Index and pack results cached
5. **Token awareness** - Budgets shown, truncation handled

This brings external implementation knowledge into your context without wasting tokens on irrelevant code.
