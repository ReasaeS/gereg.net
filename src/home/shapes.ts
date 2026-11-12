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

type Spiral = {
  x: number; // units
  base: number; // units
  squash: number;
  lift: number; // units
  from: number;
  to: number;
  poleBottom: number; // units
  poleTop: number; // units
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
const stepCount: number = 11;
const stepRise: number = 58; // units
const stepReach: number = 125; // units
const stepTurn: number = 0.78; // rad
const stepThick: number = 12; // units
const poleRadius: number = 10; // units
const treadSamples: number = 8;

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

function drawSpiral(
  graphics: Graphics,
  spiral: Spiral,
  accent: string,
  far: string,
): void {
  const order: Array<number> = new Array();

  function point(
    angle: number,
    radius: number,
    height: number,
  ): [number, number] {
    return [
      spiral.x + Math.sin(angle) * radius,
      spiral.base + Math.cos(angle) * radius * spiral.squash - height,
    ];
  }

  function tread(index: number): void {
    const middle: number = index * stepTurn;
    const from: number = middle - stepTurn / 2;
    const to: number = middle + stepTurn / 2;
    const height: number = spiral.lift + index * stepRise;
    const near: boolean = Math.cos(middle) >= 0;
    const edge: string = near ? accent : inkColor;
    const angles: Array<number> = new Array();

    for (let sample = 0; sample <= treadSamples; sample++) {
      angles.push(from + (sample / treadSamples) * stepTurn);
    }

    const facing: Array<number> = angles.filter(
      (angle: number) => Math.cos(angle) > 0,
    );

    if (facing.length >= 2) {
      const band: Array<number> = new Array();

      for (const angle of facing) {
        band.push(...point(angle, stepReach, height));
      }

      for (const angle of [...facing].reverse()) {
        band.push(...point(angle, stepReach, height - stepThick));
      }

      graphics.poly(band).fill(edge).stroke({ color: inkColor, width: 3 });
    }

    for (const [angle, facingY] of [
      [from, Math.sin(from)],
      [to, -Math.sin(to)],
    ] as Array<[number, number]>) {
      if (facingY <= 0) {
        continue;
      }

      const riser: Array<number> = [
        ...point(angle, poleRadius, height),
        ...point(angle, stepReach, height),
        ...point(angle, stepReach, height - stepThick),
        ...point(angle, poleRadius, height - stepThick),
      ];

      graphics
        .poly(riser)
        .fill(edge)
        .poly(riser)
        .fill({ color: inkColor, alpha: sideShade })
        .stroke({ color: inkColor, width: 3, join: "round" });
    }

    const top: Array<number> = [...point(from, poleRadius, height)];

    for (const angle of angles) {
      top.push(...point(angle, stepReach, height));
    }

    top.push(...point(to, poleRadius, height));

    graphics
      .poly(top)
      .fill(near ? trimColor : far)
      .stroke({ color: inkColor, width: 3, join: "round" });
  }

  for (let index = spiral.from; index <= spiral.to; index++) {
    order.push(index);
  }

  order.sort(
    (first: number, second: number) =>
      Math.cos(first * stepTurn) - Math.cos(second * stepTurn),
  );

  for (const index of order) {
    if (Math.cos(index * stepTurn) < 0) {
      tread(index);
    }
  }

  drawPole(graphics, spiral, spiral.poleBottom, spiral.poleTop, far);

  for (const index of order) {
    if (Math.cos(index * stepTurn) >= 0) {
      tread(index);
    }
  }
}

function drawPole(
  graphics: Graphics,
  spiral: Spiral,
  bottom: number,
  top: number,
  far: string,
): void {
  const height: number = top - bottom;
  const y: number = spiral.base - top;

  graphics
    .ellipse(
      spiral.x,
      spiral.base - bottom,
      poleRadius * 2,
      poleRadius * 2 * spiral.squash,
    )
    .fill(far)
    .stroke({ color: inkColor, width: 2 })
    .rect(spiral.x - poleRadius, y, poleRadius * 2, height)
    .fill(trimColor)
    .rect(spiral.x + 2, y, poleRadius - 2, height)
    .fill({ color: inkColor, alpha: sideShade })
    .rect(spiral.x - poleRadius, y, poleRadius * 2, height)
    .stroke({ color: inkColor, width: 3 });
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
  stepCount,
  stepRise,
  stepReach,
  poleRadius,
  drawSpiral,
  drawPole,
  sideShade,
  frustum,
  project,
  faceMatrix,
  drawSolid,
  createCurve,
};
export type { Placement, Solid, Spiral, Curve };
