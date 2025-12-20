// Opening Scene - Main Entry Point

import {
  createOpeningState,
  movePlayer,
  tickPlayer,
  tickRabbit,
  startChase,
  updateTerminalSize,
  OpeningState,
} from './game.js';
import {
  enterScreen,
  exitScreen,
  renderTypingIntro,
  render,
  initRain,
  tickRain,
} from './renderer.js';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export type OpeningResult = 'quit' | 'transition';

export async function runOpeningScene(): Promise<OpeningResult> {
  let state = createOpeningState();

  // Enter alternate screen buffer
  enterScreen();

  // Enable raw mode for input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  // Phase 1: Typing intro
  await renderTypingIntro(state.width, state.height);

  // Phase 2: Dramatic pause (2 seconds)
  await sleep(2000);

  // Phase 3: Start chase - characters appear, rabbit moves
  state = startChase(state);
  initRain(state.width, state.height);
  render(state);

  let animationInterval: ReturnType<typeof setInterval> | null = null;

  // Create promise first to avoid race condition with resolveWith
  let resolveWith: (result: OpeningResult) => void;
  const resultPromise = new Promise<OpeningResult>((resolve) => {
    resolveWith = resolve;
  });

  const onResize = () => {
    state = updateTerminalSize(state);
    if (state.scene === 'chase') {
      initRain(state.width, state.height);
      render(state);
    }
  };

  const cleanup = () => {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
    process.stdin.removeListener('data', onKeypress);
    process.stdout.removeListener('resize', onResize);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    exitScreen();
  };

  const onKeypress = (key: Buffer) => {
    const str = key.toString();

    // Ctrl+C or q to quit
    if (str === '\x03' || str === 'q' || str === 'Q') {
      cleanup();
      resolveWith('quit');
      return;
    }

    if (state.scene === 'chase') {
      // Arrow keys
      if (str === '\x1b[A') {
        state = movePlayer(state, 'up');
      } else if (str === '\x1b[B') {
        state = movePlayer(state, 'down');
      } else if (str === '\x1b[C') {
        state = movePlayer(state, 'right');
      } else if (str === '\x1b[D') {
        state = movePlayer(state, 'left');
      }
      // WASD
      else if (str === 'w' || str === 'W') {
        state = movePlayer(state, 'up');
      } else if (str === 's' || str === 'S') {
        state = movePlayer(state, 'down');
      } else if (str === 'd' || str === 'D') {
        state = movePlayer(state, 'right');
      } else if (str === 'a' || str === 'A') {
        state = movePlayer(state, 'left');
      }

      render(state);

      // Check for transition after player move
      if (state.scene === 'transition') {
        cleanup();
        resolveWith('transition');
      }
    }
  };

  process.stdin.on('data', onKeypress);
  process.stdout.on('resize', onResize);

  // Start animation loop
  animationInterval = setInterval(() => {
    if (state.scene === 'chase') {
      state = updateTerminalSize(state);
      state = tickPlayer(state);
      state = tickRabbit(state);
      tickRain(state.width, state.height);
      render(state);

      // Check for transition to scene 2
      if (state.scene === 'transition') {
        cleanup();
        resolveWith('transition');
      }
    }
  }, 50);  // ~20 FPS for smoother animation

  return resultPromise;
}
