// ANSI color codes with improved contrast
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Headers/emphasis
  header: '\x1b[1;36m',       // Bold cyan
  accent: '\x1b[38;5;75m',    // Bright blue (256-color)

  // Basic colors
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',

  // Score gradient
  scoreHigh: '\x1b[92m',      // Bright green
  scoreMid: '\x1b[93m',       // Bright yellow
  scoreLow: '\x1b[90m',       // Gray

  // Better secondary text
  muted: '\x1b[38;5;245m',    // Medium gray (256-color)
};

// Box-drawing characters
export const box = {
  // Standard corners
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  // Rounded corners
  roundTopLeft: '╭',
  roundTopRight: '╮',
  roundBottomLeft: '╰',
  roundBottomRight: '╯',
  // Lines
  horizontal: '─',
  vertical: '│',
  // Intersections
  teeDown: '┬',
  teeUp: '┴',
  teeRight: '├',
  teeLeft: '┤',
  cross: '┼',
};

// Strip ANSI codes for width calculation
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Get visible width (excluding ANSI codes)
export function visibleWidth(str: string): number {
  return stripAnsi(str).length;
}

// Pad string to width (accounting for ANSI codes)
export function padEnd(str: string, width: number): string {
  const visible = visibleWidth(str);
  if (visible >= width) return str;
  return str + ' '.repeat(width - visible);
}

export function padStart(str: string, width: number): string {
  const visible = visibleWidth(str);
  if (visible >= width) return str;
  return ' '.repeat(width - visible) + str;
}

// Color functions
export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

export function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

export function green(text: string): string {
  return `${colors.green}${text}${colors.reset}`;
}

export function yellow(text: string): string {
  return `${colors.yellow}${text}${colors.reset}`;
}

export function blue(text: string): string {
  return `${colors.blue}${text}${colors.reset}`;
}

export function cyan(text: string): string {
  return `${colors.cyan}${text}${colors.reset}`;
}

export function red(text: string): string {
  return `${colors.red}${text}${colors.reset}`;
}

export function gray(text: string): string {
  return `${colors.gray}${text}${colors.reset}`;
}

export function muted(text: string): string {
  return `${colors.muted}${text}${colors.reset}`;
}

export function header(text: string): string {
  return `${colors.header}${text}${colors.reset}`;
}

export function accent(text: string): string {
  return `${colors.accent}${text}${colors.reset}`;
}

// Score with color gradient
export function scoreColor(score: number): string {
  if (score >= 0.7) return colors.scoreHigh;
  if (score >= 0.4) return colors.scoreMid;
  return colors.scoreLow;
}

export function coloredScore(score: number, formatted: string): string {
  return `${scoreColor(score)}${formatted}${colors.reset}`;
}

// Success/error indicators
export function success(message: string): void {
  console.log(`${green('✓')} ${message}`);
}

export function error(message: string): void {
  console.error(`${red('✗')} ${message}`);
}

export function info(message: string): void {
  console.log(`${blue('→')} ${message}`);
}

export function warn(message: string): void {
  console.log(`${yellow('!')} ${message}`);
}

// Modern box-drawing table
interface TableColumn {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  width?: number;
}

interface TableOptions {
  maxWidth?: number;
  truncate?: boolean;
}

