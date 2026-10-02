import type { Ticker } from "pixi.js";

type Easing = (progress: number) => number;

type Spring = {
  value: number;
  velocity: number;
};

const bisectSteps: number = 24;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  function sample(first: number, second: number, time: number): number {
    const rest: number = 1 - time;

    return (
      3 * first * time * rest * rest +
      3 * second * time * time * rest +
      time * time * time
    );
  }

  return (progress: number) => {
    if (progress <= 0) {
      return 0;
    }

    if (progress >= 1) {
      return 1;
    }

    let low: number = 0;
    let high: number = 1;
    let time: number = progress;

    for (let index = 0; index < bisectSteps; index++) {
      time = (low + high) / 2;

      if (sample(x1, x2, time) < progress) {
        low = time;
      } else {
        high = time;
      }
    }

    return sample(y1, y2, time);
  };
}

const ease: Easing = cubicBezier(0.25, 0.1, 0.25, 1);
const easeOut: Easing = cubicBezier(0, 0, 0.58, 1);

function approach(value: number, target: number, step: number): number {
  if (value < target) {
    return Math.min(value + step, target);
  }

  return Math.max(value - step, target);
}

function smoothDamp(
  spring: Spring,
  target: number,
  smoothing: number,
  delta: number,
): void {
  const omega: number = 2 / smoothing;
  const step: number = omega * delta;
  const decay: number =
    1 / (1 + step + 0.48 * step * step + 0.235 * step * step * step);
  const change: number = spring.value - target;
  const pull: number = (spring.velocity + omega * change) * delta;
  const value: number = target + (change + pull) * decay;

  spring.velocity = (spring.velocity - omega * pull) * decay;

  if (change > 0 === value < target) {
    spring.value = target;
    spring.velocity = 0;
    return;
  }

  spring.value = value;
}

function springStep(
  spring: Spring,
  target: number,
  frequency: number,
  damping: number,
  delta: number,
): void {
  const omega: number = Math.PI * 2 * frequency;
  const force: number =
    -(spring.value - target) * omega * omega -
    2 * damping * omega * spring.velocity;

  spring.velocity += force * delta;
  spring.value += spring.velocity * delta;
}

function tween(
  ticker: Ticker,
  duration: number,
  step: (progress: number) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let elapsed: number = 0;

    function tick(current: Ticker): void {
      elapsed += current.deltaMS;
      const progress: number = Math.min(elapsed / duration, 1);
      step(progress);

      if (progress >= 1) {
        ticker.remove(tick);
        resolve();
      }
    }

    step(0);
    ticker.add(tick);
  });
}

export { cubicBezier, ease, easeOut, approach, smoothDamp, springStep, tween };
export type { Easing, Spring };
