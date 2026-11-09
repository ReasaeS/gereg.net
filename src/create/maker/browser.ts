import {
  Container,
  Graphics,
  Rectangle,
  Text,
  type Application,
  type FederatedWheelEvent,
} from "pixi.js";
import type { Creations } from "../types";
import { getTheme } from "../../theme/theme";
import { createText } from "../../ui/text";
import { createGlide, type Glide } from "../../ui/motion";
import { smoothDamp, type Spring } from "../../effects/tween/tween";
import { createTile, paintTile, stepTile, type Tile } from "../gallery/tile";
import { drawEntry } from "../gallery/art";
import {
  categoryOf,
  compareOrder,
  entryRarity,
  type Category,
  type Entry,
  type Search,
} from "../gallery/kinds";
import { createSearchBar, type SearchBar } from "../gallery/search";
import { gameLayers, runLayers } from "../packs";
import type { Game, Run } from "../types";
import {
  artHeight,
  artInset,
  diamond,
  fit,
  tileHeight,
  tileWidth,
  trim,
  trimLit,
} from "../gallery/style";

type Card = {
  label: string;
  entry: Entry | null;
};

type Browser = {
  view: Container;
  open: (
    title: string,
    cards: Array<Card>,
    current: number,
    choose: (index: number) => void,
  ) => void;
  close: () => void;
  shown: () => boolean;
  layout: () => void;
  update: (delta: number) => void;
};

type Slot = {
  holder: Container;
  tile: Tile;
  card: Card;
  index: number;
  y: number; // px
};

const shadeColor: string = "#01040f";
const shadeAlpha: number = 0.72;
const panelColor: string = "#020a26";
const panelAlpha: number = 0.96;
const panelMargin: number = 36; // px
const panelPadding: number = 26; // px
const panelRadius: number = 14; // px
const panelGrow: number = 0.04;
const headerHeight: number = 64; // px
const searchGap: number = 24; // px
const countRoom: number = 110; // px
const footerHeight: number = 40; // px
const badgeHeight: number = 32; // px
const badgeSlant: number = 12; // px
const badgePadding: number = 22; // px
const titleSize: number = 20; // px
const countSize: number = 13; // px
const cardScale: number = 1;
const cardGap: number = 26; // px
const listInset: number = 22; // px
const cornerSize: number = 6; // px
const fadeSmoothing: number = 0.12; // s
const scrollSmoothing: number = 0.12; // s
const dealDelay: number = 0.08; // s
const dealSpread: number = 0.6; // s
const dealStep: number = 0.035; // s
const riseTime: number = 0.22; // s
const riseDistance: number = 26; // px
const currentGlow: number = 0.45;
const emptyDetail: string = "Leave this empty";

