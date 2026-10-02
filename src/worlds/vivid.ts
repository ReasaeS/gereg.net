import {
  Container,
  FillGradient,
  Graphics,
  Sprite,
  type Application,
  type Renderer,
  type Texture,
  type Ticker,
} from "pixi.js";

type Glow = {
  sprite: Sprite;
  x: number; // %
  y: number; // %
  drift: number; // %
  speed: number;
  phase: number;
};

const skyStops: Array<string> = ["#170631", "#2c0a49", "#0a2142"];
const glowTextureSize: number = 256; // px
const glowColors: Array<string> = [
  "#ff3fa4",
  "#3fd8ff",
  "#ffb347",
  "#8a5cff",
  "#3dffb0",
  "#ff5e7a",
  "#5c8aff",
];
const glowScale: number = 0.7; // of the longer screen side
const glowMinAlpha: number = 0.22;
const glowMaxAlpha: number = 0.4;
const glowDrift: number = 12; // %
const glowMinSpeed: number = 0.03;
const glowMaxSpeed: number = 0.08;

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function createGlowTexture(renderer: Renderer): Texture {
  const gradient: FillGradient = new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: [
      { offset: 0, color: "rgba(255, 255, 255, 1)" },
      { offset: 0.35, color: "rgba(255, 255, 255, 0.45)" },
      { offset: 1, color: "rgba(255, 255, 255, 0)" },
    ],
  });
  const shape: Graphics = new Graphics()
    .rect(0, 0, glowTextureSize, glowTextureSize)
    .fill(gradient);
  const texture: Texture = renderer.generateTexture({ target: shape });
  shape.destroy();

  return texture;
}

function createVivid(app: Application): Container {
  const view: Container = new Container();
  const sky: Graphics = new Graphics();
  const glowLayer: Container = new Container();
  const texture: Texture = createGlowTexture(app.renderer);
  const glows: Array<Glow> = new Array();
  let time: number = 0;

  for (let index = 0; index < glowColors.length; index++) {
    const sprite: Sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.tint = glowColors[index]!;
    sprite.alpha = mix(glowMinAlpha, glowMaxAlpha, Math.random());
    sprite.blendMode = "add";
    glowLayer.addChild(sprite);
    glows.push({
      sprite: sprite,
      x: mix(5, 95, Math.random()),
      y: mix(5, 95, Math.random()),
      drift: glowDrift * mix(0.5, 1, Math.random()),
      speed: mix(glowMinSpeed, glowMaxSpeed, Math.random()),
      phase: Math.random() * Math.PI * 2,
    });
  }

  view.eventMode = "none";
  view.addChild(sky, glowLayer);

  const gradient: FillGradient = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: skyStops.map((color: string, index: number) => ({
      offset: index / (skyStops.length - 1),
      color: color,
    })),
  });

  function build(): void {
    sky.clear().rect(0, 0, app.screen.width, app.screen.height).fill(gradient);
  }

  build();
  app.renderer.on("resize", build);

  app.ticker.add((ticker: Ticker) => {
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const size: number = Math.max(width, height) * glowScale;

    time += ticker.deltaMS / 1000;

    for (let index = 0; index < glows.length; index++) {
      const glow: Glow = glows[index]!;
      const angle: number = time * glow.speed * Math.PI * 2 + glow.phase;

      glow.sprite.position.set(
        (width * (glow.x + glow.drift * Math.cos(angle))) / 100,
        (height * (glow.y + glow.drift * Math.sin(angle * 0.7))) / 100,
      );
      glow.sprite.width = size;
      glow.sprite.height = size;
    }
  });

  return view;
}

export { createVivid };
