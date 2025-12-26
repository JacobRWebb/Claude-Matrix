/**
 * Repository Index Query Tools
 *
 * MCP tools for querying the code index:
 * - matrix_find_definition: Find where a symbol is defined
 * - matrix_list_exports: List exports from a file or directory
 * - matrix_index_status: Get index status for current repo
 * - matrix_search_symbols: Search symbols by partial name
 */

import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  findDefinitions,
  findExports,
  getIndexStatus,
  searchSymbols,
  getFileImports,
} from '../indexer/store.js';
import { indexRepository } from '../indexer/index.js';
import type { SymbolKind, DefinitionResult, ExportResult, IndexStatus } from '../indexer/types.js';

/**
 * Find git repository root
 */
function findGitRoot(startPath: string): string | null {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: startPath,
    encoding: 'utf-8',
  });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim();
  }
  return null;
}

/**
 * Generate stable repo ID from path
 */
function generateRepoId(root: string): string {
  const hash = createHash('sha256').update(root).digest('hex').slice(0, 8);
  return `repo_${hash}`;
}

/**
 * Get current repo info from cwd
 */
function getCurrentRepoInfo(): { root: string; id: string } | null {
  const cwd = process.cwd();
  const root = findGitRoot(cwd) || cwd;

  // Check if it's a TS/JS project
  if (!existsSync(join(root, 'package.json')) &&
      !existsSync(join(root, 'tsconfig.json')) &&
      !existsSync(join(root, 'jsconfig.json'))) {
    return null;
  }

  return {
    root,
    id: generateRepoId(root),
  };
}

// Tool input types
export interface FindDefinitionInput {
  symbol: string;
  kind?: SymbolKind;
  file?: string;
}

export interface ListExportsInput {
  path?: string;
}

export interface SearchSymbolsInput {
  query: string;
  limit?: number;
}

export interface GetImportsInput {
  file: string;
}

// Tool output types
export interface FindDefinitionResult {
  found: boolean;
  definitions?: DefinitionResult[];
  message?: string;
}

export interface ListExportsResult {
  found: boolean;
  exports?: ExportResult[];
  message?: string;
}

export interface IndexStatusResult {
  indexed: boolean;
  status?: IndexStatus;
  message?: string;
}

export interface SearchSymbolsResult {
  found: boolean;
  results?: DefinitionResult[];
  message?: string;
}

/**
 * Find where a symbol is defined
 */
export function matrixFindDefinition(input: FindDefinitionInput): FindDefinitionResult {
  const repo = getCurrentRepoInfo();
  if (!repo) {
    return {
      found: false,
      message: 'Not in an indexed TypeScript/JavaScript repository',
    };
  }

  const definitions = findDefinitions(
    repo.id,
    input.symbol,
    input.kind,
    input.file
  );

  if (definitions.length === 0) {
    return {
      found: false,
      message: `No definitions found for "${input.symbol}"`,
    };
  }

  return {
    found: true,
    definitions,
  };
}

/**
 * List all exports from a file or directory
 */
export function matrixListExports(input: ListExportsInput): ListExportsResult {
  const repo = getCurrentRepoInfo();
  if (!repo) {
    return {
      found: false,
      message: 'Not in an indexed TypeScript/JavaScript repository',
    };
  }

  const exports = findExports(repo.id, input.path);

  if (exports.length === 0) {
    return {
      found: false,
      message: input.path
        ? `No exports found in "${input.path}"`
        : 'No exports found in repository',
    };
  }

  return {
    found: true,
    exports,
  };
}

/**
 * Get index status for current repository
 */
export function matrixIndexStatus(): IndexStatusResult {
  const repo = getCurrentRepoInfo();
  if (!repo) {
    return {
      indexed: false,
      message: 'Not in an indexed TypeScript/JavaScript repository',
    };
  }

  const repoName = repo.root.split('/').pop() || 'unknown';
  const status = getIndexStatus(repo.id, repoName);

  if (status.filesIndexed === 0) {
    return {
      indexed: false,
      message: 'Repository not yet indexed. Run session start to index.',
    };
  }

  return {
    indexed: true,
    status,
  };
}

/**
 * Search symbols by partial name match
 */
export function matrixSearchSymbols(input: SearchSymbolsInput): SearchSymbolsResult {
  const repo = getCurrentRepoInfo();
  if (!repo) {
    return {
      found: false,
      message: 'Not in an indexed TypeScript/JavaScript repository',
    };
  }

  const results = searchSymbols(repo.id, input.query, input.limit || 20);

  if (results.length === 0) {
    return {
      found: false,
      message: `No symbols matching "${input.query}" found`,
    };
  }

  return {
    found: true,
    results,
  };
}

/**
 * Get imports for a specific file
 */
export function matrixGetImports(input: GetImportsInput) {
  const repo = getCurrentRepoInfo();
  if (!repo) {
    return {
      found: false,
      message: 'Not in an indexed TypeScript/JavaScript repository',
    };
  }

  const imports = getFileImports(repo.id, input.file);

  if (imports.length === 0) {
    return {
      found: false,
      message: `No imports found in "${input.file}"`,
    };
  }

  return {
    found: true,
    imports,
  };
}

// Reindex input types
export interface ReindexInput {
  full?: boolean;  // Force full reindex (ignore incremental)
}

export interface ReindexResult {
  success: boolean;
  filesScanned?: number;
  filesIndexed?: number;
  filesSkipped?: number;
  symbolsFound?: number;
  importsFound?: number;
  duration?: number;
  message?: string;
}

/**
 * Manually trigger repository reindexing
 */
export async function matrixReindex(input: ReindexInput = {}): Promise<ReindexResult> {
  const repo = getCurrentRepoInfo();
  if (!repo) {
    return {
      success: false,
      message: 'Not in a TypeScript/JavaScript repository',
    };
  }

  try {
    const result = await indexRepository({
      repoRoot: repo.root,
      repoId: repo.id,
      incremental: !input.full,
    });

    return {
      success: true,
      filesScanned: result.filesScanned,
      filesIndexed: result.filesIndexed,
      filesSkipped: result.filesSkipped,
      symbolsFound: result.symbolsFound,
      importsFound: result.importsFound,
      duration: result.duration,
      message: result.filesIndexed > 0
        ? `Indexed ${result.filesIndexed} files, found ${result.symbolsFound} symbols`
        : `Index up to date (${result.filesSkipped} files unchanged)`,
    };
  } catch (err) {
    return {
      success: false,
      message: `Indexing failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
