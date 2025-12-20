import { getDb, bufferToEmbedding, cosineSimilarity } from '../db/index.js';
import { EMBEDDING_DIM } from '../embeddings/local.js';
import {
  bold,
  cyan,
  muted,
  green,
  yellow,
  red,
  error,
  success,
  info,
  warn,
  printBox,
  formatColoredScore,
  formatScore,
  truncate,
  box,
  padEnd,
} from './utils/output.js';

interface MergeOptions {
  threshold: number;
  type: 'solutions' | 'failures';
  dryRun: boolean;
}

interface Solution {
  id: string;
  problem: string;
  solution: string;
  scope: string;
  score: number;
  uses: number;
  successes: number;
  partial_successes: number;
  failures: number;
  tags: string;
  problem_embedding: Uint8Array;
  created_at: string;
}

interface MergeCandidate {
  a: Solution;
  b: Solution;
  similarity: number;
}

function parseArgs(args: string[]): MergeOptions {
  let threshold = 0.8;
  let type: 'solutions' | 'failures' = 'solutions';
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith('--threshold=')) {
      threshold = parseFloat(arg.split('=')[1] ?? '0.8') || 0.8;
    } else if (arg.startsWith('--type=')) {
      const t = arg.split('=')[1] ?? '';
      if (t === 'solutions' || t === 'failures') {
        type = t;
      }
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { threshold, type, dryRun };
}

async function promptUser(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim().toLowerCase();
  }
  return '';
}

function printMergePair(
  pair: MergeCandidate,
  index: number,
  total: number
): void {
  const width = 72;
  const innerWidth = width - 2;
  const similarityPct = (pair.similarity * 100).toFixed(0) + '%';

  // Top border with pair info and similarity
  const leftLabel = ` Pair ${index} of ${total} `;
  const rightLabel = ` ${similarityPct} similar `;
  const midDash = box.horizontal.repeat(
    innerWidth - leftLabel.length - rightLabel.length
  );
  console.log(
    muted(box.roundTopLeft) +
    muted(box.horizontal) +
    cyan(leftLabel) +
    muted(midDash) +
    green(rightLabel) +
    muted(box.roundTopRight)
  );

  // Empty line
  printBoxLine(innerWidth, '');

  // Solution A
  printSolutionBlock(pair.a, 'A', innerWidth, pair.a.score >= pair.b.score);

  // Empty line
  printBoxLine(innerWidth, '');

  // Solution B
  printSolutionBlock(pair.b, 'B', innerWidth, pair.b.score > pair.a.score);

  // Empty line
  printBoxLine(innerWidth, '');

  // Recommendation
  const keep = pair.a.score >= pair.b.score ? 'A' : 'B';
  const keepId = keep === 'A' ? pair.a.id : pair.b.id;
  printBoxLine(
    innerWidth,
    `  ${bold('Recommendation:')} Keep ${keep} (${muted(keepId.slice(0, 12))})`
  );

  // Bottom border
  console.log(
    muted(box.roundBottomLeft) +
    muted(box.horizontal.repeat(innerWidth)) +
    muted(box.roundBottomRight)
  );
}

function printSolutionBlock(
  sol: Solution,
  label: string,
  width: number,
  isRecommended: boolean
): void {
  const marker = isRecommended ? green('●') : muted('○');

  // Nested box for solution
  const nestedWidth = width - 4;
  const innerNested = nestedWidth - 2;

  // Nested top border
  const labelPart = ` ${label}: ${sol.id.slice(0, 12)} `;
  const nestedTopDash = box.horizontal.repeat(innerNested - labelPart.length);
  printBoxLine(
    width,
    `  ${muted(box.topLeft)}${muted(box.horizontal)}${marker} ${cyan(labelPart.trim())}${muted(nestedTopDash)}${muted(box.topRight)}`
  );

  // Problem
  const problem = truncate(sol.problem, innerNested - 12);
  printBoxLine(
    width,
    `  ${muted(box.vertical)}  ${muted('Problem:')}  ${problem}${' '.repeat(Math.max(0, innerNested - 12 - problem.length))}${muted(box.vertical)}`
  );

  // Metadata
  const tags = JSON.parse(sol.tags || '[]') as string[];
  const meta = `${muted('Scope:')} ${sol.scope}  ${muted('Score:')} ${formatColoredScore(sol.score)}  ${muted('Uses:')} ${sol.uses}`;
  printBoxLine(width, `  ${muted(box.vertical)}  ${meta}${' '.repeat(Math.max(0, innerNested - 40))}${muted(box.vertical)}`);

  // Solution preview
  const solutionLines = sol.solution.split('\n').slice(0, 4);
  for (const line of solutionLines) {
    const preview = truncate(line, innerNested - 4);
    printBoxLine(
      width,
      `  ${muted(box.vertical)}    ${muted(preview)}${' '.repeat(Math.max(0, innerNested - 4 - preview.length))}${muted(box.vertical)}`
    );
  }
  if (sol.solution.split('\n').length > 4) {
    printBoxLine(
      width,
      `  ${muted(box.vertical)}    ${muted('...')}${' '.repeat(innerNested - 7)}${muted(box.vertical)}`
    );
  }

  // Tags if present
  if (tags.length > 0) {
    const tagStr = truncate(tags.join(', '), innerNested - 10);
    printBoxLine(
      width,
      `  ${muted(box.vertical)}  ${muted('Tags:')} ${tagStr}${' '.repeat(Math.max(0, innerNested - 8 - tagStr.length))}${muted(box.vertical)}`
    );
  }

  // Nested bottom border
  printBoxLine(
    width,
    `  ${muted(box.bottomLeft)}${muted(box.horizontal.repeat(innerNested))}${muted(box.bottomRight)}`
  );
}