function createBrowser(app: Application, creations: () => Creations): Browser {
  const view: Container = new Container();
  const shade: Graphics = new Graphics();
  const panel: Container = new Container();
  const frame: Graphics = new Graphics();
  const badge: Graphics = new Graphics();
  const title: Text = createText(titleSize, "#ffffff");
  const count: Text = createText(countSize, "#ffffff");
  const grid: Container = new Container();
  const list: Container = new Container();
  const mask: Graphics = new Graphics();
  const marker: Graphics = new Graphics();
  const scroll: Spring = { value: 0, velocity: 0 };
  const searchBar: SearchBar = createSearchBar(app, filter);
  const slots: Array<Slot> = new Array();
  let shownSlots: Array<Slot> = new Array();
  let heading: string = "";
  let category: Category = "visual";
  let picked: (index: number) => void = () => undefined;
  let current: number = -1;
  let focus: number = 0;
  let open: boolean = false;
  let elapsed: number = 0;
  let scrollTarget: number = 0;
  let columns: number = 1;
  let gridWidth: number = 0;
  let gridHeight: number = 0;
  let panelWidth: number = 0;
  const fade: Glide = createGlide(
    0,
    (value: number) => {
      view.alpha = value;
      view.visible = value > 0.001;
      panel.scale.set(1 - panelGrow * (1 - value));
    },
    fadeSmoothing,
  );

  function cellWidth(): number {
    return tileWidth * cardScale + cardGap;
  }

  function cellHeight(): number {
    return tileHeight * cardScale + cardGap;
  }

  function maxScroll(): number {
    const rows: number = Math.ceil(shownSlots.length / columns);

    return Math.max(
      rows * cellHeight() - cardGap + listInset * 2 - gridHeight,
      0,
    );
  }

  function drawFrame(width: number, height: number): void {
    const accent: string = getTheme().accent;

    frame
      .clear()
      .roundRect(0, 0, width, height, panelRadius)
      .fill({ color: panelColor, alpha: panelAlpha })
      .roundRect(0, 0, width, height, panelRadius)
      .stroke({ color: trim, width: 2, alignment: 1 })
      .roundRect(7, 7, width - 14, height - 14, panelRadius - 5)
      .stroke({ color: accent, width: 1, alpha: 0.7 })
      .moveTo(panelPadding, headerHeight)
      .lineTo(width - panelPadding, headerHeight)
      .moveTo(panelPadding, height - footerHeight)
      .lineTo(width - panelPadding, height - footerHeight)
      .stroke({ color: trim, width: 1, alpha: 0.25 });

    for (const [x, y] of [
      [14, 14],
      [width - 14, 14],
      [14, height - 14],
      [width - 14, height - 14],
    ] as Array<[number, number]>) {
      diamond(frame, x, y, cornerSize);
    }

    frame.fill(accent);
  }

  function drawBadge(): void {
    const width: number = title.width + badgePadding * 2;

    badge
      .clear()
      .poly([
        badgeSlant,
        0,
        width + badgeSlant,
        0,
        width,
        badgeHeight,
        0,
        badgeHeight,
      ])
      .fill(getTheme().accent);
    title.position.set(badgeSlant / 2 + width / 2, badgeHeight / 2);
  }

  function layout(): void {
    const width: number = app.screen.width - panelMargin * 2;
    const height: number = app.screen.height - panelMargin * 2;

    columns = Math.max(
      Math.floor((width - panelPadding * 2 + cardGap) / cellWidth()),
      1,
    );
    gridWidth = columns * cellWidth() - cardGap;
    gridHeight = height - headerHeight - footerHeight - panelPadding;

    panelWidth = Math.min(width, Math.max(gridWidth + panelPadding * 2, 420));

    shade
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: shadeColor, alpha: shadeAlpha });
    panel.pivot.set(panelWidth / 2, height / 2);
    panel.position.set(app.screen.width / 2, app.screen.height / 2);
    drawFrame(panelWidth, height);
    badge.position.set(panelPadding, (headerHeight - badgeHeight) / 2);
    count.position.set(panelWidth - panelPadding, headerHeight / 2);
    placeSearch();
    grid.position.set(
      (panelWidth - gridWidth) / 2,
      headerHeight + panelPadding / 2,
    );
    mask
      .clear()
      .rect(-cardGap, 0, gridWidth + cardGap * 2, gridHeight)
      .fill(0xffffff);
    grid.hitArea = new Rectangle(0, 0, gridWidth, gridHeight);
    place();
  }

  function place(): void {
    for (const slot of slots) {
      slot.holder.visible = false;
    }

    for (let position = 0; position < shownSlots.length; position++) {
      const slot: Slot = shownSlots[position]!;

      slot.holder.visible = true;
      slot.y =
        listInset +
        Math.floor(position / columns) * cellHeight() +
        (tileHeight * cardScale) / 2;
      slot.holder.position.set(
        (position % columns) * cellWidth() + (tileWidth * cardScale) / 2,
        slot.y,
      );
    }

    scrollTarget = Math.min(scrollTarget, maxScroll());
  }

  function placeSearch(): void {
    const left: number = badge.x + badge.width + searchGap;
    const right: number = panelWidth - panelPadding - countRoom - searchGap;

    searchBar.view.position.set((left + right) / 2, headerHeight / 2);
    searchBar.layout(Math.max(right - left, 0));
  }

  function paintCount(): void {
    count.text = searchBar.filtering()
      ? shownSlots.length + " OF " + slots.length
      : shownSlots.length + (shownSlots.length === 1 ? " CARD" : " CARDS");
    title.text = heading;
    drawBadge();
    placeSearch();
  }

  function matches(slot: Slot, search: Search): boolean {
    const needle: string = search.query.trim().toLowerCase();

    if (slot.card.entry === null) {
      return (
        search.types.size === 0 &&
        slot.card.label.toLowerCase().includes(needle)
      );
    }

    return (
      (search.types.size === 0 ||
        search.types.has(entryRarity(slot.card.entry).label)) &&
      slot.card.entry.item.name.toLowerCase().includes(needle)
    );
  }

  function compareSlots(first: Slot, second: Slot, search: Search): number {
    if (first.card.entry === null || second.card.entry === null) {
      return (
        Number(first.card.entry !== null) - Number(second.card.entry !== null)
      );
    }

    return (
      compareOrder(
        search.order,
        category,
        first.card.entry,
        second.card.entry,
      ) * (search.reversed ? -1 : 1)
    );
  }

  function sift(): void {
    const search: Search = searchBar.search();

    shownSlots = slots
      .filter((slot: Slot) => matches(slot, search))
      .sort((first: Slot, second: Slot) => compareSlots(first, second, search));
  }

  function filter(): void {
    if (!open) {
      return;
    }

    sift();
    focus = 0;
    place();
    paintCount();
    reveal();
  }

  function dress(tile: Tile, card: Card): void {
    const width: number = tileWidth - artInset * 2;

    tile.actions.visible = false;

    if (card.entry === null) {
      tile.rarity = null;
      tile.name.text = card.label.toUpperCase();
      tile.rank.text = "";
      tile.detail.text = emptyDetail;
    } else {
      const entry: Entry = card.entry;

      tile.rarity = entryRarity(entry);
      tile.rank.text = tile.rarity.label.toUpperCase();
      tile.name.text = entry.item.name.toUpperCase();
      tile.layers =
        entry.kind === "run"
          ? runLayers(creations(), entry.item as Run)
          : entry.kind === "game"
            ? gameLayers(creations(), entry.item as Game)
            : new Array();
      tile.detail.text = drawEntry(
        tile.art,
        entry,
        creations(),
        width,
        artHeight,
      );
    }

    fit(tile.name);
    fit(tile.detail);
    tile.coverName.text = tile.name.text;
    fit(tile.coverName);
    tile.coverRank.text = tile.rank.text;
    paintTile(tile, true);
  }

  function clear(): void {
    for (const slot of slots) {
      slot.holder.destroy({ children: true });
    }

    slots.length = 0;
    shownSlots = new Array();
  }

  function reveal(): void {
    const position: number = shownSlots.findIndex(
      (slot: Slot) => slot.index === shownSlots[focus]?.index,
    );

    if (position < 0) {
      return;
    }

    const top: number = Math.floor(position / columns) * cellHeight();
    const bottom: number = top + cellHeight() - cardGap + listInset * 2;

    if (top < scrollTarget) {
      scrollTarget = top;
    } else if (bottom > scrollTarget + gridHeight) {
      scrollTarget = bottom - gridHeight;
    }

    scrollTarget = Math.min(Math.max(scrollTarget, 0), maxScroll());
  }

  function choose(position: number): void {
    const slot: Slot | undefined = shownSlots[position];

    if (!open || slot === undefined) {
      return;
    }

    picked(slot.index);
    close();
  }

  function close(): void {
    open = false;
    searchBar.setActive(false);
    fade.set(0);
  }

  function openBrowser(
    name: string,
    cards: Array<Card>,
    chosen: number,
    choose: (index: number) => void,
  ): void {
    clear();
    heading = "CHOOSE " + name.toUpperCase();
    category = categoryOf(
      cards.find((card: Card) => card.entry !== null)?.entry?.kind ??
        "background",
    );
    searchBar.reset();
    searchBar.setCategory(category);
    searchBar.setActive(true);
    picked = choose;
    current = chosen;
    open = true;
    elapsed = 0;

    for (let index = 0; index < cards.length; index++) {
      const card: Card = cards[index]!;
      const slot: Slot = {
        holder: new Container(),
        tile: createTile(false, null, {
          hover: () => {
            focus = shownSlots.indexOf(slot);
          },
          tap: () => choose(shownSlots.indexOf(slot)),
          act: () => undefined,
        }),
        card: card,
        index: index,
        y: 0,
      };

      slot.holder.scale.set(cardScale);
      slot.holder.addChild(slot.tile.view);
      dress(slot.tile, card);
      list.addChild(slot.holder);
      slots.push(slot);
    }

    list.addChild(marker);
    sift();
    focus = Math.max(
      shownSlots.findIndex((slot: Slot) => slot.index === chosen),
      0,
    );
    layout();
    paintCount();
    scrollTarget = 0;
    reveal();
    scroll.value = scrollTarget;
    scroll.velocity = 0;
    fade.set(1);
  }

  function update(delta: number): void {
    if (!view.visible) {
      return;
    }

    elapsed += delta;
    smoothDamp(scroll, scrollTarget, scrollSmoothing, delta);
    list.y = -scroll.value;
    marker.clear();

    const step: number = Math.min(
      dealStep,
      dealSpread / Math.max(shownSlots.length, 1),
    );

    for (let position = 0; position < shownSlots.length; position++) {
      const slot: Slot = shownSlots[position]!;
      const start: number = dealDelay + position * step;
      const rise: number = Math.min(
        Math.max((elapsed - start) / riseTime, 0),
        1,
      );
      const eased: number = 1 - (1 - rise) * (1 - rise);
      const goal: number =
        position === focus ? 1 : slot.index === current ? currentGlow : 0;

      if (stepTile(slot.tile, goal, open && elapsed > start, delta)) {
        paintTile(slot.tile, true);
      }

      slot.holder.alpha = eased;
      slot.holder.y = slot.y + riseDistance * (1 - eased);

      if (slot.index === current) {
        const x: number = slot.holder.x;
        const y: number = slot.y - (tileHeight * cardScale) / 2;

        marker
          .poly([x - 7, y - 14, x + 7, y - 14, x, y - 5])
          .fill({ color: trimLit, alpha: eased });
      }
    }
  }

  window.addEventListener(
    "keydown",
    (event: KeyboardEvent) => {
      if (
        !open ||
        searchBar.focused() ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const moves: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -columns,
        ArrowDown: columns,
      };
      const move: number | undefined = moves[event.key];

      if (move !== undefined) {
        focus = Math.min(
          Math.max(focus + move, 0),
          Math.max(shownSlots.length - 1, 0),
        );
        reveal();
      } else if (event.key === "Enter") {
        choose(focus);
      } else {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  title.anchor.set(0.5);
  count.anchor.set(1, 0.5);
  count.alpha = 0.7;
  badge.addChild(title);
  list.mask = mask;
  grid.addChild(list, mask);
  grid.eventMode = "static";
  grid.on("wheel", (event: FederatedWheelEvent) => {
    scrollTarget = Math.min(
      Math.max(scrollTarget + event.deltaY, 0),
      maxScroll(),
    );
  });
  panel.addChild(frame, badge, count, grid, searchBar.view);
  shade.eventMode = "static";
  shade.on("pointertap", close);
  panel.eventMode = "static";
  view.addChild(shade, panel);
  view.visible = false;
  view.alpha = 0;

  return {
    view: view,
    open: openBrowser,
    close: close,
    shown: () => open,
    layout: layout,
    update: update,
  };
}

export { createBrowser };
export type { Browser, Card };
