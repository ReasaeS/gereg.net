import { Container, FillGradient, Graphics, Rectangle } from "pixi.js";
import { getTheme, type Theme } from "../theme/theme";
import type { Room, Spot } from "./room";
import {
  arcSteps,
  createCurve,
  drawPole,
  drawSolid,
  drawSpiral,
  frustum,
  poleRadius,
  project,
  sideShade,
  type Curve,
  type Placement,
  type Solid,
  type Spiral,
  stepCount,
  stepRise,
} from "./shapes";

const wallColor: string = "#0d2260";
const ceilingColor: string = "#081a4f";
const floorColor: string = "#0f2459";
const floorLine: string = "#0a1b4a";
const inkColor: string = "#020b30";
const trimColor: string = "#ffffff";
const paneTop: number = 90; // units
const paneBottom: number = 520; // units
const horizonY: number = 450; // units
const mullionGap: number = 300; // units
const floorX: number = 800; // units
const floorY: number = 900; // units
const floorRadiusX: number = 1150; // units
const floorRadiusY: number = 330; // units
const scopeX: number = 1180; // units
const scopeY: number = 690; // units
const deskX: number = 445; // units
const deskY: number = 650; // units
const hatchX: number = 1330; // units
const hatchY: number = 765; // units
const wellRadius: number = 145; // units
const wellSteps: number = 5;
const wellDepth: number = 400; // units
const wellShade: number = 0.25;
const poleAbove: number = 70; // units
const squash: number = floorRadiusY / floorRadiusX;
const eyeY: number = 250; // units
const seaBottom: number = 800; // units
const rafterGap: number = 200; // units
const postGap: number = 100; // units
const legSpread: number = 55; // units
const legTop: number = 110; // units
const legTurn: number = 0.5; // rad
const mountRadius: number = 14; // units
const tubeRadius: number = 16; // units
const tubeLength: number = 160; // units
const tubeBack: number = 0.4;
const tubePitch: number = 0.15; // rad
const eyepieceLength: number = 24; // units
const eyepieceRadius: number = 7; // units
const deskWidth: number = 250; // units
const deskDepth: number = 90; // units
const deskHeight: number = 86; // units
const slabThick: number = 18; // units
const curve: Curve = createCurve(
  floorX,
  floorY,
  floorRadiusX,
  floorRadiusY,
  eyeY,
);

function facingCenter(x: number, y: number): number {
  return -Math.atan2(floorX - x, (floorY - y) / squash);
}

