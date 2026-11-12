import { Matrix, type Graphics } from "pixi.js";

type Placement = {
  x: number; // units
  y: number; // units
  angle: number; // rad
  squash: number;
};

type Solid = {
  place: Placement;
  along: number; // units
  width: number; // units
  out: number; // units
  depth: number; // units
  bottom: number; // units
  height: number; // units
};

type Curve = {
  wallY: (x: number, y: number) => number;
  squeeze: (x: number) => number;
  band: (top: number, bottom: number) => Array<number>;
  around: (gap: number) => Array<number>;
};

const arcSteps: number = 24;
const inkColor: string = "#020b30";
const trimColor: string = "#ffffff";
const sideShade: number = 0.4;
const topShine: number = 0.15;
const bandLeft: number = -1000; // units
const bandRight: number = 2600; // units
const bandStep: number = 20; // units

function frustum(
  graphics: Graphics,
  bottomRadius: number,
  topRadius: number,
  bottom: number,
  top: number,
  tilt: number,
): Array<number> {
  const points: Array<number> = [bottomRadius, bottom];

  for (let index = 1; index <= arcSteps; index++) {
    const turn: number = (index / arcSteps) * Math.PI;

    points.push(
      Math.cos(turn) * bottomRadius,
      bottom + Math.sin(turn) * bottomRadius * tilt,
    );
  }

  for (let index = arcSteps; index >= 0; index--) {
    const turn: number = (index / arcSteps) * Math.PI;

    points.push(
      Math.cos(turn) * topRadius,
      top + Math.sin(turn) * topRadius * tilt,
    );
  }

  graphics.poly(points);

  return points;
}

function project(
  place: Placement,
  along: number,
  out: number,
  height: number,
): [number, number] {
  const cos: number = Math.cos(place.angle);
  const sin: number = Math.sin(place.angle);

  return [
    place.x + cos * along - sin * out,
    place.y + (sin * along + cos * out) * place.squash - height,
  ];
}

function faceMatrix(place: Placement, out: number, height: number): Matrix {
  const [x, y] = project(place, 0, out, height);

  return new Matrix(
    Math.cos(place.angle),
    Math.sin(place.angle) * place.squash,
    0,
    1,
    x,
    y,
  );
}

function drawSolid(
  graphics: Graphics,
  solid: Solid,
  color: string,
  front: boolean,
): void {
  const half: number = solid.width / 2;
  const side: number = Math.sign(Math.sin(solid.place.angle)) * half;

  function quad(
    corners: Array<[number, number, number]>,
    tint: string,
    alpha: number,
  ): void {
    const points: Array<number> = new Array();

    for (const [along, out, height] of corners) {
      points.push(
        ...project(
          solid.place,
          solid.along + along,
          solid.out + out,
          solid.bottom + height,
        ),
      );
    }

    graphics.poly(points).fill(color);

    if (alpha > 0) {
      graphics.poly(points).fill({ color: tint, alpha: alpha });
    }

    graphics.stroke({ color: inkColor, width: 3, join: "round" });
  }

  if (side !== 0) {
    quad(
      [
        [side, 0, 0],
        [side, solid.depth, 0],
        [side, solid.depth, solid.height],
        [side, 0, solid.height],
      ],
      inkColor,
      sideShade,
    );
  }

  quad(
    [
      [-half, 0, solid.height],
      [half, 0, solid.height],
      [half, solid.depth, solid.height],
      [-half, solid.depth, solid.height],
    ],
    trimColor,
    topShine,
  );

  if (front) {
    quad(
      [
        [-half, solid.depth, 0],
        [half, solid.depth, 0],
        [half, solid.depth, solid.height],
        [-half, solid.depth, solid.height],
      ],
      inkColor,
      0,
    );
  }
}

function createCurve(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  eyeY: number,
): Curve {
  function lean(x: number): number {
    return Math.min(Math.abs(x - centerX) / radiusX, 1);
  }

  function wallY(x: number, y: number): number {
    const bow: number = (y - eyeY) / (centerY - radiusY - eyeY);
    const reach: number = lean(x);

    return y + bow * radiusY * (1 - Math.sqrt(1 - reach * reach));
  }

  function band(top: number, bottom: number): Array<number> {
    const points: Array<number> = new Array();

    for (let x = bandLeft; x <= bandRight; x += bandStep) {
      points.push(x, wallY(x, top));
    }

    for (let x = bandRight; x >= bandLeft; x -= bandStep) {
      points.push(x, wallY(x, bottom));
    }

    return points;
  }

  function around(gap: number): Array<number> {
    const turn: number = gap / radiusX;
    const count: number = Math.floor(Math.PI / 2 / turn);
    const places: Array<number> = new Array();

    for (let index = -count; index <= count; index++) {
      places.push(centerX + Math.sin(index * turn) * radiusX);
    }

    return places;
  }

  return {
    wallY: wallY,
    squeeze: (x: number) => Math.sqrt(1 - lean(x) * lean(x)),
    band: band,
    around: around,
  };
}

export {
  arcSteps,
  sideShade,
  frustum,
  project,
  faceMatrix,
  drawSolid,
  createCurve,
};
export type { Placement, Solid, Curve };
