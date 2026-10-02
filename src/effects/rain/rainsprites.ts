import {
  Assets,
  Container,
  Rectangle,
  Sprite,
  Texture,
  type Renderer,
} from "pixi.js";
import type { RainSprite } from "./rainmodel";

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
): Promise<Array<Texture>> {
  const loads: Array<Promise<Texture | null>> = new Array();

  for (let index = 0; index < sprites.length; index++) {
    loads.push(loadTexture(sprites[index]!.path));
  }

  const textures: Array<Texture | null> = await Promise.all(loads);
  let cellSize: number = 1;

  for (let index = 0; index < textures.length; index++) {
    const texture: Texture | null = textures[index]!;

    if (texture !== null) {
      cellSize = Math.max(cellSize, texture.width, texture.height);
    }
  }

  cellSize += cellPadding * 2;

  const columns: number = Math.max(Math.ceil(Math.sqrt(textures.length)), 1);
  const rows: number = Math.max(Math.ceil(textures.length / columns), 1);
  const sheet: Container = new Container();
  const cells: Array<Rectangle> = new Array();

  for (let index = 0; index < textures.length; index++) {
    const texture: Texture | null = textures[index]!;
    const x: number = (index % columns) * cellSize + cellPadding;
    const y: number = Math.floor(index / columns) * cellSize + cellPadding;

    if (texture === null) {
      cells.push(new Rectangle(x - cellPadding, y - cellPadding, 1, 1));
      continue;
    }

    const sprite: Sprite = new Sprite(texture);
    sprite.position.set(x, y);
    sheet.addChild(sprite);
    cells.push(new Rectangle(x, y, texture.width, texture.height));
  }

  const atlas: Texture = renderer.generateTexture({
    target: sheet,
    frame: new Rectangle(0, 0, columns * cellSize, rows * cellSize),
  });
  sheet.destroy({ children: true });

  for (let index = 0; index < textures.length; index++) {
    const path: string = sprites[index]!.path;

    if (textures[index] !== null) {
      Assets.unload(path);
    }
  }

  return cells.map(
    (cell: Rectangle) => new Texture({ source: atlas.source, frame: cell }),
  );
}

export { loadSprites };
