import {
  Assets,
  Container,
  Rectangle,
  Sprite,
  Texture,
  type Renderer,
} from "pixi.js";
import type { RainSprite } from "./rainmodel";

type SpriteLayers = {
  color: Texture;
  core: Texture;
};

const cellPadding: number = 2; // px

function loadTexture(path: string): Promise<Texture | null> {
  return Assets.load<Texture>(path).catch(() => {
    console.warn("Could not load sprite: " + path);
    return null;
  });
}

async function loadSprites(
  renderer: Renderer,
  sprites: Array<RainSprite>,
): Promise<Array<SpriteLayers>> {
  const loads: Array<Promise<Texture | null>> = new Array();

  for (let index = 0; index < sprites.length; index++) {
    loads.push(loadTexture(sprites[index]!.path));
  }

  const textures: Array<Texture | null> = await Promise.all(loads);
  const sheet: Container = new Container();
  const cells: Array<Rectangle> = new Array();
  let width: number = 1;
  let y: number = cellPadding;

  for (let index = 0; index < textures.length; index++) {
    const texture: Texture | null = textures[index]!;

    if (texture === null) {
      cells.push(new Rectangle(0, 0, 2, 1));
      continue;
    }

    const sprite: Sprite = new Sprite(texture);
    sprite.position.set(cellPadding, y);
    sheet.addChild(sprite);
    cells.push(new Rectangle(cellPadding, y, texture.width, texture.height));
    width = Math.max(width, texture.width + cellPadding * 2);
    y += texture.height + cellPadding * 2;
  }

  const atlas: Texture = renderer.generateTexture({
    target: sheet,
    frame: new Rectangle(0, 0, width, y),
  });
  sheet.destroy({ children: true });

  for (let index = 0; index < textures.length; index++) {
    if (textures[index] !== null) {
      Assets.unload(sprites[index]!.path);
    }
  }

  return cells.map((cell: Rectangle) => {
    const half: number = cell.width / 2;

    return {
      color: new Texture({
        source: atlas.source,
        frame: new Rectangle(cell.x, cell.y, half, cell.height),
      }),
      core: new Texture({
        source: atlas.source,
        frame: new Rectangle(cell.x + half, cell.y, half, cell.height),
      }),
    };
  });
}

export { loadSprites };
export type { SpriteLayers };
