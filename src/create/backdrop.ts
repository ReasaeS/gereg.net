import { Container, FillGradient, Graphics, type Application } from "pixi.js";
import { getTheme } from "../theme/theme";
import { drawRing } from "./sigil";

type Sigil = {
  x: number; // of screen width
  y: number; // of screen height
  radius: number; // of screen height
  points: number;
  step: number;
  speed: number; // rad/s
};

type Backdrop = {
  view: Container;
  layout: () => void;
  update: (delta: number) => void;
};

const vignetteAlpha: number = 0.65;
const sigilAlpha: number = 0.45;
const sigilOrb: number = 0.07;
const sigilTicks: number = 4;
const sigils: Array<Sigil> = [
  { x: 0.5, y: 0.58, radius: 0.5, points: 6, step: 2, speed: 0.03 },
  { x: 0.5, y: 0.58, radius: 0.3, points: 8, step: 3, speed: -0.05 },
  { x: 0.07, y: 0.12, radius: 0.24, points: 5, step: 2, speed: 0.04 },
  { x: 0.94, y: 0.9, radius: 0.28, points: 7, step: 3, speed: -0.035 },
];
const backdropTop: string = getTheme().skyTop;
const backdropBottom: string = getTheme().seaDeep;
const backdropGradient: FillGradient = new FillGradient({
  type: "linear",
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: backdropTop },
    { offset: 1, color: backdropBottom },
  ],
});
const vignetteGradient: FillGradient = new FillGradient({
  type: "radial",
  center: { x: 0.5, y: 0.45 },
  innerRadius: 0,
  outerCenter: { x: 0.5, y: 0.45 },
  outerRadius: 0.75,
  colorStops: [
    { offset: 0, color: "rgba(0, 0, 0, 0)" },
    { offset: 0.6, color: "rgba(0, 0, 0, 0.2)" },
    { offset: 1, color: "rgba(0, 0, 0, " + vignetteAlpha + ")" },
  ],
});

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

function createBackdrop(app: Application): Backdrop {
  const view: Container = new Container();
  const backdrop: Graphics = new Graphics();
  const circles: Container = new Container();
  const vignette: Graphics = new Graphics();
  const sigilViews: Array<Graphics> = sigils.map(() => new Graphics());

  function layout(): void {
    backdrop
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill(backdropGradient);

    for (let index = 0; index < sigils.length; index++) {
      const sigil: Sigil = sigils[index]!;
      const graphics: Graphics = sigilViews[index]!;

      drawSigil(graphics, sigil, sigil.radius * app.screen.height);
      graphics.position.set(
        sigil.x * app.screen.width,
        sigil.y * app.screen.height,
      );
    }

    vignette
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill(vignetteGradient);
  }

  function update(delta: number): void {
    for (let index = 0; index < sigils.length; index++) {
      sigilViews[index]!.rotation += sigils[index]!.speed * delta;
    }
  }

  circles.addChild(...sigilViews);
  circles.alpha = sigilAlpha;
  view.addChild(backdrop, circles, vignette);
  view.eventMode = "none";
  layout();

  return { view: view, layout: layout, update: update };
}

export { createBackdrop };
export type { Backdrop };
