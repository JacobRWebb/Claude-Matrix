// Opening Scene - Renderer (No rain, just glitch)

import { INTRO_LINES, INTRO_LINES_GLITCH, STICK_FIGURES, RABBIT_ART } from '../content.js';
import { OpeningState, Player, Rabbit } from './game.js';

// ANSI escape sequences
const ESC = '\x1b';
const ENTER_ALT = `${ESC}[?1049h`;
const EXIT_ALT = `${ESC}[?1049l`;
const HOME = `${ESC}[H`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const RESET = `${ESC}[0m`;

// Colors
const WHITE = `${ESC}[97m`;
const ORANGE = `${ESC}[38;5;208m`;
const DIM = `${ESC}[38;5;238m`;
const VERY_DIM = `${ESC}[38;5;235m`;
const GREEN = `${ESC}[38;5;46m`;
const BRIGHT_GREEN = `${ESC}[38;5;82m`;

// Screen buffer cell
interface Cell {
  char: string;
  color: string;
}

function createBuffer(width: number, height: number): Cell[][] {
  const buffer: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ char: ' ', color: '' });
    }
    buffer.push(row);
  }
  return buffer;
}

function setCell(buffer: Cell[][], x: number, y: number, char: string, color: string): void {
  const row = buffer[Math.floor(y)];
  if (row && Math.floor(x) >= 0 && Math.floor(x) < row.length) {
    row[Math.floor(x)] = { char, color };
  }
}

// Glitch effect
let glitchFrames = 0;
let isGlitching = false;
let glitchDuration = 0;
let nextGlitch = 80 + Math.floor(Math.random() * 120);

function updateGlitch(): void {
  glitchFrames++;
  if (!isGlitching && glitchFrames >= nextGlitch) {
    isGlitching = true;
    glitchDuration = 8 + Math.floor(Math.random() * 5);  // 8-12 frames for longer pulse
  }
  if (isGlitching) {
    glitchDuration--;
    if (glitchDuration <= 0) {
      isGlitching = false;
      glitchFrames = 0;
      nextGlitch = 60 + Math.floor(Math.random() * 80);  // Slightly more frequent
    }
  }
}

function glitchColor(color: string): string {
  if (!isGlitching) return color;
  if (color === WHITE) return BRIGHT_GREEN;
  if (color === ORANGE) return GREEN;
  return GREEN;
}

// No rain in opening - just empty functions for compatibility
export function initRain(_width: number, _height: number): void {}
export function tickRain(_width: number, _height: number): void {}

// Render intro text (centered) - GREEN normally, "Claude" in ORANGE during glitch
function renderIntroText(buffer: Cell[][]): void {
  const height = buffer.length;
  const width = buffer[0]?.length || 80;
  const lines = isGlitching ? INTRO_LINES_GLITCH : INTRO_LINES;
  const totalLines = lines.length;
  const centerY = Math.floor((height - totalLines) / 2);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line) continue;

    const y = centerY + i;
    const x = Math.floor((width - line.length) / 2);

    // Check if this line contains "Claude" (glitch line)
    const claudeStart = line.indexOf('Claude');
    const claudeEnd = claudeStart + 6;  // "Claude" is 6 chars

    for (let j = 0; j < line.length; j++) {
      let color = GREEN;  // Default: green text

      // During glitch, "Claude" word is ORANGE
      if (isGlitching && claudeStart !== -1 && j >= claudeStart && j < claudeEnd) {
        color = ORANGE;
      }

      setCell(buffer, x + j, y, line[j]!, color);
    }
  }
}

// Render stick figure player (3 lines: head, torso, legs) - GREEN tones in scene 1
function renderPlayer(buffer: Cell[][], player: Player): void {
  const figure = STICK_FIGURES[player.direction];
  // Player blinks GREEN in scene 1
  const color = player.momentum < 3 ? BRIGHT_GREEN : player.momentum < 6 ? GREEN : DIM;

  // Draw each line of the figure (3 lines)
  for (let line = 0; line < figure.length; line++) {
    const row = figure[line]!;
    const y = player.y - 2 + line;  // Start 2 rows above player.y
    const xOffset = Math.floor(row.length / 2);  // Center horizontally

    for (let i = 0; i < row.length; i++) {
      setCell(buffer, player.x - xOffset + i, y, row[i]!, glitchColor(color));
    }
  }

  // Trail effect
  if (player.momentum < 2 && player.direction !== 'idle') {
    let trailX = player.x;
    let trailY = player.y;
    switch (player.direction) {
      case 'left': trailX += 3; break;
      case 'right': trailX -= 3; break;
      case 'up': trailY += 3; break;
      case 'down': trailY -= 3; break;
    }
    setCell(buffer, trailX, trailY, '·', VERY_DIM);
  }
}

