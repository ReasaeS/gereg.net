import {
  Assets,
  Color,
  ColorMatrixFilter,
  Container,
  type ColorSource,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type Application,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
  type Texture,
  type Ticker,
} from "pixi.js";
import { approach, smoothDamp, type Spring } from "../effects/tween/tween";
import type {
  Background,
  Character,
  Creations,
  Cutscene,
  Enemy,
  Line,
  Keyframe,
  Pattern,
  Spell,
  Sound,
  Stage,
} from "./data";
import { placeAlong, solidSpans, wallAngle } from "./data";
import { getTexture } from "./images";
import { getTheme } from "../theme/theme";
import { drawShape, previewHeight, previewWidth } from "./preview";
import { drawSpell, spellRadius } from "./sigil";
import { drawSound, soundLength } from "./sound";
import { createBackdrop, type Backdrop } from "./backdrop";
import { castOf, feelingOf, speakerOf } from "./cutscene";
import {
  cosmetics,
  difficulties,
  frames,
  defaultName,
  ranks,
  rarityOf,
  type Rarity,
} from "./rarity";

type Kind =
  | "stage"
  | "pattern"
  | "enemy"
  | "background"
  | "spell"
  | "sound"
  | "character"
  | "cutscene";

type Raindrop = {
  x: number; // px
  y: number; // px
  speed: number; // px/s
  length: number; // px
};

type Category = "stage" | "cosmetic" | "enemy" | "pattern";

type Entry = {
  kind: Kind;
  index: number;
  item:
    Stage | Pattern | Enemy | Background | Spell | Sound | Character | Cutscene;
};

type Live = {
  show: (kind: Kind, index: number) => Container | null;
  update: (delta: number) => void;
};

type Gallery = {
  view: Container;
  refresh: () => void;
  appear: () => void;
  disappear: () => Promise<void>;
  disappearTime: () => number;
  setActive: (active: boolean) => void;
};

type Action = "delete" | "rename" | "publish";

type TileButton = {
  view: Container;
  back: Graphics;
  label: Text;
  hovered: boolean;
  enabled: boolean;
  width: number; // px
};

type Tile = {
  view: Container;
  face: Container;
  cover: Container;
  coverName: Text;
  coverArt: Graphics;
  rain: Graphics;
  drops: Array<Raindrop>;
  coverFill: number;
  coverRank: Text;
  gems: Graphics;
  rank: Text;
  rarity: Rarity<unknown> | null;
  turnFrom: number; // rad
  turnTo: number; // rad
  turnProgress: number;
  back: Graphics;
  art: Container;
  name: Text;
  detail: Text;
  actions: Container;
  buttons: Array<TileButton>;
  lit: number;
};

