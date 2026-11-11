import { BufferImageSource, Texture } from "pixi.js";
import type { Blend, Bullet, Glow, Shape } from "./types";
import { bulletSide } from "./defaults";
import { createPixels, decodePixels, type Pixels } from "../editor/pixels";
import { drawBulletDefault } from "../editor/default";

type Energy = {
  glow: Texture;
  core: Texture;
};

type Extent = {
  side: number; // of radius
  top: number; // of radius
  bottom: number; // of radius
};

const energySize: number = 96; // px
const cacheLimit: number = 64;
const starPoints: number = 5;
const starInner: number = 0.45; // of radius
const ringHole: number = 0.55; // of radius
const cache: Map<string, Energy> = new Map();
const full: Extent = { side: 1, top: -1, bottom: 1 };
const extents: Record<Shape, Extent> = {
  orb: full,
  rice: full,
  star: { side: 0.951, top: -0.809, bottom: 1 },
  kunai: full,
  ring: full,
  heart: { side: 0.832, top: -0.61, bottom: 1 },
  diamond: full,
};

function tracePath(
  context: CanvasRenderingContext2D,
  shape: Shape,
  a: number,
  b: number,
): void {
  context.beginPath();

  if (shape === "orb") {
    context.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
  } else if (shape === "ring") {
    context.ellipse(0, 0, a, b, 0, 0, Math.PI * 2);
    context.moveTo(a * ringHole, 0);
    context.ellipse(0, 0, a * ringHole, b * ringHole, 0, 0, Math.PI * 2, true);
  } else if (shape === "rice") {
    context.moveTo(0, -b);
    context.quadraticCurveTo(a * 2, 0, 0, b);
    context.quadraticCurveTo(-a * 2, 0, 0, -b);
  } else if (shape === "diamond") {
    context.moveTo(0, -b);
    context.lineTo(a, 0);
    context.lineTo(0, b);
    context.lineTo(-a, 0);
  } else if (shape === "kunai") {
    context.moveTo(0, b);
    context.lineTo(a, b * 0.1);
    context.lineTo(a * 0.35, -b * 0.2);
    context.lineTo(a * 0.35, -b);
    context.lineTo(-a * 0.35, -b);
    context.lineTo(-a * 0.35, -b * 0.2);
    context.lineTo(-a, b * 0.1);
  } else if (shape === "heart") {
    context.moveTo(0, b);
    context.bezierCurveTo(-a * 1.3, b * 0.1, -a * 0.9, -b * 1.1, 0, -b * 0.4);
    context.bezierCurveTo(a * 0.9, -b * 1.1, a * 1.3, b * 0.1, 0, b);
  } else {
    for (let index = 0; index < starPoints * 2; index++) {
      const angle: number = (index * Math.PI) / starPoints;
      const reach: number = index % 2 === 0 ? 1 : starInner;

      context.lineTo(Math.sin(angle) * a * reach, Math.cos(angle) * b * reach);
    }
  }

  context.closePath();
}

function blurOf(width: number, softness: number): number {
  return (width / 2) * (softness / (1 + softness));
}

function paintLayer(
  bullet: Bullet,
  width: number,
  height: number,
  blend: Blend,
): Texture {
  const canvas: HTMLCanvasElement = document.createElement("canvas");
  const context: CanvasRenderingContext2D = canvas.getContext("2d")!;
  const pad: number = Math.max(
    0,
    ...bullet.glows.map((glow: Glow) => blurOf(width, glow.softness)),
  );
  const extent: Extent = extents[bullet.shape];

  canvas.width = width;
  canvas.height = height;
  context.translate(width / 2, height / 2);
  context.scale(1 / extent.side, 2 / (extent.bottom - extent.top));

  for (const glow of bullet.glows) {
    if (glow.blend !== blend) {
      continue;
    }

    const a: number = (width / 2 - pad) * glow.size;
    const b: number = (height / 2 - pad) * glow.size;
    const blur: number = blurOf(width, glow.softness);

    context.save();
    context.translate(0, (-(extent.top + extent.bottom) / 2) * b);
    tracePath(context, bullet.shape, a, b);
    context.clip("evenodd");
    context.clearRect(-width, -height, width * 2, height * 2);
    context.restore();
    context.save();
    context.translate(0, (-(extent.top + extent.bottom) / 2) * b);
    context.globalAlpha = glow.opacity / 100;
    context.fillStyle = glow.color;
    context.shadowColor = glow.color;
    context.shadowBlur = blur;
    tracePath(context, bullet.shape, a, b);
    context.fill("evenodd");
    context.shadowBlur = blur / 2;
    context.fill("evenodd");
    context.restore();
  }

  return Texture.from(canvas);
}

function readBullet(bullet: Bullet, pixels: Pixels): void {
  if (!decodePixels(pixels, bullet.pixels)) {
    drawBulletDefault(pixels);
  }
}

function spriteEnergy(bullet: Bullet): Energy {
  const pixels: Pixels = createPixels(bulletSide);

  readBullet(bullet, pixels);

  return {
    glow: new Texture({
      source: new BufferImageSource({
        resource: pixels.data,
        width: bulletSide,
        height: bulletSide,
        scaleMode: "nearest",
      }),
    }),
    core: Texture.EMPTY,
  };
}

function energyOf(bullet: Bullet): Energy {
  const key: string = [
    bullet.look,
    bullet.look === "sprite" ? bullet.pixels : "",
    bullet.shape,
    JSON.stringify(bullet.glows),
    bullet.length,
  ].join("|");
  const cached: Energy | undefined = cache.get(key);

  if (cached !== undefined) {
    return cached;
  }

  if (bullet.look === "sprite") {
    const energy: Energy = spriteEnergy(bullet);

    remember(key, energy);

    return energy;
  }

  const width: number = energySize;
  const height: number = Math.round(energySize * Math.max(bullet.length, 1));
  const energy: Energy = {
    glow: paintLayer(bullet, width, height, "normal"),
    core: paintLayer(bullet, width, height, "light"),
  };

  remember(key, energy);

  return energy;
}

function remember(key: string, energy: Energy): void {
  if (cache.size >= cacheLimit) {
    cache.delete(cache.keys().next().value!);
  }

  cache.set(key, energy);
}

export { energyOf, readBullet };
export type { Energy };
