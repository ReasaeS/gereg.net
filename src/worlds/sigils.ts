import { Container, Graphics, type Application } from "pixi.js";
import { getTheme } from "../theme/theme";
import { drawRing } from "../create/sigil";

type Sigil = {
  x: number; // of screen width
  y: number; // of screen height
  radius: number; // of screen height
  points: number;
  step: number;
  speed: number; // rad/s
};

type Sigils = {
  view: Container;
  layout: () => void;
  update: () => void;
};

const sigilAlpha: number = 0.45;
const sigilOrb: number = 0.07;
const sigilTicks: number = 4;
const sigils: Array<Sigil> = [
  { x: 0.5, y: 0.58, radius: 0.5, points: 6, step: 2, speed: 0.03 },
  { x: 0.5, y: 0.58, radius: 0.3, points: 8, step: 3, speed: -0.05 },
  { x: 0.07, y: 0.12, radius: 0.24, points: 5, step: 2, speed: 0.04 },
  { x: 0.94, y: 0.9, radius: 0.28, points: 7, step: 3, speed: -0.035 },
];

function drawSigil(graphics: Graphics, sigil: Sigil, radius: number): void {
  graphics.clear();
  drawRing(
    graphics,
    {
      radius: radius,
      points: sigil.points,
      step: sigil.step,
      ticks: sigil.points * sigilTicks,
      orb: sigilOrb,
      spin: 0,
    },
    getTheme().ring,
    0,
  );
}

function createSigils(app: Application): Sigils {
  const view: Container = new Container();
  const circles: Container = new Container();
  const sigilViews: Array<Graphics> = sigils.map(() => new Graphics());

  function layout(): void {
    for (let index = 0; index < sigils.length; index++) {
      const sigil: Sigil = sigils[index]!;
      const graphics: Graphics = sigilViews[index]!;

      drawSigil(graphics, sigil, sigil.radius * app.screen.height);
      graphics.position.set(
        sigil.x * app.screen.width,
        sigil.y * app.screen.height,
      );
    }
  }

  function update(): void {
    const time: number = performance.now() / 1000;

    for (let index = 0; index < sigils.length; index++) {
      sigilViews[index]!.rotation = sigils[index]!.speed * time;
    }
  }

  circles.addChild(...sigilViews);
  circles.alpha = sigilAlpha;
  view.addChild(circles);
  view.eventMode = "none";
  layout();
  update();

  return { view: view, layout: layout, update: update };
}

export { createSigils };
export type { Sigils };
