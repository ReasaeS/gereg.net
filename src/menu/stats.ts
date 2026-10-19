import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type Ticker,
} from "pixi.js";
import { createButton, paintButton, type Button } from "../ui/button";
import { createText } from "../ui/text";
import { createGlide, type Glide } from "../ui/motion";
import { getTheme } from "../theme/theme";
import { getStat, onStats, resetStats, type Stat } from "../game/stats";
import { formatPlaytime, playtime } from "../settings/playtime";
import {
  achievements,
  isUnlocked,
  onAchievements,
  resetAchievements,
  type Achievement,
} from "../game/achievements";
import { leftKeys, rightKeys } from "../game/input";
import type { PageContent } from "./page";

type Badge = {
  view: Container;
  shape: Graphics;
  mark: Text;
  lit: Glide;
};

type Tile = {
  view: Container;
  back: Graphics;
  value: Text;
  label: Text;
  count: Glide;
  shown: Glide;
  read: () => number;
  format: (value: number) => string;
};

const valueSize: number = 54; // px
const labelSize: number = 22; // px
const tileWidth: number = 240; // px
const tileHeight: number = 118; // px
const tileGap: number = 16; // px
const tileSlant: number = 14; // px
const tilePadding: number = 24; // px
const stripeWidth: number = 5; // px
const tileAlpha: number = 0.55;
const columns: number = 4;
const listTop: number = 0.32; // of screen height
const riseDistance: number = 30; // px
const tileStagger: number = 0.04; // s
const countSmoothing: number = 0.35; // s
const confirmTime: number = 3000; // ms
const stripGap: number = 34; // px
const headingSize: number = 26; // px
const headingGap: number = 46; // px
const badgeSize: number = 52; // px
const badgeGap: number = 20; // px
const badgeLift: number = 0.18;
const markSize: number = 26; // px
const captionSize: number = 22; // px
const captionGap: number = 26; // px
const lockedAlpha: number = 0.35;
const screenBottom: number = 0.95; // of screen height
const sparkPoints: number = 4;
const sparkInner: number = 0.38;
const statNames: Array<[Stat, string]> = [
  ["runs", "runs started"],
  ["clears", "runs cleared"],
  ["gameOvers", "game overs"],
  ["best", "best score"],
  ["score", "total score"],
  ["misses", "misses"],
  ["bombs", "bombs used"],
  ["grazes", "grazes"],
  ["items", "items collected"],
  ["zen", "time in zen"],
];

