// Game state and logic for the rabbit hole game

import { PORTALS, PlayerDirection } from './content.js';

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

export interface Player {
  x: number;
  y: number;
  direction: PlayerDirection;
  momentum: number;  // Frames since last move (0 = just moved)
}

export interface Portal {
  id: number;
  pos: Position;
  visited: boolean;
  bounds: BoundingBox;  // Collision box for the portal
}

export type Scene = 'intro' | 'map' | 'finale';

export interface GameState {
  player: Player;
  rabbit: Position;
  rabbitLooking: 'left' | 'right';  // Direction rabbit is facing
  rabbitTarget: Position | null;  // Where rabbit is heading (smooth movement)
  portals: Portal[];
  visitedCount: number;
  scene: Scene;
  currentPortalId: number | null;
  showModal: boolean;
  nearPortalId: number | null;  // Portal player is near (for hint)
  width: number;
  height: number;
}

// ==================== COLLISION SYSTEM ====================

// Player bounding box (3 wide, 3 tall)
const PLAYER_WIDTH = 3;
const PLAYER_HEIGHT = 3;

// Rabbit bounding box (9 wide, 3 tall)
const RABBIT_WIDTH = 9;
const RABBIT_HEIGHT = 3;

// Portal bounding box: [N] + label below = 5 wide, 3 tall
const PORTAL_WIDTH = 7;
const PORTAL_HEIGHT = 3;

function getPlayerBounds(x: number, y: number): BoundingBox {
  return {
    x: x - 1,
    y: y - 1,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  };
}

function getRabbitBounds(x: number, y: number): BoundingBox {
  return {
    x: x - 4,
    y: y - 1,
    width: RABBIT_WIDTH,
    height: RABBIT_HEIGHT,
  };
}

