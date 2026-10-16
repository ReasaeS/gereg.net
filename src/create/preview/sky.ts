import {
  Container,
  FillGradient,
  Graphics,
  TilingSprite,
  type Texture,
} from "pixi.js";
import { getTexture } from "../images";
import type { Background } from "../types";
import { previewHeight, previewWidth } from "./bounds";

type Sky = {
  view: Container;
  fill: Graphics;
  tiles: TilingSprite;
  gradient: FillGradient | null;
  background: Background | null;
  painted: string;
};

function createSky(): Sky {
  const sky: Sky = {
    view: new Container(),
    fill: new Graphics(),
    tiles: new TilingSprite({ width: previewWidth, height: previewHeight }),
    gradient: null,
    background: null,
    painted: "",
  };

  sky.tiles.visible = false;
  sky.view.addChild(sky.fill, sky.tiles);

  return sky;
}

function skyKey(background: Background | null): string {
  return background === null
    ? ""
    : (getTexture(background.sprite) === null ? "" : background.sprite) +
        background.top +
        background.bottom;
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

export { createSky, skyKey, paintSky };
export type { Sky };
