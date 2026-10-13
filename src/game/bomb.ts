import { Graphics } from "pixi.js";
import { archetype, type BombKind } from "./archetype";

type Style = {
  duration: number; // s
  damage: number; // per s
  color: string;
};

type Bomb = {
  view: Graphics;
  stock: () => number;
  setStock: (value: number) => void;
  trigger: (x: number, y: number) => boolean;
  update: (delta: number, x: number, y: number) => void;
  active: () => boolean;
  invincible: () => boolean;
  covers: (x: number, y: number, radius: number) => boolean;
  damage: () => number;
  clear: () => void;
};

const startBombs: number = 3;
const deathbombWindow: number = 0.15; // s
const afterGrace: number = 1; // s
const fadeTime: number = 0.3; // s
const sealGrow: number = 0.8; // s
const sealReach: number = 620; // units
const sealRings: number = 3;
const sealGap: number = 26; // units
const sparkWidth: number = 110; // units
const sparkGrow: number = 0.2; // s
const sparkCore: number = 0.4; // of width
const burstRing: number = 0.5; // s
const styles: Record<BombKind, Style> = {
  seal: { duration: 2.5, damage: 24, color: "#ff6fd8" },
  spark: { duration: 3, damage: 40, color: "#fff27a" },
  burst: { duration: 1.2, damage: 15, color: "#7ad8ff" },
};

function createBomb(width: number, height: number): Bomb {
  const view: Graphics = new Graphics();
  let stock: number = startBombs;
  let kind: BombKind = archetype().bomb;
  let time: number = 0;
  let left: number = 0;
  let shield: number = 0;
  let originX: number = 0;
  let originY: number = 0;

  function style(): Style {
    return styles[kind];
  }

  function trigger(x: number, y: number): boolean {
    if (stock < 1 || left > 0) {
      return false;
    }

    stock--;
    originX = x;
    originY = y;
    kind = archetype().bomb;
    time = 0;
    left = style().duration;
    shield = style().duration + afterGrace;

    return true;
  }

  function sealRadius(): number {
    return sealReach * Math.min(time / sealGrow, 1);
  }

  function sparkHalf(): number {
    return (sparkWidth / 2) * Math.min(time / sparkGrow, 1);
  }

  function draw(): void {
    const alpha: number = Math.min(left / fadeTime, 1);
    const color: string = style().color;

    view.clear();

    if (left <= 0) {
      return;
    }

    if (kind === "seal") {
      const radius: number = sealRadius();

      view
        .circle(originX, originY, radius)
        .fill({ color: color, alpha: 0.18 * alpha });

      for (let ring = 0; ring < sealRings; ring++) {
        view.circle(originX, originY, Math.max(radius - ring * sealGap, 0));
      }

      view.stroke({ color: "#ffffff", width: 3, alpha: 0.7 * alpha });
    } else if (kind === "spark") {
      const half: number = sparkHalf();

      view
        .rect(originX - half, 0, half * 2, originY)
        .fill({ color: color, alpha: 0.45 * alpha })
        .rect(originX - half * sparkCore, 0, half * sparkCore * 2, originY)
        .fill({ color: "#ffffff", alpha: 0.8 * alpha });
    } else {
      const flash: number = left / style().duration;
      const ring: number = Math.min(time / burstRing, 1);

      view
        .rect(0, 0, width, height)
        .fill({ color: color, alpha: 0.35 * flash })
        .circle(originX, originY, Math.hypot(width, height) * ring)
        .stroke({ color: "#ffffff", width: 4, alpha: (1 - ring) * alpha });
    }
  }

  function update(delta: number, x: number, y: number): void {
    shield = Math.max(shield - delta, 0);

    if (left > 0) {
      time += delta;
      left = Math.max(left - delta, 0);

      if (kind === "spark") {
        originX = x;
        originY = y;
      }
    }

    draw();
  }

  function covers(x: number, y: number, radius: number): boolean {
    if (left <= 0) {
      return false;
    }

    if (kind === "seal") {
      const reach: number = sealRadius() + radius;

      return (x - originX) ** 2 + (y - originY) ** 2 < reach * reach;
    }

    if (kind === "spark") {
      return Math.abs(x - originX) < sparkHalf() + radius && y < originY;
    }

    return true;
  }

  function clear(): void {
    time = 0;
    left = 0;
    shield = 0;
    view.clear();
  }

  return {
    view: view,
    stock: () => stock,
    setStock: (value: number) => {
      stock = value;
    },
    trigger: trigger,
    update: update,
    active: () => left > 0,
    invincible: () => shield > 0,
    covers: covers,
    damage: () => (left > 0 ? style().damage : 0),
    clear: clear,
  };
}

export { startBombs, deathbombWindow, createBomb };
export type { Bomb };
