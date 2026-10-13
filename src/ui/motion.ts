import { Color, UPDATE_PRIORITY, type ColorSource, type Ticker } from "pixi.js";
import { frameDelta, smoothDamp, type Spring } from "../effects/tween/tween";

type Step = (delta: number) => boolean;

type Glide = {
  value: () => number;
  set: (target: number) => void;
  snap: (value: number) => void;
};

const settle: number = 0.0005;
const quick: number = 0.08; // s
const steps: Set<Step> = new Set();
const from: Color = new Color();
const to: Color = new Color();

function tick(ticker: Ticker): void {
  const delta: number = frameDelta(ticker);

  for (const step of Array.from(steps)) {
    if (!step(delta)) {
      steps.delete(step);
    }
  }
}

function startMotion(ticker: Ticker): void {
  ticker.add(tick, undefined, UPDATE_PRIORITY.HIGH);
}

function animate(step: Step): void {
  steps.add(step);
}

function createGlide(
  initial: number,
  apply: (value: number) => void,
  smoothing: number = quick,
): Glide {
  const spring: Spring = { value: initial, velocity: 0 };
  let target: number = initial;
  let running: boolean = false;

  function step(delta: number): boolean {
    smoothDamp(spring, target, smoothing, delta);

    if (
      Math.abs(spring.value - target) < settle &&
      Math.abs(spring.velocity) < settle
    ) {
      spring.value = target;
      spring.velocity = 0;
    }

    apply(spring.value);
    running = spring.value !== target;

    return running;
  }

  function set(value: number): void {
    target = value;

    if (!running && spring.value !== target) {
      running = true;
      animate(step);
    }
  }

  function snap(value: number): void {
    target = value;
    spring.value = value;
    spring.velocity = 0;
    apply(value);
  }

  return { value: () => spring.value, set: set, snap: snap };
}

function mix(first: ColorSource, second: ColorSource, amount: number): number {
  const [red, green, blue] = from.setValue(first).toRgbArray() as [
    number,
    number,
    number,
  ];
  const [toRed, toGreen, toBlue] = to.setValue(second).toRgbArray() as [
    number,
    number,
    number,
  ];

  return new Color([
    red + (toRed - red) * amount,
    green + (toGreen - green) * amount,
    blue + (toBlue - blue) * amount,
  ]).toNumber();
}

export { startMotion, animate, createGlide, mix };
export type { Glide };
