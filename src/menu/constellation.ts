import { Container, Graphics } from "pixi.js";

type Constellation = {
  view: Container;
  update: (amount: number, hover: number, delta: number) => void;
};

type Star = {
  x: number;
  y: number;
  dot: Graphics;
  speed: number;
  phase: number;
};

const glyphOffsets: Array<number> = [55, 179, 303];
const glyphBase: number = 235;
const glyphRise: number = 180;
const glyphSkew: number = -8; // deg
const glyphSegments: Array<Array<Array<number>>> = [
  [
    [10, 8, 90, 8],
    [92, 92, 92, 170],
    [10, 172, 90, 172],
    [8, 92, 8, 170],
    [8, 10, 8, 88],
    [52, 90, 90, 90],
  ],
  [
    [10, 8, 90, 8],
    [10, 172, 90, 172],
    [8, 92, 8, 170],
    [8, 10, 8, 88],
    [10, 90, 48, 90],
  ],
  [
    [10, 8, 90, 8],
    [92, 10, 92, 88],
    [8, 92, 8, 170],
    [8, 10, 8, 88],
    [10, 90, 48, 90],
    [52, 90, 90, 90],
    [65.1, 100, 76.9, 162],
  ],
];
const mergeDistance: number = 8; // logo units
const lineAlpha: number = 0.35;
const lineWidth: number = 1; // px
const starRadius: number = 1.6; // px
const haloRadius: number = 4; // px
const haloAlpha: number = 0.25;
const starColor: string = "#ffffff";
const faintAlpha: number = 0.45;
const hoverAlpha: number = 0.8;
const twinkle: number = 0.4;
const minTwinkleSpeed: number = 0.2; // Hz
const maxTwinkleSpeed: number = 0.6; // Hz

function place(glyph: number, x: number, y: number): Array<number> {
  return [
    glyphOffsets[glyph]! +
      x +
      Math.tan((glyphSkew * Math.PI) / 180) * (y - glyphRise),
    glyphBase + y - glyphRise,
  ];
}

function createConstellation(
  scale: number,
  x: number,
  y: number,
): Constellation {
  const view: Container = new Container();
  const lines: Graphics = new Graphics();
  const stars: Array<Star> = new Array();
  let time: number = 0;

  function starAt(pointX: number, pointY: number): Star {
    const found: Star | undefined = stars.find(
      (star: Star) =>
        Math.hypot(star.x - pointX, star.y - pointY) <= mergeDistance,
    );

    if (found !== undefined) {
      return found;
    }

    const star: Star = {
      x: pointX,
      y: pointY,
      dot: new Graphics(),
      speed:
        minTwinkleSpeed + Math.random() * (maxTwinkleSpeed - minTwinkleSpeed),
      phase: Math.random() * Math.PI * 2,
    };

    stars.push(star);

    return star;
  }

  for (let glyph = 0; glyph < glyphSegments.length; glyph++) {
    for (const segment of glyphSegments[glyph]!) {
      const [fromX, fromY] = place(glyph, segment[0]!, segment[1]!) as [
        number,
        number,
      ];
      const [toX, toY] = place(glyph, segment[2]!, segment[3]!) as [
        number,
        number,
      ];
      const from: Star = starAt(fromX, fromY);
      const to: Star = starAt(toX, toY);

      lines
        .moveTo(from.x * scale, from.y * scale)
        .lineTo(to.x * scale, to.y * scale);
    }
  }

  lines.stroke({ color: starColor, width: lineWidth, alpha: lineAlpha });
  view.addChild(lines);

  for (const star of stars) {
    star.dot
      .circle(0, 0, haloRadius)
      .fill({ color: starColor, alpha: haloAlpha })
      .circle(0, 0, starRadius)
      .fill(starColor);
    star.dot.position.set(star.x * scale, star.y * scale);
    view.addChild(star.dot);
  }

  view.position.set(x, y);
  view.alpha = 0;
  view.visible = false;

  function update(amount: number, hover: number, delta: number): void {
    time += delta;
    view.alpha = amount * (faintAlpha + (hoverAlpha - faintAlpha) * hover);
    view.visible = view.alpha > 0;

    if (!view.visible) {
      return;
    }

    for (const star of stars) {
      star.dot.alpha =
        1 -
        twinkle *
          (0.5 + 0.5 * Math.sin(time * star.speed * Math.PI * 2 + star.phase));
    }
  }

  return { view: view, update: update };
}

export { createConstellation };
export type { Constellation };
