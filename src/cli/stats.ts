import { matrixStatus } from '../tools/index.js';
import {
  bold,
  cyan,
  muted,
  green,
  yellow,
  printBox,
  formatDate,
  formatColoredScore,
  truncate,
  statusDot,
  padEnd,
} from './utils/output.js';

export function stats(): void {
  const result = matrixStatus();

  console.log();

  // Status section
  printBox('Matrix Memory', [
    `Status:    ${statusDot(result.status === 'operational')} ${result.status === 'operational' ? green('operational') : yellow(result.status)}`,
    `Database:  ${statusDot(result.database === 'connected')} ${result.database === 'connected' ? green('connected') : yellow(result.database)}`,
  ], 45);

  console.log();

  // Current repo section
  const repoContent: string[] = [];
  if (result.currentRepo.name) {
    repoContent.push(`${cyan(padEnd('Name:', 12))} ${result.currentRepo.name}`);
  } else {
    repoContent.push(muted('Not in a repository'));
  }

  if (result.currentRepo.languages.length > 0) {
    repoContent.push(`${cyan(padEnd('Languages:', 12))} ${result.currentRepo.languages.join(', ')}`);
  }
  if (result.currentRepo.frameworks.length > 0) {
    repoContent.push(`${cyan(padEnd('Frameworks:', 12))} ${result.currentRepo.frameworks.join(', ')}`);
  }
  if (result.currentRepo.patterns.length > 0) {
    repoContent.push(`${cyan(padEnd('Patterns:', 12))} ${result.currentRepo.patterns.join(', ')}`);
  }

  printBox('Current Repository', repoContent, 55);

  console.log();

  // Memory counts - inline format
  const countContent = [
    `${cyan('Solutions')} ${bold(String(result.stats.solutions))}    ` +
    `${cyan('Failures')} ${bold(String(result.stats.failures))}    ` +
    `${cyan('Repos')} ${bold(String(result.stats.repos))}`,
  ];
  printBox('Memory Counts', countContent, 55);

  // Top tags
  if (result.topTags.length > 0) {
    console.log();
    printBox('Top Tags', [result.topTags.join('  ')], 55);
  }

  // Recent solutions
  if (result.recentSolutions.length > 0) {
    console.log();
    const recentContent: string[] = [];

    for (const sol of result.recentSolutions) {
      const date = formatDate(sol.created_at);
      const score = formatColoredScore(sol.score);
      const problem = truncate(sol.problem, 40);
      recentContent.push(`${muted(sol.id.slice(0, 12))} ${problem}`);
      recentContent.push(`  ${muted(sol.scope)} ${muted('│')} ${score} ${muted('│')} ${muted(date)}`);
    }

    printBox('Recent Solutions', recentContent, 60);
  }

  console.log();
}
