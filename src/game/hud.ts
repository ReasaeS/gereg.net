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
  setReadout: (shown: boolean, instant: boolean) => void;
  setTrack: (name: string | null, playing: boolean) => void;
  onPlayer: (listener: (action: PlayerAction) => void) => void;
};

type PlayerAction = "previous" | "toggle" | "next";

type PlayerButton = {
  view: Container;
  back: Graphics;
  icon: Graphics;
  hover: Glide;
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
const readoutSmoothing: number = 0.25; // s
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
const trackLabelY: number = 136; // units
const trackNameY: number = 160; // units
const playerY: number = 204; // units
const playerGap: number = 52; // units
const buttonRadius: number = 17; // units
const mainRadius: number = 22; // units
const iconSize: number = 7; // units
const hoverGrow: number = 0.12;
const hoverSmoothing: number = 0.12; // s
const nameWidth: number = 184; // units

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

function drawPlayerIcon(
  icon: Graphics,
  action: PlayerAction,
  playing: boolean,
): void {
  const size: number = iconSize;

  icon.clear();

  if (action === "toggle" && playing) {
    icon
      .rect(-size * 0.8, -size, size * 0.6, size * 2)
      .rect(size * 0.2, -size, size * 0.6, size * 2)
      .fill(0xffffff);
  } else if (action === "toggle") {
    icon.poly([-size * 0.6, -size, size, 0, -size * 0.6, size]).fill(0xffffff);
  } else {
    const facing: number = action === "next" ? 1 : -1;

    icon
      .poly([
        -size * facing,
        -size * 0.8,
        size * 0.4 * facing,
        0,
        -size * facing,
        size * 0.8,
      ])
      .rect(
        facing > 0 ? size * 0.5 : -size * 0.75,
        -size * 0.8,
        size * 0.25,
        size * 1.6,
      )
      .fill(0xffffff);
  }
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
  const readout: Container = new Container();
  const reveal: Glide = createGlide(
    1,
    (value: number) => {
      readout.alpha = value;
    },
    readoutSmoothing,
  );
  const elapsedLabel: Text = createText(rowSize);
  const elapsedValue: Text = createText(rowSize);
  const trackLabel: Text = createText(rowSize);
  const trackName: Text = createText(rowSize);
  const playerListeners: Array<(action: PlayerAction) => void> = new Array();
  const buttons: Map<PlayerAction, PlayerButton> = new Map();
  let trackPlaying: boolean = false;
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
  view.addChild(wall.view, readout);
  readout.addChild(badgeBack);
  badge.text = "NORMAL";
  badge.anchor.set(0.5);
  badge.position.set((panelX + panelRight) / 2, badgeY + badgeHeight / 2);
  readout.addChild(badge);

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
  trackLabel.text = "Now Playing";
  trackLabel.anchor.set(0, 0.5);
  trackLabel.position.set(panelX, trackLabelY);
  trackName.anchor.set(0.5);
  trackName.position.set((panelX + panelRight) / 2, trackNameY);
  zen.addChild(trackLabel, trackName);

  for (const [index, action] of (
    ["previous", "toggle", "next"] as Array<PlayerAction>
  ).entries()) {
    const button: Container = new Container();
    const back: Graphics = new Graphics()
      .circle(0, 0, action === "toggle" ? mainRadius : buttonRadius)
      .fill(0xffffff);
    const icon: Graphics = new Graphics();
    const hover: Glide = createGlide(
      0,
      (value: number) => {
        button.scale.set(1 + value * hoverGrow);
      },
      hoverSmoothing,
    );

    drawPlayerIcon(icon, action, false);
    button.position.set(
      (panelX + panelRight) / 2 + (index - 1) * playerGap,
      playerY,
    );
    button.addChild(back, icon);
    button.eventMode = "static";
    button.cursor = "pointer";
    button.on("pointerover", () => hover.set(1));
    button.on("pointerout", () => hover.set(0));
    button.on("pointertap", () => {
      hover.snap(-1);
      hover.set(1);

      for (const listener of playerListeners) {
        listener(action);
      }
    });
    zen.addChild(button);
    buttons.set(action, { view: button, back: back, icon: icon, hover: hover });
  }

  zen.visible = false;
  readout.addChild(stage, zen);

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
    trackLabel.tint = shown.label;
    trackName.tint = shown.text;

    for (const button of buttons.values()) {
      button.back.tint = shown.accent;
      button.icon.tint = shown.text;
    }

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

  function setTrack(name: string | null, playing: boolean): void {
    trackName.text = name ?? "No songs";

    while (trackName.width > nameWidth && trackName.text.length > 1) {
      trackName.text = trackName.text.slice(0, -2) + "…";
    }

    if (playing !== trackPlaying) {
      trackPlaying = playing;
      drawPlayerIcon(buttons.get("toggle")!.icon, "toggle", playing);
    }
  }

  texts.push(badge, elapsedLabel, elapsedValue, trackLabel, trackName);

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
    setTrack: setTrack,
    onPlayer: (listener: (action: PlayerAction) => void) => {
      playerListeners.push(listener);
    },
    setReadout: (shown: boolean, instant: boolean) => {
      if (instant) {
        reveal.snap(shown ? 1 : 0);
      } else {
        reveal.set(shown ? 1 : 0);
      }
    },
  };
}

export { createHud };
export type { Hud, PlayerAction, Stats };