const categoryList: Array<Category> = ["stage", "enemy", "pattern", "cosmetic"];
const categoryNames: Map<Category, string> = new Map([
  ["stage", "stages"],
  ["cosmetic", "cosmetics"],
  ["enemy", "enemies"],
  ["pattern", "patterns"],
]);
const itemNames: Map<Category, string> = new Map([
  ["stage", "stage"],
  ["cosmetic", "cosmetic"],
  ["enemy", "enemy"],
  ["pattern", "pattern"],
]);
const tileWidth: number = 190; // px
const tileHeight: number = 300; // px
const tileRadius: number = 10; // px
const actions: Array<Action> = ["delete", "rename", "publish"];
const actionHeight: number = 22; // px
const actionGap: number = 5; // px
const actionSize: number = 10; // px
const actionBottom: number = 14; // px
const actionDisabled: number = 0.35;
const tileGap: number = 26; // px
const artInset: number = 16; // px
const artTop: number = 18; // px
const artHeight: number = 140; // px
const nameSize: number = 17; // px
const detailSize: number = 12; // px
const plusSize: number = 56; // px
const nameMargin: number = 14; // px
const logoPath: string = "./logo.svg";
const logoWidth: number = 150; // px
const logoResolution: number = 2;
const plateHeight: number = 110; // px
const coverNameGap: number = 30; // px
const rankSize: number = 10; // px
const rankTop: number = 60; // px
const rankGap: number = 22; // px
const gemSize: number = 5; // px
const gemSpacing: number = 13; // px
const gemCategories: Array<Category> = ["stage", "enemy"];
const rainCount: number = 16;
const rainMinSpeed: number = 200; // px/s
const rainMaxSpeed: number = 400; // px/s
const rainMinLength: number = 11; // px
const rainMaxLength: number = 14; // px
const rainWind: number = 100; // px/s
const rainAlpha: number = 0.7;
const rainMaxDelta: number = 0.05; // s
const plateInset: number = 12; // px
const plateTop: number = tileHeight / 2 - plateHeight / 2; // px
const plateBottom: number = tileHeight / 2 + plateHeight / 2; // px
const rainDrift: number = (rainWind * plateHeight) / rainMinSpeed; // px
const rarityDepth: number = 0.45;
const rarityLit: number = 0.25;
const dotLimit: number = 24;
const galleryWidth: number = 0.8; // of screen width
const galleryTop: number = 0.22; // of screen height
const galleryBottom: number = 0.97; // of screen height
const headerY: number = 0.11; // of screen height
const tabSize: number = 26; // px
const tabGap: number = 56; // px
const ornamentLength: number = 0.16; // of screen width
const ornamentGap: number = 30; // px
const diamondSize: number = 5; // px
const focusGap: number = 16; // px
const scrollSmoothing: number = 0.08; // s
const appearDuration: number = 0.45; // s
const appearStagger: number = 0.05; // s
const appearDistance: number = 40; // px
const staggerLimit: number = 16;
const selectDuration: number = 0.18; // s
const flipDuration: number = 0.4; // s
const flipShade: number = 0.35;
const tileLift: number = 0.06;
const liftMargin: number = 14; // px
const trim: string = getTheme().highlight;
const trimLit: string = getTheme().accent;
const detailColor: string = "#9fd8ff";
const cardFace: string = getTheme().menuSelected;
const cardInner: string = getTheme().seaDeep;
const cardBack: string = getTheme().seaMiddle;
const serifFamily: Array<string> = ["Georgia", "Times New Roman", "serif"];

function createSerif(size: number, color: string): Text {
  return new Text({
    text: "",
    style: {
      fontFamily: serifFamily,
      fontSize: size,
      fontWeight: "700",
      letterSpacing: size * 0.12,
      fill: color,
    },
  });
}

function diamond(graphics: Graphics, x: number, y: number, size: number): void {
  graphics.poly([x, y - size, x + size, y, x, y + size, x - size, y]);
}

function fit(text: Text): void {
  text.scale.set(1);
  text.scale.set(Math.min((tileWidth - nameMargin * 2) / text.width, 1));
}

function tintedLogo(app: Application): Texture | null {
  const source: Texture | undefined = Assets.get<Texture>(logoPath);

  if (source === undefined) {
    return null;
  }

  const sprite: Sprite = new Sprite(source);
  const tint: ColorMatrixFilter = new ColorMatrixFilter();
  const [red, green, blue] = new Color(getTheme().ring).toRgbArray() as [
    number,
    number,
    number,
  ];

  tint.matrix = [
    0,
    0,
    0,
    0,
    red,
    0,
    0,
    0,
    0,
    green,
    0,
    0,
    0,
    0,
    blue,
    0,
    0,
    0,
    1,
    0,
  ];
  sprite.filters = [tint];

  const texture: Texture = app.renderer.generateTexture({
    target: sprite,
    resolution: logoResolution,
  });

  sprite.destroy();

  return texture;
}

function isFaceUp(angle: number): boolean {
  return Math.round(angle / Math.PI) % 2 === 1;
}

function drawCover(cover: Graphics, fill: ColorSource): void {
  const centerY: number = tileHeight / 2;

  cover
    .clear()
    .roundRect(0, 0, tileWidth, tileHeight, tileRadius)
    .fill(fill)
    .roundRect(0, 0, tileWidth, tileHeight, tileRadius)
    .stroke({ color: trim, width: 2, alignment: 1 })
    .roundRect(6, 6, tileWidth - 12, tileHeight - 12, tileRadius - 4)
    .stroke({ color: trim, width: 0.75, alpha: 0.6 });

  for (let offset = -tileHeight; offset < tileWidth; offset += 18) {
    const startX: number = Math.max(12, 12 + offset);
    const endX: number = Math.min(tileWidth - 12, tileHeight - 12 + offset);

    if (startX < endX) {
      cover.moveTo(startX, startX - offset).lineTo(endX, endX - offset);
    }
  }

  cover.stroke({ color: trim, width: 0.5, alpha: 0.18 });
  cover
    .rect(12, centerY - plateHeight / 2, tileWidth - 24, plateHeight)
    .fill(fill)
    .rect(12, centerY - plateHeight / 2, tileWidth - 24, 1)
    .rect(12, centerY + plateHeight / 2 - 1, tileWidth - 24, 1)
    .fill({ color: trim, alpha: 0.7 });
}

