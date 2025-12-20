import {
  getConfig,
  saveConfig,
  resetConfig,
  get,
  set,
  getAllKeys,
  getConfigPath,
  clearCache,
} from '../config/index.js';
import {
  bold,
  cyan,
  muted,
  green,
  yellow,
  success,
  error,
} from './utils/output.js';

export async function config(args: string[]): Promise<void> {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
    case 'ls':
      return showConfigStatic();

    case 'get':
      return getConfigValue(args[1]);

    case 'set':
      return setConfigValue(args[1], args[2]);

    case 'reset':
      return resetConfigToDefaults();

    case 'path':
      return showConfigPath();

    case undefined:
      return interactiveConfig();

    default:
      error(`Unknown config subcommand: ${subcommand}`);
      showConfigHelp();
  }
}

interface ConfigItem {
  key: string;
  name: string;
  section: string;
  value: unknown;
  type: string;
}

function getConfigItems(): ConfigItem[] {
  const items: ConfigItem[] = [];
  for (const { key, value, type } of getAllKeys()) {
    const [section, ...rest] = key.split('.');
    items.push({
      key,
      name: rest.join('.'),
      section: section || '',
      value,
      type,
    });
  }
  return items;
}

async function interactiveConfig(): Promise<void> {
  const items = getConfigItems();
  let selectedIndex = 0;
  let editMode = false;
  let editBuffer = '';

  // Enable raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const render = () => {
    // Clear screen and move to top
    process.stdout.write('\x1b[2J\x1b[H');

    // Header
    console.log();
    console.log(`  ${bold('Matrix Configuration')}`);
    console.log(`  ${muted(getConfigPath())}`);
    console.log();
    console.log(`  ${muted('↑↓ Navigate   Enter Edit   r Reset   q Quit')}`);
    console.log();

    // Group by section
    let currentSection = '';
    let itemIndex = 0;

    for (const item of items) {
      if (item.section !== currentSection) {
        if (currentSection !== '') console.log();
        console.log(`  ${bold(capitalize(item.section))}`);
        currentSection = item.section;
      }

      const isSelected = itemIndex === selectedIndex;
      const prefix = isSelected ? green('▸') : ' ';
      const nameStyle = isSelected ? cyan : (s: string) => s;
      const valueStr = formatValue(item.value, item.type);

      if (editMode && isSelected) {
        console.log(`  ${prefix} ${nameStyle(padRight(item.name, 18))} ${yellow(editBuffer + '█')}`);
      } else {
        console.log(`  ${prefix} ${nameStyle(padRight(item.name, 18))} ${valueStr}`);
      }

      itemIndex++;
    }

    console.log();
    if (editMode) {
      console.log(`  ${muted('Type new value, Enter to save, Esc to cancel')}`);
    }
  };

  render();

  return new Promise((resolve) => {
    const onKeypress = (key: Buffer) => {
      const char = key.toString();

      if (editMode) {
        // Handle edit mode input
        if (char === '\x1b' || char === '\x03') {
          // Escape or Ctrl+C - cancel edit
          editMode = false;
          editBuffer = '';
          render();
        } else if (char === '\r' || char === '\n') {
          // Enter - save value
          const item = items[selectedIndex]!;
          try {
            clearCache();
            set(item.key, editBuffer);
            // Refresh items with new value
            const newItems = getConfigItems();
            items.length = 0;
            items.push(...newItems);
          } catch (e) {
            // Ignore errors
          }
          editMode = false;
          editBuffer = '';
          render();
        } else if (char === '\x7f' || char === '\b') {
          // Backspace
          editBuffer = editBuffer.slice(0, -1);
          render();
        } else if (char >= ' ' && char <= '~') {
          // Printable character
          editBuffer += char;
          render();
        }
        return;
      }

      // Normal mode
      if (char === '\x1b[A') {
        // Up arrow
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
      } else if (char === '\x1b[B') {
        // Down arrow
        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
        render();
      } else if (char === '\r' || char === '\n') {
        // Enter - start editing
        editMode = true;
        editBuffer = String(items[selectedIndex]!.value);
        render();
      } else if (char === 'r' || char === 'R') {
        // Reset to defaults
        resetConfig();
        clearCache();
        const newItems = getConfigItems();
        items.length = 0;
        items.push(...newItems);
        render();
      } else if (char === 'q' || char === 'Q' || char === '\x03') {
        // Quit (q or Ctrl+C)
        cleanup();
        console.log();
        resolve();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('data', onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
    };

    process.stdin.on('data', onKeypress);
  });
}

function showConfigStatic(): void {
  const items = getConfigItems();

  console.log();
  console.log(`  ${bold('Matrix Configuration')}`);
  console.log(`  ${muted(getConfigPath())}`);
  console.log();

  let currentSection = '';
  for (const item of items) {
    if (item.section !== currentSection) {
      if (currentSection !== '') console.log();
      console.log(`  ${bold(capitalize(item.section))}`);
      currentSection = item.section;
    }

    const isLast = items.indexOf(item) === items.length - 1 ||
      items[items.indexOf(item) + 1]?.section !== item.section;
    const prefix = isLast ? '└─' : '├─';
    const valueStr = formatValue(item.value, item.type);

    console.log(`  ${muted(prefix)} ${cyan(padRight(item.name, 18))} ${valueStr}`);
  }

  console.log();
  console.log(muted('  Use: matrix config set <key> <value>'));
  console.log();
}

function getConfigValue(key: string | undefined): void {
  if (!key) {
    error('Usage: matrix config get <key>');
    console.log(muted('\nAvailable keys:'));
    for (const { key: k } of getAllKeys()) {
      console.log(muted(`  ${k}`));
    }
    return;
  }

  try {
    const value = get(key);
    console.log(formatValue(value, typeof value));
  } catch {
    error(`Key not found: ${key}`);
  }
}

function setConfigValue(key: string | undefined, value: string | undefined): void {
  if (!key || value === undefined) {
    error('Usage: matrix config set <key> <value>');
    return;
  }

  try {
    const oldValue = get(key);
    set(key, value);
    clearCache();
    const newValue = get(key);

    success(`Updated ${cyan(key)}`);
    console.log(`  ${muted('Old:')} ${formatValue(oldValue, typeof oldValue)}`);
    console.log(`  ${muted('New:')} ${formatValue(newValue, typeof newValue)}`);
  } catch (err) {
    error(`Failed to set ${key}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function resetConfigToDefaults(): void {
  resetConfig();
  clearCache();
  success('Config reset to defaults');
  console.log();
  showConfigStatic();
}

function showConfigPath(): void {
  console.log(getConfigPath());
}

function showConfigHelp(): void {
  console.log(`
${bold('Usage:')} matrix config [subcommand]

${bold('Subcommands:')}
  ${cyan('(none)')}            Interactive config editor
  ${cyan('list')}              Show all configuration values
  ${cyan('get')} <key>         Get a specific value
  ${cyan('set')} <key> <val>   Set a specific value
  ${cyan('reset')}             Reset to default values
  ${cyan('path')}              Show config file path

${bold('Examples:')}
  matrix config
  matrix config list
  matrix config get search.defaultLimit
  matrix config set search.defaultLimit 10
`);
}

function formatValue(value: unknown, type: string): string {
  if (type === 'boolean' || typeof value === 'boolean') {
    return value ? green('true') : yellow('false');
  }
  if (type === 'number' || typeof value === 'number') {
    return cyan(String(value));
  }
  if (type === 'string' || typeof value === 'string') {
    return green(`"${value}"`);
  }
  return String(value);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}
