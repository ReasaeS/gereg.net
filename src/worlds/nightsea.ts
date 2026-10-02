import {
  Container,
  FillGradient,
  Graphics,
  type Application,
  type Ticker,
} from "pixi.js";
import { seaHeight } from "./vivid";

type Reflection = {
  x: number; // %
  depth: number; // of sea height
  length: number; // px
  alpha: number;
  speed: number; // px/s
};

const seaStops: Array<string> = ["#1a2a52", "#0b1430", "#040814"];
const crestColor: string = "#9fb4d8";
const crestAlpha: number = 0.35;
const crestWidth: number = 2; // px
const reflectionCount: number = 22;
const reflectionColor: string = "#8fa6cc";
const reflectionMinLength: number = 30; // px
const reflectionMaxLength: number = 110; // px
const reflectionMinAlpha: number = 0.05;
const reflectionMaxAlpha: number = 0.18;
const reflectionMinSpeed: number = 4; // px/s
const reflectionMaxSpeed: number = 14; // px/s
const maxDelta: number = 0.05; // s

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function createNightSea(app: Application): Container {
  const view: Container = new Container();
  const water: Graphics = new Graphics();
  const surface: Graphics = new Graphics();
  const reflections: Array<Reflection> = new Array();
  const gradient: FillGradient = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: seaStops.map((color: string, index: number) => ({
      offset: index / (seaStops.length - 1),
      color: color,
    })),
  });

  for (let index = 0; index < reflectionCount; index++) {
    reflections.push({
      x: Math.random() * 100,
      depth: mix(0.12, 0.95, Math.random()),
      length: mix(reflectionMinLength, reflectionMaxLength, Math.random()),
      alpha: mix(reflectionMinAlpha, reflectionMaxAlpha, Math.random()),
      speed: mix(reflectionMinSpeed, reflectionMaxSpeed, Math.random()),
    });
  }

  view.eventMode = "none";
  view.addChild(water, surface);

  app.ticker.add((ticker: Ticker) => {
    const delta: number = Math.min(ticker.deltaMS / 1000, maxDelta);
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const top: number = height * (1 - seaHeight / 100);

    water
      .clear()
      .rect(0, top, width, height - top)
      .fill(gradient);
    surface
      .clear()
      .moveTo(0, top)
      .lineTo(width, top)
      .stroke({ color: crestColor, alpha: crestAlpha, width: crestWidth });

    for (let index = 0; index < reflections.length; index++) {
      const reflection: Reflection = reflections[index]!;
      const span: number = width + reflection.length;
      reflection.x =
        (reflection.x + ((reflection.speed * delta) / span) * 100) % 100;

      const x: number = (span * reflection.x) / 100 - reflection.length;
      const y: number = top + (height - top) * reflection.depth;

      surface
        .rect(x, Math.min(y, height - 2), reflection.length, 2)
        .fill({ color: reflectionColor, alpha: reflection.alpha });
    }
  });

  return view;
}

export { createNightSea };
