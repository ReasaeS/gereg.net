import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { maxPower, minPower } from "./drones";
import { startBombs } from "./bomb";
import { hudHeight, hudWidth } from "./field";
import { createText, screenResolution } from "../ui/text";
import { createGlide, mix, type Glide } from "../ui/motion";
import { createWallpaperView, type WallpaperView } from "../create/wallpaper";
import { paletteOf } from "../create/palette";
import type { Palette, Wallpaper } from "../create/types";
import { loadLogo, trackLogo } from "../ui/logo";
import { formatPlaytime } from "../settings/playtime";

type Stats = {
  hiScore: number;
  score: number;
  lives: number;
  bombs: number;
  power: number;
  maxPower: number;
  graze: number;
  point: number;
};

type Hud = {
  view: Container;
  stats: Stats;
  refresh: () => void;
  setScale: (scale: number) => void;
  setZen: (on: boolean) => void;
  setBadge: (label: string) => void;
  setElapsed: (seconds: number) => void;
  setLook: (wallpaper: Wallpaper | null, palette: Palette | null) => void;
};

type Shade = "accent" | "highlight" | "text" | "label";

type Row = {
  label: Text;
  value: Text | null;
  stars: Graphics | null;
};

const panelX: number = 440; // units
const panelRight: number = 624; // units
const badgeY: number = 22; // units
const badgeHeight: number = 24; // units
const badgeSlant: number = 8; // units
const badgeSize: number = 20; // units
const rowSize: number = 17; // units
const shades: Array<Shade> = ["accent", "highlight", "text", "label"];
const lookSmoothing: number = 0.6; // s
const lifeColor: string = "#ff6fa8";
const bombColor: string = "#5cff8a";
const starRadius: number = 6.5; // units
const starGap: number = 15; // units
const scoreDigits: number = 10;
const logoWidth: number = 176; // units
const logoBottom: number = 464; // units
const rowLayout: Array<[string, number]> = [
  ["HiScore", 72],
  ["Score", 96],
  ["Player", 136],
  ["Bomb", 160],
  ["Power", 200],
  ["Graze", 224],
  ["Point", 248],
];
const elapsedLabelY: number = 72; // units
const elapsedValueY: number = 96; // units

function drawStars(
  graphics: Graphics,
  count: number,
  color: string,
  right: number,
  outline: number,
): void {
  graphics.clear();

  for (let index = 0; index < count; index++) {
    const centerX: number = right - starRadius - index * starGap;
    const points: Array<number> = new Array();

    for (let corner = 0; corner < 10; corner++) {
      const angle: number = (corner / 10) * Math.PI * 2 - Math.PI / 2;
      const radius: number = corner % 2 === 0 ? starRadius : starRadius * 0.45;

      points.push(centerX + Math.cos(angle) * radius, Math.sin(angle) * radius);
    }

    graphics.poly(points).fill(color).stroke({ color: outline, width: 1 });
  }
}

function drawBadge(badge: Graphics): void {
  badge
    .poly([
      panelX + badgeSlant,
      badgeY,
      panelRight,
      badgeY,
      panelRight - badgeSlant,
      badgeY + badgeHeight,
      panelX,
      badgeY + badgeHeight,
    ])
    .fill(0xffffff);
}

