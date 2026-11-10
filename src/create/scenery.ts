import { Texture } from "pixi.js";
import type { Background, Parallax, SceneKind, Scenery } from "./types";
import { getTexture } from "./images";
import type { Option } from "../ui/widgets";

type Draw = (
  context: CanvasRenderingContext2D,
  scene: Scenery,
  random: () => number,
) => void;

const sceneSize: number = 256; // px
const cacheLimit: number = 96;
const seedLimit: number = 100000;
const sceneKinds: Array<Option<SceneKind>> = [
  { value: "stars", label: "Stars" },
  { value: "clouds", label: "Clouds" },
  { value: "rain", label: "Rain" },
  { value: "motes", label: "Motes" },
  { value: "waves", label: "Waves" },
  { value: "islands", label: "Islands" },
  { value: "city", label: "City blocks" },
  { value: "nebula", label: "Nebula" },
  { value: "grid", label: "Grid" },
];
const sceneColors: Array<string> = [
  "#ffffff",
  "#9fd8ff",
  "#3b82ff",
  "#7ae38f",
  "#2fa84f",
  "#fff27a",
  "#ffb347",
  "#ff6b5b",
  "#ff6fd8",
  "#b48aff",
  "#3d4766",
  "#1d1d2b",
];
const skyTops: Array<string> = [
  "#031448",
  "#0b3f9e",
  "#1e0a2e",
  "#4a1a5c",
  "#5c1a1a",
  "#1e5c2a",
  "#04303f",
  "#2b1b4d",
];
const skyBottoms: Array<string> = [
  "#000000",
  "#01030a",
  "#01040f",
  "#120818",
  "#03121d",
  "#010a12",
];
const textures: Map<string, Texture> = new Map();

