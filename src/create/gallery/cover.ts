import {
  Assets,
  Color,
  ColorMatrixFilter,
  Sprite,
  type Application,
  type ColorSource,
  type Graphics,
  type Texture,
} from "pixi.js";
import { getTheme } from "../../theme/theme";
import { tileHeight, tileRadius, tileWidth, trim } from "./style";

type Raindrop = {
  x: number; // px
  y: number; // px
  speed: number; // px/s
  length: number; // px
};

const logoPath: string = "./logo.svg";
const logoWidth: number = 150; // px
const logoResolution: number = 2;
const plateHeight: number = 110; // px
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

export {
  logoWidth,
  plateHeight,
  plateInset,
  plateTop,
  rainCount,
  rainMaxDelta,
  tintedLogo,
  drawCover,
  createDrop,
  drawRain,
};
export type { Raindrop };
