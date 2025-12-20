import { getDb } from '../db/index.js';
import {
  header,
  muted,
  printTable,
  printBox,
  error,
  formatDate,
  formatColoredScore,
} from './utils/output.js';

type ListType = 'solutions' | 'failures' | 'repos';

interface ListOptions {
  type: ListType;
  page: number;
  limit: number;
}

function parseArgs(args: string[]): ListOptions {
  const type = (args[0] as ListType) || 'solutions';
  const validTypes: ListType[] = ['solutions', 'failures', 'repos'];

  if (!validTypes.includes(type)) {
    error(`Invalid type: ${type}. Use: solutions, failures, or repos`);
    process.exit(1);
  }

  let page = 1;
  let limit = 20;

  for (const arg of args) {
    if (arg.startsWith('--page=')) {
      page = parseInt(arg.split('=')[1] ?? '1', 10) || 1;
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1] ?? '20', 10) || 20;
    }
  }

  return { type, page, limit };
}

export function list(args: string[]): void {
  const { type, page, limit } = parseArgs(args);
  const offset = (page - 1) * limit;
  const db = getDb();

  // Get total count for pagination
  const tableMap: Record<ListType, string> = {
    solutions: 'solutions',
    failures: 'failures',
    repos: 'repos',
  };
  const countResult = db
    .query(`SELECT COUNT(*) as total FROM ${tableMap[type]}`)
    .get() as { total: number };
  const total = countResult.total;
  const totalPages = Math.ceil(total / limit);

  console.log();

  switch (type) {
    case 'solutions': {
      const rows = db
        .query(
          `
        SELECT id, problem, scope, score, uses, created_at
        FROM solutions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
        )
        .all(limit, offset) as Array<{
        id: string;
        problem: string;
        scope: string;
        score: number;
        uses: number;
        created_at: string;
      }>;

      const formatted = rows.map((row) => ({
        id: row.id,
        problem: row.problem.slice(0, 45) + (row.problem.length > 45 ? '…' : ''),
        scope: row.scope,
        score: formatColoredScore(row.score),
        uses: row.uses.toString(),
        created: formatDate(row.created_at),
      }));

      printBox(`Solutions ${muted(`(page ${page}/${totalPages})`)}`, [], 70);
      console.log();
      printTable(formatted, [
        { key: 'id', header: 'ID', width: 15 },
        { key: 'problem', header: 'Problem', width: 45 },
        { key: 'scope', header: 'Scope', width: 6 },
        { key: 'score', header: 'Score', align: 'right', width: 6 },
        { key: 'uses', header: 'Uses', align: 'right', width: 5 },
        { key: 'created', header: 'Created', width: 12 },
      ]);
      break;
    }

    case 'failures': {
      const rows = db
        .query(
          `
        SELECT id, error_type, error_message, occurrences, root_cause, created_at
        FROM failures
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
        )
        .all(limit, offset) as Array<{
        id: string;
        error_type: string;
        error_message: string;
        occurrences: number;
        root_cause: string;
        created_at: string;
      }>;

      const formatted = rows.map((row) => ({
        id: row.id,
        type: row.error_type,
        message:
          row.error_message.slice(0, 35) +
          (row.error_message.length > 35 ? '…' : ''),
        occurrences: row.occurrences.toString(),
        created: formatDate(row.created_at),
      }));

      printBox(`Failures ${muted(`(page ${page}/${totalPages})`)}`, [], 70);
      console.log();
      printTable(formatted, [
        { key: 'id', header: 'ID', width: 15 },
        { key: 'type', header: 'Type', width: 8 },
        { key: 'message', header: 'Message', width: 35 },
        { key: 'occurrences', header: 'Count', align: 'right', width: 5 },
        { key: 'created', header: 'Created', width: 12 },
      ]);
      break;
    }

    case 'repos': {
      const rows = db
        .query(
          `
        SELECT id, name, path, languages, frameworks, patterns, updated_at
        FROM repos
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `
        )
        .all(limit, offset) as Array<{
        id: string;
        name: string;
        path: string;
        languages: string;
        frameworks: string;
        patterns: string;
        updated_at: string;
      }>;

      const formatted = rows.map((row) => ({
        id: row.id,
        name: row.name,
        languages: JSON.parse(row.languages || '[]').join(', '),
        frameworks: JSON.parse(row.frameworks || '[]').slice(0, 3).join(', '),
        updated: formatDate(row.updated_at),
      }));

      printBox(`Repos ${muted(`(page ${page}/${totalPages})`)}`, [], 70);
      console.log();
      printTable(formatted, [
        { key: 'id', header: 'ID', width: 15 },
        { key: 'name', header: 'Name', width: 20 },
        { key: 'languages', header: 'Languages', width: 20 },
        { key: 'frameworks', header: 'Frameworks', width: 20 },
        { key: 'updated', header: 'Updated', width: 12 },
      ]);
      break;
    }
  }

  // Pagination info
  console.log();
  console.log(muted(`  Page ${page} of ${totalPages} (${total} total)`));

  if (totalPages > 1) {
    const nav = [];
    if (page > 1) nav.push(`--page=${page - 1}`);
    if (page < totalPages) nav.push(`--page=${page + 1}`);
    console.log(muted(`  Navigate: ${nav.join('  ')}`));
  }

  console.log();
}