function seeded(seed: number): () => number {
  let state: number = seed >>> 0 || 1;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value: number = state;

    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function wrapped(
  action: (x: number, y: number) => void,
  x: number,
  y: number,
): void {
  for (const offsetX of [-sceneSize, 0, sceneSize]) {
    for (const offsetY of [-sceneSize, 0, sceneSize]) {
      action(x + offsetX, y + offsetY);
    }
  }
}

function glow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
): void {
  const gradient: CanvasGradient = context.createRadialGradient(
    x,
    y,
    0,
    x,
    y,
    radius,
  );

  gradient.addColorStop(0, color);
  gradient.addColorStop(1, color + "00");
  context.globalAlpha = alpha;
  context.fillStyle = gradient;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function amount(scene: Scenery): number {
  return Math.min(Math.max(scene.density / 100, 0.05), 1);
}

function scale(scene: Scenery): number {
  return Math.min(Math.max(scene.size / 100, 0.25), 3);
}

const draws: Record<SceneKind, Draw> = {
  stars: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const count: number = Math.round(30 + 260 * amount(scene));

    for (let index = 0; index < count; index++) {
      const x: number = random() * sceneSize;
      const y: number = random() * sceneSize;
      const side: number = Math.max(
        1,
        Math.round((0.6 + random() ** 3 * 2.4) * scale(scene)),
      );
      const color: string = random() < 0.25 ? scene.accent : scene.color;
      const alpha: number = 0.35 + random() * 0.65;

      wrapped(
        (atX: number, atY: number) => {
          context.globalAlpha = alpha;
          context.fillStyle = color;
          context.fillRect(Math.round(atX), Math.round(atY), side, side);

          if (side >= 3) {
            context.globalAlpha = alpha * 0.5;
            context.fillRect(
              Math.round(atX) - side,
              Math.round(atY) + side / 2 - 0.5,
              side * 3,
              1,
            );
            context.fillRect(
              Math.round(atX) + side / 2 - 0.5,
              Math.round(atY) - side,
              1,
              side * 3,
            );
          }
        },
        x,
        y,
      );
    }
  },
  motes: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const count: number = Math.round(8 + 60 * amount(scene));

    for (let index = 0; index < count; index++) {
      const x: number = random() * sceneSize;
      const y: number = random() * sceneSize;
      const radius: number = (3 + random() * 7) * scale(scene);
      const alpha: number = 0.4 + random() * 0.6;

      wrapped(
        (atX: number, atY: number) => {
          glow(context, atX, atY, radius, scene.color, alpha * 0.7);
          glow(context, atX, atY, radius * 0.35, scene.accent, alpha);
        },
        x,
        y,
      );
    }
  },
  rain: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const count: number = Math.round(30 + 220 * amount(scene));
    const slant: number = (random() - 0.5) * 0.4;

    context.lineWidth = Math.max(1, scale(scene));

    for (let index = 0; index < count; index++) {
      const x: number = random() * sceneSize;
      const y: number = random() * sceneSize;
      const length: number = (8 + random() * 18) * scale(scene);
      const color: string = random() < 0.2 ? scene.accent : scene.color;
      const alpha: number = 0.25 + random() * 0.5;

      wrapped(
        (atX: number, atY: number) => {
          context.globalAlpha = alpha;
          context.strokeStyle = color;
          context.beginPath();
          context.moveTo(atX, atY);
          context.lineTo(atX + slant * length, atY + length);
          context.stroke();
        },
        x,
        y,
      );
    }
  },
  clouds: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const count: number = Math.round(3 + 12 * amount(scene));

    for (let index = 0; index < count; index++) {
      const x: number = random() * sceneSize;
      const y: number = random() * sceneSize;
      const puffs: Array<Array<number>> = new Array(
        4 + Math.floor(random() * 4),
      )
        .fill(0)
        .map(() => [
          (random() - 0.5) * 50 * scale(scene),
          (random() - 0.5) * 20 * scale(scene),
          (12 + random() * 18) * scale(scene),
        ]);

      wrapped(
        (atX: number, atY: number) => {
          for (const [offsetX, offsetY, radius] of puffs) {
            glow(
              context,
              atX + offsetX!,
              atY + offsetY! + radius! * 0.25,
              radius! * 1.1,
              scene.accent,
              0.18,
            );
            glow(
              context,
              atX + offsetX!,
              atY + offsetY!,
              radius!,
              scene.color,
              0.32,
            );
          }
        },
        x,
        y,
      );
    }
  },
  nebula: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const count: number = Math.round(3 + 7 * amount(scene));

    context.globalCompositeOperation = "lighter";

    for (let index = 0; index < count; index++) {
      const x: number = random() * sceneSize;
      const y: number = random() * sceneSize;
      const radius: number = (45 + random() * 70) * scale(scene);
      const color: string = index % 2 === 0 ? scene.color : scene.accent;

      wrapped(
        (atX: number, atY: number) =>
          glow(context, atX, atY, radius, color, 0.22),
        x,
        y,
      );
    }

    context.globalCompositeOperation = "source-over";
  },
  waves: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const rows: number = Math.round(5 + 18 * amount(scene));

    context.lineWidth = Math.max(1, 1.5 * scale(scene));

    for (let row = 0; row < rows; row++) {
      const y: number = ((row + random() * 0.6) / rows) * sceneSize;
      const cycles: number = 1 + Math.floor(random() * 4);
      const height: number = (2 + random() * 4) * scale(scene);
      const phase: number = random() * Math.PI * 2;
      const color: string = random() < 0.25 ? scene.accent : scene.color;

      for (const offsetY of [-sceneSize, 0, sceneSize]) {
        context.globalAlpha = 0.35 + random() * 0.35;
        context.strokeStyle = color;
        context.beginPath();

        for (let x = 0; x <= sceneSize; x += 4) {
          const atY: number =
            y +
            offsetY +
            Math.sin((x / sceneSize) * Math.PI * 2 * cycles + phase) * height;

          if (x === 0) {
            context.moveTo(x, atY);
          } else {
            context.lineTo(x, atY);
          }
        }

        context.stroke();
      }
    }
  },
  islands: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const count: number = Math.round(2 + 6 * amount(scene));

    for (let index = 0; index < count; index++) {
      const x: number = random() * sceneSize;
      const y: number = random() * sceneSize;
      const radius: number = (16 + random() * 26) * scale(scene);
      const bumps: Array<number> = new Array(14)
        .fill(0)
        .map(() => 0.7 + random() * 0.5);
      const trees: Array<Array<number>> = new Array(6)
        .fill(0)
        .map(() => [
          (random() - 0.5) * radius,
          (random() - 0.5) * radius,
          (2 + random() * 3) * scale(scene),
        ]);

      const outline: (atX: number, atY: number, grow: number) => void = (
        atX: number,
        atY: number,
        grow: number,
      ): void => {
        context.beginPath();
        bumps.forEach((bump: number, step: number) => {
          const angle: number = (step / bumps.length) * Math.PI * 2;
          const reach: number = radius * bump + grow;
          const pointX: number = atX + Math.cos(angle) * reach;
          const pointY: number = atY + Math.sin(angle) * reach;

          if (step === 0) {
            context.moveTo(pointX, pointY);
          } else {
            context.lineTo(pointX, pointY);
          }
        });
        context.closePath();
        context.fill();
      };

      wrapped(
        (atX: number, atY: number) => {
          context.globalAlpha = 1;
          context.fillStyle = scene.accent;
          outline(atX, atY, 4 * scale(scene));
          context.fillStyle = scene.color;
          outline(atX, atY, 0);
          context.globalAlpha = 0.35;
          context.fillStyle = "#000000";

          for (const [offsetX, offsetY, size] of trees) {
            context.beginPath();
            context.arc(atX + offsetX!, atY + offsetY!, size!, 0, Math.PI * 2);
            context.fill();
          }
        },
        x,
        y,
      );
    }
  },
  city: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const cells: number = Math.max(
      2,
      Math.round(sceneSize / (28 * scale(scene))),
    );
    const cell: number = sceneSize / cells;
    const street: number = Math.max(2, Math.round(cell * 0.14));

    for (let row = 0; row < cells; row++) {
      for (let column = 0; column < cells; column++) {
        if (random() > 0.25 + 0.75 * amount(scene)) {
          continue;
        }

        const left: number = column * cell + street;
        const top: number = row * cell + street;
        const side: number = cell - street * 2;

        context.globalAlpha = 0.75 + random() * 0.25;
        context.fillStyle = scene.color;
        context.fillRect(left, top, side, side);
        context.globalAlpha = 0.3;
        context.fillStyle = "#000000";
        context.fillRect(left, top + side * 0.8, side, side * 0.2);
        context.globalAlpha = 1;
        context.fillStyle = scene.accent;

        const lights: number = Math.floor(random() * 5);

        for (let light = 0; light < lights; light++) {
          context.fillRect(
            Math.round(left + random() * (side - 3)),
            Math.round(top + random() * (side * 0.8 - 3)),
            2,
            2,
          );
        }
      }
    }
  },
  grid: (
    context: CanvasRenderingContext2D,
    scene: Scenery,
    random: () => number,
  ): void => {
    const lines: number = Math.max(
      2,
      Math.round((4 + 12 * amount(scene)) / scale(scene)),
    );
    const gap: number = sceneSize / lines;
    const major: number = 2 + Math.floor(random() * 3);

    for (let index = 0; index < lines; index++) {
      const color: string = index % major === 0 ? scene.accent : scene.color;
      const at: number = Math.round(index * gap) + 0.5;

      context.globalAlpha = index % major === 0 ? 0.6 : 0.3;
      context.fillStyle = color;
      context.fillRect(at, 0, 1, sceneSize);
      context.fillRect(0, at, sceneSize, 1);
    }
  },
};

