import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from "pixi.js";
import { getTheme } from "../theme/theme";

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
};

type Row = {
  label: Text;
  value: Text | null;
  stars: Graphics | null;
};

const fontFamily: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
const logoPath: string = "./logo.svg";
const logoResolution: number = 2;
const hudWidth: number = 640; // units
const hudHeight: number = 480; // units
const fieldX: number = 32; // units
const fieldY: number = 16; // units
const fieldWidth: number = 384; // units
const fieldHeight: number = 448; // units
const panelX: number = 440; // units
const panelRight: number = 624; // units
const frameColor: string = "#030c2a";
const stripeColor: string = "#0a2160";
const stripeGap: number = 14; // units
const stripeWidth: number = 5; // units
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

function createText(size: number, color: string): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: fontFamily,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: color,
    },
  });
}

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

function drawFrame(frame: Graphics): void {
  frame.clear().rect(0, 0, hudWidth, hudHeight).fill(frameColor);

  for (let x = -hudHeight; x < hudWidth; x += stripeGap) {
    frame
      .poly([
        x,
        hudHeight,
        x + stripeWidth,
        hudHeight,
        x + stripeWidth + hudHeight,
        0,
        x + hudHeight,
        0,
      ])
      .fill(stripeColor);
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
  const rows: Array<Row> = new Array();
  const texts: Array<Text> = new Array();
  const logoTexture: Texture = await Assets.load({
    src: logoPath,
    data: { resolution: logoResolution * (window.devicePixelRatio || 1) },
  });
  const logo: Sprite = new Sprite(logoTexture);
  const stats: Stats = {
    hiScore: 0,
    score: 0,
    lives: 2,
    bombs: 3,
    power: 0,
    maxPower: 4,
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
    view.addChild(label);

    if (value !== null) {
      value.anchor.set(1, 0.5);
      value.position.set(panelRight, y);
      view.addChild(value);
    }

    if (stars !== null) {
      stars.y = y;
      view.addChild(stars);
    }

    rows.push({ label: label, value: value, stars: stars });
  }

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
      texts[index]!.resolution = scale * (window.devicePixelRatio || 1);
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

  texts.push(badge);

  for (let index = 0; index < rows.length; index++) {
    const row: Row = rows[index]!;

    texts.push(row.label);

    if (row.value !== null) {
      texts.push(row.value);
    }
  }

  refresh();

  return { view: view, stats: stats, refresh: refresh, setScale: setScale };
}

export {
  hudWidth,
  hudHeight,
  fieldX,
  fieldY,
  fieldWidth,
  fieldHeight,
  drawFrame,
  createHud,
};
export type { Hud, Stats };
