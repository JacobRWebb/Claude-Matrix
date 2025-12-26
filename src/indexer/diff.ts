/**
 * File Diff
 *
 * Compares current repository state against indexed state
 * to determine which files need re-indexing.
 */

import type { ScannedFile, FileDiff, RepoFileRow } from './types.js';

/**
 * Compare scanned files against indexed files to find changes
 */
export function computeDiff(
  scannedFiles: ScannedFile[],
  indexedFiles: Map<string, RepoFileRow>
): FileDiff {
  const added: ScannedFile[] = [];
  const modified: ScannedFile[] = [];
  const deleted: string[] = [];

  // Track which indexed files we've seen
  const seenPaths = new Set<string>();

  for (const file of scannedFiles) {
    const indexed = indexedFiles.get(file.path);

    if (!indexed) {
      // New file, not in index
      added.push(file);
    } else if (file.mtime > indexed.mtime) {
      // File has been modified since last index
      modified.push(file);
    }
    // else: file unchanged, skip

    seenPaths.add(file.path);
  }

  // Find deleted files (in index but not in scan)
  for (const [path] of indexedFiles) {
    if (!seenPaths.has(path)) {
      deleted.push(path);
    }
  }

  return { added, modified, deleted };
}

/**
 * Get summary of diff for logging
 */
export function getDiffSummary(diff: FileDiff): string {
  const parts: string[] = [];

  if (diff.added.length > 0) {
    parts.push(`${diff.added.length} new`);
  }
  if (diff.modified.length > 0) {
    parts.push(`${diff.modified.length} modified`);
  }
  if (diff.deleted.length > 0) {
    parts.push(`${diff.deleted.length} deleted`);
  }

  if (parts.length === 0) {
    return 'No changes';
  }

  return parts.join(', ');
}

/**
 * Check if there are any changes to process
 */
export function hasChanges(diff: FileDiff): boolean {
  return diff.added.length > 0 || diff.modified.length > 0 || diff.deleted.length > 0;
}

/**
 * Get total number of files that need processing
 */
export function getChangedFileCount(diff: FileDiff): number {
  return diff.added.length + diff.modified.length + diff.deleted.length;
}
