import {
  Container,
  Graphics,
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
import type { PageContent } from "./page";

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

    grid.position.set(
      Math.round(app.screen.width / 2 - width / 2),
      Math.round(app.screen.height * listTop),
    );
  }

  function refresh(): void {
    for (const tile of tiles) {
      drawTile(tile);
      tile.count.set(tile.read());
    }

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

    refresh();
  }

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (
      !active ||
      event.code !== "KeyR" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    press();
    event.preventDefault();
  });

  app.ticker.add((_ticker: Ticker) => {
    if (active) {
      const online: Tile = tiles[tiles.length - 1]!;

      online.count.set(online.read());
    }
  });
  onStats(refresh);
  layout();
  setActive(false);
  app.renderer.on("resize", layout);

  return {
    view: view,
    setActive: setActive,
    enter: enter,
  };
}

export { createStats };
