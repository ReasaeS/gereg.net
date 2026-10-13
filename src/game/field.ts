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

function drawFrame(frame: Graphics): void {
  frame.clear().rect(0, 0, hudWidth, hudHeight).fill(frameColor);

  for (let x = -hudHeight; x < hudWidth; x += stripeGap) {
    frame
      .poly([
        x,
        hudHeight,
        x + stripeWidth,
        hudHeight,
        x + stripeWidth + hudHeight,
        0,
        x + hudHeight,
        0,
      ])
      .fill(stripeColor);
  }
}

export {
  hudWidth,
  hudHeight,
  fieldX,
  fieldY,
  fieldWidth,
  fieldHeight,
  hudScale,
  drawFrame,
};
