import { Container, Graphics } from "pixi.js";
import { createGlide, type Glide } from "../ui/motion";
import { defaultWallpaper } from "./defaults";
import type { Wallpaper } from "./types";

type WallpaperView = {
  view: Container;
  show: (wallpaper: Wallpaper | null) => void;
};

const plainWallpaper: Wallpaper = defaultWallpaper();
const spacingMin: number = 4; // units
const waveSteps: number = 8;

function drawMotif(
  graphics: Graphics,
  wallpaper: Wallpaper,
  reach: number,
  scale: number,
): void {
  const size: number = wallpaper.size * scale;
  const spacing: number = Math.max(spacingMin, wallpaper.spacing) * scale;
  const ink: string = wallpaper.ink;
  const count: number = Math.ceil(reach / spacing);

  if (wallpaper.motif === "stripes") {
    for (let i = -count; i <= count; i++) {
      graphics.rect(i * spacing - size / 2, -reach, size, reach * 2);
    }

    graphics.fill(ink);
    return;
  }

  if (wallpaper.motif === "grid") {
    for (let i = -count; i <= count; i++) {
      graphics.rect(i * spacing - size / 2, -reach, size, reach * 2);
      graphics.rect(-reach, i * spacing - size / 2, reach * 2, size);
    }

    graphics.fill(ink);
    return;
  }

  if (wallpaper.motif === "zigzag" || wallpaper.motif === "waves") {
    const rise: number = spacing / 2;

    for (let row = -count; row <= count; row++) {
      const y: number = row * spacing;

      graphics.moveTo(-reach - spacing, y);

      for (let x = -count - 1; x <= count; x++) {
        if (wallpaper.motif === "zigzag") {
          graphics.lineTo(x * spacing + spacing / 2, y - rise / 2);
          graphics.lineTo((x + 1) * spacing, y);
          continue;
        }

        for (let step = 1; step <= waveSteps; step++) {
          const t: number = step / waveSteps;

          graphics.lineTo(
            (x + t) * spacing,
            y - (Math.sin(t * Math.PI * 2) * rise) / 2,
          );
        }
      }

      graphics.stroke({ width: size, color: ink, join: "round" });
    }

    return;
  }

  for (let row = -count; row <= count; row++) {
    for (let column = -count; column <= count; column++) {
      if (wallpaper.motif === "checks" && (row + column) % 2 !== 0) {
        continue;
      }

      const x: number =
        column * spacing +
        (wallpaper.motif === "checks" ? 0 : (Math.abs(row) % 2) * spacing) / 2;
      const y: number = row * spacing;

      if (wallpaper.motif === "dots") {
        graphics.circle(x, y, size / 2);
      } else if (wallpaper.motif === "diamonds") {
        graphics.poly([
          x,
          y - size / 2,
          x + size / 2,
          y,
          x,
          y + size / 2,
          x - size / 2,
          y,
        ]);
      } else {
        graphics.rect(x - size / 2, y - size / 2, size, size);
      }
    }
  }

  graphics.fill(ink);
}

function paintWallpaper(
  layer: Container,
  wallpaper: Wallpaper | null,
  width: number,
  height: number,
  scale: number,
): void {
  const value: Wallpaper = wallpaper ?? plainWallpaper;
  const base: Graphics = new Graphics()
    .rect(0, 0, width, height)
    .fill(value.base);

  for (const child of layer.removeChildren()) {
    child.destroy();
  }

  layer.addChild(base);

  if (value.size <= 0) {
    return;
  }

  const motif: Graphics = new Graphics();
  const mask: Graphics = new Graphics()
    .rect(0, 0, width, height)
    .fill(0xffffff);

  drawMotif(motif, value, Math.hypot(width, height) / 2, scale);
  motif.position.set(width / 2, height / 2);
  motif.angle = value.angle;
  motif.mask = mask;
  layer.addChild(motif, mask);
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
