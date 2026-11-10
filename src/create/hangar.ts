import type {
  Build,
  Core,
  Engines,
  Fins,
  Guns,
  Hull,
  Livery,
  Wings,
} from "./types";
import {
  createCanvas,
  inEllipse,
  inPolygon,
  inRect,
  paint,
  render,
  tone,
  type Canvas,
} from "./forge";
import { createPixels, encodePixels, type Pixels } from "../editor/pixels";
import type { Option } from "../ui/widgets";

type Part<T> = Option<T>;

const hullRegion: number = 1;
const trimRegion: number = 2;
const metalRegion: number = 3;
const glowRegion: number = 4;
const edgeMargin: number = 0.03;
const outlineShade: number = -0.78;

const hulls: Array<Part<Hull>> = [
  { value: "dart", label: "Dart" },
  { value: "pod", label: "Pod" },
  { value: "block", label: "Block" },
  { value: "manta", label: "Manta" },
  { value: "needle", label: "Needle" },
  { value: "orb", label: "Orb" },
];
const wingParts: Array<Part<Wings>> = [
  { value: "none", label: "None" },
  { value: "swept", label: "Swept" },
  { value: "delta", label: "Delta" },
  { value: "straight", label: "Straight" },
  { value: "twin", label: "Twin" },
  { value: "ring", label: "Ring" },
  { value: "blade", label: "Blade" },
];
const engineParts: Array<Part<Engines>> = [
  { value: "none", label: "None" },
  { value: "nozzle", label: "Nozzles" },
  { value: "nacelle", label: "Nacelles" },
  { value: "booster", label: "Booster" },
];
const gunParts: Array<Part<Guns>> = [
  { value: "none", label: "None" },
  { value: "cannons", label: "Cannons" },
  { value: "spike", label: "Spike" },
  { value: "prongs", label: "Prongs" },
  { value: "array", label: "Array" },
];
const finParts: Array<Part<Fins>> = [
  { value: "none", label: "None" },
  { value: "tail", label: "Tail fins" },
  { value: "spines", label: "Spines" },
  { value: "horns", label: "Horns" },
  { value: "ridge", label: "Ridge" },
];
const coreParts: Array<Part<Core>> = [
  { value: "none", label: "None" },
  { value: "eye", label: "Eye" },
  { value: "slit", label: "Slit" },
  { value: "cross", label: "Cross" },
  { value: "twin", label: "Twin eyes" },
];
const liveries: Array<Part<Livery>> = [
  { value: "plain", label: "Plain" },
  { value: "stripe", label: "Stripe" },
  { value: "bands", label: "Bands" },
  { value: "panels", label: "Panels" },
  { value: "twotone", label: "Two-tone" },
];
const hullColors: Array<string> = [
  "#c9d3e6",
  "#6b7a99",
  "#3d4766",
  "#8a3d4f",
  "#3d6b5a",
  "#a8823d",
  "#5a3d8a",
  "#2b2f45",
];
const trimColors: Array<string> = [
  "#ff3b3b",
  "#ffb347",
  "#fff27a",
  "#7ae38f",
  "#7ad8ff",
  "#3b82ff",
  "#b48aff",
  "#ff6fd8",
];
const metalColors: Array<string> = [
  "#2a2e3d",
  "#4a4f63",
  "#6e7385",
  "#3d2a2a",
  "#2a3d36",
  "#1d1d2b",
];
const glowColors: Array<string> = [
  "#ffffff",
  "#7ad8ff",
  "#7ae38f",
  "#fff27a",
  "#ff8a80",
  "#ff6fd8",
  "#b48aff",
];

function defaultBuild(): Build {
  return {
    hull: "dart",
    length: 70,
    width: 30,
    wings: "swept",
    span: 75,
    sweep: 40,
    wingSpot: 0,
    engines: "nozzle",
    engineCount: 2,
    engineSize: 100,
    guns: "cannons",
    gunLength: 100,
    fins: "none",
    core: "eye",
    coreSpot: 20,
    livery: "stripe",
    hullColor: "#6b7a99",
    trimColor: "#ff3b3b",
    metalColor: "#2a2e3d",
    glowColor: "#7ad8ff",
  };
}