function createDrop(fresh: boolean): Raindrop {
  const length: number =
    rainMinLength + Math.random() * (rainMaxLength - rainMinLength);

  return {
    x:
      plateInset -
      rainDrift +
      Math.random() * (tileWidth - plateInset * 2 + rainDrift),
    y: fresh
      ? plateTop + Math.random() * (plateHeight + length)
      : plateTop - Math.random() * plateHeight * 0.5,
    speed: rainMinSpeed + Math.random() * (rainMaxSpeed - rainMinSpeed),
    length: length,
  };
}

function drawRain(rain: Graphics, drops: Array<Raindrop>, delta: number): void {
  rain.clear();

  for (let index = 0; index < drops.length; index++) {
    let drop: Raindrop = drops[index]!;

    drop.x += rainWind * delta;
    drop.y += drop.speed * delta;

    if (drop.y - drop.length > plateBottom) {
      drop = createDrop(false);
      drops[index] = drop;
    }

    const reach: number = drop.length / Math.hypot(rainWind, drop.speed);

    rain
      .moveTo(drop.x - rainWind * reach, drop.y - drop.speed * reach)
      .lineTo(drop.x, drop.y);
  }

  rain.stroke({ color: getTheme().rain, width: 1, alpha: rainAlpha });
}

function blend(from: ColorSource, to: ColorSource, amount: number): number {
  const [fromRed, fromGreen, fromBlue] = new Color(from).toRgbArray() as [
    number,
    number,
    number,
  ];
  const [toRed, toGreen, toBlue] = new Color(to).toRgbArray() as [
    number,
    number,
    number,
  ];

  return new Color([
    fromRed + (toRed - fromRed) * amount,
    fromGreen + (toGreen - fromGreen) * amount,
    fromBlue + (toBlue - fromBlue) * amount,
  ]).toNumber();
}

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
  const base: number = ((pattern.heading + 90) * Math.PI) / 180;

  if (pattern.frame === "objective") {
    const direction: number = wallAngle(pattern.wall);
    const directionX: number = Math.cos(direction);
    const directionY: number = Math.sin(direction);
    const travel: number = Math.atan2(pattern.velocity.y, pattern.velocity.x);
    const travelX: number = Math.cos(travel);
    const travelY: number = Math.sin(travel);
    const span: number =
      Math.min(width, height) * 0.8 * Math.min(pattern.cover, 1);

    const spans: Array<[number, number]> = solidSpans(pattern);

    for (let index = 0; index < count; index++) {
      const along: number | null = placeAlong(spans, (index + 0.5) / count);

      if (along === null) {
        break;
      }

      const offset: number = -span / 2 + along * span;
      const x: number = width / 2 - directionX * radius - directionY * offset;
      const y: number = height / 2 - directionY * radius + directionX * offset;

      dots
        .moveTo(x, y)
        .lineTo(x + travelX * radius * 0.6, y + travelY * radius * 0.6)
        .stroke({ color: pattern.color, width: 1, alpha: 0.5 })
        .circle(
          x + travelX * radius * 0.6,
          y + travelY * radius * 0.6,
          size / 2,
        )
        .fill(pattern.color);
    }

    art.addChild(dots);
    return;
  }

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

function drawSpellArt(
  art: Container,
  spell: Spell,
  width: number,
  height: number,
): void {
  const graphics: Graphics = new Graphics();

  drawSpell(graphics, spell, 0);
  graphics.scale.set((Math.min(width, height) * 0.45) / spellRadius(spell));
  graphics.position.set(width / 2, height / 2);
  art.addChild(graphics);
}

function drawSoundArt(
  art: Container,
  sound: Sound,
  width: number,
  height: number,
): void {
  const graphics: Graphics = new Graphics();

  drawSound(graphics, sound, width * 0.8, height * 0.6, getTheme().ring);
  graphics.position.set(width * 0.1, height * 0.2);
  art.addChild(graphics);
}

