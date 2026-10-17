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
import { createGlide, type Glide } from "../../ui/motion";
import { downKeys, leftKeys, rightKeys, upKeys } from "../../game/input";
import type { Creations, Game, Run } from "../types";
import { gameLayers, runLayers } from "../packs";
import { previewHeight, previewWidth } from "../preview/preview";
import {
  categoryList,
  categoryDeals,
  categoryOf,
  entryRarity,
  itemNames,
  searchEntries,
  type Action,
  type Category,
  type Deal,
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
import { createTabs, headerY, type Tabs } from "./tabs";
import { createSearchBar, type SearchBar } from "./search";
import { createDealer, type Dealer } from "./deal";

type Live = {
  show: (kind: Kind, index: number) => Container | null;
  update: (delta: number) => void;
};

type Showing = {
  tile: Tile;
  view: Container | null;
  live: Live;
};

type Place = {
  key: string;
  x: Spring;
  y: Spring;
  fade: Spring;
};

type Gallery = {
  view: Container;
  refresh: () => void;
  appear: () => void;
  reset: () => void;
  disappear: () => Promise<void>;
  disappearTime: () => number;
  setActive: (active: boolean) => void;
  focus: (kind: Kind, index: number) => void;
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
const searchTop: number = 52; // px
const searchGap: number = 36; // px
const slideSmoothing: number = 0.12; // s
const fadeSmoothing: number = 0.08; // s
const fadeLimit: number = 0.01;
const emptySize: number = 14; // px

function createGallery(
  app: Application,
  creations: () => Creations,
  open: (kind: Kind, index: number) => void,
  create: (deal: Deal) => void,
  act: (kind: Kind, index: number, action: Action) => void,
  players: [Live, Live],
): Gallery {
  const view: Container = new Container();
  const tabs: Tabs = createTabs(app, (value: Category) => showKind(value));
  const grid: Container = new Container();
  const list: Container = new Container();
  const mask: Graphics = new Graphics();
  const tiles: Array<Tile> = new Array();
  const places: Map<Tile, Place> = new Map();
  const leaving: Array<Tile> = new Array();
  const searchBar: SearchBar = createSearchBar(app, () => rebuild(false));
  const empty: Text = createSerif(emptySize, trim);
  const emptyFade: Glide = createGlide(0, (value: number) => {
    empty.alpha = value;
  });
  const logo: Texture | null = tintedLogo(app);
  const dealer: Dealer = createDealer(
    app,
    logo,
    creations,
    (deal: Deal) => create(deal),
    () => searchBar.setActive(active),
  );
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
  let current: Showing | null = null;
  let fading: Showing | null = null;
  let shown: Array<Entry> = new Array();

  function entries(): Array<Entry> {
    return shown;
  }

  function count(): number {
    return shown.length + 1;
  }

  function keyOf(index: number): string {
    const entry: Entry | undefined = shown[index - 1];

    return entry === undefined ? "new" : entry.kind + ":" + entry.item.id;
  }

  function slotX(index: number): number {
    return (index % columns) * (tileWidth + tileGap) + tileWidth / 2;
  }

  function slotY(index: number): number {
    return rowOf(index) * (tileHeight + tileGap) + tileHeight / 2;
  }

  function choose(index: number): void {
    if (!active) {
      return;
    }

    const entry: Entry | undefined = entries()[index - 1];

    const deals: Array<Deal> = categoryDeals(category);

    if (index === 0 && deals.length === 1) {
      create(deals[0]!);
    } else if (index === 0) {
      searchBar.setActive(false);
      dealer.open(category, deals);
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

  function slide(delta: number): void {
    for (let index = 0; index < tiles.length; index++) {
      const place: Place = places.get(tiles[index]!)!;

      smoothDamp(place.x, slotX(index), slideSmoothing, delta);
      smoothDamp(place.y, slotY(index), slideSmoothing, delta);
      smoothDamp(place.fade, 1, fadeSmoothing, delta);
    }

    for (let index = leaving.length - 1; index >= 0; index--) {
      const tile: Tile = leaving[index]!;
      const place: Place = places.get(tile)!;

      smoothDamp(place.fade, 0, fadeSmoothing, delta);

      if (place.fade.value < fadeLimit) {
        leaving.splice(index, 1);
        places.delete(tile);
        tile.view.destroy({ children: true });
      }
    }
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

  function makeTile(index: number, born: number): Tile {
    const tile: Tile = createTile(index === 0, logo, {
      hover: () => {
        const at: number = tiles.indexOf(tile);

        if (active && at >= 0) {
          onTabs = false;
          selected = at;
          revealed = at;
          paint();
        }
      },
      tap: () => {
        const at: number = tiles.indexOf(tile);

        if (at < 0) {
          return;
        }

        onTabs = false;
        selected = at;
        paint();
        choose(at);
      },
      act: (action: Action) => {
        const entry: Entry | undefined = entries()[tiles.indexOf(tile) - 1];

        if (active && entry !== undefined) {
          act(entry.kind, entry.index, action);
        }
      },
    });

    places.set(tile, {
      key: keyOf(index),
      x: { value: slotX(index), velocity: 0 },
      y: { value: slotY(index), velocity: 0 },
      fade: { value: born, velocity: 0 },
    });
    list.addChild(tile.view);

    return tile;
  }

  function unmount(showing: Showing | null): void {
    if (showing === null) {
      return;
    }

    for (const child of showing.tile.art.children) {
      child.visible = true;
    }

    showing.view?.removeFromParent();
  }

  function release(tile: Tile | null = null): void {
    if (tile === null || current?.tile === tile) {
      unmount(current);
      current = null;
    }

    if (tile === null || fading?.tile === tile) {
      unmount(fading);
      fading = null;
    }
  }

  function mount(tile: Tile, index: number, live: Live): Showing {
    const entry: Entry | undefined = entries()[index - 1];
    const width: number = tileWidth - artInset * 2;
    const liveView: Container | null =
      entry === undefined ? null : live.show(entry.kind, entry.index);
    const showing: Showing = { tile: tile, view: liveView, live: live };

    if (entry === undefined || liveView === null) {
      return showing;
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
    return showing;
  }

  function turning(showing: Showing | null): boolean {
    return (
      showing !== null &&
      tiles.includes(showing.tile) &&
      showing.tile.turnProgress < 1
    );
  }

  function animateLive(delta: number): void {
    const target: Tile | null =
      revealed === null || revealed === 0 ? null : (tiles[revealed] ?? null);

    if (fading !== null && !turning(fading)) {
      unmount(fading);
      fading = null;
    }

    if (target !== (current?.tile ?? null)) {
      const back: Showing | null = fading?.tile === target ? fading : null;

      if (back !== null) {
        fading = null;
      }

      if (turning(current)) {
        unmount(fading);
        fading = current;
      } else {
        unmount(current);
      }

      current =
        back ??
        (target === null
          ? null
          : mount(
              target,
              revealed!,
              fading?.live === players[0] ? players[1] : players[0],
            ));
    }

    for (const showing of [current, fading]) {
      if (
        showing !== null &&
        showing.view !== null &&
        showing.tile.face.visible
      ) {
        showing.live.update(delta);
      }
    }
  }

  function describe(tile: Tile, index: number): void {
    const width: number = tileWidth - artInset * 2;

    release(tile);

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
      tile.layers = new Array();
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
    tile.layers =
      entry.kind === "run"
        ? runLayers(creations(), entry.item as Run)
        : entry.kind === "game"
          ? gameLayers(creations(), entry.item as Game)
          : new Array();
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
      const tile: Tile = tiles[index]!;
      const place: Place = places.get(tile)!;

      tile.view.alpha = Math.min(progress * 3, 1) * place.fade.value;
      applyTransform(tile);
      tile.view.position.set(
        place.x.value,
        place.y.value + appearDistance * (1 - eased),
      );
    }

    for (const tile of leaving) {
      const place: Place = places.get(tile)!;

      tile.view.alpha = Math.min(tile.view.alpha, place.fade.value);
      tile.view.position.set(place.x.value, place.y.value);
    }

    empty.position.set(slotX(1), slotY(1));
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

  function rebuild(all: boolean): void {
    const chosen: Tile | undefined = tiles[selected];
    const flipped: Tile | undefined =
      revealed === null ? undefined : tiles[revealed];
    const previous: Map<string, Tile> = new Map();
    const fresh: boolean = tiles.length === 0;

    for (const tile of tiles) {
      const key: string = places.get(tile)!.key;

      if (previous.has(key)) {
        leaving.push(tile);
      } else {
        previous.set(key, tile);
      }
    }

    shown = searchEntries(creations(), category, searchBar.search());
    tiles.length = 0;

    for (let index = 0; index < count(); index++) {
      const tile: Tile | undefined = previous.get(keyOf(index));

      if (tile === undefined) {
        tiles.push(makeTile(index, fresh ? 1 : 0));
        describe(tiles[index]!, index);
        continue;
      }

      previous.delete(keyOf(index));
      tiles.push(tile);

      if (all || index === 0) {
        describe(tile, index);
      }
    }

    for (const tile of previous.values()) {
      release(tile);

      tile.view.eventMode = "none";
      leaving.push(tile);
    }

    if (chosen !== undefined && tiles.includes(chosen)) {
      selected = tiles.indexOf(chosen);
    }

    revealed =
      flipped !== undefined && tiles.includes(flipped)
        ? tiles.indexOf(flipped)
        : null;
    emptyFade.set(shown.length === 0 && searchBar.filtering() ? 1 : 0);
    arrange();
    select(selected);
  }

  function refresh(): void {
    rebuild(true);
  }

  function clear(): void {
    release();

    for (const tile of [...tiles, ...leaving]) {
      places.delete(tile);
      tile.view.destroy({ children: true });
    }

    tiles.length = 0;
    leaving.length = 0;
  }

  function reset(): void {
    category = categoryList[0]!;
    selected = 0;
    revealed = null;
    target = 0;
    scroll.value = 0;
    scroll.velocity = 0;
    searchBar.reset();
    searchBar.setCategory(category);
    clear();
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
    searchBar.setCategory(category);
    clear();
    refresh();
    appear();
  }

  function layout(): void {
    const area: number = app.screen.width * galleryWidth;
    const searchY: number = Math.round(app.screen.height * headerY) + searchTop;
    const top: number = Math.max(
      app.screen.height * galleryTop,
      searchY + searchBar.height + searchGap,
    );

    columns = Math.max(Math.floor((area + tileGap) / (tileWidth + tileGap)), 1);

    const width: number = columns * (tileWidth + tileGap) - tileGap;
    const left: number = Math.round(app.screen.width / 2 - width / 2);

    searchBar.view.position.set(Math.round(app.screen.width / 2), searchY);
    searchBar.layout(Math.max(width, area));

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

  empty.text = "NO MATCHING CARDS";
  empty.anchor.set(0.5);
  empty.alpha = 0;
  list.addChild(empty);
  grid.addChild(list, mask);
  list.mask = mask;
  view.addChild(tabs.view, searchBar.view, grid, dealer.view);
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
    slide(ticker.deltaMS / 1000);
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
    } else if (appearDirection < 0 && appearTime > 0) {
      appearTime = Math.max(appearTime - ticker.deltaMS / 1000, 0);

      if (appearTime === 0) {
        vanished?.();
        vanished = null;
      }
    }

    arrange();
  });

  function shortcut(event: KeyboardEvent): Action | null {
    const command: boolean = event.ctrlKey || event.metaKey;

    if (!command && event.code === "F2") {
      return "rename";
    }

    if (!command && event.code === "Delete") {
      return "delete";
    }

    if (command && !event.shiftKey && event.code === "KeyD") {
      return "duplicate";
    }

    if (command && !event.shiftKey && event.code === "KeyE") {
      return "export";
    }

    return null;
  }

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || dealer.shown() || searchBar.focused() || event.altKey) {
      return;
    }

    const action: Action | null = shortcut(event);
    const entry: Entry | undefined = entries()[selected - 1];

    if (action !== null) {
      if (!onTabs && entry !== undefined) {
        act(entry.kind, entry.index, action);
      }

      event.preventDefault();
      return;
    }

    if (event.ctrlKey || event.metaKey) {
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

  function focus(kind: Kind, index: number): void {
    showKind(categoryOf(kind));
    refresh();

    const at: number = shown.findIndex(
      (entry: Entry) => entry.kind === kind && entry.index === index,
    );

    if (at >= 0) {
      onTabs = false;
      browse(at + 1);
    }
  }

  function setActive(value: boolean): void {
    active = value;
    searchBar.setActive(value);
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
    focus: focus,
  };
}

export { createGallery };
export type { Gallery, Live };
