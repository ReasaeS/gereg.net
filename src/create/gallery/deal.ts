import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type Texture,
  type Ticker,
} from "pixi.js";
import { createGlide, type Glide } from "../../ui/motion";
import { downKeys, leftKeys, rightKeys, upKeys } from "../../game/input";
import type { Creations, Run } from "../types";
import { blankEntry } from "../blank";
import { gameLayers, runLayers } from "../packs";
import { itemNames, type Category, type Creation, type Deal } from "./kinds";
import {
  artHeight,
  artInset,
  createSerif,
  fit,
  tileHeight,
  tileWidth,
  trim,
} from "./style";
import { drawRain, rainMaxDelta } from "./cover";
import { drawEntry } from "./art";
import {
  applyTransform,
  createTile,
  paintTile,
  placeName,
  stepTile,
  type Tile,
} from "./tile";

type Dealt = {
  deal: Deal;
  holder: Container;
  hit: Container;
  tile: Tile;
  x: number; // px
  y: number; // px
};

type Dealer = {
  view: Container;
  open: (category: Category, deals: Array<Deal>) => void;
  shown: () => boolean;
};

const shadeAlpha: number = 0.72;
const shadeSmoothing: number = 0.12; // s
const titleSize: number = 30; // px
const titleY: number = 0.09; // of screen height
const deckMargin: number = 32; // px
const rowY: number = 0.6; // of screen height
const rowWidth: number = 0.9; // of screen width
const rowHeight: number = 0.5; // of screen height
const cardGap: number = 30; // px
const rowLimit: number = 5;
const rowGap: number = 26; // px
const tableHeight: number = 0.64; // of screen height
const deckScale: number = 0.42;
const deckLayers: number = 3;
const deckStep: number = 3; // px
const dealDelay: number = 0.25; // s
const dealStagger: number = 0.14; // s
const dealDuration: number = 0.5; // s
const dealSpin: number = 2.4; // rad
const dealArc: number = 60; // px
const flipDelay: number = 0.12; // s
const liftHeight: number = 22; // px
const leaveDuration: number = 0.4; // s
const leaveDrop: number = 160; // px
const leaveTurn: number = 0.35; // rad
const chosenGrow: number = 0.18;
const deckRest: number = 0.6;