function getPortalBounds(pos: Position): BoundingBox {
  return {
    x: pos.x - 3,
    y: pos.y - 1,
    width: PORTAL_WIDTH,
    height: PORTAL_HEIGHT,
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

// Check if player collides with any portal (for blocking movement, not triggering)
function playerCollidesWithPortal(state: GameState, px: number, py: number): boolean {
  const playerBounds = getPlayerBounds(px, py);
  for (const portal of state.portals) {
    if (boxesOverlap(playerBounds, portal.bounds)) {
      return true;
    }
  }
  return false;
}

// Check if player collides with rabbit
function playerCollidesWithRabbit(state: GameState, px: number, py: number): boolean {
  const playerBounds = getPlayerBounds(px, py);
  const rabbitBounds = getRabbitBounds(state.rabbit.x, state.rabbit.y);
  return boxesOverlap(playerBounds, rabbitBounds);
}

// Check if player is NEAR a portal (adjacent but not overlapping) - for hint display
export function checkNearPortal(state: GameState): number | null {
  const playerBounds = getPlayerBounds(state.player.x, state.player.y);

  // Expand player bounds by 3 units for "near" detection
  const nearBounds: BoundingBox = {
    x: playerBounds.x - 3,
    y: playerBounds.y - 2,
    width: playerBounds.width + 6,
    height: playerBounds.height + 4,
  };

  for (const portal of state.portals) {
    // Check if near but NOT overlapping
    if (boxesOverlap(nearBounds, portal.bounds) && !boxesOverlap(playerBounds, portal.bounds)) {
      return portal.id;
    }
  }
  return null;
}

// Get terminal dimensions
function getTerminalSize(): { width: number; height: number } {
  return {
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  };
}

// Calculate portal positions based on screen size
// Snake pattern for easier navigation: 1-2-3 (top), 6-5-4 (bottom reversed)
function calculatePortalPositions(width: number, height: number): Position[] {
  const leftCol = Math.floor(width * 0.2);
  const midCol = Math.floor(width * 0.5);
  const rightCol = Math.floor(width * 0.8);

  const topRow = Math.floor(height * 0.3);
  const botRow = Math.floor(height * 0.7);

  // Snake pattern: 1-2-3 top row (left to right), 4-5-6 bottom row (right to left)
  return [
    { x: leftCol, y: topRow },    // 1: Search
    { x: midCol, y: topRow },     // 2: Store
    { x: rightCol, y: topRow },   // 3: Recall
    { x: rightCol, y: botRow },   // 4: Config (under 3)
    { x: midCol, y: botRow },     // 5: Merge (under 2)
    { x: leftCol, y: botRow },    // 6: Stats (under 1)
  ];
}

export function createInitialState(): GameState {
  const { width, height } = getTerminalSize();
  const positions = calculatePortalPositions(width, height);

  const portals: Portal[] = PORTALS.map((p, i) => ({
    id: p.id,
    pos: positions[i]!,
    visited: false,
    bounds: getPortalBounds(positions[i]!),
  }));

  // Player starts on LEFT side (opposite of scene 1 exit)
  const playerStart: Player = {
    x: 10,
    y: Math.floor(height * 0.7),  // Same Y level as scene 1
    direction: 'right',  // Facing toward portals
    momentum: 0,
  };

  // Rabbit starts near first portal, ready to lead
  const rabbitStart: Position = {
    x: positions[0]!.x + 8,
    y: positions[0]!.y,
  };

  return {
    player: playerStart,
    rabbit: rabbitStart,
    rabbitLooking: 'left',  // Starts looking at player
    rabbitTarget: null,
    portals,
    visitedCount: 0,
    scene: 'intro',
    currentPortalId: null,
    showModal: false,
    nearPortalId: null,
    width,
    height,
  };
}

export function updateTerminalSize(state: GameState): GameState {
  const { width, height } = getTerminalSize();
  if (width === state.width && height === state.height) {
    return state;
  }

  const positions = calculatePortalPositions(width, height);

  // Scale player position proportionally
  const playerX = Math.min(
    Math.max(3, Math.floor((state.player.x / state.width) * width)),
    width - 3
  );
  const playerY = Math.min(
    Math.max(3, Math.floor((state.player.y / state.height) * height)),
    height - 4
  );

  const portals = state.portals.map((p, i) => ({
    ...p,
    pos: positions[i]!,
    bounds: getPortalBounds(positions[i]!),
  }));

  // Move rabbit to current target portal
  const nextUnvisited = portals.find(p => !p.visited);
  const rabbitPos = nextUnvisited
    ? { x: nextUnvisited.pos.x + 6, y: nextUnvisited.pos.y }
    : state.rabbit;

  return {
    ...state,
    player: { ...state.player, x: playerX, y: playerY },
    rabbit: rabbitPos,
    portals,
    width,
    height,
  };
}

// Tick player momentum (call every frame)
export function tickPlayer(state: GameState): GameState {
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

// Calculate distance between player and rabbit
function getDistanceToPlayer(state: GameState): number {
  const dx = state.player.x - state.rabbit.x;
  const dy = state.player.y - state.rabbit.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Tick rabbit movement - moves toward rabbitTarget after modal closes
export function tickRabbit(state: GameState): GameState {
  // Don't move during modal
  if (state.showModal) return state;

  // If no target, find next unvisited portal
  let target = state.rabbitTarget;
  if (!target) {
    const nextUnvisited = state.portals.find(p => !p.visited);
    if (nextUnvisited) {
      // Position rabbit to the right of portal, but keep on screen
      const targetX = Math.min(nextUnvisited.pos.x + 6, state.width - 10);
      target = { x: targetX, y: nextUnvisited.pos.y };
    }
  }

  // No target? Stay put (but make sure rabbit is on screen)
  if (!target) {
    // Clamp rabbit position to screen
    const clampedX = Math.max(5, Math.min(state.width - 10, state.rabbit.x));
    const clampedY = Math.max(3, Math.min(state.height - 4, state.rabbit.y));
    if (clampedX !== state.rabbit.x || clampedY !== state.rabbit.y) {
      return { ...state, rabbit: { x: clampedX, y: clampedY } };
    }
    return state;
  }

  // Already at target? Clear it
  if (Math.abs(target.x - state.rabbit.x) < 2 && Math.abs(target.y - state.rabbit.y) < 2) {
    return { ...state, rabbitTarget: null };
  }

  // Wait for player to be close before moving
  const distance = getDistanceToPlayer(state);
  const FOLLOW_DISTANCE = 35;
  if (distance > FOLLOW_DISTANCE) {
    return state;  // Wait for player
  }

  // Move toward target
  const speed = 0.8;
  let newX = state.rabbit.x;
  let newY = state.rabbit.y;
  let looking = state.rabbitLooking;

  if (Math.abs(target.x - newX) > 1) {
    const dir = Math.sign(target.x - newX);
    newX += dir * speed;
    looking = dir > 0 ? 'right' : 'left';  // Face movement direction
  }
  if (Math.abs(target.y - newY) > 1) {
    newY += Math.sign(target.y - newY) * speed;
  }

  // Clamp to screen bounds
  newX = Math.max(5, Math.min(state.width - 10, newX));
  newY = Math.max(3, Math.min(state.height - 4, newY));

  return { ...state, rabbit: { x: newX, y: newY }, rabbitLooking: looking };
}

export function movePlayer(
  state: GameState,
  direction: 'up' | 'down' | 'left' | 'right'
): GameState {
  // Don't move if modal is showing (O key closes it, not movement)
  if (state.showModal) {
    return state;
  }

  const speed = 2;  // 2x speed for smoother movement
  let newX = state.player.x;
  let newY = state.player.y;

  // Calculate new position with speed
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
      newX = Math.min(state.width - 3, state.player.x + speed);
      break;
  }

  // Check collision with portal - BLOCK movement (don't trigger)
  if (playerCollidesWithPortal(state, newX, newY)) {
    const nearPortal = checkNearPortal(state);
    return { ...state, player: { ...state.player, direction, momentum: 0 }, nearPortalId: nearPortal };
  }

  // Update nearPortalId for hint display
  const newState = {
    ...state,
    player: {
      x: newX,
      y: newY,
      direction,
      momentum: 0,
    },
  };
  const nearPortal = checkNearPortal(newState);

  return {
    ...newState,
    nearPortalId: nearPortal,
  };
}

// Check if player touches a portal (for triggering visit)
function checkPortalCollision(state: GameState, px: number, py: number): number | null {
  const playerBounds = getPlayerBounds(px, py);
  for (const portal of state.portals) {
    if (boxesOverlap(playerBounds, portal.bounds)) {
      return portal.id;
    }
  }
  return null;
}

// Visit a portal - opens modal, sets rabbit TARGET (doesn't teleport)
export function visitPortal(state: GameState, portalId: number): GameState {
  const portalIndex = state.portals.findIndex(p => p.id === portalId);
  if (portalIndex === -1) return state;

  const portal = state.portals[portalIndex]!;
  const wasVisited = portal.visited;

  const newPortals = [...state.portals];
  newPortals[portalIndex] = { ...portal, visited: true };

  const visitedCount = wasVisited ? state.visitedCount : state.visitedCount + 1;

  // Set rabbit TARGET (doesn't teleport - tickRabbit moves smoothly)
  const nextUnvisited = newPortals.find(p => !p.visited);
  const rabbitTarget = nextUnvisited
    ? { x: Math.min(nextUnvisited.pos.x + 6, state.width - 10), y: nextUnvisited.pos.y }
    : null;

  return {
    ...state,
    portals: newPortals,
    visitedCount,
    currentPortalId: portalId,
    showModal: true,
    rabbitTarget,  // Set target, rabbit moves after modal closes
    nearPortalId: null,
    // Don't change scene here - wait for modal close
  };
}

// Close modal - check if all visited, then go to finale
export function closeModal(state: GameState): GameState {
  const allVisited = state.visitedCount >= PORTALS.length;

  return {
    ...state,
    showModal: false,
    currentPortalId: null,
    scene: allVisited ? 'finale' : state.scene,
  };
}

export function startMap(state: GameState): GameState {
  return {
    ...state,
    scene: 'map',
  };
}

export function getPortalContent(portalId: number) {
  return PORTALS.find(p => p.id === portalId);
}
