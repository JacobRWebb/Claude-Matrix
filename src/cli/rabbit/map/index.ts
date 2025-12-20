// Map Scene - Portal Exploration Entry Point

import {
  createInitialState,
  movePlayer,
  tickPlayer,
  tickRabbit,
  updateTerminalSize,
  checkNearPortal,
  visitPortal,
  closeModal,
  GameState,
} from '../game.js';
import {
  enterScreen,
  exitScreen,
  render,
  renderFinale,
  initRain,
  tickRain,
  setRainDensity,
} from '../renderer.js';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export type MapResult = 'quit' | 'complete';

export async function runMapScene(): Promise<MapResult> {
  let state = createInitialState();
  state = { ...state, scene: 'map' };  // Start directly in map mode

  // Enter alternate screen buffer
  enterScreen();

  // Enable raw mode for input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  // Initialize rain
  initRain(state.width, state.height);
  render(state);

  let animationInterval: ReturnType<typeof setInterval> | null = null;
  let resolveWith: (result: MapResult) => void;
  let finaleShown = false;

  const cleanup = () => {
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
    process.stdin.removeListener('data', onKeypress);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    exitScreen();
  };

  // Start animation loop
  animationInterval = setInterval(() => {
    state = updateTerminalSize(state);
    tickRain(state.width, state.height);

    if (state.scene === 'finale') {
      // Boost rain for finale
      if (!finaleShown) {
        setRainDensity(0.5);  // 2.5x more rain!
      }
      // Keep animating finale with rain
      renderFinale(state.width, state.height);
      finaleShown = true;
    } else {
      state = tickPlayer(state);
      state = tickRabbit(state);  // Rabbit leads through portals
      render(state);
    }
  }, 50);  // ~20 FPS

  const onKeypress = (key: Buffer) => {
    const str = key.toString();

    // Ctrl+C or q to quit
    if (str === '\x03' || str === 'q' || str === 'Q') {
      cleanup();
      resolveWith('quit');
      return;
    }

    // In finale, any key exits
    if (state.scene === 'finale') {
      cleanup();
      resolveWith('complete');
      return;
    }

    // O key - open/close portal modal
    if (str === 'o' || str === 'O') {
      if (state.showModal) {
        // Close modal - rabbit can now move to next portal
        state = closeModal(state);
      } else if (state.nearPortalId !== null) {
        // Open portal modal
        state = visitPortal(state, state.nearPortalId);
      }
      render(state);
      return;
    }

    // Arrow keys (don't work during modal)
    if (str === '\x1b[A') {
      state = movePlayer(state, 'up');
    } else if (str === '\x1b[B') {
      state = movePlayer(state, 'down');
    } else if (str === '\x1b[C') {
      state = movePlayer(state, 'right');
    } else if (str === '\x1b[D') {
      state = movePlayer(state, 'left');
    }
    // WASD (don't work during modal)
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
  };

  process.stdin.on('data', onKeypress);

  // Handle terminal resize
  process.stdout.on('resize', () => {
    state = updateTerminalSize(state);
    initRain(state.width, state.height);
    render(state);
  });

  return new Promise<MapResult>((resolve) => {
    resolveWith = resolve;
  });
}
