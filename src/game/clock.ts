import { getRate } from "../settings/settings";

type Clock = {
  pending: number; // s
};

const maxCatchUp: number = 0.05; // s

function createClock(): Clock {
  return { pending: 0 };
}

function runClock(
  clock: Clock,
  elapsed: number,
  step: (delta: number) => void,
): void {
  const delta: number = 1 / getRate();
  const limit: number = Math.max(Math.floor(maxCatchUp / delta), 1);
  let steps: number = 0;

  clock.pending += elapsed;

  while (clock.pending >= delta && steps < limit) {
    step(delta);
    clock.pending -= delta;
    steps++;
  }

  if (steps === limit) {
    clock.pending %= delta;
  }
}

export { createClock, runClock };
export type { Clock };
