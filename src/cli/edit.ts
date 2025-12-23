import { getDb } from '../db/index.js';
import {
  bold,
  cyan,
  dim,
  yellow,
  success,
  error,
  warn,
} from './utils/output.js';
import { createInterface } from 'readline';

type EditType = 'solution' | 'failure';

interface EditOptions {
  id: string;
  type: EditType;
  field?: string;
  value?: string;
}

const SOLUTION_FIELDS = ['problem', 'solution', 'scope', 'tags'] as const;
const FAILURE_FIELDS = ['error_message', 'root_cause', 'fix_applied', 'prevention'] as const;

function parseArgs(args: string[]): EditOptions {
  const id = args[0] || '';
  let type: EditType = 'solution';
  let field: string | undefined;
  let value: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--type=')) {
      const t = arg.split('=')[1];
      if (t === 'solution' || t === 'failure') {
        type = t;
      }
    } else if (arg.startsWith('--field=')) {
      field = arg.split('=')[1];
    } else if (arg.startsWith('--value=')) {
      value = arg.split('=').slice(1).join('='); // Handle values with = in them
    }
  }

  return { id, type, field, value };
}

function getSolution(id: string): Record<string, unknown> | null {
  const db = getDb();
  const result = db.query(`
    SELECT id, problem, solution, scope, tags, score, uses, created_at
    FROM solutions WHERE id = ? OR id LIKE ?
  `).get(id, `${id}%`) as Record<string, unknown> | null;
  return result;
}

function getFailure(id: string): Record<string, unknown> | null {
  const db = getDb();
  const result = db.query(`
    SELECT id, error_type, error_message, root_cause, fix_applied, prevention, created_at
    FROM failures WHERE id = ? OR id LIKE ?
  `).get(id, `${id}%`) as Record<string, unknown> | null;
  return result;
}

function displaySolution(solution: Record<string, unknown>): void {
  const solutionText = String(solution.solution || '');
  console.log();
  console.log(`  ${bold('Solution:')} ${dim(solution.id as string)}`);
  console.log();
  console.log(`  ${cyan('problem')}     ${solution.problem || ''}`);
  console.log(`  ${cyan('solution')}    ${solutionText.slice(0, 60)}${solutionText.length > 60 ? '...' : ''}`);
  console.log(`  ${cyan('scope')}       ${solution.scope || ''}`);
  console.log(`  ${cyan('tags')}        ${solution.tags || '[]'}`);
  console.log();
}

function displayFailure(failure: Record<string, unknown>): void {
  const errorMsg = String(failure.error_message || '');
  console.log();
  console.log(`  ${bold('Failure:')} ${dim(failure.id as string)}`);
  console.log();
  console.log(`  ${cyan('error_message')}  ${errorMsg.slice(0, 50)}${errorMsg.length > 50 ? '...' : ''}`);
  console.log(`  ${cyan('root_cause')}     ${failure.root_cause || dim('(not set)')}`);
  console.log(`  ${cyan('fix_applied')}    ${failure.fix_applied || dim('(not set)')}`);
  console.log(`  ${cyan('prevention')}     ${failure.prevention || dim('(not set)')}`);
  console.log();
}