function printBoxLine(width: number, content: string): void {
  // This is a simplified version - just prints content padded
  console.log(muted(box.vertical) + padEnd(content, width - 2) + muted(box.vertical));
}

async function executeMerge(
  keep: Solution,
  remove: Solution
): Promise<void> {
  const db = getDb();

  // Combine stats
  const newUses = keep.uses + remove.uses;
  const newSuccesses = keep.successes + remove.successes;
  const newPartial = keep.partial_successes + remove.partial_successes;
  const newFailures = keep.failures + remove.failures;

  // Combine tags
  const keepTags = JSON.parse(keep.tags || '[]') as string[];
  const removeTags = JSON.parse(remove.tags || '[]') as string[];
  const combinedTags = [...new Set([...keepTags, ...removeTags])];

  // Update the kept solution
  db.query(`
    UPDATE solutions
    SET uses = ?,
        successes = ?,
        partial_successes = ?,
        failures = ?,
        tags = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    newUses,
    newSuccesses,
    newPartial,
    newFailures,
    JSON.stringify(combinedTags),
    keep.id
  );

  // Log the merge
  db.query(`
    INSERT INTO usage_log (solution_id, outcome, notes, created_at)
    VALUES (?, 'success', ?, datetime('now'))
  `).run(
    keep.id,
    `Merged from ${remove.id}: +${remove.uses} uses`
  );

  // Delete the merged solution
  db.query(`DELETE FROM solutions WHERE id = ?`).run(remove.id);
}

export async function merge(args: string[]): Promise<void> {
  const options = parseArgs(args);

  if (options.type === 'failures') {
    warn('Failure merging not yet implemented. Use --type=solutions');
    return;
  }

  console.log();
  printBox('Merge Analysis', [
    `Scanning for duplicates (threshold: ${(options.threshold * 100).toFixed(0)}%)...`,
  ], 55);
  console.log();

  const db = getDb();

  // Load all solutions with embeddings
  const solutions = db.query(`
    SELECT id, problem, solution, scope, score, uses, successes,
           partial_successes, failures, tags, problem_embedding, created_at
    FROM solutions
    WHERE problem_embedding IS NOT NULL
    ORDER BY score DESC
  `).all() as Solution[];

  if (solutions.length < 2) {
    info('Not enough solutions to compare');
    return;
  }

  info(`Loaded ${solutions.length} solutions`);

  // Find similar pairs
  const candidates: MergeCandidate[] = [];

  for (let i = 0; i < solutions.length; i++) {
    for (let j = i + 1; j < solutions.length; j++) {
      const a = solutions[i]!;
      const b = solutions[j]!;

      try {
        const embA = bufferToEmbedding(a.problem_embedding);
        const embB = bufferToEmbedding(b.problem_embedding);

        if (embA.length !== EMBEDDING_DIM || embB.length !== EMBEDDING_DIM) {
          continue;
        }

        const similarity = cosineSimilarity(embA, embB);

        if (similarity >= options.threshold) {
          candidates.push({ a, b, similarity });
        }
      } catch {
        continue;
      }
    }
  }

  // Sort by similarity descending
  candidates.sort((a, b) => b.similarity - a.similarity);

  if (candidates.length === 0) {
    success(`No similar pairs found above ${(options.threshold * 100).toFixed(0)}% threshold`);
    console.log(muted(`\nTry lowering threshold with --threshold=0.7`));
    return;
  }

  console.log(`${bold('Found')} ${green(String(candidates.length))} ${bold('similar pairs')}`);
  console.log();

  if (options.dryRun) {
    // Just show all pairs
    for (let i = 0; i < candidates.length; i++) {
      printMergePair(candidates[i]!, i + 1, candidates.length);
      console.log();
    }
    console.log(muted('Dry run complete. Run without --dry-run to merge interactively.'));
    return;
  }

  // Interactive mode
  let merged = 0;
  let skipped = 0;

  for (let i = 0; i < candidates.length; i++) {
    const pair = candidates[i]!;

    printMergePair(pair, i + 1, candidates.length);
    console.log();

    const keep = pair.a.score >= pair.b.score ? pair.a : pair.b;
    const remove = pair.a.score >= pair.b.score ? pair.b : pair.a;

    console.log(`  ${cyan('[y]')} Merge (keep ${keep.id.slice(0, 8)})  ${cyan('[n]')} Skip  ${cyan('[v]')} View full  ${cyan('[q]')} Quit`);
    console.log();

    const answer = await promptUser('  > ');

    if (answer === 'q') {
      info('Merge cancelled');
      break;
    }

    if (answer === 'y') {
      await executeMerge(keep, remove);
      success(`Merged: ${red(remove.id.slice(0, 12))} → ${green(keep.id.slice(0, 12))} (uses: ${keep.uses}→${keep.uses + remove.uses})`);
      merged++;
    } else if (answer === 'v') {
      // Show full content
      console.log(`\n${bold('=== Full Solution A ===')}`);
      console.log(pair.a.solution);
      console.log(`\n${bold('=== Full Solution B ===')}`);
      console.log(pair.b.solution);
      console.log();

      // Re-prompt
      i--;
      continue;
    } else {
      muted('  Skipped');
      skipped++;
    }

    console.log();
  }

  // Summary
  console.log();
  printBox('Merge Complete', [
    `Merged: ${green(String(merged))}  Skipped: ${muted(String(skipped))}`,
  ], 40);
  console.log();
}
