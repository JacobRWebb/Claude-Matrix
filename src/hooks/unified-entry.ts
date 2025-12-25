#!/usr/bin/env bun
/**
 * Unified Hooks Entry Point
 *
 * Single binary that handles all hook events based on CLI argument.
 * Compiled with: bun build --compile src/hooks/unified-entry.ts
 *
 * Usage: matrix-hooks <hook-type>
 * Hook types: session-start, user-prompt-submit, pre-tool-bash, post-tool-bash, pre-tool-edit, stop-session
 */

const hookType = process.argv[2];

if (!hookType) {
  console.error('Usage: matrix-hooks <hook-type>');
  console.error('Hook types: session-start, user-prompt-submit, pre-tool-bash, post-tool-bash, pre-tool-edit, stop-session');
  process.exit(1);
}

async function main() {
  switch (hookType) {
    case 'session-start':
      await import('./session-start.js');
      break;
    case 'user-prompt-submit':
      await import('./user-prompt-submit.js');
      break;
    case 'pre-tool-bash':
      await import('./pre-tool-bash.js');
      break;
    case 'post-tool-bash':
      await import('./post-tool-bash.js');
      break;
    case 'pre-tool-edit':
      await import('./pre-tool-edit.js');
      break;
    case 'stop-session':
      await import('./stop-session.js');
      break;
    default:
      console.error(`Unknown hook type: ${hookType}`);
      console.error('Valid types: session-start, user-prompt-submit, pre-tool-bash, post-tool-bash, pre-tool-edit, stop-session');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Hook ${hookType} failed:`, err);
  process.exit(1);
});