function pickFrom<T>(list: Array<T>, random: () => number): T {
  return list[Math.floor(random() * list.length)]!;
}

function between(
  min: number,
  max: number,
  step: number,
  random: () => number,
): number {
  return min + Math.floor(random() * ((max - min) / step + 1)) * step;
}

function randomBuild(random: () => number = Math.random): Build {
  const value: <T>(list: Array<Part<T>>) => T = <T>(list: Array<Part<T>>): T =>
    pickFrom(list, random).value;

  return {
    hull: value(hulls),
    length: between(45, 90, 5, random),
    width: between(15, 55, 5, random),
    wings: value(wingParts),
    span: between(35, 95, 5, random),
    sweep: between(-60, 80, 10, random),
    wingSpot: between(-40, 40, 10, random),
    engines: value(engineParts),
    engineCount: between(1, 3, 1, random),
    engineSize: between(60, 140, 10, random),
    guns: value(gunParts),
    gunLength: between(60, 140, 10, random),
    fins: value(finParts),
    core: value(coreParts),
    coreSpot: between(-40, 50, 10, random),
    livery: value(liveries),
    hullColor: pickFrom(hullColors, random),
    trimColor: pickFrom(trimColors, random),
    metalColor: pickFrom(metalColors, random),
    glowColor: pickFrom(glowColors, random),
  };
}

function valid<T>(list: Array<Part<T>>, value: T): T {
  return list.some((part: Part<T>) => part.value === value)
    ? value
    : list[0]!.value;
}

