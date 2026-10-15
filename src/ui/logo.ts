import { Assets, type Sprite, type Texture } from "pixi.js";
import { onRatio, renderRatio } from "./density";

const logoPath: string = "./logo.svg";
const logoResolution: number = 2;

function loadLogo(): Promise<Texture> {
  return Assets.load({
    src: logoPath,
    data: { resolution: logoResolution * renderRatio() },
  });
}

function trackLogo(sprite: Sprite): void {
  onRatio((ratio: number) => {
    void Assets.load<Texture>({
      src: `${logoPath}?ratio=${ratio}`,
      data: { resolution: logoResolution * ratio },
    }).then((texture: Texture) => {
      if (renderRatio() === ratio) {
        sprite.texture = texture;
      }
    });
  });
}

export { loadLogo, trackLogo };
