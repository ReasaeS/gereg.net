import {
  Container,
  FillGradient,
  Graphics,
  TilingSprite,
  type Texture,
} from "pixi.js";
import { getTexture } from "../images";
import { layerKey, layerTexture } from "../scenery";
import type { Background, Parallax } from "../types";
import { previewHeight, previewWidth } from "./bounds";

type Layer = {
  tiles: TilingSprite;
  parallax: Parallax;
};

type Sky = {
  view: Container;
  fill: Graphics;
  tiles: TilingSprite;
  layers: Array<Layer>;
  gradient: FillGradient | null;
  background: Background | null;
  painted: string;
  clock: number; // s
};

function createSky(): Sky {
  const sky: Sky = {
    view: new Container(),
    fill: new Graphics(),
    tiles: new TilingSprite({ width: previewWidth, height: previewHeight }),
    layers: new Array(),
    gradient: null,
    background: null,
    painted: "",
    clock: 0,
  };

  sky.tiles.visible = false;
  sky.view.addChild(sky.fill, sky.tiles);

  return sky;
}

function spriteKey(sprite: string | null): string {
  return getTexture(sprite) === null ? "" : (sprite ?? "");
}

function skyKey(background: Background | null): string {
  return background === null
    ? ""
    : spriteKey(background.sprite) +
        background.top +
        background.bottom +
        background.layers
          .map((layer: Parallax) => layerKey(layer) + ":" + layer.opacity)
          .join(",");
}

function setSkyTime(sky: Sky, time: number): void {
  sky.clock = time;
  sky.tiles.tilePosition.y = (sky.background?.scroll ?? 0) * time;

  for (const layer of sky.layers) {
    layer.tiles.tilePosition.set(
      layer.parallax.drift * time,
      layer.parallax.scroll * time,
    );
  }
}

function advanceSky(sky: Sky, delta: number): void {
  setSkyTime(sky, sky.clock + delta);
}

function paintLayers(sky: Sky): void {
  for (const layer of sky.layers) {
    layer.tiles.destroy();
  }

  sky.layers = new Array();

  for (const parallax of sky.background?.layers ?? []) {
    const texture: Texture | null = layerTexture(parallax);

    if (texture === null) {
      continue;
    }

    const tiles: TilingSprite = new TilingSprite({
      texture: texture,
      width: previewWidth,
      height: previewHeight,
    });

    tiles.tileScale.set(previewWidth / texture.width);
    tiles.alpha = parallax.opacity;
    sky.view.addChild(tiles);
    sky.layers.push({ tiles: tiles, parallax: parallax });
  }

  setSkyTime(sky, sky.clock);
}

function paintSky(sky: Sky): void {
  const background: Background | null = sky.background;
  const texture: Texture | null = getTexture(background?.sprite ?? null);

  sky.painted = skyKey(background);
  sky.tiles.visible = texture !== null;

  if (texture !== null) {
    sky.tiles.texture = texture;
    sky.tiles.tileScale.set(previewWidth / texture.width);
  }

  sky.gradient?.destroy();
  sky.gradient = null;
  sky.fill.clear();
  paintLayers(sky);

  if (background === null) {
    sky.fill.rect(0, 0, previewWidth, previewHeight).fill("#01040f");
    return;
  }

  sky.gradient = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: background.top },
      { offset: 1, color: background.bottom },
    ],
  });
  sky.fill.rect(0, 0, previewWidth, previewHeight).fill(sky.gradient);
}

export { createSky, skyKey, paintSky, setSkyTime, advanceSky };
export type { Sky };