export function printTable(
  rows: Record<string, unknown>[],
  columns: string[] | TableColumn[],
  options: TableOptions = {}
): void {
  const { maxWidth = 40, truncate: shouldTruncate = true } = options;

  if (rows.length === 0) {
    console.log(muted('  No results'));
    return;
  }

  // Normalize columns to TableColumn format
  const cols: TableColumn[] = columns.map((col) =>
    typeof col === 'string'
      ? { key: col, header: col.charAt(0).toUpperCase() + col.slice(1), align: 'left' as const }
      : col
  );

  // Calculate column widths
  const widths: Map<string, number> = new Map();
  for (const col of cols) {
    const headerLen = col.header.length;
    const maxDataLen = Math.max(
      ...rows.map((row) => String(row[col.key] ?? '').length)
    );
    widths.set(col.key, Math.min(Math.max(headerLen, maxDataLen), col.width ?? maxWidth));
  }

  // Build border strings
  const topBorder = box.topLeft +
    cols.map((col) => box.horizontal.repeat((widths.get(col.key) ?? 0) + 2)).join(box.teeDown) +
    box.topRight;

  const headerSep = box.teeRight +
    cols.map((col) => box.horizontal.repeat((widths.get(col.key) ?? 0) + 2)).join(box.cross) +
    box.teeLeft;

  const bottomBorder = box.bottomLeft +
    cols.map((col) => box.horizontal.repeat((widths.get(col.key) ?? 0) + 2)).join(box.teeUp) +
    box.bottomRight;

  // Print table
  console.log(muted(topBorder));

  // Header row
  const headerRow = box.vertical +
    cols.map((col) => {
      const w = widths.get(col.key) ?? 0;
      return ' ' + bold(padEnd(col.header, w)) + ' ';
    }).join(muted(box.vertical)) +
    muted(box.vertical);
  console.log(headerRow);
  console.log(muted(headerSep));

  // Data rows
  for (const row of rows) {
    const line = muted(box.vertical) +
      cols.map((col) => {
        const w = widths.get(col.key) ?? 0;
        let val = String(row[col.key] ?? '');
        const visible = visibleWidth(val);
        // Only truncate if the visible width exceeds column width
        if (shouldTruncate && visible > w) {
          // Strip ANSI, truncate, then we lose color - but that's ok for long values
          const stripped = stripAnsi(val);
          val = stripped.slice(0, w - 1) + '…';
        }
        const align = col.align ?? 'left';
        let padded: string;
        if (align === 'right') {
          padded = padStart(val, w);
        } else if (align === 'center') {
          const leftPad = Math.floor((w - visibleWidth(val)) / 2);
          const rightPad = Math.max(0, w - leftPad - visibleWidth(val));
          padded = ' '.repeat(leftPad) + val + ' '.repeat(rightPad);
        } else {
          padded = padEnd(val, w);
        }
        return ' ' + padded + ' ';
      }).join(muted(box.vertical)) +
      muted(box.vertical);
    console.log(line);
  }

  console.log(muted(bottomBorder));
}

// Rounded box for sections
export function printBox(title: string, content: string[], width = 50): void {
  const innerWidth = width - 2;
  const contentWidth = innerWidth - 2; // Account for padding spaces
  const titleText = title ? `${box.horizontal} ${title} ` : '';
  const titleVisible = visibleWidth(titleText);
  const remainingWidth = Math.max(0, innerWidth - titleVisible);

  console.log(
    muted(box.roundTopLeft) +
    muted(titleText) +
    muted(box.horizontal.repeat(remainingWidth)) +
    muted(box.roundTopRight)
  );

  for (const line of content) {
    const visible = visibleWidth(line);
    let displayLine = line;

    // Truncate if content exceeds box width
    if (visible > contentWidth) {
      const stripped = stripAnsi(line);
      displayLine = stripped.slice(0, contentWidth - 1) + '…';
    }

    const displayVisible = visibleWidth(displayLine);
    const padding = Math.max(0, contentWidth - displayVisible);
    console.log(muted(box.vertical) + ' ' + displayLine + ' '.repeat(padding) + ' ' + muted(box.vertical));
  }

  console.log(
    muted(box.roundBottomLeft) +
    muted(box.horizontal.repeat(innerWidth)) +
    muted(box.roundBottomRight)
  );
}

// Truncate text with ellipsis
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// Format date for display
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format score as percentage
export function formatScore(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

// Format score with color
export function formatColoredScore(score: number): string {
  const formatted = formatScore(score);
  return coloredScore(score, formatted);
}

// Key-value display with aligned labels
export function printKeyValue(label: string, value: string, labelWidth = 12): void {
  console.log(`  ${cyan(padEnd(label + ':', labelWidth))} ${value}`);
}

// Status indicator (colored dot)
export function statusDot(ok: boolean): string {
  return ok ? green('●') : yellow('●');
}
