/**
 * File Scanner
 *
 * Discovers TypeScript/JavaScript files in a repository.
 * Uses Bun.Glob for fast file discovery with pattern exclusions.
 */

import { join, relative } from 'path';
import { stat } from 'fs/promises';
import type { ScannedFile } from './types.js';

// File extensions to index
const EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'mts', 'cts', 'cjs'];

// Default directories to exclude
const DEFAULT_EXCLUDES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '__pycache__',
  'vendor',
  '.turbo',
  '.vercel',
];

// Default file patterns to exclude
const DEFAULT_EXCLUDE_PATTERNS = [
  '*.min.js',
  '*.bundle.js',
  '*.d.ts',           // skip declaration files (generated)
  '*.test.ts',        // skip test files (optional)
  '*.spec.ts',
  '*.test.tsx',
  '*.spec.tsx',
];

export interface ScanOptions {
  repoRoot: string;
  excludePatterns?: string[];
  maxFileSize?: number;       // bytes, default: 1MB
  includeTests?: boolean;     // include test files, default: false
}

/**
 * Scan a repository for TypeScript/JavaScript files
 */
export async function scanRepository(options: ScanOptions): Promise<ScannedFile[]> {
  const {
    repoRoot,
    excludePatterns = [],
    maxFileSize = 1024 * 1024, // 1MB
    includeTests = false,
  } = options;

  const files: ScannedFile[] = [];

  // Build glob pattern for all supported extensions
  const pattern = `**/*.{${EXTENSIONS.join(',')}}`;

  // Build exclusion list
  const allExcludes = [
    ...DEFAULT_EXCLUDES.map(dir => `**/${dir}/**`),
    ...excludePatterns,
  ];

  // Add test file exclusions unless includeTests is true
  if (!includeTests) {
    allExcludes.push(
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
      '**/__tests__/**',
      '**/__mocks__/**',
    );
  }

  // Always exclude declaration files
  allExcludes.push('**/*.d.ts', '**/*.d.mts', '**/*.d.cts');

  const glob = new Bun.Glob(pattern);

  for await (const filePath of glob.scan({
    cwd: repoRoot,
    absolute: false,
    onlyFiles: true,
  })) {
    // Quick check for common exclusions (performance optimization)
    const pathParts = filePath.split('/');
    const shouldExcludeQuick = DEFAULT_EXCLUDES.some(dir => pathParts.includes(dir));
    if (shouldExcludeQuick) {
      continue;
    }

    // Check additional exclusion patterns
    const shouldExclude = allExcludes.some(excludePattern => {
      // Handle glob patterns
      if (excludePattern.includes('*')) {
        // Convert glob to regex
        const regex = excludePattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '___DOUBLESTAR___')
          .replace(/\*/g, '[^/]*')
          .replace(/___DOUBLESTAR___/g, '.*');
        return new RegExp(`^${regex}$`).test(filePath);
      }
      // Simple substring match
      return filePath.includes(excludePattern);
    });

    if (shouldExclude) {
      continue;
    }

    const absolutePath = join(repoRoot, filePath);

    try {
      const stats = await stat(absolutePath);

      // Skip files larger than maxFileSize
      if (stats.size > maxFileSize) {
        continue;
      }

      files.push({
        path: filePath,
        absolutePath,
        mtime: Math.floor(stats.mtimeMs),
      });
    } catch {
      // File doesn't exist or can't be read, skip
      continue;
    }
  }

  return files;
}

/**
 * Get file stats for a single file
 */
export async function getFileStats(absolutePath: string): Promise<{ mtime: number; size: number } | null> {
  try {
    const stats = await stat(absolutePath);
    return {
      mtime: Math.floor(stats.mtimeMs),
      size: stats.size,
    };
  } catch {
    return null;
  }
}

/**
 * Check if a path matches any exclusion pattern
 */
export function isExcluded(filePath: string, excludePatterns: string[] = []): boolean {
  // Quick check: path contains excluded directory as a path segment
  const pathParts = filePath.split('/');
  if (DEFAULT_EXCLUDES.some(dir => pathParts.includes(dir))) {
    return true;
  }

  // Check declaration files (.d.ts, .d.mts, .d.cts)
  if (/\.d\.(ts|mts|cts)$/.test(filePath)) {
    return true;
  }

  // Check test files
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) {
    return true;
  }

  // Check minified/bundle files
  if (/\.(min|bundle)\.(js|ts)$/.test(filePath)) {
    return true;
  }

  // Check custom exclusion patterns
  for (const pattern of excludePatterns) {
    if (pattern.includes('*')) {
      // Convert glob to regex
      const regex = pattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      if (new RegExp(regex).test(filePath)) {
        return true;
      }
    } else if (filePath.includes(pattern)) {
      return true;
    }
  }

  return false;
}
