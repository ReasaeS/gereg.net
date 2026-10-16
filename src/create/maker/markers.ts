import {
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
  type Point,
  type Texture,
} from "pixi.js";
import type { Enemy, Spawn } from "../types";
import { getTexture } from "../images";
import { drawShape } from "../shape";
import { motion } from "../kinematics";
import { getTheme } from "../../theme/theme";
import { previewHeight, previewWidth } from "../preview/preview";
import type { Studio } from "./studio";

type Markers = {
  build: () => void;
  place: () => void;
};

const markerAlpha: number = 0.75;
const markerPadding: number = 6; // units
const guideAlpha: number = 0.35;
const trailTime: number = 4; // s
const trailSteps: number = 48;

function createMarkers(studio: Studio): Markers {
  const { preview, cursor, changed, refresh, refreshControls } = studio;
  const { keyframe, spawn, enemyById } = studio.pick;

  const markerLayer: Container = new Container();
  const guides: Graphics = new Graphics();
  const ghosts: Array<Container> = new Array();
  let dragging: boolean = false;

  function buildMarkers(): void {
    for (const ghost of ghosts) {
      ghost.destroy({ children: true });
    }

    ghosts.length = 0;

    for (const value of keyframe().spawns) {
      const ghost: Container = new Container();
      const found: Enemy | null = enemyById(value.enemy);
      const texture: Texture | null = getTexture(found?.sprite ?? null);

      if (found !== null && texture !== null) {
        const image: Sprite = new Sprite(texture);

        image.anchor.set(0.5);
        image.scale.set(found.size / Math.max(texture.width, texture.height));
        ghost.addChild(image);
      } else {
        const body: Graphics = new Graphics();

        drawShape(body, found?.color ?? "#6b6b85", found?.size ?? 24);
        ghost.addChild(body);
      }

      ghost.alpha = markerAlpha;
      markerLayer.addChild(ghost);
      ghosts.push(ghost);
    }

    placeMarkers();
  }

  function placeMarkers(): void {
    const spawns: Array<Spawn> = keyframe().spawns;

    guides.clear();

    for (
      let index = 0;
      index < spawns.length && index < ghosts.length;
      index++
    ) {
      const value: Spawn = spawns[index]!;
      const x: number = value.x * previewWidth;
      const y: number = value.y * previewHeight;
      const size: number = enemyById(value.enemy)?.size ?? 24;
      const chosen: boolean = index === cursor.spawn;

      ghosts[index]!.position.set(x, y);

      if (
        (value.curve === "polynomial" ? value.derivatives : value.waves)
          .length > 0
      ) {
        guides.moveTo(x, y);

        for (let step = 1; step <= trailSteps; step++) {
          const [pointX, pointY] = motion(
            x,
            y,
            value,
            (step / trailSteps) * trailTime,
          );

          guides.lineTo(pointX, pointY);
        }

        guides.stroke({
          color: chosen ? getTheme().accent : "#ffffff",
          width: 1.5,
          alpha: chosen ? 0.8 : guideAlpha,
        });
      }

      guides.circle(x, y, size / 2 + markerPadding).stroke({
        color: chosen ? getTheme().accent : "#ffffff",
        width: chosen ? 3 : 1.5,
        alpha: chosen ? 1 : guideAlpha * 2,
      });
    }
  }

  function markerAt(x: number, y: number): number {
    const spawns: Array<Spawn> = keyframe().spawns;
    let best: number = -1;
    let bestDistance: number = Infinity;

    for (let index = 0; index < spawns.length; index++) {
      const value: Spawn = spawns[index]!;
      const reach: number =
        (enemyById(value.enemy)?.size ?? 24) / 2 + markerPadding * 2;
      const distance: number = Math.hypot(
        value.x * previewWidth - x,
        value.y * previewHeight - y,
      );

      if (distance <= reach && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    }

    return best;
  }

  function dragTo(event: FederatedPointerEvent): void {
    const local: Point = preview.overlay.toLocal(event.global);

    spawn().x = Math.min(Math.max(local.x / previewWidth, 0), 1);
    spawn().y = Math.min(Math.max(local.y / previewHeight, 0), 1);
    placeMarkers();

    refreshControls();
  }

  preview.overlay.addChild(guides, markerLayer);
  preview.overlay.eventMode = "static";
  preview.overlay.hitArea = new Rectangle(0, 0, previewWidth, previewHeight);
  preview.overlay.on("pointerdown", (event: FederatedPointerEvent) => {
    const local: Point = preview.overlay.toLocal(event.global);
    const index: number = markerAt(local.x, local.y);

    if (index < 0) {
      return;
    }

    cursor.spawn = index;
    dragging = true;
    refresh();
  });
  preview.overlay.on("globalpointermove", (event: FederatedPointerEvent) => {
    if (dragging) {
      dragTo(event);
    }
  });

  function endDrag(): void {
    if (!dragging) {
      return;
    }

    dragging = false;
    changed();
    preview.seek(keyframe().time);
  }

  preview.overlay.on("pointerup", endDrag);
  preview.overlay.on("pointerupoutside", endDrag);

  return { build: buildMarkers, place: placeMarkers };
}

export { createMarkers };
export type { Markers };