function drawCharacterArt(
  art: Container,
  character: Character,
  width: number,
  height: number,
): void {
  const texture: Texture | null = getTexture(
    character.emotions[0]?.sprite ?? null,
  );

  drawBackground(art, null, width, height);

  if (texture === null) {
    const figure: Graphics = new Graphics();
    const head: number = height * 0.14;

    figure
      .circle(width / 2, height * 0.38, head)
      .fill({ color: character.color, alpha: 0.8 })
      .roundRect(
        width / 2 - head * 1.6,
        height * 0.38 + head * 1.3,
        head * 3.2,
        height,
        head,
      )
      .fill({ color: character.color, alpha: 0.8 });
    art.addChild(figure);
    return;
  }

  const portrait: Sprite = new Sprite(texture);

  portrait.anchor.set(0.5, 1);
  portrait.scale.set((height * 0.9) / texture.height);
  portrait.position.set(width / 2, height);
  art.addChild(portrait);
}

function drawCutsceneArt(
  art: Container,
  cutscene: Cutscene,
  cast: Array<Character>,
  width: number,
  height: number,
): void {
  const box: Graphics = new Graphics();
  const speakers: Array<Character> = castOf(cutscene, cast);
  const lines: number = Math.min(cutscene.lines.length, 2);

  drawBackground(art, null, width, height);

  for (const character of speakers.slice(0, 1)) {
    const said: Line | undefined = cutscene.lines.find(
      (value: Line) => value.character === character?.id,
    );
    const texture: Texture | null =
      said === undefined
        ? null
        : getTexture(feelingOf(character, said)?.sprite ?? null);

    if (texture === null) {
      continue;
    }

    const portrait: Sprite = new Sprite(texture);

    portrait.anchor.set(0.5, 1);
    portrait.scale.set((height * 0.7) / texture.height);
    portrait.position.set(width * 0.25, height * 0.7);
    art.addChild(portrait);
  }

  box
    .rect(width * 0.08, height * 0.58, width * 0.84, height * 0.3)
    .fill({ color: "#01040f", alpha: 0.82 })
    .stroke({ color: "#ffffff", width: 1, alignment: 1 });

  for (let order = 0; order < lines; order++) {
    box
      .rect(
        width * 0.13,
        height * (0.65 + order * 0.1),
        width * (order === 0 ? 0.6 : 0.4),
        height * 0.04,
      )
      .fill({
        color: speakerOf(cast, cutscene.lines[order]!)?.color ?? "#ffffff",
        alpha: 0.8,
      });
  }

  art.addChild(box);
}

