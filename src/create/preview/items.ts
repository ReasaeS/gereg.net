import { Graphics, type Container } from "pixi.js";
import type { Drop, Drops, Effect, Vector } from "../types";
import { previewHeight, previewWidth } from "./bounds";

type Pickup = Drop | "effect";

type Item = {
  kind: Pickup;
  effect: Effect | null;
  x: number; // units
  y: number; // units
  vx: number; // units/s
  vy: number; // units/s
  spin: number; // rad
};

type Defeat = {
  x: number; // units
  y: number; // units
  drops: Drops;
  effects: Array<Effect>;
};

type Haul = {
  power: number;
  points: number;
  count: number;
  lives: number;
  lifePieces: number;
  bombs: number;
  bombPieces: number;
  effects: Array<Effect>;
};

type Items = {
  drop: (defeat: Defeat) => void;
  update: (delta: number, x: number, y: number, alive: boolean) => Haul;
  clear: () => void;
  positions: () => ReadonlyArray<Vector>;
};

const dropOrder: Array<Drop> = [
  "life",
  "bomb",
  "big",
  "lifepiece",
  "bombpiece",
  "power",
  "point",
];
const powerValue: Map<Drop, number> = new Map([
  ["power", 0.05],
  ["big", 1],
  ["point", 0],
  ["life", 0],
  ["lifepiece", 0],
  ["bomb", 0],
  ["bombpiece", 0],
]);
const itemSize: Map<Drop, number> = new Map([
  ["power", 5],
  ["big", 9],
  ["point", 5],
  ["life", 9],
  ["lifepiece", 6],
  ["bomb", 9],
  ["bombpiece", 6],
]);
const itemColor: Map<Drop, string> = new Map([
  ["power", "#ff4d5e"],
  ["big", "#ff4d5e"],
  ["point", "#4da6ff"],
  ["life", "#ff6fd8"],
  ["lifepiece", "#ff6fd8"],
  ["bomb", "#7ae38f"],
  ["bombpiece", "#7ae38f"],
]);
const effectSize: number = 8; // units
const pointBase: number = 300;
const pointBonus: number = 1700;
const popSpeed: number = 140; // units/s
const popSpread: number = 70; // units/s
const gravity: number = 260; // units/s^2
const fallSpeed: number = 110; // units/s
const drag: number = 2; // 1/s
const spinSpeed: number = 3; // rad/s
const magnetRange: number = 70; // units
const magnetSpeed: number = 480; // units/s
const collectLine: number = 0.25; // of field height
const collectRange: number = 16; // units
const itemMargin: number = 20; // units

