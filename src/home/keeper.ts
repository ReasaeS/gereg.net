import { Circle, Container, FillGradient, Graphics, Rectangle } from "pixi.js";
import { getTheme, type Theme } from "../theme/theme";
import { drawEmote } from "./emotes";
import type { Room, Spot } from "./room";
import {
  drawSolid,
  drawSpiral,
  stepCount,
  faceMatrix,
  frustum,
  type Placement,
  type Solid,
} from "./shapes";

type Note = {
  view: Container;
  age: number; // s
  drift: number; // units
};

const wallColor: string = "#0d2260";
const wallShade: string = "#06123a";
const panelColor: string = "#112a72";
const floorColor: string = "#16357a";
const floorLine: string = "#0f2961";
const inkColor: string = "#020b30";
const trimColor: string = "#ffffff";
const shelfColor: string = "#081a4f";
const brassColor: string = "#e0a93b";
const warmColor: string = "#fff3b0";
const dimColor: string = "#5a5030";
const bookColors: Array<string> = [
  "#8fdcff",
  "#ffd34d",
  "#ffffff",
  "#5b7fe0",
  "#ff8fb1",
];
const bookWidths: Array<number> = [14, 18, 12, 20, 16, 13, 22, 15, 17, 12, 19];
const bookHeights: Array<number> = [62, 70, 55, 66, 72, 58, 64, 68, 52, 60];
const floorX: number = 800; // units
const floorY: number = 900; // units
const floorRadiusX: number = 1150; // units
const floorRadiusY: number = 360; // units
const doorX: number = 190; // units
const doorBottom: number = 592; // units
const doorHalf: number = 75; // units
const doorHeight: number = 330; // units
const shelfX: number = 425; // units
const shelfTop: number = 220; // units
const shelfBottom: number = 562; // units
const windowX: number = 800; // units
const windowY: number = 300; // units
const windowRadius: number = 120; // units
const horizonShare: number = 0.4;
const clockX: number = 1050; // units
const clockY: number = 230; // units
const clockRadius: number = 46; // units
const radioX: number = 1060; // units
const stairsX: number = 1380; // units
const stairsBase: number = 630; // units
const firstTread: number = 40; // units
const stairsTop: number = 34; // units
const lanternX: number = 600; // units
const lanternY: number = 110; // units
const lanternBars: number = 4;
const glassRadius: number = 18; // units
const twistRate: number = 0.13; // Hz
const twistReach: number = 0.9; // rad
const noteEvery: number = 1.3; // s
const noteLife: number = 2.8; // s
const noteRise: number = 120; // units
const noteSize: number = 26; // units
const sway: number = 0.8; // Hz
const eyeY: number = 250; // units
const bendStep: number = 8; // units
const bandStep: number = 20; // units
const ringSteps: number = 48;
const archSteps: number = 24;
const stripeGap: number = 80; // units
const wallLeft: number = -1000; // units
const wallRight: number = 2600; // units
const curveShade: number = 0.5;
const shelfDepth: number = 56; // units
const capDepth: number = 66; // units
const tableDepth: number = 90; // units
const tableTop: number = 80; // units
const slabHeight: number = 14; // units
const radioOut: number = 20; // units
const radioDepth: number = 50; // units
const radioHeight: number = 78; // units
const clockDepth: number = 10; // units

function wallAngle(x: number): number {
  return Math.asin(Math.min(Math.max((x - floorX) / floorRadiusX, -1), 1));
}

function wallBase(x: number): number {
  return floorY - floorRadiusY * Math.cos(wallAngle(x));
}

function wallPlace(x: number): Placement {
  return {
    x: x,
    y: wallBase(x),
    angle: wallAngle(x),
    squash: floorRadiusY / floorRadiusX,
  };
}

function dip(x: number): number {
  const lean: number = Math.min(Math.abs(x - floorX) / floorRadiusX, 1);

  return floorRadiusY * (1 - Math.sqrt(1 - lean * lean));
}

function bow(y: number): number {
  return (y - eyeY) / (floorY - floorRadiusY - eyeY);
}

