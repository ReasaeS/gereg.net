import { Point, Sprite, type Texture } from "pixi.js";
import { approach } from "../effects/tween/tween";
import { getPixel, inside, type Pixels } from "../editor/pixels";

type Witch = {
  view: Sprite;
  update: (width: number, height: number, delta: number) => void;
  hovered: () => boolean;
};

const witchReveal: number = 0.25; // s
const witchSize: number = 0.11; // of screen height
const witchMinY: number = 0.1; // of screen height
const witchMaxY: number = 0.42; // of screen height
const witchMinDuration: number = 12; // s
const witchMaxDuration: number = 18; // s
const witchMinPause: number = 4; // s
const witchMaxPause: number = 10; // s
const witchBob: number = 0.025; // of screen height
const witchBobSpeed: number = 0.35; // Hz
const witchClimb: number = 0.12; // of screen height per pass
const witchTilt: number = 0.25; // rad

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function createWitch(texture: Texture, pixels: Pixels, pointer: Point): Witch {
  const view: Sprite = new Sprite(texture);
  const local: Point = new Point();
  let reveal: number = 0;
  let hovering: boolean = false;
  let progress: number = 0;
  let duration: number = 0;
  let pause: number = mix(0, witchMinPause, Math.random());
  let direction: number = 1;
  let startY: number = 0;
  let climb: number = 0;
  let time: number = 0;

  view.anchor.set(0.5);
  view.tint = 0x000000;
  view.visible = false;

  function launch(): void {
    progress = 0;
    duration = mix(witchMinDuration, witchMaxDuration, Math.random());
    direction = Math.random() < 0.5 ? 1 : -1;
    startY = mix(witchMinY, witchMaxY, Math.random());
    climb = witchClimb * mix(-1, 1, Math.random());
    view.visible = true;
  }

  function hovered(): boolean {
    if (!view.visible) {
      return false;
    }

    view.toLocal(pointer, undefined, local);

    const x: number = Math.floor(local.x + pixels.size / 2);
    const y: number = Math.floor(local.y + pixels.size / 2);

    return inside(pixels, x, y) && (getPixel(pixels, x, y) & 0xff) > 0;
  }

  function update(width: number, height: number, delta: number): void {
    time += delta;
    hovering = hovered();
    reveal = approach(reveal, hovering ? 1 : 0, delta / witchReveal);

    const shade: number = Math.round(reveal * 255);

    view.tint = (shade << 16) | (shade << 8) | shade;

    if (!view.visible) {
      pause -= delta;

      if (pause <= 0) {
        launch();
      }

      return;
    }

    progress += delta / duration;

    if (progress >= 1) {
      view.visible = false;
      pause = mix(witchMinPause, witchMaxPause, Math.random());
      return;
    }

    const size: number = height * witchSize;
    const along: number = direction > 0 ? progress : 1 - progress;
    const wave: number = time * witchBobSpeed * Math.PI * 2;

    view.position.set(
      mix(-size, width + size, along),
      height * (startY + climb * progress + witchBob * Math.sin(wave)),
    );
    view.scale.set((direction * size) / texture.width, size / texture.height);
    view.rotation = direction * witchTilt * Math.cos(wave) * 0.5;
  }

  return { view: view, update: update, hovered: () => hovering };
}

export { createWitch };
export type { Witch };