// Render rabbit (3 lines ASCII art)
function renderRabbit(buffer: Cell[][], rabbit: Rabbit): void {
  const art = rabbit.looking === 'right' ? RABBIT_ART.right : RABBIT_ART.left;
  const color = rabbit.momentum < 3 ? WHITE : rabbit.momentum < 6 ? ORANGE : DIM;

  // Draw each line of the rabbit (3 lines)
  for (let line = 0; line < art.length; line++) {
    const row = art[line]!;
    const y = rabbit.y - 2 + line;  // Start 2 rows above rabbit.y
    const xOffset = Math.floor(row.length / 2);  // Center horizontally

    for (let i = 0; i < row.length; i++) {
      if (row[i] !== ' ') {  // Skip spaces for transparency
        setCell(buffer, rabbit.x - xOffset + i, y, row[i]!, glitchColor(color));
      }
    }
  }
}

// Convert buffer to string
function bufferToString(buffer: Cell[][]): string {
  let frame = HOME;

  for (let y = 0; y < buffer.length; y++) {
    const row = buffer[y]!;
    for (let x = 0; x < row.length; x++) {
      const cell = row[x]!;
      if (cell.color) {
        frame += cell.color + cell.char + RESET;
      } else {
        frame += cell.char;
      }
    }
    if (y < buffer.length - 1) {
      frame += '\n';
    }
  }

  return frame;
}

// Public functions

export function enterScreen(): void {
  process.stdout.write(ENTER_ALT + HIDE_CURSOR);
}

export function exitScreen(): void {
  process.stdout.write(SHOW_CURSOR + EXIT_ALT);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// Render a glitch frame during typing (Matrix -> Claude)
async function renderGlitchFrame(
  row: number,
  col: number,
  normalLine: string,
  glitchLine: string,
  showGlitch: boolean
): Promise<void> {
  const line = showGlitch ? glitchLine : normalLine;
  const claudeStart = glitchLine.indexOf('Claude');

  for (let j = 0; j < line.length; j++) {
    let color = GREEN;
    // "Claude" in orange during glitch
    if (showGlitch && claudeStart !== -1 && j >= claudeStart && j < claudeStart + 6) {
      color = ORANGE;
    }
    process.stdout.write(`${ESC}[${row + 1};${col + j + 1}H${color}${line[j]}${RESET}`);
  }
}

// Typing intro effect (centered) - GREEN text with Matrix->Claude glitch
export async function renderTypingIntro(width: number, height: number): Promise<void> {
  const totalLines = INTRO_LINES.length;
  const centerY = Math.floor((height - totalLines) / 2);

  // Clear screen once
  let clear = HOME;
  for (let y = 0; y < height; y++) {
    clear += ' '.repeat(width) + '\n';
  }
  process.stdout.write(clear);

  // Type each line in GREEN
  for (let i = 0; i < INTRO_LINES.length; i++) {
    const line = INTRO_LINES[i]!;
    const glitchLine = INTRO_LINES_GLITCH[i]!;
    const row = centerY + i;
    const col = Math.floor((width - line.length) / 2);

    if (!line) {
      await sleep(400);
      continue;
    }

    // Type the line character by character
    for (let j = 0; j < line.length; j++) {
      process.stdout.write(`${ESC}[${row + 1};${col + j + 1}H${GREEN}${line[j]}${RESET}`);
      await sleep(50);
    }

    // After "The Matrix has you." line, do glitch effect
    if (line.includes('Matrix')) {
      await sleep(300);
      // Glitch a few times: Matrix -> Claude -> Matrix -> Claude -> Matrix
      for (let g = 0; g < 3; g++) {
        await renderGlitchFrame(row, col, line, glitchLine, true);  // Claude
        await sleep(150);
        await renderGlitchFrame(row, col, line, glitchLine, false); // Matrix
        await sleep(100);
      }
    }

    await sleep(500);
  }
}

// Render chase scene
export function render(state: OpeningState): void {
  updateGlitch();

  const buffer = createBuffer(state.width, state.height);

  // Layer 1: Intro text (stays visible)
  renderIntroText(buffer);

  // Only show characters during chase
  if (state.scene === 'chase') {
    // Layer 3: Rabbit
    renderRabbit(buffer, state.rabbit);

    // Layer 4: Player
    renderPlayer(buffer, state.player);
  }

  const frame = bufferToString(buffer);
  process.stdout.write(frame);
}