function createItems(layer: Container): Items {
  const graphics: Graphics = new Graphics();
  const items: Array<Item> = new Array();

  function drop(defeat: Defeat): void {
    for (const kind of dropOrder) {
      const count: number = Math.max(Math.round(defeat.drops[kind] ?? 0), 0);

      for (let index = 0; index < count; index++) {
        items.push({
          kind: kind,
          effect: null,
          x: defeat.x + (Math.random() - 0.5) * (count > 1 ? 30 : 0),
          y: defeat.y,
          vx: (Math.random() - 0.5) * popSpread * (count > 1 ? 1 : 0.3),
          vy: -popSpeed * (0.7 + Math.random() * 0.5),
          spin: Math.random() * Math.PI,
        });
      }
    }

    for (const effect of defeat.effects) {
      items.push({
        kind: "effect",
        effect: effect,
        x: defeat.x + (Math.random() - 0.5) * 20,
        y: defeat.y,
        vx: (Math.random() - 0.5) * popSpread * 0.5,
        vy: -popSpeed * (0.8 + Math.random() * 0.4),
        spin: Math.random() * Math.PI,
      });
    }
  }

  function drawEffect(item: Item): void {
    const color: string = item.effect?.color ?? "#ffffff";
    const corners: Array<number> = new Array();

    for (let corner = 0; corner < 4; corner++) {
      const angle: number = -item.spin + (corner * Math.PI) / 2;

      corners.push(
        item.x + Math.cos(angle) * effectSize * 0.45,
        item.y + Math.sin(angle) * effectSize * 0.45,
      );
    }

    graphics
      .circle(item.x, item.y, effectSize * 1.6)
      .fill({ color: color, alpha: 0.18 })
      .circle(item.x, item.y, effectSize)
      .fill({ color: color, alpha: 0.9 })
      .stroke({ color: "#ffffff", width: 1.25 })
      .poly(corners)
      .fill({ color: "#ffffff", alpha: 0.95 });
  }

  function draw(): void {
    graphics.clear();

    for (const item of items) {
      if (item.kind === "effect") {
        drawEffect(item);
        continue;
      }

      const size: number = itemSize.get(item.kind)!;
      const color: string = itemColor.get(item.kind)!;
      const corners: Array<number> = new Array();

      for (let corner = 0; corner < 4; corner++) {
        const angle: number = item.spin + (corner * Math.PI) / 2;

        corners.push(
          item.x + Math.cos(angle) * size,
          item.y + Math.sin(angle) * size,
        );
      }

      graphics
        .poly(corners)
        .fill({ color: color, alpha: 0.9 })
        .poly(corners)
        .stroke({ color: "#ffffff", width: 1.25 });

      if (item.kind === "big" || item.kind === "life" || item.kind === "bomb") {
        graphics
          .circle(item.x, item.y, size * 0.35)
          .fill({ color: "#ffffff", alpha: 0.9 });
      }
    }
  }

  function update(delta: number, x: number, y: number, alive: boolean): Haul {
    const haul: Haul = {
      power: 0,
      points: 0,
      count: 0,
      lives: 0,
      lifePieces: 0,
      bombs: 0,
      bombPieces: 0,
      effects: new Array(),
    };
    const pulled: boolean = alive && y < previewHeight * collectLine;
    let write: number = 0;

    for (const item of items) {
      const dx: number = x - item.x;
      const dy: number = y - item.y;
      const distance: number = Math.hypot(dx, dy);

      if (alive && (pulled || distance < magnetRange) && item.vy > 0) {
        const step: number = Math.min(magnetSpeed * delta, distance);

        item.x += (dx / Math.max(distance, 0.001)) * step;
        item.y += (dy / Math.max(distance, 0.001)) * step;
      } else {
        item.vx -= item.vx * Math.min(drag * delta, 1);
        item.vy = Math.min(item.vy + gravity * delta, fallSpeed);
        item.x += item.vx * delta;
        item.y += item.vy * delta;
      }

      item.spin += spinSpeed * delta;

      if (alive && Math.hypot(x - item.x, y - item.y) < collectRange) {
        if (item.effect !== null) {
          haul.effects.push(item.effect);
        }

        haul.power += item.kind === "effect" ? 0 : powerValue.get(item.kind)!;
        haul.count++;
        haul.lives += item.kind === "life" ? 1 : 0;
        haul.lifePieces += item.kind === "lifepiece" ? 1 : 0;
        haul.bombs += item.kind === "bomb" ? 1 : 0;
        haul.bombPieces += item.kind === "bombpiece" ? 1 : 0;

        if (item.kind === "point") {
          haul.points += Math.round(
            pointBase +
              pointBonus * Math.min(Math.max(1 - item.y / previewHeight, 0), 1),
          );
        }

        continue;
      }

      if (
        item.y > previewHeight + itemMargin ||
        item.x < -itemMargin ||
        item.x > previewWidth + itemMargin
      ) {
        continue;
      }

      items[write++] = item;
    }

    items.length = write;
    draw();

    return haul;
  }

  function clear(): void {
    items.length = 0;
    graphics.clear();
  }

  layer.addChild(graphics);

  return { drop: drop, update: update, clear: clear, positions: () => items };
}

export { createItems };
export type { Items, Defeat, Haul };