async function createHud(): Promise<Hud> {
  const view: Container = new Container();
  const wall: WallpaperView = createWallpaperView(
    hudWidth,
    hudHeight,
    1,
    lookSmoothing,
  );
  const badgeBack: Graphics = new Graphics();
  const badge: Text = createText(badgeSize);
  const stage: Container = new Container();
  const zen: Container = new Container();
  const elapsedLabel: Text = createText(rowSize);
  const elapsedValue: Text = createText(rowSize);
  const rows: Array<Row> = new Array();
  const texts: Array<Text> = new Array();
  const logoTexture: Texture = await loadLogo();
  const logo: Sprite = new Sprite(logoTexture);
  const stats: Stats = {
    hiScore: 0,
    score: 0,
    lives: 2,
    bombs: startBombs,
    power: minPower,
    maxPower: maxPower,
    graze: 0,
    point: 0,
  };

  const plain: Palette = paletteOf(null);
  const shown: Record<Shade, number> = {
    accent: 0,
    highlight: 0,
    text: 0,
    label: 0,
  };
  let from: Record<Shade, number> = { ...shown };
  let to: Palette = plain;
  const blend: Glide = createGlide(1, paint, lookSmoothing);

  wall.show(null);
  drawBadge(badgeBack);
  view.addChild(wall.view, badgeBack);
  badge.text = "NORMAL";
  badge.anchor.set(0.5);
  badge.position.set((panelX + panelRight) / 2, badgeY + badgeHeight / 2);
  view.addChild(badge);

  for (let index = 0; index < rowLayout.length; index++) {
    const [name, y] = rowLayout[index]!;
    const label: Text = createText(rowSize);
    const star: boolean = name === "Player" || name === "Bomb";
    const value: Text | null = star ? null : createText(rowSize);
    const stars: Graphics | null = star ? new Graphics() : null;

    label.text = name;
    label.anchor.set(0, 0.5);
    label.position.set(panelX, y);
    stage.addChild(label);

    if (value !== null) {
      value.anchor.set(1, 0.5);
      value.position.set(panelRight, y);
      stage.addChild(value);
    }

    if (stars !== null) {
      stars.y = y;
      stage.addChild(stars);
    }

    rows.push({ label: label, value: value, stars: stars });
  }

  elapsedLabel.text = "Time Elapsed";
  elapsedLabel.anchor.set(0, 0.5);
  elapsedLabel.position.set(panelX, elapsedLabelY);
  elapsedValue.text = formatPlaytime(0);
  elapsedValue.anchor.set(1, 0.5);
  elapsedValue.position.set(panelRight, elapsedValueY);
  zen.addChild(elapsedLabel, elapsedValue);
  zen.visible = false;
  view.addChild(stage, zen);

  trackLogo(logo);
  logo.anchor.set(0.5, 1);
  logo.width = logoWidth;
  logo.scale.y = logo.scale.x;
  logo.position.set((panelX + panelRight) / 2, logoBottom);
  view.addChild(logo);

  function score(value: number): string {
    return String(Math.floor(value)).padStart(scoreDigits, "0");
  }

  function setScale(scale: number): void {
    for (let index = 0; index < texts.length; index++) {
      texts[index]!.resolution = screenResolution(scale);
    }
  }

  function refresh(): void {
    const values: Array<string> = [
      score(Math.max(stats.hiScore, stats.score)),
      score(stats.score),
      "",
      "",
      stats.power.toFixed(2) + " / " + stats.maxPower.toFixed(2),
      String(stats.graze),
      String(stats.point),
    ];

    for (let index = 0; index < rows.length; index++) {
      const row: Row = rows[index]!;

      if (row.value !== null) {
        row.value.text = values[index]!;
      }
    }

    drawStars(
      rows[2]!.stars!,
      stats.lives,
      lifeColor,
      panelRight,
      shown.highlight,
    );
    drawStars(
      rows[3]!.stars!,
      stats.bombs,
      bombColor,
      panelRight,
      shown.highlight,
    );
  }

  function paint(value: number): void {
    for (const shade of shades) {
      shown[shade] = mix(from[shade], to[shade], value);
    }

    badgeBack.tint = shown.accent;
    badge.tint = shown.text;
    elapsedLabel.tint = shown.label;
    elapsedValue.tint = shown.text;

    for (const row of rows) {
      row.label.tint = shown.label;

      if (row.value !== null) {
        row.value.tint = shown.text;
      }
    }

    refresh();
  }

  function setLook(wallpaper: Wallpaper | null, palette: Palette | null): void {
    const next: Palette = paletteOf(palette);

    wall.show(wallpaper);

    if (JSON.stringify(next) === JSON.stringify(to)) {
      return;
    }

    from = { ...shown };
    to = next;
    blend.snap(0);
    blend.set(1);
  }

  function setZen(on: boolean): void {
    stage.visible = !on;
    zen.visible = on;
    badge.text = on ? "ZEN" : "NORMAL";
  }

  function setElapsed(seconds: number): void {
    const text: string = formatPlaytime(seconds * 1000);

    if (elapsedValue.text !== text) {
      elapsedValue.text = text;
    }
  }

  texts.push(badge, elapsedLabel, elapsedValue);

  for (let index = 0; index < rows.length; index++) {
    const row: Row = rows[index]!;

    texts.push(row.label);

    if (row.value !== null) {
      texts.push(row.value);
    }
  }

  blend.snap(1);

  return {
    view: view,
    stats: stats,
    refresh: refresh,
    setScale: setScale,
    setZen: setZen,
    setBadge: (label: string) => {
      badge.text = label.toUpperCase();
    },
    setElapsed: setElapsed,
    setLook: setLook,
  };
}

export { createHud };
export type { Hud, Stats };