function wallY(x: number, y: number): number {
  return y + bow(y) * dip(x);
}

function squeeze(anchor: number): number {
  const lean: number = Math.min(Math.abs(anchor - floorX) / floorRadiusX, 1);

  return Math.sqrt(1 - lean * lean);
}

function bendPoint(x: number, y: number, anchor: number): [number, number] {
  const bentX: number = anchor + (x - anchor) * squeeze(anchor);

  return [bentX, y + bow(y) * (dip(bentX) - dip(anchor))];
}

function bend(
  points: Array<number>,
  anchor: number,
  closed: boolean,
  originX: number,
  originY: number,
): Array<number> {
  const result: Array<number> = new Array();
  const count: number = points.length / 2;
  const segments: number = closed ? count : count - 1;

  function add(x: number, y: number): void {
    const [bentX, bentY] = bendPoint(x + originX, y + originY, anchor);

    result.push(bentX - originX, bentY - originY);
  }

  for (let index = 0; index < segments; index++) {
    const next: number = (index + 1) % count;
    const fromX: number = points[index * 2]!;
    const fromY: number = points[index * 2 + 1]!;
    const toX: number = points[next * 2]!;
    const toY: number = points[next * 2 + 1]!;
    const pieces: number = Math.max(
      Math.ceil(Math.hypot(toX - fromX, toY - fromY) / bendStep),
      1,
    );

    for (let piece = 0; piece < pieces; piece++) {
      const along: number = piece / pieces;

      add(fromX + (toX - fromX) * along, fromY + (toY - fromY) * along);
    }
  }

  if (!closed) {
    add(points[points.length - 2]!, points[points.length - 1]!);
  }

  return result;
}

function ring(x: number, y: number, radius: number): Array<number> {
  const points: Array<number> = new Array();

  for (let index = 0; index < ringSteps; index++) {
    const angle: number = (index / ringSteps) * Math.PI * 2;

    points.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }

  return points;
}

function arch(
  x: number,
  bottom: number,
  top: number,
  half: number,
): Array<number> {
  const points: Array<number> = [x - half, bottom];

  for (let index = 0; index <= archSteps; index++) {
    const angle: number = Math.PI + (index / archSteps) * Math.PI;

    points.push(x + Math.cos(angle) * half, top + Math.sin(angle) * half);
  }

  points.push(x + half, bottom);

  return points;
}

function box(
  x: number,
  y: number,
  width: number,
  height: number,
): Array<number> {
  return [x, y, x + width, y, x + width, y + height, x, y + height];
}

function band(top: number, bottom: number): Array<number> {
  const points: Array<number> = new Array();

  for (let x = wallLeft; x <= wallRight; x += bandStep) {
    points.push(x, wallY(x, top));
  }

  for (let x = wallRight; x >= wallLeft; x -= bandStep) {
    points.push(x, wallY(x, bottom));
  }

  return points;
}

function trace(graphics: Graphics, points: Array<number>): void {
  graphics.moveTo(points[0]!, points[1]!);

  for (let index = 2; index < points.length; index += 2) {
    graphics.lineTo(points[index]!, points[index + 1]!);
  }
}

