import type { Container, Rectangle, Ticker } from "pixi.js";
import { createRing, type Ring, type RingStyle } from "../ring/ring";
import { tween, type Easing } from "../tween/tween";

type Circle = {
  x: number;
  y: number;
  radius: number;
};

const ringMargin: number = 60; // px
const fadeStart: number = 0.75;

function rippleReveal(
  ticker: Ticker,
  layer: Container,
  bounds: Rectangle,
  from: Circle,
  ring: RingStyle,
  duration: number,
  easing: Easing,
  reverse: boolean,
  track: (circle: Circle) => void,
  finish: () => void,
): Promise<void> {
  const endRadius: number =
    Math.hypot(
      Math.max(from.x, bounds.width - from.x),
      Math.max(from.y, bounds.height - from.y),
    ) + ringMargin;

  const wave: Ring = createRing(ring);
  layer.addChild(wave.view);

  return tween(ticker, duration, (time: number) => {
    const progress: number = easing(reverse ? 1 - time : time);
    const radius: number = from.radius + (endRadius - from.radius) * progress;

    track({ x: from.x, y: from.y, radius: radius });
    wave.setCircle(from.x, from.y, radius - ring.width / 2);
    wave.view.alpha =
      progress < fadeStart ? 1 : 1 - (progress - fadeStart) / (1 - fadeStart);
  }).then(() => {
    finish();
    wave.view.destroy();
    track(reverse ? from : { x: from.x, y: from.y, radius: Infinity });
  });
}

export { rippleReveal };
export type { Circle };