function createGallery(
  app: Application,
  creations: () => Creations,
  open: (kind: Kind, index: number) => void,
  create: (category: Category) => void,
  act: (kind: Kind, index: number, action: Action) => void,
  live: Live,
): Gallery {
  const view: Container = new Container();
  const categories: Container = new Container();
  const backdrop: Backdrop = createBackdrop(app);
  const ornament: Graphics = new Graphics();
  const tabs: Array<Text> = new Array();
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
    const source: Creations = creations();
    const list: Array<Entry> = new Array();

    function add(
      kind: Kind,
      items: Array<
        | Stage
        | Pattern
        | Enemy
        | Background
        | Spell
        | Sound
        | Character
        | Cutscene
      >,
    ): void {
      for (let index = 0; index < items.length; index++) {
        list.push({ kind: kind, index: index, item: items[index]! });
      }
    }

    if (category === "stage") {
      add("stage", source.stages);
    } else if (category === "pattern") {
      add("pattern", source.patterns);
    } else if (category === "enemy") {
      add("enemy", source.enemies);
    } else {
      add("background", source.backgrounds);
      add("spell", source.spells);
      add("sound", source.sounds);
      add("cutscene", source.cutscenes);
      add("character", source.characters);
    }

    return list.sort(compare);
  }

  function compare(first: Entry, second: Entry): number {
    const tier: number =
      (rarity(first).tier - rarity(second).tier) *
      (category === "stage" ? -1 : 1);
    const firstDefault: RegExpExecArray | null = defaultName.exec(
      first.item.name,
    );
    const secondDefault: RegExpExecArray | null = defaultName.exec(
      second.item.name,
    );

    if (tier !== 0) {
      return tier;
    }

    if (firstDefault !== null && secondDefault !== null) {
      return Number(firstDefault[2]) - Number(secondDefault[2]);
    }

    if (firstDefault !== null || secondDefault !== null) {
      return firstDefault !== null ? 1 : -1;
    }

    return first.item.name.localeCompare(second.item.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function rarity(entry: Entry): Rarity<unknown> {
    if (entry.kind === "stage") {
      return rarityOf(difficulties, (entry.item as Stage).difficulty);
    }

    if (entry.kind === "enemy") {
      return rarityOf(ranks, (entry.item as Enemy).rank);
    }

    if (entry.kind === "pattern") {
      return rarityOf(frames, (entry.item as Pattern).frame);
    }

    return rarityOf(cosmetics, entry.kind);
  }

  function count(): number {
    return entries().length + 1;
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

    paintTabs();
  }

  function drawTile(index: number): void {
    const tile: Tile = tiles[index]!;
    const lit: number = tile.lit;
    const tone: string | null = tile.rarity?.color ?? null;
    const border: number = blend(trim, trimLit, lit);
    const body: number =
      tone === null
        ? new Color(cardBack).toNumber()
        : blend(tone, "#000000", rarityDepth);
    const face: number =
      tone === null
        ? blend(cardFace, getTheme().skyTop, lit)
        : blend(body, tone, rarityLit * lit);

    if (tile.coverFill !== body) {
      tile.coverFill = body;
      drawCover(tile.coverArt, body);
    }

    tile.back
      .clear()
      .roundRect(-6, -6, tileWidth + 12, tileHeight + 12, tileRadius + 6)
      .stroke({ color: trimLit, width: 6, alpha: 0.3 * lit })
      .roundRect(0, 0, tileWidth, tileHeight, tileRadius)
      .fill(face)
      .roundRect(0, 0, tileWidth, tileHeight, tileRadius)
      .stroke({ color: border, width: 2, alignment: 1 })
      .roundRect(5, 5, tileWidth - 10, tileHeight - 10, tileRadius - 4)
      .stroke({ color: border, width: 0.75, alpha: 0.55 })
      .rect(artInset, artTop, tileWidth - artInset * 2, artHeight)
      .fill(cardInner)
      .rect(artInset, artTop, tileWidth - artInset * 2, artHeight)
      .stroke({ color: border, width: 1, alpha: 0.7 });

    for (const [x, y] of [
      [10, 10],
      [tileWidth - 10, 10],
      [10, tileHeight - 10],
      [tileWidth - 10, tileHeight - 10],
    ] as Array<[number, number]>) {
      diamond(tile.back, x, y, diamondSize - 1);
    }

    tile.back.fill(border);
    tile.gems.clear();

    if (tile.rarity !== null) {
      const color: string = tile.rarity.color;
      const tier: number = tile.rarity.tier;

      for (const graphics of [tile.back, tile.gems]) {
        graphics
          .roundRect(8, 8, tileWidth - 16, tileHeight - 16, tileRadius - 5)
          .stroke({ color: color, width: 1, alpha: 0.8 });

        if (!gemCategories.includes(category)) {
          continue;
        }

        for (let gem = 0; gem < tier; gem++) {
          diamond(
            graphics,
            tileWidth / 2 + (gem - (tier - 1) / 2) * gemSpacing,
            0,
            gemSize,
          );
        }

        graphics.fill(color).stroke({ color: cardBack, width: 1.5 });
      }

      tile.rank.tint = color;
      tile.coverRank.tint = color;
    }

    tile.name.tint = border;
    tile.coverName.tint = border;
    tile.detail.tint = blend(detailColor, "#ffffff", lit);
    applyTransform(tile);

    for (const button of tile.buttons) {
      paintAction(button);
    }
  }

  function applyTransform(tile: Tile): void {
    const lift: number = 1 + tileLift * tile.lit;
    const progress: number = tile.turnProgress;
    const eased: number = progress * progress * (3 - 2 * progress);
    const angle: number = tile.turnFrom + (tile.turnTo - tile.turnFrom) * eased;
    const turn: number = Math.abs(Math.cos(angle));
    const edge: number = Math.abs(Math.sin(angle));
    const shade: number = 1 - flipShade * edge;

    tile.face.visible = Math.cos(angle) < 0;
    tile.cover.visible = !tile.face.visible;
    tile.view.scale.set(lift * Math.max(turn, 0.001), lift);
    tile.face.tint = blend("#000000", "#ffffff", shade);
    tile.cover.tint = tile.face.tint;
  }

  function animateTiles(delta: number): void {
    for (let index = 0; index < tiles.length; index++) {
      const tile: Tile = tiles[index]!;
      const goal: number = !onTabs && index === selected ? 1 : 0;

      const faceUp: boolean = index === 0 || index === revealed;

      if (faceUp !== isFaceUp(tile.turnTo)) {
        const progress: number = tile.turnProgress;
        const eased: number = progress * progress * (3 - 2 * progress);
        const current: number =
          tile.turnFrom + (tile.turnTo - tile.turnFrom) * eased;
        let next: number = Math.floor(current / Math.PI + 1) * Math.PI;

        if (isFaceUp(next) !== faceUp) {
          next += Math.PI;
        }

        tile.turnFrom = current;
        tile.turnTo = next;
        tile.turnProgress = 0;
      }

      if (tile.lit !== goal || tile.turnProgress < 1) {
        tile.lit = approach(tile.lit, goal, delta / selectDuration);
        tile.turnProgress = approach(
          tile.turnProgress,
          1,
          (delta / flipDuration) * (Math.PI / (tile.turnTo - tile.turnFrom)),
        );
        drawTile(index);
      }
    }
  }

  function makeTile(index: number): Tile {
    const tile: Container = new Container();
    const back: Graphics = new Graphics();
    const art: Container = new Container();
    const artMask: Graphics = new Graphics()
      .rect(artInset, artTop, tileWidth - artInset * 2, artHeight)
      .fill(0xffffff);
    const name: Text = createSerif(nameSize, "#ffffff");
    const detail: Text = createSerif(detailSize, "#ffffff");
    const face: Container = new Container();
    const cover: Container = new Container();
    const coverArt: Graphics = new Graphics();
    const coverName: Text = createSerif(nameSize, "#ffffff");
    const coverRank: Text = createSerif(rankSize, "#ffffff");
    const rank: Text = createSerif(rankSize, "#ffffff");
    const gems: Graphics = new Graphics();

    const rain: Graphics = new Graphics();
    const rainMask: Graphics = new Graphics()
      .rect(
        plateInset,
        plateTop + 1,
        tileWidth - plateInset * 2,
        plateHeight - 2,
      )
      .fill(0xffffff);
    const drops: Array<Raindrop> = new Array();

    for (let drop = 0; drop < rainCount; drop++) {
      drops.push(createDrop(true));
    }

    drawCover(coverArt, cardBack);
    rain.mask = rainMask;
    cover.addChild(coverArt, rain, rainMask, gems, coverName, coverRank);
    coverRank.anchor.set(0.5);
    coverRank.position.set(
      tileWidth / 2,
      tileHeight / 2 + plateHeight / 2 + coverNameGap + rankGap,
    );
    rank.anchor.set(0.5, 0);
    rank.position.set(tileWidth / 2, artTop + artHeight + rankTop);
    coverName.anchor.set(0.5);
    coverName.position.set(
      tileWidth / 2,
      tileHeight / 2 + plateHeight / 2 + coverNameGap,
    );

    if (logo !== null) {
      const emblem: Sprite = new Sprite(logo);

      emblem.anchor.set(0.5);
      emblem.scale.set(logoWidth / logo.width);
      emblem.position.set(tileWidth / 2, tileHeight / 2);
      cover.addChild(emblem);
    }
    art.position.set(artInset, artTop);
    art.mask = artMask;
    name.anchor.set(0.5, 0);
    name.position.set(tileWidth / 2, artTop + artHeight + 16);
    detail.anchor.set(0.5, 0);
    detail.position.set(tileWidth / 2, artTop + artHeight + 22 + nameSize);
    const row: Container = new Container();
    const width: number =
      (tileWidth - artInset * 2 - actionGap * (actions.length - 1)) /
      actions.length;
    const tileButtons: Array<TileButton> = actions.map(
      (action: Action, position: number) => {
        const button: TileButton = {
          view: new Container(),
          back: new Graphics(),
          label: createSerif(actionSize, "#ffffff"),
          hovered: false,
          enabled: true,
          width: width,
        };

        button.label.text = action.toUpperCase();
        button.label.anchor.set(0.5);
        button.label.position.set(width / 2, actionHeight / 2);
        button.view.addChild(button.back, button.label);
        button.view.x = position * (width + actionGap);
        button.view.eventMode = "static";
        button.view.cursor = "pointer";
        button.view.hitArea = new Rectangle(0, 0, width, actionHeight);
        button.view.on("pointerover", () => {
          button.hovered = true;
          paintAction(button);
        });
        button.view.on("pointerout", () => {
          button.hovered = false;
          paintAction(button);
        });
        button.view.on("pointertap", (event: FederatedPointerEvent) => {
          event.stopPropagation();

          const entry: Entry | undefined = entries()[index - 1];

          if (active && button.enabled && entry !== undefined) {
            act(entry.kind, entry.index, action);
          }
        });
        row.addChild(button.view);

        return button;
      },
    );

    row.position.set(artInset, tileHeight - actionHeight - actionBottom);
    face.addChild(back, art, artMask, name, detail, rank, row);
    tile.addChild(face, cover);
    tile.eventMode = "static";
    tile.cursor = "pointer";
    tile.hitArea = new Rectangle(0, 0, tileWidth, tileHeight);
    tile.pivot.set(tileWidth / 2, tileHeight / 2);
    tile.on("pointerover", () => {
      if (active) {
        onTabs = false;
        selected = index;
        revealed = index;
        paint();
      }
    });
    tile.on("pointertap", () => {
      onTabs = false;
      selected = index;
      paint();
      choose(index);
    });

    return {
      view: tile,
      face: face,
      cover: cover,
      coverName: coverName,
      coverArt: coverArt,
      rain: rain,
      drops: drops,
      coverFill: new Color(cardBack).toNumber(),
      coverRank: coverRank,
      gems: gems,
      rank: rank,
      rarity: null,
      turnFrom: index === 0 ? Math.PI : 0,
      turnTo: index === 0 ? Math.PI : 0,
      turnProgress: 1,
      back: back,
      art: art,
      name: name,
      detail: detail,
      actions: row,
      buttons: tileButtons,
      lit: 0,
    };
  }

  function paintAction(button: TileButton): void {
    const lit: boolean = button.hovered && button.enabled;
    const width: number = button.width;

    button.back
      .clear()
      .rect(0, 0, width, actionHeight)
      .fill({ color: trimLit, alpha: lit ? 0.22 : 0 })
      .rect(0, 0, width, actionHeight)
      .stroke({ color: lit ? trimLit : trim, width: 0.75, alignment: 1 });
    button.label.tint = lit ? trimLit : getTheme().menuText;
    button.view.alpha = button.enabled ? 1 : actionDisabled;
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
    const item:
      | Stage
      | Pattern
      | Enemy
      | Background
      | Spell
      | Sound
      | Character
      | Cutscene = entry.item;

    tile.rarity = rarity(entry);
    tile.rank.text = tile.rarity.label.toUpperCase();
    tile.coverRank.text = tile.rank.text;

    tile.name.text = item.name.toUpperCase();
    fit(tile.name);
    tile.coverName.text = tile.name.text;
    fit(tile.coverName);

    if (entry.kind === "stage") {
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
    } else if (entry.kind === "pattern") {
      const pattern: Pattern = item as Pattern;

      drawPattern(tile.art, pattern, width, artHeight);
      tile.detail.text = pattern.count + " bullets  ·  " + pattern.rate + "/s";
    } else if (entry.kind === "enemy") {
      const enemy: Enemy = item as Enemy;

      drawEnemy(tile.art, enemy, width, artHeight);
      tile.detail.text =
        enemy.health +
        " hp  ·  " +
        (patternById(enemy.pattern)?.name ?? "No pattern");
    } else if (entry.kind === "sound") {
      const sound: Sound = item as Sound;

      drawSoundArt(tile.art, sound, width, artHeight);
      tile.detail.text =
        (sound.source === "file" ? "file" : sound.wave) +
        "  ·  " +
        soundLength(sound).toFixed(2) +
        "s";
    } else if (entry.kind === "character") {
      const character: Character = item as Character;

      drawCharacterArt(tile.art, character, width, artHeight);
      tile.detail.text =
        character.emotions.length +
        (character.emotions.length === 1 ? " emotion" : " emotions");
    } else if (entry.kind === "cutscene") {
      const cutscene: Cutscene = item as Cutscene;

      const speakers: number = castOf(cutscene, creations().characters).length;

      drawCutsceneArt(
        tile.art,
        cutscene,
        creations().characters,
        width,
        artHeight,
      );
      tile.detail.text =
        speakers +
        (speakers === 1 ? " character" : " characters") +
        "  ·  " +
        cutscene.lines.length +
        (cutscene.lines.length === 1 ? " line" : " lines");
    } else if (entry.kind === "spell") {
      const spell: Spell = item as Spell;

      drawSpellArt(tile.art, spell, width, artHeight);
      tile.detail.text =
        spell.rings.length + (spell.rings.length === 1 ? " ring" : " rings");
    } else {
      drawBackground(tile.art, item as Background, width, artHeight);
      tile.detail.text = "Scroll " + (item as Background).scroll;
    }

    if (entry.kind === "stage") {
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

  for (let index = 0; index < categoryList.length; index++) {
    const value: Category = categoryList[index]!;
    const tab: Text = createSerif(tabSize, "#ffffff");

    tab.text = categoryNames.get(value)!.toUpperCase();
    tab.anchor.set(0.5);
    tab.eventMode = "static";
    tab.cursor = "pointer";
    tab.on("pointertap", () => showKind(value));
    tabs.push(tab);
    categories.addChild(tab);
  }

  function paintTabs(): void {
    const current: Text | undefined = tabs[categoryList.indexOf(category)];

    for (const tab of tabs) {
      tab.tint = tab === current ? trimLit : trim;
      tab.alpha = tab === current ? 1 : 0.7;
    }

    ornament.clear();

    if (current === undefined) {
      return;
    }

    const first: Text = tabs[0]!;
    const last: Text = tabs[tabs.length - 1]!;
    const left: number = first.x - first.width / 2 - ornamentGap;
    const right: number = last.x + last.width / 2 + ornamentGap;
    const length: number = app.screen.width * ornamentLength;

    ornament
      .rect(left - length, -0.5, length, 1)
      .rect(right, -0.5, length, 1)
      .fill({ color: trim, alpha: 0.7 });
    diamond(ornament, left, 0, diamondSize);
    diamond(ornament, right, 0, diamondSize);
    diamond(ornament, left - length, 0, diamondSize - 2);
    diamond(ornament, right + length, 0, diamondSize - 2);
    ornament
      .fill(trim)
      .rect(current.x - current.width / 2, tabSize * 0.85, current.width, 1.5)
      .fill(trimLit);
    diamond(ornament, current.x, tabSize * 0.85 + 0.75, diamondSize);

    if (onTabs) {
      diamond(
        ornament,
        current.x - current.width / 2 - focusGap,
        0,
        diamondSize,
      );
      diamond(
        ornament,
        current.x + current.width / 2 + focusGap,
        0,
        diamondSize,
      );
    }

    ornament.fill(trimLit);
  }

  function layout(): void {
    const area: number = app.screen.width * galleryWidth;
    const top: number = app.screen.height * galleryTop;

    columns = Math.max(Math.floor((area + tileGap) / (tileWidth + tileGap)), 1);

    const width: number = columns * (tileWidth + tileGap) - tileGap;
    const left: number = Math.round(app.screen.width / 2 - width / 2);

    visibleHeight = app.screen.height * galleryBottom - top;
    grid.position.set(left, top);
    let tabX: number = 0;

    for (const tab of tabs) {
      tab.x = tabX + tab.width / 2;
      tabX += tab.width + tabGap;
    }

    for (const tab of tabs) {
      tab.x -= (tabX - tabGap) / 2;
    }

    categories.position.set(
      Math.round(app.screen.width / 2),
      Math.round(app.screen.height * headerY),
    );
    backdrop.layout();
    paintTabs();
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
  categories.addChild(ornament);
  view.addChild(backdrop.view, categories, grid);
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

    backdrop.update(ticker.deltaMS / 1000);

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

    const up: boolean = event.code === "ArrowUp" || event.code === "KeyW";
    const down: boolean = event.code === "ArrowDown" || event.code === "KeyS";
    const left: boolean = event.code === "ArrowLeft" || event.code === "KeyA";
    const right: boolean = event.code === "ArrowRight" || event.code === "KeyD";
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
    } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
      browse(selected - 1);
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      browse(selected + 1);
    } else if (event.code === "ArrowUp" || event.code === "KeyW") {
      browse(selected - columns);
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
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
    disappear: disappear,
    disappearTime: () => Math.min(appearTime, appearEnd()) * 1000,
    setActive: setActive,
  };
}

export { createGallery };
export type { Gallery, Live, Kind, Category, Action };
