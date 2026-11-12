import { Graphics, type Rectangle } from "pixi.js";
import { getTheme } from "../theme/theme";

type Drizzle = {
  view: Graphics;
  update: (delta: number) => void;
  strike: () => void;
};

type Drop = {
  x: number; // units
  y: number; // units
  speed: number; // units/s
  length: number; // units
};

const dropMinSpeed: number = 700; // units/s
const dropMaxSpeed: number = 1100; // units/s
const dropMinLength: number = 22; // units
const dropMaxLength: number = 46; // units
const dropSlant: number = 0.22;
const dropWidth: number = 2; // units
const dropAlpha: number = 0.55;
const flashDecay: number = 2.6; // per s
const flashFlicker: number = 30; // Hz
const flashAlpha: number = 0.75;
const strikeMin: number = 9; // s
const strikeMax: number = 22; // s

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function createDrizzle(area: Rectangle, count: number): Drizzle {
  const view: Graphics = new Graphics();
  const drops: Array<Drop> = new Array();
  let flash: number = 0;
  let time: number = 0;
  let nextStrike: number = mix(strikeMin, strikeMax, Math.random());

  for (let index = 0; index < count; index++) {
    drops.push({
      x: area.x + Math.random() * area.width,
      y: area.y + Math.random() * area.height,
      speed: mix(dropMinSpeed, dropMaxSpeed, Math.random()),
      length: mix(dropMinLength, dropMaxLength, Math.random()),
    });
  }

  function update(delta: number): void {
    time += delta;
    nextStrike -= delta;
    flash = Math.max(flash - delta * flashDecay, 0);

    if (nextStrike <= 0) {
      flash = 1;
      nextStrike = mix(strikeMin, strikeMax, Math.random());
    }

    view.clear();

    for (const drop of drops) {
      drop.y += drop.speed * delta;
      drop.x += drop.speed * dropSlant * delta;

      if (drop.y - drop.length > area.y + area.height) {
        drop.y = area.y - Math.random() * area.height * 0.2;
        drop.x =
          area.x - area.height * dropSlant + Math.random() * area.width * 1.1;
      }

      view
        .moveTo(drop.x, drop.y)
        .lineTo(drop.x - drop.length * dropSlant, drop.y - drop.length);
    }

    view.stroke({ color: getTheme().rain, width: dropWidth, alpha: dropAlpha });

    if (flash > 0) {
      const flicker: number =
        0.6 + 0.4 * Math.sin(time * flashFlicker * Math.PI * 2);

      view
        .rect(area.x, area.y, area.width, area.height)
        .fill({ color: "#ffffff", alpha: flash * flicker * flashAlpha });
    }
  }

  return {
    view: view,
    update: update,
    strike: () => {
      flash = 1;
    },
  };
}

export { createDrizzle };
export type { Drizzle };