function formatCount(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatTime(seconds: number): string {
  return formatPlaytime(seconds * 1000);
}

function createStats(app: Application): PageContent {
  const view: Container = new Container();
  const grid: Container = new Container();
  const tiles: Array<Tile> = new Array();
  const sources: Array<[string, () => number, (value: number) => string]> = [
    ...statNames.map(
      ([stat, name]: [Stat, string]): [
        string,
        () => number,
        (value: number) => string,
      ] => [
        name,
        () => getStat(stat),
        stat === "zen" ? formatTime : formatCount,
      ],
    ),
    ["time online", () => playtime() / 1000, formatTime],
  ];
  let armed: boolean = false;
  let timer: number = 0;
  let active: boolean = false;

  function press(): void {
    window.clearTimeout(timer);

    if (armed) {
      armed = false;
      resetAchievements();
      resetStats();
    } else {
      armed = true;
      timer = window.setTimeout(() => {
        armed = false;
        paintReset();
      }, confirmTime);
    }

    paintReset();
  }

  const reset: Button = createButton("reset stats", () => armed, press);

  function paintReset(): void {
    reset.label.text = armed ? "SURE?" : "RESET STATS";
    paintButton(reset);
  }

  function drawTile(tile: Tile): void {
    tile.back
      .clear()
      .poly([
        tileSlant,
        0,
        tileWidth,
        0,
        tileWidth - tileSlant,
        tileHeight,
        0,
        tileHeight,
      ])
      .fill({ color: getTheme().menuSelected, alpha: tileAlpha })
      .poly([
        tileSlant,
        0,
        tileSlant + stripeWidth,
        0,
        stripeWidth,
        tileHeight,
        0,
        tileHeight,
      ])
      .fill(getTheme().accent);
    tile.value.tint = getTheme().highlight;
    tile.label.tint = getTheme().menuText;
  }

  for (let index = 0; index < sources.length; index++) {
    const [name, read, format] = sources[index]!;
    const tileView: Container = new Container();
    const back: Graphics = new Graphics();
    const value: Text = createText(valueSize);
    const label: Text = createText(labelSize);
    const tile: Tile = {
      view: tileView,
      back: back,
      value: value,
      label: label,
      read: read,
      format: format,
      count: createGlide(
        0,
        (amount: number) => {
          value.text = format(amount);
        },
        countSmoothing,
      ),
      shown: createGlide(
        0,
        (amount: number) => {
          tileView.alpha = amount;
          tileView.y =
            Math.floor(index / columns) * (tileHeight + tileGap) +
            riseDistance * (1 - amount);
        },
        countSmoothing + index * tileStagger,
      ),
    };

    label.text = name.toUpperCase();
    label.anchor.set(0, 1);
    label.alpha = 0.75;
    label.position.set(tilePadding, tileHeight - tilePadding * 0.6);
    value.anchor.set(0, 0);
    value.position.set(tilePadding + tileSlant / 2, tilePadding * 0.5);
    tileView.x = (index % columns) * (tileWidth + tileGap);
    tileView.addChild(back, value, label);
    grid.addChild(tileView);
    drawTile(tile);
    tile.shown.snap(0);
    tile.count.snap(0);
    tiles.push(tile);
  }

  const strip: Container = new Container();
  const heading: Text = createText(headingSize);
  const caption: Text = createText(captionSize);
  const badges: Array<Badge> = new Array();
  let chosen: number = 0;

  function drawBadge(badge: Badge, achievement: Achievement): void {
    const half: number = badgeSize / 2;
    const open: boolean = isUnlocked(achievement);

    badge.shape
      .clear()
      .poly([0, -half, half, 0, 0, half, -half, 0])
      .fill({
        color: open ? getTheme().accent : getTheme().menuSelected,
        alpha: open ? 1 : tileAlpha,
      })
      .stroke({
        color: getTheme().highlight,
        width: 2,
        alpha: open ? 0.9 : lockedAlpha,
      });

    if (open) {
      const points: Array<number> = new Array();

      for (let index = 0; index < sparkPoints * 2; index++) {
        const angle: number = (index / (sparkPoints * 2)) * Math.PI * 2;
        const reach: number =
          half * (index % 2 === 0 ? 0.55 : 0.55 * sparkInner);

        points.push(Math.sin(angle) * reach, -Math.cos(angle) * reach);
      }

      badge.shape.poly(points).fill(getTheme().highlight);
    }

    badge.mark.visible = !open;
    badge.mark.tint = getTheme().menuText;
  }

  function choose(index: number): void {
    chosen = (index + badges.length) % badges.length;
    paintBadges();
  }

  function paintBadges(): void {
    const count: number = achievements.filter(isUnlocked).length;
    const achievement: Achievement = achievements[chosen]!;

    heading.text = "ACHIEVEMENTS  " + count + " / " + achievements.length;
    heading.tint = getTheme().accent;
    caption.text = isUnlocked(achievement)
      ? achievement.name.toUpperCase() + "  ·  " + achievement.description
      : "LOCKED  ·  " + achievement.description;
    caption.tint = getTheme().menuText;

    for (let index = 0; index < badges.length; index++) {
      drawBadge(badges[index]!, achievements[index]!);
      badges[index]!.lit.set(index === chosen ? 1 : 0);
    }
  }

  for (let index = 0; index < achievements.length; index++) {
    const badgeView: Container = new Container();
    const shape: Graphics = new Graphics();
    const mark: Text = createText(markSize);
    const badge: Badge = {
      view: badgeView,
      shape: shape,
      mark: mark,
      lit: createGlide(0, (amount: number) => {
        badgeView.scale.set(1 + badgeLift * amount);
        badgeView.alpha = 0.75 + 0.25 * amount;
      }),
    };

    mark.text = "?";
    mark.anchor.set(0.5);
    badgeView.position.set(
      badgeSize / 2 + index * (badgeSize + badgeGap),
      headingGap + badgeSize / 2,
    );
    badgeView.addChild(shape, mark);
    badgeView.eventMode = "static";
    badgeView.cursor = "pointer";
    badgeView.hitArea = new Rectangle(
      -badgeSize / 2,
      -badgeSize / 2,
      badgeSize,
      badgeSize,
    );
    badgeView.on("pointerover", () => choose(index));
    badgeView.on("pointertap", () => choose(index));
    badge.lit.snap(0);
    badges.push(badge);
    strip.addChild(badgeView);
  }

  caption.position.set(0, headingGap + badgeSize + captionGap);
  strip.addChild(heading, caption);
  strip.y =
    Math.ceil((sources.length + 1) / columns) * (tileHeight + tileGap) -
    tileGap +
    stripGap;
  grid.addChild(strip);

  reset.view.position.set(
    (sources.length % columns) * (tileWidth + tileGap) + tileSlant,
    Math.floor(sources.length / columns) * (tileHeight + tileGap) +
      tileHeight / 2 -
      reset.view.height / 2,
  );
  grid.addChild(reset.view);
  view.addChild(grid);

  function layout(): void {
    const width: number = columns * (tileWidth + tileGap) - tileGap;

    const top: number = Math.round(app.screen.height * listTop);
    const tall: number = strip.y + caption.y + captionSize * 1.5;
    const scale: number = Math.min(
      (app.screen.height * screenBottom - top) / tall,
      (app.screen.width * screenBottom) / width,
      1,
    );

    grid.scale.set(scale);
    grid.position.set(
      Math.round(app.screen.width / 2 - (width * scale) / 2),
      top,
    );
  }

  function refresh(): void {
    for (const tile of tiles) {
      drawTile(tile);
      tile.count.set(tile.read());
    }

    paintBadges();
    paintReset();
  }

  function setActive(value: boolean): void {
    active = value;
    view.eventMode = value ? "passive" : "none";

    if (!value) {
      window.clearTimeout(timer);
      armed = false;
      paintReset();
    }
  }

  function enter(): void {
    for (const tile of tiles) {
      tile.shown.snap(0);
      tile.count.snap(0);
      tile.shown.set(1);
    }

    chosen = 0;
    refresh();
  }

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.code === "KeyR") {
      press();
    } else if (leftKeys.includes(event.code)) {
      choose(chosen - 1);
    } else if (rightKeys.includes(event.code)) {
      choose(chosen + 1);
    } else {
      return;
    }

    event.preventDefault();
  });

  app.ticker.add((_ticker: Ticker) => {
    if (active) {
      const online: Tile = tiles[tiles.length - 1]!;

      online.count.set(online.read());
    }
  });
  onStats(refresh);
  onAchievements(refresh);
  layout();
  setActive(false);
  app.renderer.on("resize", layout);

  return {
    view: view,
    setActive: setActive,
    enter: enter,
    topic: () => "stats",
  };
}

export { createStats };
