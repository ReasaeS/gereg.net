import { Graphics, type Container, type Rectangle, type Ticker } from "pixi.js";
import { cubicBezier, tween, type Easing } from "../tween/tween";

const beamWidth: number = 24; // px
const beamGlow: number = 16; // px
const glowAlpha: number = 0.35;
const stretchEasing: Easing = cubicBezier(0.2, 0.8, 0.3, 1);
const growEasing: Easing = cubicBezier(0.7, 0, 0.8, 0.4);
const fadeEasing: Easing = cubicBezier(0.3, 0, 0.25, 1);

function drawBeam(
  beam: Graphics,
  bounds: Rectangle,
  color: string,
  width: number,
  height: number,
): void {
  const x: number = bounds.width / 2 - width / 2;
  const y: number = bounds.height / 2 - height / 2;

  beam
    .clear()
    .rect(x - beamGlow, y, width + beamGlow * 2, height)
    .fill({ color: color, alpha: glowAlpha })
    .rect(x, y, width, height)
    .fill(color);
}

function beamReveal(
  ticker: Ticker,
  layer: Container,
  bounds: Rectangle,
  color: string,
  stretchDuration: number,
  holdDuration: number,
  growDuration: number,
  fadeDuration: number,
  cover: () => void,
): Promise<void> {
  const beam: Graphics = new Graphics();

  layer.addChild(beam);

  return tween(ticker, stretchDuration, (progress: number) => {
    drawBeam(
      beam,
      bounds,
      color,
      beamWidth,
      bounds.height * stretchEasing(progress),
    );
  })
    .then(() => tween(ticker, holdDuration, () => undefined))
    .then(() =>
      tween(ticker, growDuration, (progress: number) => {
        drawBeam(
          beam,
          bounds,
          color,
          beamWidth + (bounds.width - beamWidth) * growEasing(progress),
          bounds.height,
        );
      }),
    )
    .then(() => {
      drawBeam(beam, bounds, color, bounds.width + beamGlow * 2, bounds.height);
      cover();

      return tween(ticker, fadeDuration, (progress: number) => {
        beam.alpha = 1 - fadeEasing(progress);
      });
    })
    .then(() => {
      beam.destroy();
    });
}

export { beamReveal };
