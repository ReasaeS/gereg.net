import { BufferImageSource, Texture, type Graphics } from "pixi.js";
import type { Enemy, Vessel } from "./types";
import { drawShape } from "./shape";
import { vesselSide } from "./defaults";
import {
  createPixels,
  decodePixels,
  encodePixels,
  resamplePixels,
  type Pixels,
} from "../editor/pixels";
import { spriteSize } from "../editor/drawings";
import { drawVesselDefault } from "../editor/default";
import { buildPixels } from "./hangar";

type Look = {
  code: string;
  pixels: Pixels;
  source: BufferImageSource;
  texture: Texture;
};

const looks: Map<string, Look> = new Map();

function drawVesselFallback(pixels: Pixels): void {
  const fallback: Pixels = createPixels(spriteSize);

  drawVesselDefault(fallback);
  resamplePixels(fallback, pixels);
}

function readVessel(vessel: Vessel, pixels: Pixels): void {
  if (!decodePixels(pixels, vessel.pixels)) {
    drawVesselFallback(pixels);
  }
}

function rebuildVessel(vessel: Vessel): void {
  if (vessel.look === "built") {
    vessel.pixels = buildPixels(vessel.build, vesselSide(vessel));
  }
}

function rescaleVessel(vessel: Vessel, scale: number): void {
  if (vessel.look === "built") {
    vessel.scale = scale;
    rebuildVessel(vessel);
    return;
  }

  const from: Pixels = createPixels(vesselSide(vessel));

  readVessel(vessel, from);
  vessel.scale = scale;

  const to: Pixels = createPixels(vesselSide(vessel));

  resamplePixels(from, to);
  vessel.pixels = encodePixels(to);
}

function vesselTexture(vessel: Vessel): Texture {
  const side: number = vesselSide(vessel);
  let look: Look | undefined = looks.get(vessel.id);

  if (look === undefined || look.pixels.size !== side) {
    const pixels: Pixels = createPixels(side);
    const source: BufferImageSource = new BufferImageSource({
      resource: pixels.data,
      width: side,
      height: side,
      scaleMode: "nearest",
    });

    look = {
      code: "",
      pixels: pixels,
      source: source,
      texture: new Texture({ source: source }),
    };
    looks.set(vessel.id, look);
  }

  if (look.code !== vessel.pixels) {
    readVessel(vessel, look.pixels);
    look.code = vessel.pixels;
    look.source.update();
  }

  return look.texture;
}

function drawVessel(graphics: Graphics, vessel: Vessel, size: number): void {
  graphics
    .clear()
    .texture(vesselTexture(vessel), 0xffffff, -size / 2, -size / 2, size, size);
}

function drawBody(
  graphics: Graphics,
  enemy: Enemy | null,
  vessel: Vessel | null,
): void {
  if (vessel !== null && enemy !== null) {
    drawVessel(graphics, vessel, vesselSide(vessel));
  } else {
    drawShape(graphics, enemy?.color ?? "#6b6b85", enemy?.size ?? 24);
  }
}

export {
  drawBody,
  drawVessel,
  drawVesselFallback,
  vesselTexture,
  readVessel,
  rescaleVessel,
  rebuildVessel,
};