function number(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function repairBuild(build: Partial<Build> | undefined): Build {
  const fallback: Build = defaultBuild();
  const source: Partial<Build> = build ?? {};

  return {
    hull: valid(hulls, source.hull ?? fallback.hull),
    length: number(source.length, fallback.length),
    width: number(source.width, fallback.width),
    wings: valid(wingParts, source.wings ?? fallback.wings),
    span: number(source.span, fallback.span),
    sweep: number(source.sweep, fallback.sweep),
    wingSpot: number(source.wingSpot, fallback.wingSpot),
    engines: valid(engineParts, source.engines ?? fallback.engines),
    engineCount: number(source.engineCount, fallback.engineCount),
    engineSize: number(source.engineSize, fallback.engineSize),
    guns: valid(gunParts, source.guns ?? fallback.guns),
    gunLength: number(source.gunLength, fallback.gunLength),
    fins: valid(finParts, source.fins ?? fallback.fins),
    core: valid(coreParts, source.core ?? fallback.core),
    coreSpot: number(source.coreSpot, fallback.coreSpot),
    livery: valid(liveries, source.livery ?? fallback.livery),
    hullColor: color(source.hullColor, fallback.hullColor),
    trimColor: color(source.trimColor, fallback.trimColor),
    metalColor: color(source.metalColor, fallback.metalColor),
    glowColor: color(source.glowColor, fallback.glowColor),
  };
}

function clampV(v: number): number {
  return Math.min(Math.max(v, edgeMargin), 1 - edgeMargin);
}

function drawHull(canvas: Canvas, build: Build, region: number): void {
  const length: number = build.length / 100;
  const width: number = build.width / 100;
  const top: number = 0.5 - length / 2;
  const bottom: number = 0.5 + length / 2;
  const shapes: Record<Hull, (u: number, v: number) => boolean> = {
    dart: (u: number, v: number) =>
      inPolygon(
        [
          [-1, bottom],
          [0, bottom],
          [width * 0.35, bottom - length * 0.25],
          [width, top + length * 0.35],
          [width * 0.85, top],
          [-1, top],
        ],
        u,
        v,
      ),
    pod: (u: number, v: number) => inEllipse(0, 0.5, width, length / 2, u, v),
    block: (u: number, v: number) =>
      inPolygon(
        [
          [-1, bottom],
          [width * 0.55, bottom],
          [width, bottom - length * 0.18],
          [width, top + length * 0.12],
          [width * 0.75, top],
          [-1, top],
        ],
        u,
        v,
      ),
    manta: (u: number, v: number) =>
      inPolygon(
        [
          [-1, bottom],
          [0, bottom],
          [Math.min(width * 1.5, 0.95), top + length * 0.35],
          [Math.min(width * 1.3, 0.9), top + length * 0.08],
          [width * 0.5, top + length * 0.2],
          [-1, top],
        ],
        u,
        v,
      ),
    needle: (u: number, v: number) =>
      inPolygon(
        [
          [-1, bottom],
          [0, bottom],
          [width * 0.4, 0.5],
          [width * 0.5, top + length * 0.1],
          [width * 0.3, top],
          [-1, top],
        ],
        u,
        v,
      ),
    orb: (u: number, v: number) => {
      const radius: number = Math.min(width * 1.2, length / 2);

      return inEllipse(0, 0.5, radius, radius, u, v);
    },
  };

  paint(canvas, region, shapes[build.hull]);
}

function wingSpot(build: Build): number {
  return 0.5 + (build.wingSpot / 100) * 0.3;
}

function sweptWing(
  root: number,
  anchor: number,
  span: number,
  sweep: number,
  chord: number,
): (u: number, v: number) => boolean {
  const tip: number = anchor - sweep * 0.25;

  return (u: number, v: number) =>
    inPolygon(
      [
        [root, anchor - chord],
        [span, tip - chord * 0.35],
        [span, tip + chord * 0.35],
        [root, anchor + chord],
      ],
      u,
      v,
    );
}

function drawWings(canvas: Canvas, build: Build): void {
  const root: number = (build.width / 100) * 0.4;
  const anchor: number = wingSpot(build);
  const span: number = Math.min(build.span / 100, 1 - edgeMargin);
  const sweep: number = build.sweep / 100;
  const shapes: Record<Wings, (u: number, v: number) => boolean> = {
    none: () => false,
    swept: sweptWing(root, anchor, span, sweep, 0.1),
    delta: (u: number, v: number) =>
      inPolygon(
        [
          [root, anchor - 0.22],
          [span, anchor + 0.1 - sweep * 0.1],
          [span * 0.9, anchor + 0.14 - sweep * 0.1],
          [root, anchor + 0.14],
        ],
        u,
        v,
      ),
    straight: (u: number, v: number) =>
      inPolygon(
        [
          [root, anchor - 0.06],
          [span, anchor - 0.06 - sweep * 0.05],
          [span, anchor + 0.06 - sweep * 0.05],
          [root, anchor + 0.06],
        ],
        u,
        v,
      ),
    twin: (u: number, v: number) =>
      sweptWing(root, anchor - 0.12, span, sweep, 0.07)(u, v) ||
      sweptWing(root, anchor + 0.12, span * 0.7, sweep, 0.07)(u, v),
    ring: (u: number, v: number) => {
      const radius: number = Math.min(span * 0.85, 0.46);
      const distance: number = Math.hypot(u, v - anchor);

      return (
        (distance <= radius && distance >= radius - 0.06) ||
        inRect(root, anchor - 0.025, radius, anchor + 0.025, u, v)
      );
    },
    blade: (u: number, v: number) =>
      u >= root * 0.5 &&
      inEllipse(0, anchor, span, 0.2, u, v) &&
      !inEllipse(0, anchor + 0.08, span * 0.85, 0.2, u, v),
  };

  paint(canvas, trimRegion, shapes[build.wings]);
}

function enginePlaces(build: Build): Array<number> {
  const width: number = build.width / 100;

  if (build.engines === "nacelle") {
    const root: number = width * 0.4;
    const span: number =
      build.wings === "none" ? width + 0.12 : Math.min(build.span / 100, 0.9);

    return new Array(build.engineCount)
      .fill(0)
      .map(
        (_: number, index: number) =>
          root + (span - root) * ((index + 1) / (build.engineCount + 0.5)),
      );
  }

  return build.engineCount === 1
    ? [0]
    : build.engineCount === 2
      ? [width * 0.5]
      : [0, width * 0.65];
}

function drawEngines(canvas: Canvas, build: Build): void {
  const length: number = build.length / 100;
  const top: number = 0.5 - length / 2;
  const size: number = build.engineSize / 100;
  const anchor: number = wingSpot(build);

  if (build.engines === "none") {
    return;
  }

  if (build.engines === "booster") {
    paint(canvas, metalRegion, (u: number, v: number) =>
      inEllipse(0, top + 0.03, 0.14 * size, 0.08 * size, u, v),
    );
    paint(canvas, glowRegion, (u: number, v: number) =>
      inEllipse(0, clampV(top - 0.02 * size), 0.09 * size, 0.05 * size, u, v),
    );
    return;
  }

  for (const place of enginePlaces(build)) {
    if (build.engines === "nacelle") {
      const tail: number = anchor - 0.02 - 0.16 * size;

      paint(canvas, metalRegion, (u: number, v: number) =>
        inEllipse(place, anchor - 0.02, 0.055 * size, 0.16 * size, u, v),
      );
      paint(canvas, glowRegion, (u: number, v: number) =>
        inEllipse(place, clampV(tail - 0.02), 0.035 * size, 0.045 * size, u, v),
      );
      continue;
    }

    paint(canvas, metalRegion, (u: number, v: number) =>
      inRect(
        place - 0.06 * size,
        top - 0.01,
        place + 0.06 * size,
        top + 0.1,
        u,
        v,
      ),
    );
    paint(canvas, glowRegion, (u: number, v: number) =>
      inEllipse(
        place,
        clampV(top - 0.04 * size),
        0.045 * size,
        0.05 * size,
        u,
        v,
      ),
    );
  }
}

function drawGuns(canvas: Canvas, build: Build): void {
  const length: number = build.length / 100;
  const width: number = build.width / 100;
  const bottom: number = 0.5 + length / 2;
  const reach: number = build.gunLength / 100;
  const anchor: number = wingSpot(build);
  const root: number = width * 0.4;
  const span: number =
    build.wings === "none" ? width + 0.06 : Math.min(build.span / 100, 0.92);
  const shapes: Record<Guns, (u: number, v: number) => boolean> = {
    none: () => false,
    cannons: (u: number, v: number) =>
      inRect(
        span * 0.85 - 0.025,
        anchor - 0.05,
        span * 0.85 + 0.025,
        clampV(anchor + 0.14 * reach),
        u,
        v,
      ),
    spike: (u: number, v: number) =>
      inRect(-1, bottom - 0.12, 0.025, clampV(bottom + 0.08 * reach), u, v),
    prongs: (u: number, v: number) =>
      inPolygon(
        [
          [width * 0.25, bottom - 0.12],
          [width * 0.6, bottom - 0.12],
          [width * 0.45, clampV(bottom + 0.1 * reach)],
        ],
        u,
        v,
      ),
    array: (u: number, v: number) =>
      [0.3, 0.55, 0.8].some((share: number) => {
        const place: number = root + (span - root) * share;

        return inRect(
          place - 0.018,
          anchor,
          place + 0.018,
          clampV(anchor + 0.09 * reach),
          u,
          v,
        );
      }),
  };

  paint(canvas, metalRegion, shapes[build.guns]);
}

function drawFins(canvas: Canvas, build: Build, over: boolean): void {
  const length: number = build.length / 100;
  const width: number = build.width / 100;
  const top: number = 0.5 - length / 2;
  const bottom: number = 0.5 + length / 2;

  if (over) {
    if (build.fins === "ridge") {
      paint(canvas, trimRegion, (u: number, v: number) =>
        inRect(-1, top + 0.05, 0.025, bottom - 0.12, u, v),
      );
    }

    return;
  }

  const shapes: Record<Fins, (u: number, v: number) => boolean> = {
    none: () => false,
    ridge: () => false,
    tail: (u: number, v: number) =>
      inPolygon(
        [
          [width * 0.4, top + 0.12],
          [Math.min(width + 0.18, 0.95), clampV(top - 0.02)],
          [Math.min(width + 0.1, 0.9), top + 0.05],
          [width * 0.6, top + 0.2],
        ],
        u,
        v,
      ),
    spines: (u: number, v: number) =>
      [0.2, 0.38, 0.56, 0.74].some((share: number) => {
        const spot: number = top + length * share;

        return inPolygon(
          [
            [0, spot - 0.035],
            [0, spot + 0.035],
            [Math.min(width + 0.12, 0.95), spot - 0.06],
          ],
          u,
          v,
        );
      }),
    horns: (u: number, v: number) =>
      inPolygon(
        [
          [width * 0.3, bottom - length * 0.3],
          [width * 0.65, bottom - length * 0.35],
          [Math.min(width * 0.95, 0.9), clampV(bottom + 0.03)],
          [width * 0.7, bottom - 0.05],
        ],
        u,
        v,
      ),
  };

  paint(canvas, trimRegion, shapes[build.fins]);
}

function drawLivery(canvas: Canvas, build: Build): void {
  const length: number = build.length / 100;
  const width: number = build.width / 100;
  const top: number = 0.5 - length / 2;
  const shapes: Record<Livery, (u: number, v: number) => boolean> = {
    plain: () => false,
    stripe: (u: number) => u < width * 0.18,
    bands: (_: number, v: number) =>
      Math.floor(((v - top) / length) * 7) % 2 === 1,
    panels: (u: number, v: number) =>
      ((v - top) / 0.12) % 1 < 0.18 || Math.abs(u - width * 0.5) < 0.02,
    twotone: (_: number, v: number) => v > 0.5,
  };

  paint(
    canvas,
    build.livery === "panels" ? metalRegion : trimRegion,
    shapes[build.livery],
    true,
    hullRegion,
  );
}

function drawCore(canvas: Canvas, build: Build): void {
  const length: number = build.length / 100;
  const width: number = build.width / 100;
  const spot: number = 0.5 + (build.coreSpot / 100) * (length / 2);
  const shapes: Record<Core, (u: number, v: number) => boolean> = {
    none: () => false,
    eye: (u: number, v: number) => inEllipse(0, spot, 0.09, 0.09, u, v),
    slit: (u: number, v: number) =>
      inEllipse(0, spot, Math.max(width * 0.6, 0.08), 0.03, u, v),
    cross: (u: number, v: number) =>
      inRect(-1, spot - 0.09, 0.025, spot + 0.09, u, v) ||
      inRect(-1, spot - 0.025, 0.09, spot + 0.025, u, v),
    twin: (u: number, v: number) =>
      inEllipse(Math.max(width * 0.4, 0.07), spot, 0.05, 0.05, u, v),
  };

  paint(canvas, glowRegion, shapes[build.core]);

  if (build.core === "eye") {
    paint(canvas, metalRegion, (u: number, v: number) =>
      inEllipse(0, spot, 0.035, 0.055, u, v),
    );
  }
}

function drawBuild(build: Build, pixels: Pixels): void {
  const canvas: Canvas = createCanvas(pixels.size);

  drawFins(canvas, build, false);
  drawWings(canvas, build);
  drawEngines(canvas, build);
  drawGuns(canvas, build);
  drawHull(canvas, build, hullRegion);
  drawLivery(canvas, build);
  drawFins(canvas, build, true);
  drawCore(canvas, build);
  render(
    canvas,
    [null, build.hullColor, build.trimColor, build.metalColor, build.glowColor],
    [false, false, false, false, true],
    tone(build.hullColor, outlineShade),
    pixels,
  );
}

function buildPixels(build: Build, side: number): string {
  const pixels: Pixels = createPixels(side);

  drawBuild(build, pixels);

  return encodePixels(pixels);
}

export {
  hulls,
  wingParts,
  engineParts,
  gunParts,
  finParts,
  coreParts,
  liveries,
  hullColors,
  trimColors,
  metalColors,
  glowColors,
  defaultBuild,
  randomBuild,
  repairBuild,
  drawBuild,
  buildPixels,
};
