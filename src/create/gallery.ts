import {
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type Application,
  type FederatedWheelEvent,
  type Texture,
  type Ticker,
} from "pixi.js";
import {
  buttonGap,
  buttonHeight,
  buttonWidth,
  createButton,
  paintButton,
  type Button,
} from "../editor/button";
import { smoothDamp, type Spring } from "../effects/tween/tween";
import { getTheme } from "../theme/theme";
import type {
  Background,
  Creations,
  Enemy,
  Keyframe,
  Pattern,
  Stage,
} from "./data";
import { getTexture } from "./images";
import { drawShape } from "./preview";
import { createText } from "./widgets";

type Kind = "stage" | "pattern" | "enemy" | "background";

type Gallery = {
  view: Container;
  refresh: () => void;
  appear: () => void;
  setActive: (active: boolean) => void;
};

type Tile = {
  view: Container;
  back: Graphics;
  art: Container;
  name: Text;
  detail: Text;
};

const kinds: Array<Kind> = ["stage", "background", "enemy", "pattern"];
const kindNames: Map<Kind, string> = new Map([
  ["stage", "stages"],
  ["pattern", "patterns"],
  ["enemy", "enemies"],
  ["background", "backgrounds"],
]);
const tileWidth: number = 200; // px
const tileHeight: number = 172; // px
const tileGap: number = 16; // px
const tileSlant: number = 10; // px
const tileIdleAlpha: number = 0.6;
const artInset: number = 16; // px
const artTop: number = 10; // px
const artHeight: number = 98; // px
const nameSize: number = 22; // px
const detailSize: number = 15; // px
const detailColor: string = "#9fd8ff";
const plusSize: number = 64; // px
const dotLimit: number = 24;
const galleryWidth: number = 0.8; // of screen width
const galleryTop: number = 0.32; // of screen height
const galleryBottom: number = 0.94; // of screen height
const categoryGap: number = 18; // px
const scrollSmoothing: number = 0.08; // s
const appearDuration: number = 0.3; // s
const appearStagger: number = 0.035; // s
const appearDistance: number = 28; // px

function contain(sprite: Sprite, texture: Texture, size: number): void {
  sprite.texture = texture;
  sprite.anchor.set(0.5);
  sprite.scale.set(size / Math.max(texture.width, texture.height));
}

function drawBackground(
  art: Container,
  background: Background | null,
  width: number,
  height: number,
): void {
  const sky: Graphics = new Graphics();
  const mask: Graphics = new Graphics()
    .rect(0, 0, width, height)
    .fill(0xffffff);

  if (background === null) {
    sky.rect(0, 0, width, height).fill("#01040f");
    art.addChild(sky);
    return;
  }

  sky.rect(0, 0, width, height).fill(
    new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: background.top },
        { offset: 1, color: background.bottom },
      ],
    }),
  );
  art.addChild(sky);

  const texture: Texture | null = getTexture(background.sprite);

  if (texture !== null) {
    const image: Sprite = new Sprite(texture);

    image.scale.set(width / texture.width);
    image.mask = mask;
    art.addChild(image, mask);
  }
}

function drawPattern(
  art: Container,
  pattern: Pattern,
  width: number,
  height: number,
): void {
  const texture: Texture | null = getTexture(pattern.sprite);
  const dots: Graphics = new Graphics();
  const count: number = Math.min(
    Math.max(Math.round(pattern.count), 1),
    dotLimit,
  );
  const full: boolean = pattern.spread >= 360;
  const radius: number = height * 0.36;
  const size: number = Math.min(Math.max(pattern.size * 0.5, 4), 14);
  const base: number = (pattern.angle * Math.PI) / 180;

  for (let index = 0; index < count; index++) {
    const offset: number =
      count === 1
        ? 0
        : full
          ? (index * 360) / count
          : -pattern.spread / 2 + (index * pattern.spread) / (count - 1);
    const angle: number = base + (offset * Math.PI) / 180;
    const x: number = width / 2 + Math.cos(angle) * radius;
    const y: number = height / 2 + Math.sin(angle) * radius;

    if (texture !== null) {
      const bullet: Sprite = new Sprite();

      contain(bullet, texture, size * 2);
      bullet.position.set(x, y);
      bullet.rotation = angle - Math.PI / 2;
      art.addChild(bullet);
    } else {
      dots.circle(x, y, size / 2).fill(pattern.color);
    }
  }

  dots.circle(width / 2, height / 2, 3).fill({ color: "#ffffff", alpha: 0.6 });
  art.addChild(dots);
}

