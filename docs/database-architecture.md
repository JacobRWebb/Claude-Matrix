# Matrix Database Architecture

Matrix uses a unified SQLite database with semantic embeddings for intelligent memory and code navigation. This document explains how the database powers Matrix's learning capabilities.

---

## Overview

Matrix stores all persistent data in a single SQLite database. The architecture supports three core functions:

1. **Semantic Memory** - Solutions and failures searchable by meaning, not just keywords
2. **Code Index** - Symbol-level navigation across 15 programming languages
3. **Session Context** - Warnings, caches, and usage tracking

The database uses vector embeddings (384-dimensional) for similarity search, enabling Matrix to find relevant solutions even when the exact wording differs.

---

## Semantic Search Pipeline

### How Embeddings Work

When you store a solution, Matrix doesn't just save the text - it converts the problem description into a 384-dimensional vector using a local transformer model (MiniLM-L6-v2). This vector captures the semantic meaning of the problem.

**Example:**
```
"How to implement OAuth with Google"
      ↓ embedding
[0.23, -0.15, 0.89, ..., 0.42]  (384 dimensions)
```

Two semantically similar problems produce vectors that are geometrically close:
- "Implement Google OAuth" → similarity: 0.92
- "Set up Google authentication" → similarity: 0.87
- "Making a sandwich" → similarity: 0.12

### Cosine Similarity

Matrix uses cosine similarity to measure how alike two embeddings are. The formula compares the angle between vectors, producing a score from 0 (unrelated) to 1 (identical meaning).

When you search with `matrix_recall`, Matrix:
1. Converts your query to an embedding
2. Compares it against all stored solution embeddings
3. Returns matches above the minimum similarity threshold (default: 0.3)
4. Ranks by combined similarity and historical success score

---

## Solution Storage

### The Solutions Table

Solutions are the core of Matrix's memory. Each solution captures:

| Field | Purpose |
|-------|---------|
| `problem` | What was solved (human-readable) |
| `problem_embedding` | Vector representation for semantic search |
| `solution` | How it was solved (steps, code, explanation) |
| `scope` | Applicability: `global`, `stack`, or `repo` |
| `category` | Type: bugfix, feature, refactor, config, pattern, optimization |
| `complexity` | Difficulty rating 1-10 (auto-calculated or manual) |
| `score` | Quality score 0-1, adjusted by feedback |
| `uses` | How many times recalled |
| `successes/failures` | Outcome tracking for learning |

### Scope System

Scope determines when a solution appears in search:

- **global** - Applies everywhere (language-agnostic patterns)
- **stack** - Applies to similar tech stacks (React projects, Python backends)
- **repo** - Applies only to the specific repository

Matrix detects your current project's stack and boosts relevant solutions:
- Same repo: +15% similarity boost
- Similar stack: +8% similarity boost

### Solution Evolution

Solutions can evolve over time through the `supersedes` relationship:

```
Initial Solution (sol_abc123)
        ↓ supersedes
Improved Solution (sol_def456)
        ↓ supersedes
Current Best (sol_ghi789)
```

When a solution is superseded:
- The old solution remains searchable
- Recall results indicate when a newer version exists
- Users can choose the original or updated approach

---

## Failure Tracking

### Error Normalization

Failures use a signature-based deduplication system. Error messages contain variable parts (line numbers, file paths, timestamps) that change between occurrences. Matrix normalizes these:

```
Original: "TypeError at /Users/john/project/src/utils.ts:42: Cannot read property 'foo'"
Normalized: "TypeError at PATH:N: Cannot read property STR"
Signature: sha256("type:TypeError at PATH:N...") → "a7f3..."
```

This allows Matrix to recognize the same error across different contexts and track:
- How often it occurs (`occurrences` count)
- What fixed it last time (`fix_applied`)
- How to prevent it (`prevention` guidance)

### Failure Search

Like solutions, failures have semantic embeddings combining:
- Error type (runtime, build, test, type)
- Error message
- Root cause description

This enables searching for "authentication token expired" to find failures about "JWT validation failed" or "session timeout" - related issues with different wording.

---

## Code Index

### Symbol Extraction

The code index uses tree-sitter to parse source files and extract structured information about symbols:

| Symbol Kind | Examples |
|-------------|----------|
| function | `function authenticate()`, `def process()` |
| class | `class UserService`, `class Repository` |
| interface | `interface Config`, `type Props` |
| enum | `enum Status`, `enum Color` |
| const | `const API_URL`, `const config` |
| method | `class.method()` |

### File-Symbol Relationship

```
repo_files (one) ←→ (many) symbols
    └── repo_id, file_path, mtime
                                └── name, kind, line, exported, signature
```

