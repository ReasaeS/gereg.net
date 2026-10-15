import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from "pixi.js";
import { getTheme } from "../theme/theme";
import { maxPower, minPower } from "./drones";
import { startBombs } from "./bomb";
import { drawFrame } from "./field";
import { createText, screenResolution } from "../ui/text";
import { pixelRatio } from "../ui/density";
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
  setElapsed: (seconds: number) => void;
};

type Row = {
  label: Text;
  value: Text | null;
  stars: Graphics | null;
};

const logoPath: string = "./logo.svg";
const logoResolution: number = 2;
const panelX: number = 440; // units
const panelRight: number = 624; // units
const badgeY: number = 22; // units
const badgeHeight: number = 24; // units
const badgeSlant: number = 8; // units
const badgeSize: number = 20; // units
const rowSize: number = 17; // units
const labelColor: string = "#9fd8ff";
const valueColor: string = "#ffffff";
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

    graphics.poly(points).fill(color).stroke({ color: "#ffffff", width: 1 });
  }
}

function drawBadge(frame: Graphics): void {
  frame
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
    .fill(getTheme().accent);
}

async function createHud(): Promise<Hud> {
  const view: Container = new Container();
  const frame: Graphics = new Graphics();
  const badge: Text = createText(badgeSize, valueColor);
  const stage: Container = new Container();
  const zen: Container = new Container();
  const elapsedLabel: Text = createText(rowSize, labelColor);
  const elapsedValue: Text = createText(rowSize, valueColor);
  const rows: Array<Row> = new Array();
  const texts: Array<Text> = new Array();
  const logoTexture: Texture = await Assets.load({
    src: logoPath,
    data: { resolution: logoResolution * pixelRatio },
  });
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

  drawFrame(frame);
  drawBadge(frame);
  view.addChild(frame);
  badge.text = "NORMAL";
  badge.anchor.set(0.5);
  badge.position.set((panelX + panelRight) / 2, badgeY + badgeHeight / 2);
  view.addChild(badge);

  for (let index = 0; index < rowLayout.length; index++) {
    const [name, y] = rowLayout[index]!;
    const label: Text = createText(rowSize, labelColor);
    const star: boolean = name === "Player" || name === "Bomb";
    const value: Text | null = star ? null : createText(rowSize, valueColor);
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

    drawStars(rows[2]!.stars!, stats.lives, lifeColor, panelRight);
    drawStars(rows[3]!.stars!, stats.bombs, bombColor, panelRight);
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

  refresh();

  return {
    view: view,
    stats: stats,
    refresh: refresh,
    setScale: setScale,
    setZen: setZen,
    setElapsed: setElapsed,
  };
}

export { createHud };
export type { Hud, Stats };
