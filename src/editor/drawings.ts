import { BufferImageSource, Texture } from "pixi.js";
import {
  createPixels,
  decodePixels,
  encodePixels,
  isEmpty,
  type Pixels,
} from "./pixels";
import {
  drawDroneDefault,
  drawDroneShotDefault,
  drawGameDefault,
  drawMenuDefault,
  drawShotDefault,
} from "./default";

type Drawing = {
  name: string;
  storageKey: string;
  pixels: Pixels;
  source: BufferImageSource;
  texture: Texture;
  undo: Array<Uint8Array>;
  redo: Array<Uint8Array>;
  drawDefault: (pixels: Pixels) => void;
  custom: boolean;
};

const spriteSize: number = 32; // px
const gameStorageKey: string = "geregnet.playerSprite";
const menuStorageKey: string = "geregnet.menuSprite";
const droneStorageKey: string = "geregnet.droneSprite";
const shotStorageKey: string = "geregnet.shotSprite";
const droneShotStorageKey: string = "geregnet.droneShotSprite";

function createDrawing(
  name: string,
  storageKey: string,
  drawDefault: (pixels: Pixels) => void,
): Drawing {
  const pixels: Pixels = createPixels(spriteSize);
  const source: BufferImageSource = new BufferImageSource({
    resource: pixels.data,
    width: spriteSize,
    height: spriteSize,
    scaleMode: "nearest",
  });

  return {
    name: name,
    storageKey: storageKey,
    pixels: pixels,
    source: source,
    texture: new Texture({ source: source }),
    undo: new Array(),
    redo: new Array(),
    drawDefault: drawDefault,
    custom: false,
  };
}

const drawings: Array<Drawing> = [
  createDrawing("in game", gameStorageKey, drawGameDefault),
  createDrawing("menu", menuStorageKey, drawMenuDefault),
  createDrawing("drone", droneStorageKey, drawDroneDefault),
  createDrawing("shot", shotStorageKey, drawShotDefault),
  createDrawing("drone shot", droneShotStorageKey, drawDroneShotDefault),
];

function isDefault(target: Drawing): boolean {
  const pixels: Pixels = createPixels(spriteSize);

  target.drawDefault(pixels);

  for (let index = 0; index < pixels.data.length; index++) {
    if (pixels.data[index] !== target.pixels.data[index]) {
      return false;
    }
  }

  return true;
}

function loadDrawing(target: Drawing): void {
  target.drawDefault(target.pixels);

  try {
    const saved: string | null = localStorage.getItem(target.storageKey);

    if (saved !== null && !decodePixels(target.pixels, saved)) {
      target.drawDefault(target.pixels);
    }

    if (isEmpty(target.pixels)) {
      target.drawDefault(target.pixels);
    }
  } catch {
    console.warn("Could not load the " + target.name + " sprite");
  }

  target.custom = !isDefault(target);
  target.source.update();
}

function saveDrawing(target: Drawing): void {
  target.custom = !isDefault(target);

  try {
    localStorage.setItem(target.storageKey, encodePixels(target.pixels));
  } catch {
    console.warn("Could not save the " + target.name + " sprite");
  }
}

function defaultPlayerTexture(): Texture {
  const pixels: Pixels = createPixels(spriteSize);

  drawGameDefault(pixels);

  return new Texture({
    source: new BufferImageSource({
      resource: pixels.data,
      width: spriteSize,
      height: spriteSize,
      scaleMode: "nearest",
    }),
  });
}

function playerTexture(): Texture {
  return drawings[0]!.texture;
}

function menuTexture(): Texture {
  return drawings[1]!.texture;
}

function menuPixels(): Pixels {
  return drawings[1]!.pixels;
}

function droneTexture(): Texture {
  return drawings[2]!.texture;
}

function shotDrawing(): Drawing {
  return drawings[3]!;
}

function droneShotDrawing(): Drawing {
  return drawings[4]!;
}

for (let index = 0; index < drawings.length; index++) {
  loadDrawing(drawings[index]!);
}

export {
  spriteSize,
  drawings,
  saveDrawing,
  playerTexture,
  defaultPlayerTexture,
  menuTexture,
  menuPixels,
  droneTexture,
  shotDrawing,
  droneShotDrawing,
};
export type { Drawing };
