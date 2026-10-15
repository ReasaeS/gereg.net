import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { drawStripes } from "../game/field";
import { createGlide, type Glide } from "../ui/motion";
import { defaultWallpaper } from "./defaults";
import { getTexture, loadTexture } from "./images";
import type { Wallpaper } from "./types";

type WallpaperView = {
  view: Container;
  show: (wallpaper: Wallpaper | null) => void;
};

const plainWallpaper: Wallpaper = defaultWallpaper();
const painted: WeakMap<Container, Wallpaper> = new WeakMap();

function paintWallpaper(
  layer: Container,
  wallpaper: Wallpaper | null,
  width: number,
  height: number,
  scale: number,
): void {
  const value: Wallpaper = wallpaper ?? plainWallpaper;
  const stripes: Graphics = new Graphics();
  const texture: Texture | null = getTexture(value.sprite);

  for (const child of layer.removeChildren()) {
    child.destroy();
  }

  painted.set(layer, value);
  drawStripes(
    stripes,
    width,
    height,
    value.base,
    value.stripe,
    value.stripes,
    scale,
  );
  layer.addChild(stripes);

  if (texture !== null) {
    const image: Sprite = new Sprite(texture);
    const mask: Graphics = new Graphics()
      .rect(0, 0, width, height)
      .fill(0xffffff);

    image.anchor.set(0.5);
    image.scale.set(Math.max(width / texture.width, height / texture.height));
    image.position.set(width / 2, height / 2);
    image.mask = mask;
    layer.addChild(image, mask);
    return;
  }

  if (value.sprite !== null) {
    void loadTexture(value.sprite).then((loaded: Texture | null) => {
      if (loaded !== null && !layer.destroyed && painted.get(layer) === value) {
        paintWallpaper(layer, wallpaper, width, height, scale);
      }
    });
  }
}

function createWallpaperView(
  width: number,
  height: number,
  scale: number,
  smoothing: number,
): WallpaperView {
  const view: Container = new Container();
  let front: Container | null = null;
  let shownId: string | null = null;
  let shownLook: string = "";
  const fade: Glide = createGlide(
    1,
    (value: number) => {
      if (front !== null) {
        front.alpha = value;
      }

      if (value === 1 && view.children.length > 1) {
        for (const child of view.removeChildren(0, view.children.length - 1)) {
          child.destroy({ children: true });
        }
      }
    },
    smoothing,
  );

  function show(wallpaper: Wallpaper | null): void {
    const id: string | null = wallpaper?.id ?? null;
    const look: string = JSON.stringify(wallpaper);

    if (front !== null && id === shownId) {
      if (look !== shownLook) {
        shownLook = look;
        paintWallpaper(front, wallpaper, width, height, scale);
      }

      return;
    }

    shownId = id;
    shownLook = look;
    front = new Container();
    paintWallpaper(front, wallpaper, width, height, scale);
    view.addChild(front);

    if (view.children.length === 1) {
      fade.snap(1);
      return;
    }

    fade.snap(0);
    fade.set(1);
  }

  return { view: view, show: show };
}

export { paintWallpaper, createWallpaperView };
export type { WallpaperView };
