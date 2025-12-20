import { matrixRecall } from '../tools/index.js';
import {
  bold,
  cyan,
  muted,
  green,
  yellow,
  error,
  info,
  formatScore,
  formatColoredScore,
  box,
  padEnd,
  visibleWidth,
} from './utils/output.js';

interface SearchOptions {
  query: string;
  limit: number;
  minScore: number;
  scopeFilter: 'all' | 'repo' | 'stack' | 'global';
}

function parseArgs(args: string[]): SearchOptions {
  const queryParts: string[] = [];
  let limit = 5;
  let minScore = 0.3;
  let scopeFilter: 'all' | 'repo' | 'stack' | 'global' = 'all';

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1] ?? '5', 10) || 5;
    } else if (arg.startsWith('--min-score=')) {
      minScore = parseFloat(arg.split('=')[1] ?? '0.3') || 0.3;
    } else if (arg.startsWith('--scope=')) {
      const scope = arg.split('=')[1] ?? '';
      if (['all', 'repo', 'stack', 'global'].includes(scope)) {
        scopeFilter = scope as typeof scopeFilter;
      }
    } else if (!arg.startsWith('--')) {
      queryParts.push(arg);
    }
  }

  return {
    query: queryParts.join(' '),
    limit,
    minScore,
    scopeFilter,
  };
}

function printCard(
  id: string,
  matchPercent: string,
  problem: string,
  solution: string,
  scope: string,
  score: number,
  uses: number,
  successRate: number,
  tags: string[],
  contextBoost?: string
): void {
  const width = 70;
  const innerWidth = width - 2;

  // Top border with ID and match
  const idPart = ` ${id} `;
  const matchPart = ` ${matchPercent} match `;
  const midDash = box.horizontal.repeat(innerWidth - idPart.length - matchPart.length);
  console.log(
    muted(box.topLeft) +
    muted(box.horizontal) +
    cyan(idPart) +
    muted(midDash) +
    green(matchPart) +
    muted(box.topRight)
  );

  // Empty line
  console.log(muted(box.vertical) + ' '.repeat(innerWidth) + muted(box.vertical));

  // Context boost if present
  if (contextBoost) {
    const boostLabel = contextBoost === 'same_repo' ? 'same repo' : 'similar stack';
    const line = `  ${muted('Boosted:')} ${boostLabel}`;
    console.log(muted(box.vertical) + padEnd(line, innerWidth) + muted(box.vertical));
  }

  // Problem
  const problemLabel = `  ${bold('Problem:')} ${problem}`;
  const problemLines = wrapText(problemLabel, innerWidth - 2);
  for (const line of problemLines) {
    console.log(muted(box.vertical) + padEnd(line, innerWidth) + muted(box.vertical));
  }

  // Empty line
  console.log(muted(box.vertical) + ' '.repeat(innerWidth) + muted(box.vertical));

  // Solution
  console.log(muted(box.vertical) + padEnd(`  ${bold('Solution:')}`, innerWidth) + muted(box.vertical));
  const solutionLines = solution.split('\n').slice(0, 12);
  for (const line of solutionLines) {
    const truncated = line.slice(0, innerWidth - 4);
    console.log(muted(box.vertical) + padEnd(`    ${truncated}`, innerWidth) + muted(box.vertical));
  }
  if (solution.split('\n').length > 12) {
    console.log(muted(box.vertical) + padEnd(`    ${muted('... (truncated)')}`, innerWidth) + muted(box.vertical));
  }

  // Empty line
  console.log(muted(box.vertical) + ' '.repeat(innerWidth) + muted(box.vertical));

  // Metadata line
  const meta = `  ${muted('scope:')} ${scope}   ${muted('score:')} ${formatColoredScore(score)}   ${muted('uses:')} ${uses}   ${muted('success:')} ${formatScore(successRate)}`;
  console.log(muted(box.vertical) + padEnd(meta, innerWidth) + muted(box.vertical));

  // Tags line if present
  if (tags.length > 0) {
    const tagsLine = `  ${muted('tags:')} ${tags.join(', ')}`;
    console.log(muted(box.vertical) + padEnd(tagsLine, innerWidth) + muted(box.vertical));
  }

  // Bottom border
  console.log(muted(box.bottomLeft + box.horizontal.repeat(innerWidth) + box.bottomRight));
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (visibleWidth(testLine) <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

export async function search(args: string[]): Promise<void> {
  const options = parseArgs(args);

  if (!options.query) {
    error('Usage: matrix search <query> [--limit=N] [--scope=all|repo|stack|global]');
    process.exit(1);
  }

  info('Searching...');
  console.log(muted('(Generating embeddings, this may take a moment on first run)\n'));

  try {
    const result = await matrixRecall({
      query: options.query,
      limit: options.limit,
      minScore: options.minScore,
      scopeFilter: options.scopeFilter,
    });

    if (result.solutions.length === 0) {
      console.log(yellow('No matching solutions found.'));
      console.log(muted(`\nTry a different query or lower the min-score with --min-score=0.2`));
      return;
    }

    console.log(`${bold('Found')} ${green(String(result.totalFound))} ${bold('matches')}`);
    console.log(muted(`Showing top ${result.solutions.length}\n`));

    for (const sol of result.solutions) {
      const matchPercent = (sol.similarity * 100).toFixed(0) + '%';

      printCard(
        sol.id,
        matchPercent,
        sol.problem,
        sol.solution,
        sol.scope,
        sol.score,
        sol.uses,
        sol.successRate,
        sol.tags,
        sol.contextBoost
      );
      console.log();
    }

  } catch (err) {
    error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