function sceneKey(scene: Scenery): string {
  return [
    scene.kind,
    scene.color,
    scene.accent,
    scene.density,
    scene.size,
    scene.seed,
  ].join(":");
}

function sceneTexture(scene: Scenery): Texture {
  const key: string = sceneKey(scene);
  const cached: Texture | undefined = textures.get(key);

  if (cached !== undefined) {
    textures.delete(key);
    textures.set(key, cached);

    return cached;
  }

  const canvas: HTMLCanvasElement = document.createElement("canvas");
  const context: CanvasRenderingContext2D = canvas.getContext("2d")!;

  canvas.width = sceneSize;
  canvas.height = sceneSize;
  draws[scene.kind](context, scene, seeded(scene.seed));
  context.globalAlpha = 1;

  const texture: Texture = Texture.from(canvas);

  textures.set(key, texture);

  if (textures.size > cacheLimit) {
    textures.delete(textures.keys().next().value!);
  }

  return texture;
}

function layerTexture(layer: Parallax): Texture | null {
  return layer.scene !== null
    ? sceneTexture(layer.scene)
    : getTexture(layer.sprite);
}

function layerKey(layer: Parallax): string {
  return layer.scene !== null
    ? sceneKey(layer.scene)
    : getTexture(layer.sprite) === null
      ? ""
      : (layer.sprite ?? "");
}

