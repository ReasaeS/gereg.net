import type { Circle, Container, Rectangle } from "pixi.js";

type Oval = {
  x: number; // units
  y: number; // units
  rx: number; // units
  ry: number; // units
};

type Spot = {
  name: string;
  act: string;
  area: Rectangle | Circle;
  stand: [number, number];
  tag: [number, number];
};

type Room = {
  subject: string;
  horizon: number; // units
  back: Container;
  front: Container;
  props: Array<Container>;
  floor: Oval;
  blockers: Array<Oval>;
  spots: Array<Spot>;
  entries: Map<string, [number, number]>;
  update: (delta: number) => void;
  poke: (act: string) => void;
  paint: () => void;
};

const roomWidth: number = 1600; // units
const roomHeight: number = 1000; // units
const nearDepth: number = 960; // units
const farDepth: number = 640; // units
const nearScale: number = 1.15;
const farScale: number = 0.82;

function depthScale(y: number): number {
  const along: number = Math.min(
    Math.max((y - farDepth) / (nearDepth - farDepth), 0),
    1,
  );

  return farScale + (nearScale - farScale) * along;
}

function clampFloor(room: Room, x: number, y: number): [number, number] {
  const floor: Oval = room.floor;
  let u: number = (x - floor.x) / floor.rx;
  let v: number = (y - floor.y) / floor.ry;
  const reach: number = Math.hypot(u, v);

  if (reach > 1) {
    u /= reach;
    v /= reach;
  }

  let nextX: number = floor.x + u * floor.rx;
  let nextY: number = floor.y + v * floor.ry;

  for (const blocker of room.blockers) {
    const bu: number = (nextX - blocker.x) / blocker.rx;
    const bv: number = (nextY - blocker.y) / blocker.ry;
    const inside: number = Math.hypot(bu, bv);

    if (inside >= 1) {
      continue;
    }

    if (inside === 0) {
      nextY = blocker.y + blocker.ry;
      continue;
    }

    nextX = blocker.x + (bu / inside) * blocker.rx;
    nextY = blocker.y + (bv / inside) * blocker.ry;
  }

  return [nextX, nextY];
}

export { roomWidth, roomHeight, depthScale, clampFloor };
export type { Oval, Spot, Room };
