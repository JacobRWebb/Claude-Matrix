# Matrix Code Index

The Code Index is Matrix's language-aware navigation system that extracts symbols, tracks imports, and enables intelligent code search across 15 programming languages using tree-sitter parsing.

---

## Overview

Traditional code search (grep) finds text patterns. The Code Index understands code structure:

- **Symbols**: Functions, classes, types, interfaces
- **Relationships**: What imports what
- **Context**: Is it exported? What's its signature?

This enables queries like "find all callers of this function" or "list exports from this directory" - questions that grep can't reliably answer.

---

## Supported Languages

Matrix supports 15 languages through tree-sitter grammars:

| Language | Extensions | Symbol Kinds |
|----------|------------|--------------|
| TypeScript | .ts, .tsx | function, class, interface, type, enum, const |
| JavaScript | .js, .jsx, .mjs | function, class, const, variable |
| Python | .py | function, class, variable |
| Go | .go | function, struct, interface, type, const |
| Rust | .rs | fn, struct, enum, trait, impl, const |
| Java | .java | class, interface, method, field |
| Kotlin | .kt, .kts | fun, class, interface, object |
| Swift | .swift | func, class, struct, protocol, enum |
| C# | .cs | class, interface, method, property |
| Ruby | .rb | def, class, module |
| PHP | .php | function, class, interface, trait |
| C | .c, .h | function, struct, typedef |
| C++ | .cpp, .hpp, .cc | function, class, struct, namespace |
| Elixir | .ex, .exs | def, defmodule |
| Zig | .zig | fn, struct, enum |

---

## Indexing Pipeline

### Initial Scan

When you open a project, Matrix scans for indexable files:

1. **Directory Walk**: Traverse project recursively
2. **Filter**: Skip node_modules, .git, dist, etc.
3. **Size Check**: Skip files > 1MB
4. **Language Match**: Only files with supported extensions

### Parsing

Each file is parsed using tree-sitter:

1. **Load Grammar**: Download WASM grammar if not cached
2. **Parse AST**: Build abstract syntax tree
3. **Extract Symbols**: Walk AST for declarations
4. **Extract Imports**: Find import/require statements
5. **Store Results**: Save to SQLite with file metadata

### Incremental Updates

After initial indexing, only changed files are reprocessed:

```
Before: 250 files indexed
Changed: src/utils.ts (mtime differs)
Added: src/new-feature.ts
Deleted: src/old-code.ts

Action:
  - Reparse: src/utils.ts
  - Parse: src/new-feature.ts
  - Remove: src/old-code.ts
  - Skip: 248 unchanged files
```

---

## Symbol Extraction

### What Gets Extracted

**Functions**
```typescript
// Extracted: { name: "authenticate", kind: "function", exported: true, line: 5 }
export function authenticate(token: string): boolean { ... }

// Extracted: { name: "helper", kind: "function", exported: false, line: 10 }
function helper() { ... }
```

**Classes**
```typescript
// Extracted: { name: "UserService", kind: "class", exported: true }
// Plus methods: { name: "getUser", kind: "method", scope: "UserService" }
export class UserService {
  getUser(id: string) { ... }
}
```

**Types & Interfaces**
```typescript
// Extracted: { name: "Config", kind: "interface", exported: true }
export interface Config {
  apiUrl: string;
  timeout: number;
}

// Extracted: { name: "UserId", kind: "type", exported: true }
export type UserId = string;
```

**Enums**
```typescript
// Extracted: { name: "Status", kind: "enum", exported: true }
export enum Status {
  Active = "ACTIVE",
  Inactive = "INACTIVE"
}
```

### Signature Capture

When available, function signatures are stored:

```typescript
function fetchUser(id: string, options?: FetchOptions): Promise<User>
```

Stored as:
```
signature: "(id: string, options?: FetchOptions): Promise<User>"
```

This enables signature-based search without reading file contents.

---

## Import Tracking

### What Gets Tracked

**Named Imports**
```typescript
import { authenticate, validate } from './auth';
```
Stored as:
- imported_name: "authenticate", source_path: "./auth"
- imported_name: "validate", source_path: "./auth"

**Default Imports**
```typescript
import UserService from './services/user';
```
Stored as:
- imported_name: "UserService", is_default: true, source_path: "./services/user"

**Namespace Imports**
```typescript
import * as utils from './utils';
```
Stored as:
- imported_name: "*", is_namespace: true, local_name: "utils"

**Type-Only Imports**
```typescript
import type { Config } from './types';
```
Stored as:
- imported_name: "Config", is_type: true, source_path: "./types"

---

## Query Tools

### Find Definition (`matrix_find_definition`)

Locate where a symbol is defined.

**Input:**
```javascript
{
  symbolName: "authenticate",
  kind: "function"  // optional filter
}
```

**Output:**
```javascript
{
  symbol: "authenticate",
  definitions: [
    {
      file: "src/auth/index.ts",
      line: 42,
      kind: "function",
      exported: true,
      signature: "(token: string): boolean"
    }
  ]
}
```

### Find Callers (`matrix_find_callers`)

Find all files that use a symbol.

**Input:**
```javascript
{
  symbolName: "authenticate",
  filePath: "src/auth/index.ts"  // optional: specific definition
}
```

**Output:**
```javascript
{
  symbol: "authenticate",
  callers: [
    {
      file: "src/middleware/auth.ts",
      line: 15,
      importedAs: "authenticate"
    },
    {
      file: "src/handlers/login.ts",
      line: 8,
      importedAs: "auth"  // renamed import
    }
  ],
  totalCallers: 2
}
```

