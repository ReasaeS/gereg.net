import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type FederatedWheelEvent,
  type Texture,
  type Ticker,
} from "pixi.js";
import { smoothDamp, type Spring } from "../../effects/tween/tween";
import { downKeys, leftKeys, rightKeys, upKeys } from "../../game/input";
import type { Creations } from "../types";
import { previewHeight, previewWidth } from "../preview/preview";
import {
  categoryList,
  entryRarity,
  itemNames,
  listEntries,
  type Action,
  type Category,
  type Entry,
  type Kind,
} from "./kinds";
import {
  artHeight,
  artInset,
  createSerif,
  fit,
  tileHeight,
  tileWidth,
  trim,
} from "./style";
import { drawRain, rainMaxDelta, tintedLogo } from "./cover";
import { drawEntry } from "./art";
import {
  applyTransform,
  createTile,
  paintTile,
  stepTile,
  type Tile,
} from "./tile";
import { createTabs, type Tabs } from "./tabs";

type Live = {
  show: (kind: Kind, index: number) => Container | null;
  update: (delta: number) => void;
};

type Gallery = {
  view: Container;
  refresh: () => void;
  appear: () => void;
  reset: () => void;
  disappear: () => Promise<void>;
  disappearTime: () => number;
  setActive: (active: boolean) => void;
};

const tileGap: number = 26; // px
const plusSize: number = 56; // px
const gemCategories: Array<Category> = ["stage", "enemy"];
const galleryWidth: number = 0.8; // of screen width
const galleryTop: number = 0.22; // of screen height
const galleryBottom: number = 0.97; // of screen height
const scrollSmoothing: number = 0.08; // s
const appearDuration: number = 0.45; // s
const appearStagger: number = 0.05; // s
const appearDistance: number = 40; // px
const staggerLimit: number = 16;
const liftMargin: number = 14; // px