function createLampRoom(): Room {
  const back: Container = new Container();
  const front: Container = new Container();
  const walls: Graphics = new Graphics();
  const frame: Graphics = new Graphics();
  const scope: Container = new Container();
  const scopeArt: Graphics = new Graphics();
  const tube: Graphics = new Graphics();
  const desk: Container = new Container();
  const deskArt: Graphics = new Graphics();
  const well: Graphics = new Graphics();
  const wellMask: Graphics = new Graphics();
  const steps: Graphics = new Graphics();
  const rim: Graphics = new Graphics();
  const pole: Container = new Container();
  const poleArt: Graphics = new Graphics();

  function drawWalls(theme: Theme): void {
    walls.clear().rect(-1000, -2000, 3600, 1401).fill(ceilingColor);

    frame.clear().poly(curve.band(-600, paneTop)).fill(ceilingColor);

    for (const x of curve.around(rafterGap)) {
      frame.moveTo(floorX, -400).lineTo(x, curve.wallY(x, paneTop));
    }

    frame
      .stroke({ color: inkColor, width: 6, alpha: 0.6 })
      .poly(curve.band(paneTop - 14, paneTop + 4))
      .fill(theme.accent)
      .poly(curve.band(470, 476))
      .poly(curve.band(500, 506))
      .fill({ color: inkColor, alpha: 0.85 });

    for (const x of curve.around(postGap)) {
      const top: number = curve.wallY(x, 470);

      frame.rect(x, top, 5 * curve.squeeze(x), curve.wallY(x, 520) - top);
    }

    frame.fill({ color: inkColor, alpha: 0.85 });

    for (const x of curve.around(mullionGap)) {
      const half: number = 10 * curve.squeeze(x);

      frame.poly([
        x - half,
        curve.wallY(x - half, paneTop),
        x + half,
        curve.wallY(x + half, paneTop),
        x + half,
        curve.wallY(x + half, paneBottom),
        x - half,
        curve.wallY(x - half, paneBottom),
      ]);
    }

    frame
      .fill(trimColor)
      .stroke({ color: inkColor, width: 3 })
      .poly(curve.band(paneBottom, paneBottom + 30))
      .fill(trimColor)
      .stroke({ color: inkColor, width: 3 })
      .poly(curve.band(paneBottom + 30, seaBottom))
      .fill(wallColor)
      .ellipse(floorX, floorY, floorRadiusX, floorRadiusY)
      .fill(floorColor);

    for (const share of [0.3, 0.55, 0.8]) {
      frame.ellipse(floorX, floorY, floorRadiusX * share, floorRadiusY * share);
    }

    for (let index = 0; index < 32; index++) {
      const turn: number = (index * Math.PI) / 16;

      frame
        .moveTo(floorX, floorY)
        .lineTo(
          floorX + Math.cos(turn) * floorRadiusX,
          floorY + Math.sin(turn) * floorRadiusY,
        );
    }

    frame
      .stroke({ color: floorLine, width: 4, alpha: 0.8 })
      .ellipse(floorX, floorY, floorRadiusX, floorRadiusY)
      .stroke({ color: inkColor, width: 16, alpha: 0.45 });
  }

  function drawScope(): void {
    const legs: Array<number> = new Array();

    for (let index = 0; index < 3; index++) {
      legs.push(legTurn + (index * Math.PI * 2) / 3);
    }

    legs.sort(
      (first: number, second: number) => Math.sin(first) - Math.sin(second),
    );
    scopeArt.clear();

    for (const turn of legs) {
      const near: boolean = Math.sin(turn) > 0;

      scopeArt
        .moveTo(0, -legTop)
        .lineTo(Math.cos(turn) * legSpread, Math.sin(turn) * legSpread * squash)
        .stroke({
          color: near ? inkColor : ceilingColor,
          width: near ? 6 : 5,
          cap: "round",
        });
    }

    const points: Array<number> = frustum(
      scopeArt,
      mountRadius,
      mountRadius,
      -legTop + 6,
      -legTop - 8,
      squash,
    );

    scopeArt
      .fill(ceilingColor)
      .poly(points)
      .fill({ color: inkColor, alpha: sideShade })
      .stroke({ color: inkColor, width: 2 })
      .ellipse(0, -legTop - 8, mountRadius, mountRadius * squash)
      .fill(ceilingColor)
      .stroke({ color: inkColor, width: 2 });
  }

  function drawTube(theme: Theme): void {
    const facing: number = facingCenter(scopeX, scopeY);
    const sin: number = Math.sin(facing);
    const cos: number = Math.cos(facing);
    const screenX: number = sin * Math.cos(tubePitch);
    const screenY: number =
      -cos * Math.cos(tubePitch) * squash - Math.sin(tubePitch);
    const shown: number = Math.min(Math.hypot(screenX, screenY), 1);
    const cap: number = Math.sqrt(1 - shown * shown);
    const length: number = tubeLength * shown;
    const near: number = -length * tubeBack;
    const far: number = length * (1 - tubeBack);
    const shade: FillGradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: "rgba(255, 255, 255, 0.25)" },
        { offset: 0.3, color: "rgba(255, 255, 255, 0)" },
        { offset: 1, color: "rgba(2, 11, 48, 0.5)" },
      ],
    });

    function body(from: number, to: number, radius: number): Array<number> {
      const points: Array<number> = [from, -radius];

      for (let index = 0; index <= arcSteps; index++) {
        const turn: number = -Math.PI / 2 + (index / arcSteps) * Math.PI;

        points.push(
          to + Math.cos(turn) * radius * cap,
          Math.sin(turn) * radius,
        );
      }

      points.push(from, radius);

      return points;
    }

    function ring(at: number, width: number): Array<number> {
      const points: Array<number> = new Array();

      for (let index = 0; index <= arcSteps; index++) {
        const turn: number = -Math.PI / 2 + (index / arcSteps) * Math.PI;

        points.push(
          at + Math.cos(turn) * tubeRadius * cap,
          Math.sin(turn) * tubeRadius,
        );
      }

      for (let index = arcSteps; index >= 0; index--) {
        const turn: number = -Math.PI / 2 + (index / arcSteps) * Math.PI;

        points.push(
          at + width + Math.cos(turn) * tubeRadius * cap,
          Math.sin(turn) * tubeRadius,
        );
      }

      return points;
    }

    const hull: Array<number> = body(near, far, tubeRadius);
    const eyepiece: Array<number> = body(
      near - eyepieceLength * shown,
      near,
      eyepieceRadius,
    );

    tube
      .clear()
      .poly(hull)
      .fill(theme.accent)
      .poly(hull)
      .fill(shade)
      .stroke({ color: inkColor, width: 3, join: "round" })
      .poly(ring(near + length * 0.3, 8))
      .poly(ring(near + length * 0.75, 8))
      .fill(trimColor)
      .stroke({ color: inkColor, width: 2 })
      .ellipse(near, 0, tubeRadius * cap, tubeRadius)
      .fill(theme.accent)
      .stroke({ color: inkColor, width: 3 })
      .poly(eyepiece)
      .fill(inkColor)
      .stroke({ color: inkColor, width: 2 })
      .ellipse(
        near - eyepieceLength * shown,
        0,
        eyepieceRadius * cap,
        eyepieceRadius,
      )
      .fill(ceilingColor)
      .stroke({ color: trimColor, width: 1.5, alpha: 0.5 });
    tube.position.set(0, -legTop - 12);
    tube.rotation = Math.atan2(screenY, screenX);
  }

  function drawDesk(theme: Theme): void {
    const place: Placement = {
      x: 0,
      y: 0,
      angle: facingCenter(deskX, deskY),
      squash: squash,
    };
    const top: number = deskHeight + slabThick;
    const point = (
      along: number,
      out: number,
      height: number,
    ): [number, number] => project(place, along, out, height);
    const leg = (along: number, out: number): Solid => ({
      place: place,
      along: along,
      width: 12,
      out: out,
      depth: 12,
      bottom: 0,
      height: deskHeight,
    });

    deskArt.clear();

    for (const out of [-deskDepth / 2 + 6, deskDepth / 2 - 18]) {
      for (const along of [-deskWidth / 2 + 20, deskWidth / 2 - 20]) {
        drawSolid(deskArt, leg(along, out), ceilingColor, true);
      }
    }

    drawSolid(
      deskArt,
      {
        place: place,
        along: 0,
        width: deskWidth,
        out: -deskDepth / 2,
        depth: deskDepth,
        bottom: deskHeight,
        height: slabThick,
      },
      ceilingColor,
      true,
    );

    for (const side of [-1, 1]) {
      deskArt
        .poly([
          ...point(side * 2, -24, top + 6),
          ...point(side * 64, -26, top + 1),
          ...point(side * 64, 22, top + 1),
          ...point(side * 2, 24, top + 6),
        ])
        .fill(trimColor)
        .stroke({ color: inkColor, width: 2, join: "round" });

      for (let line = 0; line < 4; line++) {
        const out: number = -14 + line * 8;

        deskArt
          .moveTo(...point(side * 10, out, top + 5))
          .lineTo(...point(side * 54, out, top + 2));
      }

      deskArt.stroke({ color: inkColor, width: 2, alpha: 0.3 });
    }

    const ink: Solid = {
      place: place,
      along: 92,
      width: 18,
      out: -8,
      depth: 18,
      bottom: top,
      height: 14,
    };
    const [quillX, quillY] = point(92, 1, top + 14);

    drawSolid(deskArt, ink, inkColor, true);
    deskArt
      .moveTo(quillX, quillY)
      .lineTo(quillX + 22, quillY - 52)
      .stroke({ color: trimColor, width: 4, cap: "round" })
      .moveTo(quillX + 14, quillY - 32)
      .quadraticCurveTo(quillX + 34, quillY - 47, quillX + 24, quillY - 58)
      .stroke({ color: theme.accent, width: 5, cap: "round" });
  }

  function drawWell(theme: Theme): void {
    const spiral: Spiral = {
      x: hatchX,
      base: hatchY,
      squash: squash,
      lift: -(stepCount - 1) * stepRise,
      from: stepCount - wellSteps,
      to: stepCount - 1,
      poleBottom: -wellDepth,
      poleTop: 0,
    };

    well
      .clear()
      .ellipse(hatchX, hatchY, wellRadius, wellRadius * squash)
      .fill(inkColor);
    wellMask
      .clear()
      .ellipse(hatchX, hatchY, wellRadius, wellRadius * squash)
      .fill("#ffffff");
    steps.clear();
    drawSpiral(steps, spiral, theme.accent, ceilingColor);
    steps
      .ellipse(hatchX, hatchY, wellRadius, wellRadius * squash)
      .fill({ color: inkColor, alpha: wellShade });
    rim
      .clear()
      .ellipse(hatchX, hatchY, wellRadius, wellRadius * squash)
      .stroke({ color: trimColor, width: 4 })
      .ellipse(hatchX, hatchY, wellRadius + 4, (wellRadius + 4) * squash)
      .stroke({ color: inkColor, width: 2 });
    poleArt.clear();
    drawPole(poleArt, { ...spiral, x: 0, base: 0 }, 0, poleAbove, ceilingColor);
    poleArt
      .circle(0, -poleAbove - poleRadius, poleRadius)
      .fill(theme.accent)
      .stroke({ color: inkColor, width: 3 });
  }

  function paint(): void {
    const theme: Theme = getTheme();

    drawWalls(theme);
    drawScope();
    drawTube(theme);
    drawDesk(theme);
    drawWell(theme);
  }

  back.addChild(walls, frame, well, wellMask, steps, rim);
  scope.addChild(scopeArt, tube);
  scope.position.set(scopeX, scopeY);
  scope.zIndex = scopeY;
  desk.addChild(deskArt);
  desk.position.set(deskX, deskY);
  desk.zIndex = deskY;
  steps.mask = wellMask;
  pole.addChild(poleArt);
  pole.position.set(hatchX, hatchY);
  pole.zIndex = hatchY;
  paint();

  const spots: Array<Spot> = [
    {
      name: "Stairs down",
      act: "downstairs",
      area: new Rectangle(
        hatchX - wellRadius,
        hatchY - 110,
        wellRadius * 2,
        160,
      ),
      stand: [hatchX - 140, hatchY + 5],
      tag: [hatchX, hatchY - 100],
    },
    {
      name: "Telescope",
      act: "telescope",
      area: new Rectangle(scopeX - 90, scopeY - 170, 190, 175),
      stand: [scopeX - 90, scopeY + 45],
      tag: [scopeX, scopeY - 190],
    },
    {
      name: "Keeper's log",
      act: "log",
      area: new Rectangle(deskX - 130, deskY - 180, 260, 185),
      stand: [deskX, deskY + 70],
      tag: [deskX, deskY - 200],
    },
  ];

  return {
    subject: "lighthouse.lamp",
    horizon: horizonY,
    back: back,
    front: front,
    props: [scope, desk, pole],
    floor: { x: 800, y: 790, rx: 620, ry: 150 },
    blockers: [
      { x: hatchX, y: hatchY, rx: wellRadius, ry: wellRadius * squash },
      { x: scopeX, y: scopeY, rx: 60, ry: 22 },
      { x: deskX, y: deskY, rx: 130, ry: 30 },
    ],
    spots: spots,
    entries: new Map([["stairs", [hatchX - 140, hatchY + 5]]]),
    update: () => {},
    poke: () => {},
    paint: paint,
  };
}

export { createLampRoom };
