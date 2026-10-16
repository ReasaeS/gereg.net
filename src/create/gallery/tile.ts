import {
  Color,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  type FederatedPointerEvent,
  type Texture,
} from "pixi.js";
import { approach } from "../../effects/tween/tween";
import { getTheme } from "../../theme/theme";
import { createGlide, mix, type Glide } from "../../ui/motion";
import type { Rarity } from "../rarity";
import type { Action } from "./kinds";
import {
  artHeight,
  artInset,
  artTop,
  blend,
  cardBack,
  cardFace,
  cardInner,
  createSerif,
  detailColor,
  diamond,
  diamondSize,
  tileHeight,
  tileRadius,
  tileWidth,
  trim,
  trimLit,
} from "./style";
import {
  createDrop,
  drawCover,
  logoWidth,
  plateHeight,
  plateInset,
  plateTop,
  rainCount,
  type Raindrop,
} from "./cover";

type TileButton = {
  view: Container;
  back: Graphics;
  label: Text;
  hovered: boolean;
  enabled: boolean;
  width: number; // px
  glow: Glide | null;
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

type TileEvents = {
  hover: () => void;
  tap: () => void;
  act: (action: Action) => void;
};

const actions: Array<Action> = ["delete", "rename", "publish"];
const actionHeight: number = 22; // px
const actionGap: number = 5; // px
const actionSize: number = 10; // px
const actionBottom: number = 14; // px
const actionDisabled: number = 0.35;
const nameSize: number = 17; // px
const detailSize: number = 12; // px
const coverNameGap: number = 30; // px
const rankSize: number = 10; // px
const rankTop: number = 60; // px
const rankGap: number = 22; // px
const gemSize: number = 5; // px
const gemSpacing: number = 13; // px
const rarityDepth: number = 0.45;
const rarityLit: number = 0.25;
const selectDuration: number = 0.18; // s
const flipDuration: number = 0.4; // s
const flipShade: number = 0.35;
const tileLift: number = 0.06;

function isFaceUp(angle: number): boolean {
  return Math.round(angle / Math.PI) % 2 === 1;
}

function drawAction(button: TileButton, lit: number): void {
  const width: number = button.width;

  button.back
    .clear()
    .rect(0, 0, width, actionHeight)
    .fill({ color: trimLit, alpha: lit * 0.22 })
    .rect(0, 0, width, actionHeight)
    .stroke({ color: mix(trim, trimLit, lit), width: 0.75, alignment: 1 });
  button.label.tint = mix(getTheme().menuText, trimLit, lit);
}

function paintAction(button: TileButton): void {
  const lit: number = button.hovered && button.enabled ? 1 : 0;

  button.glow ??= createGlide(lit, (amount: number) =>
    drawAction(button, amount),
  );
  button.glow.set(lit);
  drawAction(button, button.glow.value());
  button.view.alpha = button.enabled ? 1 : actionDisabled;
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

function paintTile(tile: Tile, gems: boolean): void {
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

      if (!gems) {
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

function stepTile(
  tile: Tile,
  goal: number,
  faceUp: boolean,
  delta: number,
): boolean {
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

  if (tile.lit === goal && tile.turnProgress >= 1) {
    return false;
  }

  tile.lit = approach(tile.lit, goal, delta / selectDuration);
  tile.turnProgress = approach(
    tile.turnProgress,
    1,
    (delta / flipDuration) * (Math.PI / (tile.turnTo - tile.turnFrom)),
  );

  return true;
}

function createTile(
  faceUp: boolean,
  logo: Texture | null,
  events: TileEvents,
): Tile {
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
    .rect(plateInset, plateTop + 1, tileWidth - plateInset * 2, plateHeight - 2)
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
        glow: null,
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

        if (button.enabled) {
          events.act(action);
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
  tile.on("pointerover", () => events.hover());
  tile.on("pointertap", () => events.tap());

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
    turnFrom: faceUp ? Math.PI : 0,
    turnTo: faceUp ? Math.PI : 0,
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

export { createTile, paintTile, applyTransform, stepTile };
export type { Tile };