function createGallery(
  app: Application,
  creations: () => Creations,
  open: (kind: Kind, index: number) => void,
  create: (category: Category) => void,
  act: (kind: Kind, index: number, action: Action) => void,
  live: Live,
): Gallery {
  const view: Container = new Container();
  const tabs: Tabs = createTabs(app, (value: Category) => showKind(value));
  const grid: Container = new Container();
  const list: Container = new Container();
  const mask: Graphics = new Graphics();
  const tiles: Array<Tile> = new Array();
  const logo: Texture | null = tintedLogo(app);
  const scroll: Spring = { value: 0, velocity: 0 };
  let category: Category = "stage";
  let selected: number = 0;
  let onTabs: boolean = true;
  let target: number = 0;
  let active: boolean = false;
  let columns: number = 1;
  let visibleHeight: number = 1;
  let appearTime: number = Infinity;
  let revealed: number | null = null;
  let appearDirection: number = 1;
  let vanished: (() => void) | null = null;
  let liveTile: Tile | null = null;
  let liveView: Container | null = null;

  function entries(): Array<Entry> {
    return listEntries(creations(), category);
  }

  function count(): number {
    return entries().length + 1;
  }

  function choose(index: number): void {
    if (!active) {
      return;
    }

    const entry: Entry | undefined = entries()[index - 1];

    if (index === 0) {
      create(category);
    } else if (entry !== undefined) {
      open(entry.kind, entry.index);
    }
  }

  function rowOf(index: number): number {
    return Math.floor(index / columns);
  }

  function reveal(): void {
    const top: number = rowOf(selected) * (tileHeight + tileGap);
    const bottom: number = top + tileHeight;

    if (top < target) {
      target = top;
    } else if (bottom > target + visibleHeight) {
      target = bottom - visibleHeight;
    }
  }

  function browse(index: number): void {
    select(index);
    revealed = selected;
  }

  function select(index: number): void {
    selected = Math.min(Math.max(index, 0), count() - 1);
    reveal();
    paint();
  }

  function paint(): void {
    for (let index = 0; index < tiles.length; index++) {
      drawTile(index);
    }

    tabs.paint(category, onTabs);
  }

  function drawTile(index: number): void {
    paintTile(tiles[index]!, gemCategories.includes(category));
  }

  function animateTiles(delta: number): void {
    for (let index = 0; index < tiles.length; index++) {
      const goal: number = !onTabs && index === selected ? 1 : 0;
      const faceUp: boolean = index === 0 || index === revealed;

      if (stepTile(tiles[index]!, goal, faceUp, delta)) {
        drawTile(index);
      }
    }
  }

  function makeTile(index: number): Tile {
    return createTile(index, logo, {
      hover: (at: number) => {
        if (active) {
          onTabs = false;
          selected = at;
          revealed = at;
          paint();
        }
      },
      tap: (at: number) => {
        onTabs = false;
        selected = at;
        paint();
        choose(at);
      },
      act: (at: number, action: Action) => {
        const entry: Entry | undefined = entries()[at - 1];

        if (active && entry !== undefined) {
          act(entry.kind, entry.index, action);
        }
      },
    });
  }

  function release(): void {
    if (liveTile !== null) {
      for (const child of liveTile.art.children) {
        child.visible = true;
      }
    }

    liveView?.removeFromParent();
    liveTile = null;
    liveView = null;
  }

  function mount(tile: Tile, index: number): void {
    const entry: Entry | undefined = entries()[index - 1];
    const width: number = tileWidth - artInset * 2;

    liveTile = tile;
    liveView = entry === undefined ? null : live.show(entry.kind, entry.index);

    if (entry === undefined || liveView === null) {
      return;
    }

    const scale: number = Math.max(
      width / previewWidth,
      artHeight / previewHeight,
    );

    for (const child of tile.art.children) {
      child.visible = false;
    }

    liveView.scale.set(scale);
    liveView.position.set(
      (width - previewWidth * scale) / 2,
      entry.kind === "cutscene"
        ? artHeight - previewHeight * scale
        : (artHeight - previewHeight * scale) / 2,
    );
    tile.art.addChild(liveView);
  }

  function animateLive(delta: number): void {
    const target: Tile | null =
      revealed === null || revealed === 0 ? null : (tiles[revealed] ?? null);

    if (target !== liveTile) {
      release();

      if (target !== null) {
        mount(target, revealed!);
      }
    }

    if (liveView !== null && liveTile?.face.visible === true) {
      live.update(delta);
    }
  }

  function describe(tile: Tile, index: number): void {
    const width: number = tileWidth - artInset * 2;

    if (tile === liveTile) {
      release();
    }

    tile.actions.visible = index !== 0;

    for (const child of tile.art.removeChildren()) {
      child.destroy({ children: true });
    }

    if (index === 0) {
      const plus: Text = createSerif(plusSize, trim);
      const ring: Graphics = new Graphics()
        .circle(width / 2, artHeight / 2, 40)
        .stroke({ color: trim, width: 1.5 })
        .circle(width / 2, artHeight / 2, 46)
        .stroke({ color: trim, width: 0.75, alpha: 0.5 });

      plus.text = "+";
      plus.anchor.set(0.5);
      plus.position.set(width / 2, artHeight / 2);
      tile.art.addChild(ring, plus);
      tile.name.text = "NEW " + itemNames.get(category)!.toUpperCase();
      tile.rarity = null;
      tile.rank.text = "";
      tile.coverRank.text = "";
      fit(tile.name);
      tile.coverName.text = tile.name.text;
      fit(tile.coverName);
      tile.detail.text = "";
      return;
    }

    const entry: Entry = entries()[index - 1]!;

    tile.rarity = entryRarity(entry);
    tile.rank.text = tile.rarity.label.toUpperCase();
    tile.coverRank.text = tile.rank.text;

    tile.name.text = entry.item.name.toUpperCase();
    fit(tile.name);
    tile.coverName.text = tile.name.text;
    fit(tile.coverName);
    tile.detail.text = drawEntry(
      tile.art,
      entry,
      creations(),
      width,
      artHeight,
    );
    fit(tile.detail);
  }

  function arrange(): void {
    for (let index = 0; index < tiles.length; index++) {
      const progress: number = Math.min(
        Math.max(
          (appearTime - Math.min(index, staggerLimit) * appearStagger) /
            appearDuration,
          0,
        ),
        1,
      );
      const eased: number = 1 - Math.pow(1 - progress, 3);

      tiles[index]!.view.alpha = Math.min(progress * 3, 1);
      applyTransform(tiles[index]!);
      tiles[index]!.view.position.set(
        (index % columns) * (tileWidth + tileGap) + tileWidth / 2,
        rowOf(index) * (tileHeight + tileGap) +
          tileHeight / 2 +
          appearDistance * (1 - eased),
      );
    }
  }

  function appearEnd(): number {
    return (
      appearDuration + Math.min(tiles.length, staggerLimit) * appearStagger
    );
  }

  function disappear(): Promise<void> {
    revealed = null;
    appearTime = Math.min(appearTime, appearEnd());
    appearDirection = -1;

    return new Promise<void>((resolve) => {
      vanished = resolve;
    });
  }

  function appear(): void {
    onTabs = true;
    revealed = null;
    appearDirection = 1;
    vanished?.();
    vanished = null;
    appearTime = 0;
    arrange();
  }

  function refresh(): void {
    while (tiles.length < count()) {
      const tile: Tile = makeTile(tiles.length);
      tiles.push(tile);
      list.addChild(tile.view);
    }

    while (tiles.length > count()) {
      const tile: Tile = tiles.pop()!;

      if (tile === liveTile) {
        release();
      }

      tile.view.destroy({ children: true });
    }

    for (let index = 0; index < tiles.length; index++) {
      describe(tiles[index]!, index);
    }

    arrange();
    select(selected);
  }

  function reset(): void {
    category = categoryList[0]!;
    selected = 0;
    revealed = null;
    target = 0;
    scroll.value = 0;
    scroll.velocity = 0;
    refresh();
    tabs.reset(category, onTabs);
  }

  function showKind(next: Category): void {
    if (next === category) {
      return;
    }

    category = next;
    selected = 0;
    revealed = null;
    target = 0;
    refresh();
    appear();
  }

  function layout(): void {
    const area: number = app.screen.width * galleryWidth;
    const top: number = app.screen.height * galleryTop;

    columns = Math.max(Math.floor((area + tileGap) / (tileWidth + tileGap)), 1);

    const width: number = columns * (tileWidth + tileGap) - tileGap;
    const left: number = Math.round(app.screen.width / 2 - width / 2);

    visibleHeight = app.screen.height * galleryBottom - top;
    grid.position.set(left, top);
    tabs.layout();
    mask
      .clear()
      .rect(
        -liftMargin,
        -liftMargin,
        width + liftMargin * 2,
        visibleHeight + liftMargin,
      )
      .fill(0xffffff);
    grid.hitArea = new Rectangle(0, 0, width, visibleHeight);
    arrange();
    reveal();
  }

  grid.addChild(list, mask);
  list.mask = mask;
  view.addChild(tabs.view, grid);
  view.eventMode = "none";
  grid.eventMode = "static";
  grid.on("wheel", (event: FederatedWheelEvent) => {
    const total: number =
      (rowOf(count() - 1) + 1) * (tileHeight + tileGap) - tileGap;

    target = Math.min(
      Math.max(target + event.deltaY, 0),
      Math.max(total - visibleHeight, 0),
    );
  });

  app.ticker.add((ticker: Ticker) => {
    if (!view.visible) {
      return;
    }

    smoothDamp(scroll, target, scrollSmoothing, ticker.deltaMS / 1000);
    list.y = -scroll.value;
    animateTiles(ticker.deltaMS / 1000);
    animateLive(Math.min(ticker.deltaMS / 1000, rainMaxDelta));

    for (const tile of tiles) {
      if (tile.cover.visible) {
        drawRain(
          tile.rain,
          tile.drops,
          Math.min(ticker.deltaMS / 1000, rainMaxDelta),
        );
      }
    }

    if (appearDirection > 0 && appearTime < appearEnd()) {
      appearTime += ticker.deltaMS / 1000;
      arrange();
    } else if (appearDirection < 0 && appearTime > 0) {
      appearTime = Math.max(appearTime - ticker.deltaMS / 1000, 0);
      arrange();

      if (appearTime === 0) {
        vanished?.();
        vanished = null;
      }
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const up: boolean = upKeys.includes(event.code);
    const down: boolean = downKeys.includes(event.code);
    const left: boolean = leftKeys.includes(event.code);
    const right: boolean = rightKeys.includes(event.code);
    const confirm: boolean = event.code === "Enter" || event.code === "Space";

    if (onTabs && (left || right)) {
      moveTab(left ? -1 : 1);
    } else if (onTabs && (down || confirm)) {
      onTabs = false;
      browse(0);
    } else if (onTabs && up) {
      paint();
    } else if (up && rowOf(selected) === 0) {
      onTabs = true;
      revealed = null;
      paint();
    } else if (leftKeys.includes(event.code)) {
      browse(selected - 1);
    } else if (rightKeys.includes(event.code)) {
      browse(selected + 1);
    } else if (upKeys.includes(event.code)) {
      browse(selected - columns);
    } else if (downKeys.includes(event.code)) {
      browse(selected + columns);
    } else if (event.code === "Enter" || event.code === "Space") {
      choose(selected);
    } else if (event.code.startsWith("Digit")) {
      const next: Category | undefined =
        categoryList[Number(event.code.slice(5)) - 1];

      if (next === undefined) {
        return;
      }

      showKind(next);
    } else {
      return;
    }

    event.preventDefault();
  });

  function moveTab(direction: number): void {
    const index: number = Math.min(
      Math.max(categoryList.indexOf(category) + direction, 0),
      categoryList.length - 1,
    );

    showKind(categoryList[index]!);
  }

  function setActive(value: boolean): void {
    active = value;
    view.eventMode = value ? "passive" : "none";
  }

  layout();
  refresh();
  app.renderer.on("resize", layout);

  return {
    view: view,
    refresh: refresh,
    appear: appear,
    reset: reset,
    disappear: disappear,
    disappearTime: () => Math.min(appearTime, appearEnd()) * 1000,
    setActive: setActive,
  };
}

export { createGallery };
export type { Gallery, Live };