### Search Symbols (`matrix_search_symbols`)

Find symbols by partial name match.

**Input:**
```javascript
{
  query: "User",
  kind: "class",  // optional
  exported: true  // optional
}
```

**Output:**
```javascript
{
  symbols: [
    { name: "UserService", file: "src/services/user.ts", kind: "class" },
    { name: "UserRepository", file: "src/repos/user.ts", kind: "class" },
    { name: "UserDTO", file: "src/types/user.ts", kind: "interface" }
  ]
}
```

### List Exports (`matrix_list_exports`)

List all exports from a file or directory.

**Input:**
```javascript
{
  path: "src/utils"  // file or directory
}
```

**Output:**
```javascript
{
  exports: [
    { name: "formatDate", file: "src/utils/date.ts", kind: "function" },
    { name: "parseNumber", file: "src/utils/number.ts", kind: "function" },
    { name: "Config", file: "src/utils/config.ts", kind: "interface" }
  ]
}
```

### Get Imports (`matrix_get_imports`)

List all imports in a file.

**Input:**
```javascript
{
  filePath: "src/handlers/user.ts"
}
```

**Output:**
```javascript
{
  imports: [
    { name: "authenticate", source: "../auth", isType: false },
    { name: "User", source: "../types", isType: true },
    { name: "db", source: "../db", isDefault: true }
  ]
}
```

---

## Use Cases

### Blast Radius Analysis

During code review, find all code affected by a change:

```
Changed: src/auth/authenticate.ts

1. Find exports from changed file
2. For each export, find all callers
3. Recursively find callers of callers

Result: Impact visualization
```

### Safe Refactoring

Before renaming a function:

```
1. matrix_find_definition("oldName")
   → Confirms location and signature

2. matrix_find_callers("oldName")
   → Lists all 12 files that need updating

3. Rename with confidence
```

### Codebase Navigation

Understanding unfamiliar code:

```
Question: "What uses the PaymentService?"

1. matrix_find_callers("PaymentService")
   → Shows entry points

2. matrix_get_imports("PaymentService")
   → Shows dependencies

3. matrix_list_exports("src/payments")
   → Shows public API
```

### Dependency Analysis

Understanding module relationships:

```
1. List exports from src/core
2. For each export, find callers
3. Build dependency graph
4. Identify circular dependencies
```

---

## Performance

### Index Storage

Index data is stored efficiently in SQLite:

```
Files:    ~100 bytes per file
Symbols:  ~50 bytes per symbol
Imports:  ~40 bytes per import

1000-file project:
  Files:    ~100 KB
  Symbols:  ~500 KB (5 symbols/file average)
  Imports:  ~300 KB (7 imports/file average)
  Total:    ~900 KB
```

### Query Speed

All queries use indexed columns:

| Query Type | Typical Speed |
|------------|---------------|
| find_definition | <10ms |
| find_callers | 10-50ms |
| search_symbols | 10-30ms |
| list_exports | <10ms |
| get_imports | <5ms |

### Grammar Caching

Tree-sitter WASM grammars are downloaded once and cached:

```
~/.claude/matrix/grammars/
├── tree-sitter-typescript.wasm  (~1.2 MB)
├── tree-sitter-python.wasm      (~0.9 MB)
├── tree-sitter-go.wasm          (~1.1 MB)
└── ...
```

First parse of a language type triggers download (~2-3 seconds). Subsequent parses are instant.

---

## Limitations

### What's NOT Indexed

- **Dynamic imports**: `import(modulePath)` where path is a variable
- **String-based access**: `obj["methodName"]()` not tracked as call
- **Decorators as calls**: TypeScript/Python decorators not always traced
- **Build outputs**: dist/, build/ excluded by default
- **Tests**: Excluded by default (configurable)

### Language Quirks

- **JavaScript**: No type information (only runtime constructs)
- **Python**: Dynamic typing limits signature capture
- **Ruby**: Metaprogramming creates symbols not visible in AST

### Scale Limits

- **File count**: No hard limit, but indexing slows >10k files
- **File size**: Files >1MB skipped by default
- **Symbol count**: No limit, but query time increases with count

---

## Configuration

### Exclusion Patterns

Add to `matrix.config`:
```json
{
  "indexing": {
    "excludePatterns": [
      "**/generated/**",
      "**/vendor/**",
      "**/*.generated.ts"
    ]
  }
}
```

### Include Tests

By default, test files are excluded:
```json
{
  "indexing": {
    "includeTests": true
  }
}
```

### Adjust Timeout

For large repositories:
```json
{
  "indexing": {
    "timeout": 120  // seconds
  }
}
```

---

## Reindexing

### Automatic

Indexing runs automatically:
- On session start (if index is stale)
- After significant file changes
- When explicitly triggered

### Manual

Force full reindex:
```
/matrix:reindex
```

Or via tool:
```javascript
matrix_reindex({
  fullReindex: true  // ignore incremental, reparse all
})
```

### Status Check

View current index state:
```javascript
matrix_index_status()

// Output:
{
  indexed: true,
  filesIndexed: 247,
  symbolsIndexed: 1823,
  lastIndexed: "2024-01-15T10:30:00Z",
  isStale: false
}
```

---

## Summary

The Code Index provides structural understanding of codebases:

1. **Tree-sitter parsing** extracts symbols and imports
2. **15 languages** supported with consistent API
3. **Incremental updates** keep index fresh efficiently
4. **Relationship tracking** enables caller/callee analysis
5. **Fast queries** through indexed SQLite storage

This transforms code navigation from text search to semantic understanding.
