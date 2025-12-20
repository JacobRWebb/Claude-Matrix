// "Follow the White Rabbit" - Matrix Onboarding Easter Egg

import { runOpeningScene } from './rabbit/opening/index.js';
import { runMapScene } from './rabbit/map/index.js';

export async function startRabbitHole(): Promise<void> {
  // Scene 1: Opening (typing intro → chase the rabbit → exit right)
  const openingResult = await runOpeningScene();

  if (openingResult === 'quit') {
    return;
  }

  // Scene 2: Map exploration (portals with Matrix features)
  const mapResult = await runMapScene();

  if (mapResult === 'complete') {
    console.log('\n🐰 Welcome to the Matrix. Your memory is now enhanced.\n');
  }
}

// Check if input contains the trigger phrase
export function isRabbitTrigger(input: string): boolean {
  const normalized = input.toLowerCase().replace(/[^a-z\s]/g, '');
  return normalized.includes('follow the white rabbit');
}