function newSeed(random: () => number = Math.random): number {
  return Math.floor(random() * seedLimit);
}

function defaultScenery(): Scenery {
  return {
    kind: "stars",
    color: "#ffffff",
    accent: "#9fd8ff",
    density: 50,
    size: 100,
    seed: newSeed(),
  };
}

function pickFrom<T>(list: Array<T>, random: () => number): T {
  return list[Math.floor(random() * list.length)]!;
}

function randomScenery(random: () => number = Math.random): Scenery {
  return {
    kind: pickFrom(sceneKinds, random).value,
    color: pickFrom(sceneColors, random),
    accent: pickFrom(sceneColors, random),
    density: 20 + Math.floor(random() * 9) * 10,
    size: 50 + Math.floor(random() * 11) * 10,
    seed: newSeed(random),
  };
}

function randomizeBackground(
  background: Background,
  random: () => number = Math.random,
): void {
  const scroll: number = 20 + Math.floor(random() * 25) * 10;

  background.sprite = null;
  background.top = pickFrom(skyTops, random);
  background.bottom = pickFrom(skyBottoms, random);
  background.scroll = scroll;
  background.layers = new Array(1 + Math.floor(random() * 3))
    .fill(0)
    .map((_: number, index: number) => ({
      sprite: null,
      scene: randomScenery(random),
      scroll: scroll * (1 + index * 0.6),
      drift: Math.round((random() - 0.5) * 8) * 5,
      opacity: 0.5 + Math.floor(random() * 6) * 0.1,
    }));
}

function repairScenery(
  scene: Partial<Scenery> | null | undefined,
): Scenery | null {
  if (scene === null || scene === undefined) {
    return null;
  }

  const fallback: Scenery = defaultScenery();

  return {
    kind: sceneKinds.some(
      (option: Option<SceneKind>) => option.value === scene.kind,
    )
      ? scene.kind!
      : fallback.kind,
    color: typeof scene.color === "string" ? scene.color : fallback.color,
    accent: typeof scene.accent === "string" ? scene.accent : fallback.accent,
    density:
      typeof scene.density === "number" ? scene.density : fallback.density,
    size: typeof scene.size === "number" ? scene.size : fallback.size,
    seed: typeof scene.seed === "number" ? scene.seed : fallback.seed,
  };
}

export {
  seeded,
  sceneKinds,
  sceneColors,
  sceneTexture,
  layerTexture,
  layerKey,
  newSeed,
  defaultScenery,
  randomScenery,
  randomizeBackground,
  repairScenery,
};
