// Opening Scene - Game State and Logic

import { PlayerDirection, INTRO_LINES } from '../content.js';

export interface Position {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rabbit {
  x: number;
  y: number;
  looking: 'right' | 'left';  // right = moving, left = stopped looking at player
  momentum: number;           // for blink effect when moving
}

export interface Player {
  x: number;
  y: number;
  direction: PlayerDirection;
  momentum: number;
}

export type OpeningScene = 'typing' | 'pause' | 'chase' | 'transition';

export interface OpeningState {
  player: Player;
  rabbit: Rabbit;
  rabbitTarget: Position;
  scene: OpeningScene;
  width: number;
  height: number;
  textBounds: BoundingBox;  // Bounding box for intro text
}

// Get terminal dimensions
function getTerminalSize(): { width: number; height: number } {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}

// Rabbit exits screen to the right (past the edge)
function pickEdgeTarget(width: number, _height: number, rabbitY: number): Position {
  return { x: width + 10, y: rabbitY };  // Off-screen to the right
}

// Calculate bounding box for intro text
function calculateTextBounds(width: number, height: number): BoundingBox {
  const totalLines = INTRO_LINES.length;
  const centerY = Math.floor((height - totalLines) / 2);
  const maxLineLength = Math.max(...INTRO_LINES.map(l => l.length));
  const centerX = Math.floor((width - maxLineLength) / 2);

  return {
    x: centerX - 2,           // Padding
    y: centerY - 1,           // Padding
    width: maxLineLength + 4, // Padding both sides
    height: totalLines + 2,   // Padding top/bottom
  };
}

export function createOpeningState(): OpeningState {
  const { width, height } = getTerminalSize();

  const yLevel = Math.floor(height * 0.7);
  const textBounds = calculateTextBounds(width, height);

  // Player starts left side
  const playerStart: Player = {
    x: Math.floor(width * 0.2),
    y: yLevel,
    direction: 'idle',
    momentum: 10,
  };

  // Rabbit starts to the right of player
  const rabbitStart: Rabbit = {
    x: Math.floor(width * 0.5),
    y: yLevel,
    looking: 'left',  // Start looking at player
    momentum: 10,     // Start dim
  };

  // Rabbit heads off-screen to the right
  const rabbitTarget = pickEdgeTarget(width, height, yLevel);

  return {
    player: playerStart,
    rabbit: rabbitStart,
    rabbitTarget,
    scene: 'typing',
    width,
    height,
    textBounds,
  };
}

export function updateTerminalSize(state: OpeningState): OpeningState {
  const { width, height } = getTerminalSize();
  if (width === state.width && height === state.height) {
    return state;
  }

  const textBounds = calculateTextBounds(width, height);

  // Scale positions proportionally
  const playerX = Math.min(
    Math.max(2, Math.floor((state.player.x / state.width) * width)),
    width - 3
  );
  const playerY = Math.min(
    Math.max(2, Math.floor((state.player.y / state.height) * height)),
    height - 4
  );

  const rabbitX = Math.floor((state.rabbit.x / state.width) * width);
  const rabbitY = Math.floor((state.rabbit.y / state.height) * height);

  // Rabbit still goes right (off-screen)
  const rabbitTarget = pickEdgeTarget(width, height, rabbitY);

  return {
    ...state,
    player: { ...state.player, x: playerX, y: playerY },
    rabbit: { ...state.rabbit, x: rabbitX, y: rabbitY },
    rabbitTarget,
    width,
    height,
    textBounds,
  };
}

// Tick player momentum (call every frame)
export function tickPlayer(state: OpeningState): OpeningState {
  const momentum = state.player.momentum + 1;
  return {
    ...state,
    player: {
      ...state.player,
      momentum,
      direction: momentum > 5 ? 'idle' : state.player.direction,
    },
  };
}

// ==================== COLLISION SYSTEM ====================

// Player bounding box (3 wide, 3 tall centered on position)
const PLAYER_WIDTH = 3;
const PLAYER_HEIGHT = 3;

// Rabbit bounding box (9 wide, 3 tall centered on position)
const RABBIT_WIDTH = 9;
const RABBIT_HEIGHT = 3;

function getPlayerBounds(x: number, y: number): BoundingBox {
  return {
    x: x - 1,
    y: y - 2,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}

function getRabbitBounds(x: number, y: number): BoundingBox {
  return {
    x: x - 4,
    y: y - 2,
    width: RABBIT_WIDTH,
    height: RABBIT_HEIGHT,
  };
}

// Check if two bounding boxes overlap
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

// Check if player position would cause collision with text
function collidesWithText(state: OpeningState, px: number, py: number): boolean {
  const playerBounds = getPlayerBounds(px, py);
  return boxesOverlap(playerBounds, state.textBounds);
}

// Check if player position would cause collision with rabbit
function collidesWithRabbit(state: OpeningState, px: number, py: number): boolean {
  // Only check if rabbit is on screen
  if (state.rabbit.x > state.width) return false;

  const playerBounds = getPlayerBounds(px, py);
  const rabbitBounds = getRabbitBounds(state.rabbit.x, state.rabbit.y);
  return boxesOverlap(playerBounds, rabbitBounds);
}

// Check if rabbit would collide with text
function rabbitCollidesWithText(state: OpeningState, rx: number, ry: number): boolean {
  const rabbitBounds = getRabbitBounds(rx, ry);
  return boxesOverlap(rabbitBounds, state.textBounds);
}

// ==================== GAME LOGIC ====================

// Calculate distance between player and rabbit
function getDistance(state: OpeningState): number {
  const dx = state.player.x - state.rabbit.x;
  const dy = state.player.y - state.rabbit.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Check if rabbit has exited screen
export function isRabbitOffScreen(state: OpeningState): boolean {
  return state.rabbit.x >= state.width;
}

// Check if player has reached the right edge (following rabbit)
export function hasPlayerReachedExit(state: OpeningState): boolean {
  return state.player.x >= state.width - 5;
}

// Tick rabbit movement toward target (call every frame)
export function tickRabbit(state: OpeningState): OpeningState {
  if (state.scene !== 'chase') return state;

  // Check for scene transition (rabbit off screen + player at edge)
  if (isRabbitOffScreen(state) && hasPlayerReachedExit(state)) {
    return { ...state, scene: 'transition' };
  }

  const distance = getDistance(state);

  // If player is far (>25), rabbit stops and looks at player
  if (distance > 25) {
    const momentum = Math.min(state.rabbit.momentum + 1, 10);
    return {
      ...state,
      rabbit: { ...state.rabbit, looking: 'left', momentum },
    };
  }

  // Player is close - rabbit moves toward right edge
  const dx = state.rabbitTarget.x - state.rabbit.x;
  const dy = state.rabbitTarget.y - state.rabbit.y;

  // Rabbit moves at moderate speed
  const speed = 0.6;
  let newX = state.rabbit.x;
  let newY = state.rabbit.y;

  if (Math.abs(dx) > 0.5) {
    newX += Math.sign(dx) * speed;
  }
  if (Math.abs(dy) > 0.5) {
    newY += Math.sign(dy) * speed;
  }

  // Check collision with text (rabbit avoids text)
  if (rabbitCollidesWithText(state, newX, newY)) {
    // Try to go around - move vertically away from text center
    const textCenterY = state.textBounds.y + state.textBounds.height / 2;
    if (state.rabbit.y < textCenterY) {
      newY = state.textBounds.y - RABBIT_HEIGHT;
    } else {
      newY = state.textBounds.y + state.textBounds.height + 1;
    }
  }

  return {
    ...state,
    rabbit: { x: newX, y: newY, looking: 'right', momentum: 0 },
  };
}

export function movePlayer(
  state: OpeningState,
  direction: 'up' | 'down' | 'left' | 'right'
): OpeningState {
  if (state.scene !== 'chase') return state;

  const speed = 2;
  let newX = state.player.x;
  let newY = state.player.y;

  switch (direction) {
    case 'up':
      newY = Math.max(3, state.player.y - speed);
      break;
    case 'down':
      newY = Math.min(state.height - 4, state.player.y + speed);
      break;
    case 'left':
      newX = Math.max(3, state.player.x - speed);
      break;
    case 'right':
      newX = Math.min(state.width - 2, state.player.x + speed);
      break;
  }

  // Check collision with text - block movement
  if (collidesWithText(state, newX, newY)) {
    // Try moving only in the direction that doesn't collide
    if (direction === 'up' || direction === 'down') {
      if (!collidesWithText(state, state.player.x, newY)) {
        newX = state.player.x;
      } else {
        return { ...state, player: { ...state.player, direction, momentum: 0 } };
      }
    } else {
      if (!collidesWithText(state, newX, state.player.y)) {
        newY = state.player.y;
      } else {
        return { ...state, player: { ...state.player, direction, momentum: 0 } };
      }
    }
  }

  // Check collision with rabbit - block movement
  if (collidesWithRabbit(state, newX, newY)) {
    return { ...state, player: { ...state.player, direction, momentum: 0 } };
  }

  return {
    ...state,
    player: {
      x: newX,
      y: newY,
      direction,
      momentum: 0,
    },
  };
}

export function startPause(state: OpeningState): OpeningState {
  return { ...state, scene: 'pause' };
}

export function startChase(state: OpeningState): OpeningState {
  return { ...state, scene: 'chase' };
}