function createDealer(
  app: Application,
  logo: Texture | null,
  creations: () => Creations,
  pick: (deal: Deal) => void,
  closed: () => void,
): Dealer {
  const view: Container = new Container();
  const shade: Graphics = new Graphics();
  const deck: Container = new Container();
  const table: Container = new Container();
  const hits: Container = new Container();
  const title: Text = createSerif(titleSize, trim);
  const cards: Array<Dealt> = new Array();
  let active: boolean = false;
  let leaving: number | null = null;
  const shown: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = leaving === null ? Math.min(value * 1.5, 1) : 1;
      view.visible = value > 0.001 || active;
      shade.alpha = value * shadeAlpha;
    },
    shadeSmoothing,
  );
  let time: number = 0;
  let chosen: Dealt | null = null;
  let selected: number = 0;
  let scale: number = 1;
  let deckX: number = 0;
  let deckTop: number = 0;
  const deckTile: Tile = createTile(false, logo, {
    hover: () => undefined,
    tap: () => undefined,
    act: () => undefined,
  });

  function landed(index: number): number {
    return dealDelay + index * dealStagger + dealDuration;
  }

  function ready(): boolean {
    return active && leaving === null;
  }

  function describe(tile: Tile, deal: Deal): void {
    const width: number = tileWidth - artInset * 2;
    const sample: Creation = blankEntry(creations(), deal, true);

    tile.actions.visible = false;
    tile.rarity = deal.rarity;
    tile.rank.text = "NEW";
    tile.coverRank.text = "";
    tile.name.text = deal.rarity.label.toUpperCase();
    fit(tile.name);
    tile.coverName.text = "";
    tile.layers =
      deal.kind === "run"
        ? runLayers(creations(), sample as Run)
        : deal.kind === "game"
          ? gameLayers()
          : new Array();
    drawEntry(
      tile.art,
      { kind: deal.kind, index: -1, item: sample },
      creations(),
      width,
      artHeight,
    );
    tile.detail.text = deal.text;
    fit(tile.detail);
    placeName(tile);
  }

  function clear(): void {
    for (const card of cards) {
      card.holder.destroy({ children: true });
      card.hit.destroy();
    }

    cards.length = 0;
  }

  function rowCount(): number {
    return Math.ceil(Math.max(cards.length, 1) / rowLimit);
  }

  function across(): number {
    return Math.ceil(Math.max(cards.length, 1) / rowCount());
  }

  function layout(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const rows: number = rowCount();
    const count: number = across();
    const total: number = count * tileWidth + (count - 1) * cardGap;
    const tall: number = rows * tileHeight + (rows - 1) * rowGap;

    scale = Math.min(
      1,
      (width * rowWidth) / total,
      (height * (rows === 1 ? rowHeight : tableHeight)) / tall,
    );
    shade.clear().rect(0, 0, width, height).fill("#000000");
    title.position.set(width / 2, height * titleY);
    deckX = width - deckMargin - (tileWidth / 2) * deckScale * scale;
    deckTop = deckMargin + (tileHeight / 2) * deckScale * scale;
    deck.position.set(deckX, deckTop);
    deck.scale.set(deckScale * scale);

    for (let index = 0; index < cards.length; index++) {
      const card: Dealt = cards[index]!;
      const row: number = Math.floor(index / count);
      const inRow: number = Math.min(count, cards.length - row * count);
      const offset: number = (index % count) - (inRow - 1) / 2;

      card.x = width / 2 + offset * (tileWidth + cardGap) * scale;
      card.y =
        height * rowY + (row - (rows - 1) / 2) * (tileHeight + rowGap) * scale;
      card.hit.hitArea = new Rectangle(
        card.x - (tileWidth / 2) * scale,
        card.y - (tileHeight / 2) * scale,
        tileWidth * scale,
        tileHeight * scale,
      );
    }
  }

  function select(index: number): void {
    selected = Math.min(Math.max(index, 0), cards.length - 1);
  }

  function choose(card: Dealt | null): void {
    if (!ready()) {
      return;
    }

    chosen = card;
    leaving = time;
    shown.set(0);
  }

  function finish(): void {
    const picked: Dealt | null = chosen;

    active = false;
    leaving = null;
    chosen = null;
    clear();
    shown.snap(0);
    view.visible = false;
    closed();

    if (picked !== null) {
      pick(picked.deal);
    }
  }

  function open(category: Category, deals: Array<Deal>): void {
    clear();
    active = true;
    time = 0;
    leaving = null;
    chosen = null;
    title.text = "NEW " + itemNames.get(category)!.toUpperCase();

    for (let index = 0; index < deals.length; index++) {
      const holder: Container = new Container();
      const hit: Container = new Container();
      const card: Dealt = {
        deal: deals[index]!,
        holder: holder,
        hit: hit,
        tile: createTile(false, logo, {
          hover: () => undefined,
          tap: () => undefined,
          act: () => undefined,
        }),
        x: 0,
        y: 0,
      };

      describe(card.tile, card.deal);
      paintTile(card.tile, false);
      holder.visible = false;
      holder.addChild(card.tile.view);
      card.tile.view.eventMode = "none";
      hit.eventMode = "static";
      hit.cursor = "pointer";
      hit.on("pointerover", () => {
        if (ready() && time >= landed(index)) {
          select(index);
        }
      });
      hit.on("pointertap", () => {
        if (time >= landed(index)) {
          select(index);
          choose(card);
        }
      });
      table.addChild(holder);
      hits.addChild(hit);
      cards.push(card);
    }

    selected = Math.floor((Math.min(across(), deals.length) - 1) / 2);
    layout();
    view.visible = true;
    shown.set(1);
  }

  function place(card: Dealt, index: number, delta: number): void {
    const start: number = dealDelay + index * dealStagger;
    const progress: number = Math.min(
      Math.max((time - start) / dealDuration, 0),
      1,
    );
    const eased: number = 1 - Math.pow(1 - progress, 3);
    const side: number = index % 2 === 0 ? 1 : -1;
    const lit: boolean = ready() && index === selected && progress >= 1;
    const faceUp: boolean = time >= landed(index) + flipDelay;
    let x: number = deckX + (card.x - deckX) * eased;
    let y: number =
      deckTop +
      (card.y - deckTop) * eased -
      Math.sin(Math.PI * progress) * dealArc * scale;
    let turn: number = (1 - eased) * dealSpin * side;
    let size: number = (deckScale + (1 - deckScale) * eased) * scale;
    let alpha: number = 1;

    if (stepTile(card.tile, lit ? 1 : 0, faceUp, delta)) {
      paintTile(card.tile, false);
    }

    y -= liftHeight * card.tile.lit * scale;

    if (leaving !== null) {
      const away: number = Math.min((time - leaving) / leaveDuration, 1);
      const out: number = away * away;

      if (card === chosen) {
        size *= 1 + chosenGrow * (1 - Math.pow(1 - away, 3));
        alpha = 1 - out;
      } else {
        y += leaveDrop * out * scale;
        x += (card.x - app.screen.width / 2) * 0.3 * out;
        turn += leaveTurn * out * side;
        alpha = 1 - away;
      }
    }

    card.holder.visible = progress > 0;
    card.holder.position.set(x, y);
    card.holder.rotation = turn;
    card.holder.scale.set(size);
    card.holder.alpha = alpha;
    applyTransform(card.tile);

    if (card.tile.cover.visible) {
      drawRain(card.tile.rain, card.tile.drops, delta);
    }
  }

  function update(ticker: Ticker): void {
    if (!active) {
      return;
    }

    const delta: number = Math.min(ticker.deltaMS / 1000, rainMaxDelta);

    time += delta;

    for (let index = 0; index < cards.length; index++) {
      place(cards[index]!, index, delta);
    }

    deck.visible = leaving === null;
    deck.alpha = time < dealDelay + cards.length * dealStagger ? 1 : deckRest;

    if (leaving !== null && time - leaving >= leaveDuration) {
      finish();
    }
  }

  function buildDeck(): void {
    for (let layer = deckLayers; layer > 0; layer--) {
      const back: Graphics = new Graphics()
        .roundRect(
          -tileWidth / 2 + layer * deckStep,
          -tileHeight / 2 - layer * deckStep,
          tileWidth,
          tileHeight,
          10,
        )
        .fill("#01040f")
        .roundRect(
          -tileWidth / 2 + layer * deckStep,
          -tileHeight / 2 - layer * deckStep,
          tileWidth,
          tileHeight,
          10,
        )
        .stroke({ color: trim, width: 2, alpha: 0.6, alignment: 1 });

      deck.addChild(back);
    }

    deckTile.view.eventMode = "none";
    deckTile.actions.visible = false;
    deckTile.view.position.set(0, 0);
    paintTile(deckTile, false);
    deck.addChild(deckTile.view);
  }

  title.anchor.set(0.5);
  buildDeck();
  view.addChild(shade, title, deck, table, hits);
  view.visible = false;
  view.alpha = 0;
  view.eventMode = "static";
  shade.eventMode = "static";
  shade.on("pointertap", () => choose(null));
  app.ticker.add(update);
  app.renderer.on("resize", layout);
  layout();

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (!active || (event.altKey && event.code === "KeyH")) {
        return;
      }

      if (leftKeys.includes(event.code)) {
        select(selected - 1);
      } else if (rightKeys.includes(event.code)) {
        select(selected + 1);
      } else if (upKeys.includes(event.code)) {
        select(selected - across());
      } else if (downKeys.includes(event.code)) {
        select(selected + across());
      } else if (event.code === "Enter" || event.code === "Space") {
        if (time >= landed(selected)) {
          choose(cards[selected] ?? null);
        }
      } else if (event.code === "Escape") {
        choose(null);
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  return { view: view, open: open, shown: () => active };
}

export { createDealer };
export type { Dealer };
