import { ColorMatrixFilter, Graphics } from "pixi.js";

type RingStyle = {
  color: string;
  width: number; // px
  glow: number; // px
  brightness: number;
};

type Ring = {
  view: Graphics;
  setCircle: (x: number, y: number, radius: number) => void;
};

type GlowLayer = {
  spread: number; // px
  alpha: number;
};

const ringGap: number = 25; // px
const glowLayerCount: number = 16;
const nearGlowStrength: number = 0.8;
const farGlowStrength: number = 0.55;

function glowProfile(distance: number, style: RingStyle): number {
  const near: number = style.glow / 6;
  const far: number = style.glow / 2;
  const nearGlow: number =
    nearGlowStrength * Math.exp(-(distance * distance) / (2 * near * near));
  const farGlow: number =
    farGlowStrength * Math.exp(-(distance * distance) / (2 * far * far));

  return 1 - (1 - nearGlow) * (1 - farGlow);
}

function glowLayers(style: RingStyle): Array<GlowLayer> {
  const extent: number = style.glow * 1.5;
  const step: number = extent / glowLayerCount;
  const layers: Array<GlowLayer> = new Array();
  let outside: number = 0;

  for (let index = glowLayerCount; index >= 1; index--) {
    const inside: number = glowProfile((index - 0.5) * step, style);
    layers.push({
      spread: index * step,
      alpha: Math.max(1 - (1 - inside) / (1 - outside), 0),
    });
    outside = inside;
  }

  layers.push({ spread: 0, alpha: 1 });

  return layers;
}

function ringPath(
  graphics: Graphics,
  x: number,
  y: number,
  radius: number,
  coreWidth: number,
  width: number,
): void {
  const half: number = width / 2;
  const outer: number = radius + half;
  const inner: number = Math.max(radius - half, 0);
  const middle: number = (outer + inner) / 2;
  const cap: number = (outer - inner) / 2;
  const spread: number = (ringGap + coreWidth) / 2 / radius;
  const start: number = -Math.PI / 2 + spread;
  const end: number = (Math.PI * 3) / 2 - spread;

  graphics
    .moveTo(x + outer * Math.cos(start), y + outer * Math.sin(start))
    .arc(x, y, outer, start, end)
    .arc(
      x + middle * Math.cos(end),
      y + middle * Math.sin(end),
      cap,
      end,
      end + Math.PI,
    )
    .arc(x, y, inner, end, start, true)
    .arc(
      x + middle * Math.cos(start),
      y + middle * Math.sin(start),
      cap,
      start + Math.PI,
      start + Math.PI * 2,
    )
    .closePath();
}

function createRing(style: RingStyle): Ring {
  const layers: Array<GlowLayer> = glowLayers(style);
  const view: Graphics = new Graphics();

  if (style.brightness !== 1) {
    const filter: ColorMatrixFilter = new ColorMatrixFilter();
    filter.brightness(style.brightness, false);
    view.filters = [filter];
  }

  function setCircle(x: number, y: number, radius: number): void {
    view.clear();

    if (radius <= 0) {
      return;
    }

    for (let index = 0; index < layers.length; index++) {
      const layer: GlowLayer = layers[index]!;
      ringPath(view, x, y, radius, style.width, style.width + layer.spread * 2);
      view.fill({ color: style.color, alpha: layer.alpha });
    }
  }

  return { view: view, setCircle: setCircle };
}

export { createRing };
export type { Ring, RingStyle };