async function interactiveEdit(
  record: Record<string, unknown>,
  type: EditType
): Promise<void> {
  const fields = type === 'solution' ? SOLUTION_FIELDS : FAILURE_FIELDS;
  const db = getDb();
  const id = record.id as string;

  console.log();
  console.log(`  ${bold('Interactive Edit')} ${dim(`(${type})`)}`);
  console.log(`  ${dim('Select a field to edit, or q to quit')}`);
  console.log();

  // Show numbered options
  fields.forEach((field, i) => {
    const value = String(record[field] || '');
    const display = value.length > 40 ? value.slice(0, 40) + '...' : value;
    console.log(`  ${cyan(`${i + 1}.`)} ${field.padEnd(15)} ${dim(display || '(empty)')}`);
  });
  console.log(`  ${cyan('q.')} Quit`);
  console.log();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askField = (): Promise<void> => {
    return new Promise((resolve) => {
      rl.question(`  ${bold('Select field')} ${dim('[1-' + fields.length + '/q]')}: `, async (answer) => {
        const choice = answer.trim().toLowerCase();

        if (choice === 'q' || choice === '') {
          rl.close();
          console.log();
          resolve();
          return;
        }

        const index = parseInt(choice, 10) - 1;
        if (index >= 0 && index < fields.length) {
          const field = fields[index] as string;
          const currentValue = String(record[field] || '');

          console.log();
          console.log(`  ${bold(`Editing: ${field}`)}`);
          console.log(`  ${dim('Current:')} ${currentValue || dim('(empty)')}`);

          rl.question(`  ${bold('New value')}: `, (newValue) => {
            if (newValue.trim()) {
              // Update database (only solutions have updated_at column)
              const table = type === 'solution' ? 'solutions' : 'failures';
              const sql = type === 'solution'
                ? `UPDATE ${table} SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`
                : `UPDATE ${table} SET ${field} = ? WHERE id = ?`;
              db.run(sql, [newValue.trim(), id]);
              record[field] = newValue.trim();
              success(`Updated ${field}`);
            } else {
              warn('No change (empty input)');
            }
            console.log();

            // Show updated state and ask again
            fields.forEach((f: string, i: number) => {
              const value = String(record[f] || '');
              const display = value.length > 40 ? value.slice(0, 40) + '...' : value;
              console.log(`  ${cyan(`${i + 1}.`)} ${f.padEnd(15)} ${dim(display || '(empty)')}`);
            });
            console.log(`  ${cyan('q.')} Quit`);
            console.log();

            askField().then(resolve);
          });
        } else {
          console.log(yellow('  Invalid choice'));
          askField().then(resolve);
        }
      });
    });
  };

  await askField();
}

export async function edit(args: string[]): Promise<void> {
  const options = parseArgs(args);

  if (!options.id) {
    error('Usage: matrix edit <id> [--type=solution|failure]');
    console.log();
    console.log(dim('  Examples:'));
    console.log(dim('    matrix edit abc123'));
    console.log(dim('    matrix edit abc123 --type=failure'));
    console.log(dim('    matrix edit abc123 --field=problem --value="New problem"'));
    console.log();
    process.exit(1);
  }

  // Try to find the record
  let record: Record<string, unknown> | null = null;
  let actualType: EditType = options.type;

  if (options.type === 'solution') {
    record = getSolution(options.id);
    if (!record) {
      // Try failure
      record = getFailure(options.id);
      if (record) actualType = 'failure';
    }
  } else {
    record = getFailure(options.id);
    if (!record) {
      // Try solution
      record = getSolution(options.id);
      if (record) actualType = 'solution';
    }
  }

  if (!record) {
    error(`Not found: ${options.id}`);
    console.log(dim('  Use "matrix list solutions" or "matrix list failures" to see IDs'));
    process.exit(1);
  }

  // If field and value provided, do inline edit
  if (options.field && options.value !== undefined) {
    const fields: readonly string[] = actualType === 'solution' ? SOLUTION_FIELDS : FAILURE_FIELDS;
    if (!fields.includes(options.field)) {
      error(`Invalid field: ${options.field}`);
      console.log(dim(`  Valid fields: ${fields.join(', ')}`));
      process.exit(1);
    }

    const db = getDb();
    const table = actualType === 'solution' ? 'solutions' : 'failures';
    // Only solutions have updated_at column
    const sql = actualType === 'solution'
      ? `UPDATE ${table} SET ${options.field} = ?, updated_at = datetime('now') WHERE id = ?`
      : `UPDATE ${table} SET ${options.field} = ? WHERE id = ?`;
    db.run(sql, [options.value, record.id as string]);
    success(`Updated ${options.field} for ${actualType} ${dim(record.id as string)}`);
    return;
  }

  // Show current state
  if (actualType === 'solution') {
    displaySolution(record);
  } else {
    displayFailure(record);
  }

  // Interactive edit
  await interactiveEdit(record, actualType);

  success('Edit complete');
}