When a file changes:
1. Matrix checks the modification time (`mtime`)
2. If changed, re-parses the file
3. Replaces old symbols with new ones
4. Import relationships are updated

### Import Tracking

Matrix tracks imports to understand code dependencies:

```typescript
// In src/api/handler.ts
import { authenticate } from '../auth';
import type { User } from '../types';
```

Stored as:
- `imported_name`: authenticate, User
- `source_path`: ../auth, ../types
- `is_type`: false, true

This powers `matrix_find_callers` - finding all files that use a specific function.

### Incremental Indexing

Full repository scans are slow. Matrix uses incremental indexing:

1. **Initial Index** - Parse all files, store symbols and mtimes
2. **Subsequent Runs** - Compare current mtimes to stored ones
3. **Diff Processing** - Only reparse changed files

```
Changed: 3 files (re-index)
Unchanged: 247 files (skip)
Deleted: 1 file (remove from index)
```

---

## Warning System

### Unified Warnings

Warnings allow you to mark files or packages as problematic:

| Type | Target | Example |
|------|--------|---------|
| file | Path or glob pattern | `src/legacy/*.ts`, `config/secrets.json` |
| package | Package name | `moment`, `request`, `lodash` |

### Severity Levels

| Severity | Behavior |
|----------|----------|
| `info` | Show information, continue normally |
| `warn` | Show warning, ask for confirmation |
| `block` | Prevent the operation entirely |

### Scope

Warnings can be:
- **Global** - Apply to all projects (`repo_id` = NULL)
- **Repo-specific** - Only apply to current project

Example: You might globally warn about the deprecated `request` package, but only warn about `src/legacy/` in one specific project.

---

## Caching

### API Cache

External API responses are cached with 24-hour TTL:

```
cache_key: "osv:lodash"
response: { vulnerabilities: [...] }
created_at: "2024-01-15T10:00:00"
```

Cached services:
- OSV.dev (vulnerability database)
- npm registry (deprecation status)
- Bundlephobia (package size)

### Repomix Cache

Repository packs are cached separately with configurable TTL:

```
id: "abc123def"  (hash of target + query + files)
content: "# Repository: owner/repo\n..."
expires_at: "2024-01-16T10:00:00"
```

---

## Repository Fingerprinting

Matrix identifies projects by their technology stack:

**Detection Sources:**
- `package.json` → npm packages, Node.js version
- `go.mod` → Go modules
- `Cargo.toml` → Rust crates
- `requirements.txt` / `pyproject.toml` → Python packages

**Fingerprint Embedding:**

The detected stack is converted to an embedding:
```
"typescript react next.js prisma postgresql"
      ↓ embedding
[0.31, 0.22, ..., -0.18]  (384 dimensions)
```

This enables "similar stack" matching - a solution from a Next.js project ranks higher when you're working on another Next.js project.

---

## Data Integrity

### Schema Migrations

Matrix tracks database version and applies migrations automatically:

```
Version 1 → Initial schema
Version 2 → Added code index tables
Version 3 → Added warnings table
Version 4 → Added skill factory columns
```

Each migration is idempotent - running it multiple times has no effect.

### Recovery

- **Corrupted Config** - Auto-regenerated with defaults
- **Missing Tables** - Created on startup
- **Corrupted Database** - NOT auto-fixed (user data preserved)

The `matrix_doctor` tool diagnoses issues and applies safe fixes.

---

## Performance Characteristics

### SQLite Choices

SQLite was chosen for:
- Zero deployment complexity (single file)
- Excellent read performance (most Matrix operations)
- Reliable ACID transactions
- No network latency

### Indexes

Critical queries are accelerated by indexes:

```sql
-- Fast solution lookup by scope
CREATE INDEX idx_solutions_scope_score ON solutions(scope, score DESC);

-- Fast symbol search
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_exported ON symbols(exported);

-- Fast import tracking
CREATE INDEX idx_imports_source ON imports(source_path);
```

### Memory Usage

Embeddings are stored as BLOBs (binary):
- 384 dimensions × 4 bytes = 1,536 bytes per embedding
- 1,000 solutions = ~1.5 MB of embedding data
- Loaded on-demand, not kept in memory

---

## Summary

Matrix's database architecture combines:
1. **Semantic vectors** for meaning-based search
2. **Normalized signatures** for error deduplication
3. **Tree-sitter parsing** for language-aware code indexing
4. **Incremental updates** for performance
5. **Tiered caching** for external APIs

This enables Matrix to learn from past solutions, navigate codebases intelligently, and improve recommendations over time through the feedback loop.
