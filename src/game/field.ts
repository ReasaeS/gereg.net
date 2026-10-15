import type { Graphics } from "pixi.js";

const hudWidth: number = 640; // units
const hudHeight: number = 480; // units
const fieldX: number = 32; // units
const fieldY: number = 16; // units
const fieldWidth: number = 384; // units
const fieldHeight: number = 448; // units
const frameColor: string = "#030c2a";
const stripeColor: string = "#0a2160";
const stripeGap: number = 14; // units
const stripeWidth: number = 5; // units

function hudScale(width: number, height: number): number {
  return Math.min(width / hudWidth, height / hudHeight);
}

function drawStripes(
  graphics: Graphics,
  width: number,
  height: number,
  base: string,
  stripe: string,
  thickness: number,
  scale: number,
): void {
  const gap: number = stripeGap * scale;
  const band: number = thickness * scale;

  graphics.clear().rect(0, 0, width, height).fill(base);

  if (band <= 0) {
    return;
  }

  for (let x = -height; x < width; x += gap) {
    graphics
      .poly([x, height, x + band, height, x + band + height, 0, x + height, 0])
      .fill(stripe);
  }
}

function drawFrame(frame: Graphics): void {
  drawStripes(
    frame,
    hudWidth,
    hudHeight,
    frameColor,
    stripeColor,
    stripeWidth,
    1,
  );
}

export {
  hudWidth,
  hudHeight,
  fieldX,
  fieldY,
  fieldWidth,
  fieldHeight,
  hudScale,
  drawStripes,
  drawFrame,
};
