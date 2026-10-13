import type { Graphics } from "pixi.js";

function drawShape(graphics: Graphics, color: string, size: number): void {
  const radius: number = size / 2;

  graphics
    .clear()
    .ellipse(-radius * 0.7, -radius * 0.2, radius * 0.6, radius * 0.35)
    .ellipse(radius * 0.7, -radius * 0.2, radius * 0.6, radius * 0.35)
    .fill({ color: "#ffffff", alpha: 0.55 })
    .circle(0, 0, radius * 0.5)
    .fill(color)
    .circle(0, -radius * 0.55, radius * 0.3)
    .fill("#ffe0c8");
}

export { drawShape };
