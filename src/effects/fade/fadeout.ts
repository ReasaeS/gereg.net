import type { Container, Ticker } from "pixi.js";
import { easeOut, tween } from "../tween/tween";

function fadeOut(
  ticker: Ticker,
  target: Container,
  duration: number,
): Promise<void> {
  return tween(ticker, duration, (progress: number) => {
    target.alpha = 1 - easeOut(progress);
  }).then(() => {
    target.visible = false;
    target.alpha = 1;
  });
}

export { fadeOut };