function drawEnemy(
  art: Container,
  enemy: Enemy,
  width: number,
  height: number,
): void {
  const texture: Texture | null = getTexture(enemy.sprite);
  const size: number = height * 0.8;

  if (texture !== null) {
    const sprite: Sprite = new Sprite();

    contain(sprite, texture, size);
    sprite.position.set(width / 2, height / 2);
    art.addChild(sprite);
    return;
  }

  const body: Graphics = new Graphics();

  drawShape(body, enemy.color, size);
  body.position.set(width / 2, height / 2);
  art.addChild(body);
}

function createGallery(
  app: Application,
  creations: () => Creations,
  open: (kind: Kind, index: number) => void,
  create: (kind: Kind) => void,
): Gallery {
  const view: Container = new Container();
  const categories: Container = new Container();
  const grid: Container = new Container();
  const list: Container = new Container();
  const mask: Graphics = new Graphics();
  const tiles: Array<Tile> = new Array();
  const buttons: Array<Button> = new Array();
  const scroll: Spring = { value: 0, velocity: 0 };
  let kind: Kind = "stage";
  let selected: number = 0;
  let target: number = 0;
  let active: boolean = false;
  let columns: number = 1;
  let visibleHeight: number = 1;
  let appearTime: number = Infinity;

  function items(): Array<Stage | Pattern | Enemy | Background> {
    const source: Creations = creations();

    if (kind === "stage") {
      return source.stages;
    }

    if (kind === "pattern") {
      return source.patterns;
    }

    if (kind === "enemy") {
      return source.enemies;
    }

    return source.backgrounds;
  }

  function count(): number {
    return items().length + 1;
  }

  function backgroundById(id: string | null): Background | null {
    return (
      creations().backgrounds.find((value: Background) => value.id === id) ??
      null
    );
  }

  function enemyById(id: string | null): Enemy | null {
    return creations().enemies.find((value: Enemy) => value.id === id) ?? null;
  }

  function patternById(id: string | null): Pattern | null {
    return (
      creations().patterns.find((value: Pattern) => value.id === id) ?? null
    );
  }

  function choose(index: number): void {
    if (!active) {
      return;
    }

    if (index === 0) {
      create(kind);
    } else {
      open(kind, index - 1);
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

  function select(index: number): void {
    selected = Math.min(Math.max(index, 0), count() - 1);
    reveal();
    paint();
  }

  function paint(): void {
    for (let index = 0; index < tiles.length; index++) {
      const tile: Tile = tiles[index]!;
      const chosen: boolean = index === selected;
      const fresh: boolean = index === 0;

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
        .fill({
          color: chosen
            ? getTheme().highlight
            : fresh
              ? getTheme().accent
              : getTheme().menuSelected,
          alpha: chosen || fresh ? 1 : tileIdleAlpha,
        });
      tile.name.tint = chosen ? getTheme().menuSelected : getTheme().menuText;
      tile.detail.tint = chosen ? getTheme().menuSelected : 0xffffff;
    }

    for (let index = 0; index < buttons.length; index++) {
      paintButton(buttons[index]!);
    }
  }

  function makeTile(index: number): Tile {
    const tile: Container = new Container();
    const back: Graphics = new Graphics();
    const art: Container = new Container();
    const name: Text = createText(nameSize, "#ffffff");
    const detail: Text = createText(detailSize, detailColor);

    art.position.set(artInset, artTop);
    name.position.set(artInset, artTop + artHeight + 6);
    detail.position.set(artInset, artTop + artHeight + 6 + nameSize + 2);
    tile.addChild(back, art, name, detail);
    tile.eventMode = "static";
    tile.cursor = "pointer";
    tile.hitArea = new Rectangle(0, 0, tileWidth, tileHeight);
    tile.on("pointerover", () => {
      if (active) {
        selected = index;
        paint();
      }
    });
    tile.on("pointertap", () => {
      selected = index;
      paint();
      choose(index);
    });

    return { view: tile, back: back, art: art, name: name, detail: detail };
  }

  function describe(tile: Tile, index: number): void {
    const width: number = tileWidth - artInset * 2;

    for (const child of tile.art.removeChildren()) {
      child.destroy({ children: true });
    }

    if (index === 0) {
      const plus: Text = createText(plusSize, "#ffffff");

      plus.text = "+";
      plus.anchor.set(0.5);
      plus.position.set(width / 2, artHeight / 2);
      tile.art.addChild(plus);
      tile.name.text = "NEW " + kind.toUpperCase();
      tile.detail.text = "";
      return;
    }

    const item: Stage | Pattern | Enemy | Background = items()[index - 1]!;

    tile.name.text = item.name.toUpperCase();

    if (kind === "stage") {
      const stage: Stage = item as Stage;

      drawBackground(
        tile.art,
        backgroundById(stage.background),
        width,
        artHeight,
      );
      tile.detail.text =
        stage.length +
        "s  ·  " +
        stage.keyframes.length +
        (stage.keyframes.length === 1 ? " keyframe" : " keyframes");
    } else if (kind === "pattern") {
      const pattern: Pattern = item as Pattern;

      drawPattern(tile.art, pattern, width, artHeight);
      tile.detail.text = pattern.count + " bullets  ·  " + pattern.rate + "/s";
    } else if (kind === "enemy") {
      const enemy: Enemy = item as Enemy;

      drawEnemy(tile.art, enemy, width, artHeight);
      tile.detail.text =
        enemy.health +
        " hp  ·  " +
        (patternById(enemy.pattern)?.name ?? "No pattern");
    } else {
      drawBackground(tile.art, item as Background, width, artHeight);
      tile.detail.text = "Scroll " + (item as Background).scroll;
    }

    if (kind === "stage") {
      const stage: Stage = item as Stage;
      const used: Set<string> = new Set();

      for (const spawn of stage.keyframes.flatMap(
        (keyframe: Keyframe) => keyframe.spawns,
      )) {
        const enemy: Enemy | null = enemyById(spawn.enemy);

        if (enemy === null || used.has(enemy.id) || used.size >= 4) {
          continue;
        }

        const holder: Container = new Container();

        drawEnemy(holder, enemy, 36, 36);
        holder.position.set(
          width / 2 - 72 + used.size * 40,
          artHeight / 2 - 18,
        );
        tile.art.addChild(holder);
        used.add(enemy.id);
      }
    }
  }

  function arrange(): void {
    for (let index = 0; index < tiles.length; index++) {
      const progress: number = Math.min(
        Math.max((appearTime - index * appearStagger) / appearDuration, 0),
        1,
      );
      const eased: number = 1 - Math.pow(1 - progress, 3);

      tiles[index]!.view.alpha = eased;
      tiles[index]!.view.position.set(
        (index % columns) * (tileWidth + tileGap),
        rowOf(index) * (tileHeight + tileGap) + appearDistance * (1 - eased),
      );
    }
  }

  function appear(): void {
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
      tiles.pop()!.view.destroy({ children: true });
    }

    for (let index = 0; index < tiles.length; index++) {
      describe(tiles[index]!, index);
    }

    arrange();
    select(selected);
  }

  function showKind(next: Kind): void {
    if (next === kind) {
      return;
    }

    kind = next;
    selected = 0;
    target = 0;
    refresh();
    appear();
  }

  for (let index = 0; index < kinds.length; index++) {
    const value: Kind = kinds[index]!;
    const button: Button = createButton(
      kindNames.get(value)!,
      () => kind === value,
      () => showKind(value),
    );

    button.view.x = index * (buttonWidth + buttonGap);
    buttons.push(button);
    categories.addChild(button.view);
  }

  function layout(): void {
    const area: number = app.screen.width * galleryWidth;
    const top: number = app.screen.height * galleryTop;

    columns = Math.max(Math.floor((area + tileGap) / (tileWidth + tileGap)), 1);

    const width: number = columns * (tileWidth + tileGap) - tileGap;
    const left: number = Math.round(app.screen.width / 2 - width / 2);

    visibleHeight = app.screen.height * galleryBottom - top;
    grid.position.set(left, top);
    categories.position.set(
      Math.round(
        app.screen.width / 2 -
          (kinds.length * (buttonWidth + buttonGap) - buttonGap) / 2,
      ),
      top - buttonHeight - categoryGap,
    );
    mask
      .clear()
      .rect(-tileSlant, 0, width + tileSlant * 2, visibleHeight)
      .fill(0xffffff);
    grid.hitArea = new Rectangle(0, 0, width, visibleHeight);
    arrange();
    reveal();
  }

  grid.addChild(list, mask);
  list.mask = mask;
  view.addChild(categories, grid);
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

    if (appearTime < appearDuration + tiles.length * appearStagger) {
      appearTime += ticker.deltaMS / 1000;
      arrange();
    }
  });

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!active || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      select(selected - 1);
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      select(selected + 1);
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      select(selected - columns);
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      select(selected + columns);
    } else if (event.code === "Enter" || event.code === "Space") {
      choose(selected);
    } else if (event.code.startsWith("Digit")) {
      const next: Kind | undefined = kinds[Number(event.code.slice(5)) - 1];

      if (next === undefined) {
        return;
      }

      showKind(next);
    } else {
      return;
    }

    event.preventDefault();
  });

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
    setActive: setActive,
  };
}

export { createGallery };
export type { Gallery, Kind };