function createKeeperRoom(): Room {
  const back: Container = new Container();
  const front: Container = new Container();
  const walls: Graphics = new Graphics();
  const furniture: Graphics = new Graphics();
  const view: Container = new Container();
  const hole: Graphics = new Graphics();
  const frame: Graphics = new Graphics();
  const hands: Graphics = new Graphics();
  const dial: Graphics = new Graphics();
  const shelfBody: Graphics = new Graphics();
  const shelfFront: Graphics = new Graphics();
  const shelfCap: Graphics = new Graphics();
  const clockBack: Graphics = new Graphics();
  const clockFront: Graphics = new Graphics();
  const radioBody: Graphics = new Graphics();
  const radioFront: Graphics = new Graphics();
  const shelfPlace: Placement = wallPlace(shelfX);
  const clockPlace: Placement = wallPlace(clockX);
  const clockLift: number = wallBase(clockX) - clockY;
  const radioPlace: Placement = wallPlace(radioX);
  const lantern: Container = new Container();
  const lanternArt: Graphics = new Graphics();
  const lanternGlass: Graphics = new Graphics();
  const lanternFoot: Graphics = new Graphics();
  const lanternTilt: number =
    (floorRadiusY / floorRadiusX) * Math.abs(bow(lanternY));
  const stairs: Graphics = new Graphics();
  const shade: Graphics = new Graphics();
  const notes: Array<Note> = new Array();
  const noteLayer: Container = new Container();
  let radioOn: boolean = true;
  let noteClock: number = 0;
  let time: number = 0;

  function drawWalls(theme: Theme): void {
    const left: FillGradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: "rgba(2, 11, 48, 0.9)" },
        { offset: 1, color: "rgba(2, 11, 48, 0)" },
      ],
    });
    const right: FillGradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: "rgba(2, 11, 48, 0)" },
        { offset: 1, color: "rgba(2, 11, 48, 0.9)" },
      ],
    });

    const span: number = wallRight - wallLeft;
    const at = (x: number): number => (x - wallLeft) / span;
    const round: FillGradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: at(-200), color: `rgba(2, 11, 48, ${curveShade})` },
        { offset: at(450), color: "rgba(2, 11, 48, 0)" },
        { offset: at(1150), color: "rgba(2, 11, 48, 0)" },
        { offset: at(1800), color: `rgba(2, 11, 48, ${curveShade})` },
      ],
    });
    const turn: number = stripeGap / floorRadiusX;
    const stripes: number = Math.floor(Math.PI / 2 / turn);

    walls.clear().rect(wallLeft, -600, span, 2200).fill(wallColor);

    for (let index = -stripes; index <= stripes; index++) {
      const x: number = floorX + Math.sin(index * turn) * floorRadiusX;

      walls.moveTo(x, wallY(x, 46)).lineTo(x, wallY(x, 430));
    }

    walls
      .stroke({ color: wallShade, width: 3, alpha: 0.45 })
      .poly(band(-600, 46))
      .fill(wallShade)
      .poly(band(20, 46))
      .fill(inkColor)
      .poly(band(430, 630))
      .fill(panelColor)
      .poly(band(424, 434))
      .fill(theme.accent)
      .poly(band(436, 439))
      .fill({ color: trimColor, alpha: 0.6 })
      .rect(wallLeft, -600, span, 1300)
      .fill(round)
      .ellipse(floorX, floorY, floorRadiusX, floorRadiusY)
      .fill(floorColor);

    for (const share of [0.25, 0.45, 0.65, 0.85]) {
      walls.ellipse(floorX, floorY, floorRadiusX * share, floorRadiusY * share);
    }

    for (let index = 0; index < 20; index++) {
      const angle: number = (index * Math.PI) / 10;

      walls
        .moveTo(floorX, floorY)
        .lineTo(
          floorX + Math.cos(angle) * floorRadiusX,
          floorY + Math.sin(angle) * floorRadiusY,
        );
    }

    walls
      .stroke({ color: floorLine, width: 4, alpha: 0.7 })
      .ellipse(floorX, floorY, floorRadiusX, floorRadiusY)
      .stroke({ color: inkColor, width: 16, alpha: 0.45 })
      .ellipse(225, 640, 80, 18)
      .fill({ color: theme.accent, alpha: 0.55 });
    shade
      .clear()
      .rect(-1000, -600, 1300, 1600)
      .fill(left)
      .rect(1300, -600, 1300, 1600)
      .fill(right);
  }

  function drawDoor(theme: Theme): void {
    const top: number = doorBottom - doorHeight + doorHalf;
    const outer: number = doorHalf + 16;

    const shape = (points: Array<number>, closed: boolean): Array<number> =>
      bend(points, doorX, closed, 0, 0);
    const [knobX, knobY] = bendPoint(
      doorX + doorHalf - 22,
      doorBottom - 150,
      doorX,
    );

    furniture
      .poly(shape(arch(doorX, doorBottom, top, outer), true))
      .fill(trimColor)
      .stroke({ color: inkColor, width: 4 })
      .poly(shape(arch(doorX, doorBottom, top, doorHalf), true))
      .fill(theme.accent)
      .stroke({ color: inkColor, width: 4 });

    for (const side of [-1, 1]) {
      const x: number = doorX + (side * doorHalf) / 3;

      trace(furniture, shape([x, top + 50, x, doorBottom], false));
    }

    furniture
      .stroke({ color: inkColor, width: 3, alpha: 0.35 })
      .poly(shape(ring(doorX, top + 8, 26), true))
      .fill(theme.skyMiddle)
      .stroke({ color: trimColor, width: 6 })
      .poly(shape(ring(doorX, top + 8, 30), true))
      .stroke({ color: inkColor, width: 2 })
      .ellipse(knobX, knobY, 7 * squeeze(doorX), 7)
      .fill(brassColor)
      .stroke({ color: inkColor, width: 2 });
  }

  function drawShelf(theme: Theme): void {
    const left: number = -100;
    const top: number = shelfTop - shelfBottom;
    const rowHeight: number = (-top - 30) / 4;
    let book: number = 0;

    shelfBody.clear();
    drawSolid(
      shelfBody,
      {
        place: shelfPlace,
        along: 0,
        width: 200,
        out: 0,
        depth: shelfDepth,
        bottom: 0,
        height: -top,
      },
      shelfColor,
      false,
    );
    shelfFront
      .clear()
      .rect(left, top, 200, -top)
      .fill(shelfColor)
      .stroke({ color: inkColor, width: 4 });

    for (let row = 0; row < 4; row++) {
      const base: number = top + 20 + (row + 1) * rowHeight;
      let x: number = left + 12;

      while (x < left + 178) {
        const width: number = bookWidths[book % bookWidths.length]!;
        const height: number = bookHeights[(book * 3) % bookHeights.length]!;
        const color: string =
          book % 6 === 0 ? theme.accent : bookColors[book % bookColors.length]!;

        if (x + width > left + 188 || (row === 2 && book % 7 === 3)) {
          x += width;
          book++;
          continue;
        }

        shelfFront
          .rect(
            x,
            base - 8 - Math.min(height, rowHeight - 14),
            width - 2,
            Math.min(height, rowHeight - 14),
          )
          .fill(color)
          .stroke({ color: inkColor, width: 2 });
        x += width;
        book++;
      }

      shelfFront
        .rect(left + 6, base - 8, 188, 8)
        .fill({ color: trimColor, alpha: 0.85 });
    }

    shelfCap.clear();
    drawSolid(
      shelfCap,
      {
        place: shelfPlace,
        along: 0,
        width: 216,
        out: 0,
        depth: capDepth,
        bottom: -top - 8,
        height: 16,
      },
      trimColor,
      true,
    );
  }

  function drawWindow(): void {
    const glass = (points: Array<number>): Array<number> =>
      bend(points, windowX, true, windowX, windowY);

    hole
      .clear()
      .poly(glass(ring(0, 0, windowRadius)))
      .fill("#ffffff");
    frame
      .clear()
      .poly(glass(box(-windowRadius, -3, windowRadius * 2, 6)))
      .poly(glass(box(-3, -windowRadius, 6, windowRadius * 2)))
      .fill(trimColor)
      .poly(glass(ring(0, 0, windowRadius + 2)))
      .stroke({ color: trimColor, width: 24 })
      .poly(glass(ring(0, 0, windowRadius + 14)))
      .stroke({ color: inkColor, width: 4 })
      .poly(glass(ring(0, 0, windowRadius - 10)))
      .stroke({ color: inkColor, width: 4 });

    for (let index = 0; index < 8; index++) {
      const angle: number = (index * Math.PI) / 4 + Math.PI / 8;
      const [studX, studY] = bendPoint(
        windowX + Math.cos(angle) * (windowRadius + 2),
        windowY + Math.sin(angle) * (windowRadius + 2),
        windowX,
      );

      frame.circle(studX - windowX, studY - windowY, 4).fill(brassColor);
    }
  }

  function drawClockFace(): void {
    clockBack
      .clear()
      .circle(0, 0, clockRadius + 6)
      .fill(shelfColor)
      .stroke({ color: inkColor, width: 4 });
    clockFront
      .clear()
      .circle(0, 0, clockRadius + 6)
      .fill(shelfColor)
      .stroke({ color: inkColor, width: 4 })
      .circle(0, 0, clockRadius)
      .fill(trimColor);

    for (let index = 0; index < 12; index++) {
      const angle: number = (index * Math.PI) / 6;
      const inner: number =
        index % 3 === 0 ? clockRadius - 12 : clockRadius - 7;

      clockFront
        .moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        .lineTo(
          Math.cos(angle) * (clockRadius - 3),
          Math.sin(angle) * (clockRadius - 3),
        );
    }

    clockFront.stroke({ color: inkColor, width: 3 });
  }

  function drawRadio(theme: Theme): void {
    const leg = (along: number, out: number): Solid => ({
      place: radioPlace,
      along: along,
      width: 10,
      out: out,
      depth: 10,
      bottom: 0,
      height: tableTop - slabHeight,
    });

    radioBody.clear();

    for (const out of [8, tableDepth - 18]) {
      for (const along of [-70, 70]) {
        drawSolid(radioBody, leg(along, out), shelfColor, true);
      }
    }

    drawSolid(
      radioBody,
      {
        place: radioPlace,
        along: 0,
        width: 170,
        out: 0,
        depth: tableDepth,
        bottom: tableTop - slabHeight,
        height: slabHeight,
      },
      trimColor,
      true,
    );
    drawSolid(
      radioBody,
      {
        place: radioPlace,
        along: 0,
        width: 120,
        out: radioOut,
        depth: radioDepth,
        bottom: tableTop,
        height: radioHeight,
      },
      theme.accent,
      false,
    );
    radioFront
      .clear()
      .moveTo(40, -radioHeight + 2)
      .lineTo(72, -140)
      .stroke({ color: inkColor, width: 3 })
      .circle(72, -140, 5)
      .fill(theme.accent)
      .roundRect(-60, -radioHeight, 120, radioHeight, 8)
      .fill(theme.accent)
      .stroke({ color: inkColor, width: 4 })
      .circle(-24, -39, 24)
      .fill({ color: inkColor, alpha: 0.8 })
      .circle(-24, -39, 16)
      .circle(-24, -39, 8)
      .stroke({ color: trimColor, width: 2, alpha: 0.35 })
      .circle(18, -18, 7)
      .circle(40, -18, 7)
      .fill(trimColor)
      .stroke({ color: inkColor, width: 2 });
  }

  function drawDial(): void {
    dial
      .clear()
      .roundRect(8, -62, 42, 18, 4)
      .fill(radioOn ? warmColor : dimColor)
      .stroke({ color: inkColor, width: 2 })
      .rect(14 + (radioOn ? 18 : 6), -60, 3, 14)
      .fill(getTheme().accent);
  }

  function drawStairs(current: Theme): void {
    const squash: number = floorRadiusY / floorRadiusX;

    stairs.clear();
    drawSpiral(
      stairs,
      {
        x: stairsX,
        base: stairsBase,
        squash: squash,
        lift: firstTread,
        from: 0,
        to: stepCount - 1,
        poleBottom: 0,
        poleTop: stairsBase - stairsTop,
      },
      current.accent,
      shelfColor,
    );
  }

  function drawLantern(): void {
    const round: FillGradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: "rgba(2, 11, 48, 0.45)" },
        { offset: 0.35, color: "rgba(2, 11, 48, 0)" },
        { offset: 1, color: "rgba(2, 11, 48, 0.6)" },
      ],
    });

    function solid(
      graphics: Graphics,
      bottomRadius: number,
      topRadius: number,
      bottom: number,
      top: number,
      color: string,
    ): void {
      const points: Array<number> = frustum(
        graphics,
        bottomRadius,
        topRadius,
        bottom,
        top,
        lanternTilt,
      );

      graphics
        .fill(color)
        .poly(points)
        .fill(round)
        .stroke({ color: inkColor, width: 2, join: "round" });
    }

    lanternArt
      .clear()
      .moveTo(0, -lanternY - 600)
      .lineTo(0, -44)
      .stroke({ color: inkColor, width: 3 });
    solid(lanternArt, 24, 24, -26, -32, shelfColor);
    lanternArt
      .ellipse(0, -32, 24, 24 * lanternTilt)
      .fill(shelfColor)
      .stroke({ color: inkColor, width: 2 });
    solid(lanternArt, 24, 6, -30, -44, shelfColor);
    lanternArt
      .ellipse(0, -44, 6, 6 * lanternTilt)
      .fill(shelfColor)
      .stroke({ color: inkColor, width: 2 })
      .circle(0, -48, 6)
      .stroke({ color: inkColor, width: 3 });
    lanternFoot.clear();

    for (const [radius, alpha] of [
      [140, 0.06],
      [90, 0.1],
      [50, 0.18],
    ] as Array<[number, number]>) {
      lanternFoot.circle(0, 8, radius).fill({ color: warmColor, alpha: alpha });
    }

    solid(lanternFoot, 2, 10, 42, 30, shelfColor);
    solid(lanternFoot, 22, 22, 30, 22, shelfColor);
    lanternFoot
      .ellipse(0, 22, 22, 22 * lanternTilt)
      .fill(shelfColor)
      .stroke({ color: inkColor, width: 2 });
  }

  function drawGlass(twist: number): void {
    const points: Array<number> = frustum(
      lanternGlass.clear(),
      glassRadius,
      glassRadius,
      24,
      -28,
      lanternTilt,
    );

    lanternGlass.fill(warmColor);

    for (const front of [false, true]) {
      for (let index = 0; index < lanternBars; index++) {
        const turn: number = twist + (index / lanternBars) * Math.PI * 2;
        const facing: number = Math.sin(turn);

        if (facing > 0 !== front) {
          continue;
        }

        const x: number = Math.cos(turn) * glassRadius;
        const lean: number = facing * glassRadius * lanternTilt;

        lanternGlass
          .moveTo(x, -28 + lean)
          .lineTo(x, 24 + lean)
          .stroke({
            color: inkColor,
            width: front ? 3 : 2,
            alpha: front ? 0.4 + 0.6 * facing : 0.25,
          });
      }

      if (!front) {
        lanternGlass
          .ellipse(0, 4, 5, 10)
          .fill("#ffffff")
          .ellipse(0, 4, 9, 15)
          .fill({ color: "#ffffff", alpha: 0.35 });
      }
    }

    lanternGlass
      .poly(points)
      .stroke({ color: inkColor, width: 2, join: "round" });
  }

  function paint(): void {
    const current: Theme = getTheme();

    drawWalls(current);
    furniture.clear();
    drawDoor(current);
    drawShelf(current);
    drawClockFace();
    drawRadio(current);
    drawWindow();
    drawStairs(current);
    drawLantern();
    drawDial();
  }

  function drawHands(): void {
    const now: Date = new Date();
    const seconds: number = now.getSeconds();
    const minutes: number = now.getMinutes() + seconds / 60;
    const hours: number = (now.getHours() % 12) + minutes / 60;

    function hand(turn: number, length: number): void {
      const angle: number = turn * Math.PI * 2 - Math.PI / 2;

      hands
        .moveTo(0, 0)
        .lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
    }

    hands.clear();
    hand(hours / 12, 22);
    hands.stroke({ color: inkColor, width: 6, cap: "round" });
    hand(minutes / 60, 34);
    hands.stroke({ color: inkColor, width: 4, cap: "round" });
    hand(seconds / 60, 38);
    hands
      .stroke({ color: getTheme().accent, width: 2, cap: "round" })
      .circle(0, 0, 4)
      .fill(getTheme().accent);
  }

  function spawnNote(): void {
    const view: Container = drawEmote("note", noteSize);

    noteLayer.addChild(view);
    notes.push({ view: view, age: 0, drift: Math.random() * 2 - 1 });
  }

  function update(delta: number): void {
    time += delta;
    drawHands();
    lantern.rotation = Math.sin(time * sway * Math.PI * 2) * 0.03;
    drawGlass(Math.sin(time * twistRate * Math.PI * 2) * twistReach);

    if (radioOn) {
      noteClock -= delta;

      if (noteClock <= 0) {
        noteClock = noteEvery;
        spawnNote();
      }
    }

    for (let index = notes.length - 1; index >= 0; index--) {
      const note: Note = notes[index]!;
      const along: number = note.age / noteLife;

      note.age += delta;
      note.view.position.set(
        radioX - 24 + note.drift * 40 * along + Math.sin(note.age * 3) * 8,
        380 - noteRise * along,
      );
      note.view.alpha = Math.min(along * 5, 1) * (1 - along);

      if (note.age >= noteLife) {
        note.view.destroy();
        notes.splice(index, 1);
      }
    }
  }

  function poke(act: string): void {
    if (act === "radio:on" || act === "radio:off") {
      radioOn = act === "radio:on";
      noteClock = 0;
      drawDial();
    }
  }

  view.position.set(windowX, windowY);
  view.addChild(frame);
  hole.position.set(windowX, windowY);
  walls.setMask({ mask: hole, inverse: true });
  lantern.addChild(lanternFoot, lanternGlass, lanternArt);
  lantern.position.set(lanternX, lanternY);
  shelfFront.setFromMatrix(faceMatrix(shelfPlace, shelfDepth, 0));
  clockBack.setFromMatrix(faceMatrix(clockPlace, 0, clockLift));
  clockFront.setFromMatrix(faceMatrix(clockPlace, clockDepth, clockLift));
  hands.setFromMatrix(faceMatrix(clockPlace, clockDepth, clockLift));
  radioFront.setFromMatrix(
    faceMatrix(radioPlace, radioOut + radioDepth, tableTop),
  );
  dial.setFromMatrix(faceMatrix(radioPlace, radioOut + radioDepth, tableTop));
  back.addChild(
    hole,
    walls,
    furniture,
    shelfBody,
    shelfFront,
    shelfCap,
    clockBack,
    clockFront,
    hands,
    radioBody,
    radioFront,
    dial,
    view,
    stairs,
    lantern,
    noteLayer,
  );
  front.addChild(shade);
  paint();

  const spots: Array<Spot> = [
    {
      name: "Door",
      act: "exit",
      area: new Rectangle(
        doorX - 95,
        doorBottom - doorHeight - 20,
        190,
        doorHeight + 30,
      ),
      stand: [250, 690],
      tag: [doorX, doorBottom - doorHeight - 40],
    },
    {
      name: "Bookshelf",
      act: "books",
      area: new Rectangle(
        shelfX - 108,
        shelfTop - 10,
        216,
        shelfBottom - shelfTop + 10,
      ),
      stand: [shelfX, 680],
      tag: [shelfX, shelfTop - 30],
    },
    {
      name: "Window",
      act: "window",
      area: new Circle(windowX, windowY, windowRadius + 16),
      stand: [windowX, 660],
      tag: [windowX, windowY - windowRadius - 34],
    },
    {
      name: "Clock",
      act: "clock",
      area: new Circle(clockX, clockY, clockRadius + 10),
      stand: [clockX, 670],
      tag: [clockX, clockY - clockRadius - 26],
    },
    {
      name: "Radio",
      act: "radio",
      area: new Rectangle(radioX - 85, 330, 170, 235),
      stand: [radioX, 680],
      tag: [radioX, 310],
    },
    {
      name: "Stairs up",
      act: "upstairs",
      area: new Rectangle(stairsX - 140, 40, 280, 640),
      stand: [1330, 700],
      tag: [stairsX, 70],
    },
  ];

  return {
    subject: "lighthouse",
    horizon: windowY + windowRadius * horizonShare,
    back: back,
    front: front,
    props: new Array(),
    floor: { x: 800, y: 790, rx: 640, ry: 165 },
    blockers: new Array(),
    spots: spots,
    entries: new Map([
      ["door", [250, 700]],
      ["stairs", [1330, 710]],
    ]),
    update: update,
    poke: poke,
    paint: paint,
  };
}

export { createKeeperRoom };
