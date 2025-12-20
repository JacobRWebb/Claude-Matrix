import { bold, cyan, muted, printBox } from './utils/output.js';

export function printHelp(): void {
  console.log();
  printBox('Matrix', ['Persistent memory system for Claude Code'], 50);

  console.log(`
${bold('USAGE')}
  ${cyan('matrix')} ${muted('<command>')} ${muted('[options]')}

${bold('COMMANDS')}
  ${cyan('init')}                    Initialize Matrix (auto-setup)
  ${cyan('search')} ${muted('<query>')}         Search past solutions semantically
  ${cyan('list')} ${muted('[type]')}            List solutions, failures, or repos
  ${cyan('merge')}                   Find and merge duplicate solutions
  ${cyan('stats')}                   Show memory statistics
  ${cyan('export')}                  Export database (JSON/CSV)
  ${cyan('version')}                 Show version
  ${cyan('help')}                    Show this help

${bold('SEARCH OPTIONS')}
  ${muted('--limit=N')}              Max results (default: 5)
  ${muted('--min-score=N')}          Min similarity 0-1 (default: 0.3)
  ${muted('--scope=SCOPE')}          Filter: all, repo, stack, global

${bold('MERGE OPTIONS')}
  ${muted('--threshold=N')}          Similarity threshold (default: 0.8)
  ${muted('--type=TYPE')}            solutions or failures
  ${muted('--dry-run')}              Show pairs without prompts

${bold('EXAMPLES')}
  ${muted('# Complete setup (for first-time users)')}
  matrix init

  ${muted('# Search for OAuth-related solutions')}
  matrix search "OAuth implementation"

  ${muted('# List recent solutions')}
  matrix list solutions

  ${muted('# Find duplicate solutions')}
  matrix merge --dry-run

  ${muted('# Export to JSON')}
  matrix export --format=json --output=backup.json

${bold('ENVIRONMENT')}
  ${cyan('MATRIX_DB')}      Custom database path
  ${cyan('MATRIX_DIR')}     Matrix installation directory

${bold('LEARN MORE')}
  ${muted('https://github.com/ojowwalker77/Claude-Matrix')}
`);
}
