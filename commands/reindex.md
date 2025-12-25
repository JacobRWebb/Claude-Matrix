---
description: Manually reindex the repository code
---

# Matrix Reindex

Trigger a manual reindex of the TypeScript/JavaScript codebase.

Use the `matrix_reindex` MCP tool to refresh the code index:

**Arguments:**
- `full` (optional): If true, force a complete reindex ignoring incremental mode

**When to use:**
- After making significant file changes outside of Claude
- When the index seems stale or incomplete
- After renaming or moving many files

**Output:**
- Files scanned, indexed, and skipped
- Symbols and imports found
- Duration of the indexing process
