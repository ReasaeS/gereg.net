import {
  Container,
  FillGradient,
  Graphics,
  Particle,
  ParticleContainer,
  Point,
  Sprite,
  type Application,
  type Renderer,
  type Texture,
  type Ticker,
} from "pixi.js";
import { approach } from "../effects/tween/tween";
import { createLighthouse, type Lighthouse } from "./lighthouse";
import { createWitch, type Witch } from "./witch";
import { menuPixels, menuTexture } from "../editor/editor";
import { onTheme, type Theme } from "../theme/theme";
import { onSky, type Sky } from "../settings/settings";

type Reflection = {
  x: number; // %
  depth: number; // of sea height
  length: number; // px
  alpha: number;
  speed: number; // px/s
};

type Bloom = {
  particle: Particle;
  x: number; // px
  y: number; // px
  age: number; // s
};

type Mote = {
  particle: Particle;
  x: number; // %
  y: number; // %
  drift: number; // px
  speed: number;
  phase: number;
};

type Kelp = {
  x: number; // %
  length: number; // of screen height
  width: number; // px
  sway: number; // px
  speed: number;
  phase: number;
};

type Scenery = {
  glow: string | null;
  glowY: number; // screen heights below the dive point
  moteColor: string;
  kelp: boolean;
};

type Target = () => Point | null;

type Vivid = {
  setBeamTarget: (target: Target) => void;
  setHoverBlocker: (blocker: (point: Point) => boolean) => void;
  resetBeam: () => void;
  view: Container;
  scene: Container;
  setDepth: (depth: number) => void;
  setFlip: (angle: number) => void;
  setScenery: (name: string) => void;
  aboveSea: Graphics;
  rainLayer: Container;
  surface: (x: number) => number;
  absorb: (x: number, y: number, color: string) => void;
};

type Star = {
  particle: Particle;
  x: number; // %
  y: number; // of sky height
  alpha: number;
  speed: number;
  phase: number;
};

const skyStops: Array<string> = ["#06205e", "#1a5fc4", "#8fd0ff", "#8fd0ff"];
const seaStops: Array<string> = ["#2a86e0", "#0b3f9e", "#031448"];
const nightSkyStops: Array<string> = [
  "#010309",
  "#061233",
  "#173468",
  "#1d3d74",
];
const nightSeaStops: Array<string> = ["#123a78", "#071d4a", "#020a26"];
const nightDuration: number = 1.2; // s
const starCount: number = 140;
const starMinSize: number = 3; // px
const starMaxSize: number = 8; // px
const starMinAlpha: number = 0.3;
const starMaxAlpha: number = 0.95;
const starTwinkle: number = 0.35;
const starHeight: number = 0.85; // of sky height
const seaHeight: number = 20; // vh
const abyssColor: string = "#01030a";
const diveDistance: number = 2.2; // screen heights
const sceneries: Map<string, Scenery> = new Map([
  [
    "config",
    {
      glow: "#ffb02e",
      glowY: 0.6,
      moteColor: "#ffe2a8",
      kelp: false,
    },
  ],
  [
    "play",
    {
      glow: "#ff2a4d",
      glowY: 0.7,
      moteColor: "#ff9aa8",
      kelp: false,
    },
  ],
  [
    "customise",
    {
      glow: "#1fd68a",
      glowY: 0.6,
      moteColor: "#b8ffd9",
      kelp: true,
    },
  ],
  [
    "create",
    {
      glow: "#a35cff",
      glowY: 0.6,
      moteColor: "#e0c8ff",
      kelp: false,
    },
  ],
]);
const sceneryGlowScale: number = 1.4; // of the longer screen side
const sceneryGlowAlpha: number = 0.4;
const kelpCount: number = 14;
const kelpColor: string = "#06281f";
const kelpEdgeColor: string = "#1f8f63";
const kelpMinLength: number = 0.35; // of screen height
const kelpMaxLength: number = 0.8; // of screen height
const kelpMinWidth: number = 6; // px
const kelpMaxWidth: number = 16; // px
const kelpMaxSway: number = 40; // px
const kelpSegments: number = 12;
const moteCount: number = 180;
const moteMinSize: number = 2; // px
const moteMaxSize: number = 6; // px
const moteMaxAlpha: number = 0.5;
const moteParallax: number = 0.6;
const moteMaxDrift: number = 14; // px
const crestColor: string = "#e6f8ff";
const crestAlpha: number = 0.6;
const crestWidth: number = 2; // px
const reflectionCount: number = 28;
const reflectionColor: string = "#cfeeff";
const reflectionMinLength: number = 30; // px
const reflectionMaxLength: number = 120; // px
const reflectionMinAlpha: number = 0.08;
const reflectionMaxAlpha: number = 0.3;
const reflectionMinSpeed: number = 6; // px/s
const reflectionMaxSpeed: number = 20; // px/s
const glowTextureSize: number = 256; // px
const glowFalloff: Array<Array<number>> = [
  [0, 1],
  [0.35, 0.45],
  [1, 0],
];
const plumeFalloff: Array<Array<number>> = [
  [0, 1],
  [0.5, 0.8],
  [0.8, 0.4],
  [1, 0],
];
const bloomLife: number = 2.6; // s
const bloomMinWidth: number = 14; // px
const bloomMaxWidth: number = 140; // px
const bloomMinDepth: number = 0.1; // of the distance to the sea bottom
const bloomReach: number = 2.6; // plume height per distance to the sea bottom
const bloomAlpha: number = 0.1;
const maxBlooms: number = 900;
const maxDelta: number = 0.05; // s

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function verticalGradient(stops: Array<string>): FillGradient {
  return new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: stops.map((color: string, index: number) => ({
      offset: index / (stops.length - 1),
      color: color,
    })),
  });
}

function createGlowTexture(
  renderer: Renderer,
  falloff: Array<Array<number>>,
): Texture {
  const gradient: FillGradient = new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: falloff.map((stop: Array<number>) => ({
      offset: stop[0]!,
      color: "rgba(255, 255, 255, " + stop[1]! + ")",
    })),
  });
  const shape: Graphics = new Graphics()
    .rect(0, 0, glowTextureSize, glowTextureSize)
    .fill(gradient);
  const texture: Texture = renderer.generateTexture({ target: shape });
  shape.destroy();

  return texture;
}

function createVivid(app: Application): Vivid {
  const rainLayer: Container = new Container();
  const view: Container = new Container();
  const sky: Graphics = new Graphics();
  const scene: Container = new Container();
  const aboveSea: Graphics = new Graphics();
  const sea: Container = new Container();
  const deep: Container = new Container();
  const deepMask: Graphics = new Graphics();
  const water: Graphics = new Graphics();
  const surface: Graphics = new Graphics();
  const seaMask: Graphics = new Graphics();
  let seaGradient: FillGradient = verticalGradient(seaStops);
  let nightSeaGradient: FillGradient = verticalGradient(nightSeaStops);
  const nightSky: Graphics = new Graphics();
  const nightWater: Graphics = new Graphics();
  const nightGradient: FillGradient = verticalGradient(nightSkyStops);
  const starLayer: ParticleContainer = new ParticleContainer({
    dynamicProperties: {
      position: true,
      vertex: true,
      color: true,
    },
  });
  const stars: Array<Star> = new Array();
  let night: number = 0;
  let nightTarget: number = 0;
  const glowTexture: Texture = createGlowTexture(app.renderer, glowFalloff);
  const plumeTexture: Texture = createGlowTexture(app.renderer, plumeFalloff);
  const reflections: Array<Reflection> = new Array();
  const bloomLayer: ParticleContainer = new ParticleContainer({
    texture: plumeTexture,
    dynamicProperties: {
      position: true,
      vertex: true,
      color: true,
    },
  });
  const blooms: Array<Bloom> = new Array();
  const moteLayer: ParticleContainer = new ParticleContainer({
    texture: glowTexture,
    dynamicProperties: {
      position: true,
      color: true,
    },
  });
  const motes: Array<Mote> = new Array();
  let depth: number = 0;
  let flip: number = 0;
  let scenery: Scenery = sceneries.get("config")!;
  const sceneryGlow: Sprite = new Sprite(glowTexture);
  const kelpLayer: Graphics = new Graphics();
  const kelps: Array<Kelp> = new Array();
  let time: number = 0;
  let beamTarget: Target | null = null;
  let hoverBlocker: ((point: Point) => boolean) | null = null;
  const beamLocal: Point = new Point();

  for (let index = 0; index < reflectionCount; index++) {
    reflections.push({
      x: Math.random() * 100,
      depth: mix(0.12, 0.95, Math.random()),
      length: mix(reflectionMinLength, reflectionMaxLength, Math.random()),
      alpha: mix(reflectionMinAlpha, reflectionMaxAlpha, Math.random()),
      speed: mix(reflectionMinSpeed, reflectionMaxSpeed, Math.random()),
    });
  }

  for (let index = 0; index < moteCount; index++) {
    const size: number = mix(moteMinSize, moteMaxSize, Math.random());
    const particle: Particle = new Particle({
      texture: glowTexture,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: size / glowTextureSize,
      scaleY: size / glowTextureSize,
      tint: 0xffffff,
      alpha: mix(0.3, 1, Math.random()),
    });
    moteLayer.addParticle(particle);
    motes.push({
      particle: particle,
      x: Math.random() * 100,
      y: Math.random() * 100,
      drift: Math.random() * moteMaxDrift,
      speed: mix(0.05, 0.2, Math.random()),
      phase: Math.random() * Math.PI * 2,
    });
  }

  for (let index = 0; index < kelpCount; index++) {
    kelps.push({
      x: ((index + Math.random()) / kelpCount) * 100,
      length: mix(kelpMinLength, kelpMaxLength, Math.random()),
      width: mix(kelpMinWidth, kelpMaxWidth, Math.random()),
      sway: kelpMaxSway * mix(0.4, 1, Math.random()),
      speed: mix(0.08, 0.2, Math.random()),
      phase: Math.random(),
    });
  }

  for (let index = 0; index < starCount; index++) {
    const size: number = mix(
      starMinSize,
      starMaxSize,
      Math.pow(Math.random(), 3),
    );
    const particle: Particle = new Particle({
      texture: glowTexture,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: size / glowTextureSize,
      scaleY: size / glowTextureSize,
      tint: 0xffffff,
      alpha: 0,
    });
    starLayer.addParticle(particle);
    stars.push({
      particle: particle,
      x: Math.random() * 100,
      y: Math.pow(Math.random(), 1.4) * starHeight,
      alpha: mix(starMinAlpha, starMaxAlpha, Math.random()),
      speed: mix(0.1, 0.5, Math.random()),
      phase: Math.random() * Math.PI * 2,
    });
  }

  starLayer.texture = glowTexture;
  starLayer.blendMode = "add";
  sceneryGlow.anchor.set(0.5);
  sceneryGlow.blendMode = "add";
  deep.addChild(sceneryGlow, kelpLayer, deepMask);
  setScenery("config");
  deep.setMask({ mask: deepMask, inverse: false });
  sea.addChild(water, nightWater, seaMask, deep, bloomLayer, surface);
  bloomLayer.setMask({ mask: seaMask, inverse: false });
  const lighthouse: Lighthouse = createLighthouse(app.renderer, glowTexture);

  const witch: Witch = createWitch(
    menuTexture(),
    menuPixels(),
    app.renderer.events.pointer.global,
    (point: Point) => hoverBlocker?.(point) ?? false,
  );

  scene.addChild(
    sky,
    nightSky,
    starLayer,
    rainLayer,
    lighthouse.view,
    lighthouse.beam,
    witch.view,
    sea,
  );
  moteLayer.blendMode = "add";
  moteLayer.alpha = 0;

  view.eventMode = "none";
  view.addChild(scene, moteLayer);

  let gradient: FillGradient = verticalGradient(skyStops);

  function seaDepth(height: number): number {
    return (height * seaHeight) / 100 + height * (diveDistance + 1);
  }

  function build(): void {
    const height: number = app.screen.height;
    const surfaceDepth: number = (height * seaHeight) / 100;
    const total: number = seaDepth(height);

    const margin: number = overscan();

    sky
      .clear()
      .rect(-margin, -margin, app.screen.width + margin * 2, height + margin)
      .fill(gradient);
    nightSky
      .clear()
      .rect(-margin, -margin, app.screen.width + margin * 2, height + margin)
      .fill(nightGradient);
    const oldSea: FillGradient = seaGradient;
    const oldNightSea: FillGradient = nightSeaGradient;

    seaGradient = seaFill(seaStops, surfaceDepth, total);
    nightSeaGradient = seaFill(nightSeaStops, surfaceDepth, total);
    drawSea(app.screen.width, height, 0);
    oldSea.destroy();
    oldNightSea.destroy();
  }

  function seaFill(
    stops: Array<string>,
    surfaceDepth: number,
    total: number,
  ): FillGradient {
    return new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: stops[0]! },
        { offset: (surfaceDepth * 0.5) / total, color: stops[1]! },
        { offset: surfaceDepth / total, color: stops[2]! },
        { offset: 1, color: abyssColor },
      ],
    });
  }

  function drawNight(width: number, top: number, delta: number): void {
    night = approach(night, nightTarget, delta / nightDuration);

    const fade: number = night * night * (3 - 2 * night);

    nightSky.alpha = fade;
    nightWater.alpha = fade;
    starLayer.visible = fade > 0;

    if (!starLayer.visible) {
      return;
    }

    for (let index = 0; index < stars.length; index++) {
      const star: Star = stars[index]!;
      const twinkle: number =
        1 -
        starTwinkle *
          (0.5 + 0.5 * Math.sin(time * star.speed * Math.PI * 2 + star.phase));

      star.particle.x = (width * star.x) / 100;
      star.particle.y = top * star.y;
      star.particle.alpha = star.alpha * twinkle * fade;
    }
  }

  function overscan(): number {
    return Math.hypot(app.screen.width, app.screen.height) / 2;
  }

  function setFlip(value: number): void {
    flip = value;
  }

  function setScenery(name: string): void {
    scenery = sceneries.get(name) ?? sceneries.get("config")!;
    sceneryGlow.tint = scenery.glow ?? "#000000";
    moteLayer.tint = scenery.moteColor;
  }

  function drawScenery(width: number, height: number, dive: number): void {
    const centerY: number = height / 2 + diveDistance * height;
    const size: number = Math.max(width, height) * sceneryGlowScale;
    const seabed: number = centerY + height * 0.55;

    sceneryGlow.visible = scenery.glow !== null;
    sceneryGlow.alpha = sceneryGlowAlpha * depth;
    sceneryGlow.position.set(width / 2, centerY + scenery.glowY * height);
    sceneryGlow.width = size;
    sceneryGlow.height = size;
    kelpLayer.clear();

    if (!scenery.kelp || dive <= 0) {
      return;
    }

    kelpLayer.alpha = depth;

    for (let index = 0; index < kelps.length; index++) {
      const kelp: Kelp = kelps[index]!;
      const baseX: number = (width * kelp.x) / 100;
      const length: number = height * kelp.length;
      const points: Array<number> = new Array();

      for (let segment = 0; segment <= kelpSegments; segment++) {
        const along: number = segment / kelpSegments;
        const bend: number =
          Math.sin(
            (time * kelp.speed + kelp.phase - along * 0.6) * Math.PI * 2,
          ) *
          kelp.sway *
          along *
          along;

        points.push(baseX + bend, seabed - length * along);
      }

      kelpLayer
        .poly(points, false)
        .stroke({ color: kelpColor, width: kelp.width, cap: "round" })
        .poly(points, false)
        .stroke({
          color: kelpEdgeColor,
          width: Math.max(kelp.width * 0.25, 1),
          alpha: 0.6,
          cap: "round",
        });
    }
  }

  function setDepth(value: number): void {
    depth = value;
  }

  function drawDeep(width: number, height: number, top: number): void {
    const dive: number = depth * diveDistance * height;

    scene.position.set(width / 2, height / 2);
    scene.pivot.set(width / 2, height / 2 + dive);
    scene.rotation = flip;
    moteLayer.position.set(width / 2, height / 2);
    moteLayer.rotation = flip;
    moteLayer.alpha = Math.min(depth * 3, 1) * moteMaxAlpha;
    deepMask
      .clear()
      .rect(-overscan(), top, width + overscan() * 2, seaDepth(height))
      .fill(0xffffff);

    drawScenery(width, height, dive);

    if (moteLayer.alpha === 0) {
      return;
    }

    const field: number = overscan() * 2;
    const span: number = field + moteMaxSize * 2;

    for (let index = 0; index < motes.length; index++) {
      const mote: Mote = motes[index]!;
      const start: number = (span * mote.y) / 100 - dive * moteParallax;
      const y: number = ((start % span) + span) % span;

      mote.particle.x =
        (field * (mote.x - 50)) / 100 +
        Math.sin((time * mote.speed + mote.phase) * Math.PI * 2) * mote.drift;
      mote.particle.y = y - span / 2;
    }
  }

  function drawSea(width: number, height: number, delta: number): void {
    const top: number = height * (1 - seaHeight / 100);

    const margin: number = overscan();

    water
      .clear()
      .rect(-margin, top, width + margin * 2, seaDepth(height) + margin)
      .fill(seaGradient);
    nightWater
      .clear()
      .rect(-margin, top, width + margin * 2, seaDepth(height) + margin)
      .fill(nightSeaGradient);
    seaMask
      .clear()
      .rect(-margin, top, width + margin * 2, seaDepth(height) + margin)
      .fill(0xffffff);
    aboveSea
      .clear()
      .rect(-margin, -margin, width + margin * 2, top + margin)
      .fill(0xffffff);
    surface
      .clear()
      .moveTo(-margin, top)
      .lineTo(width + margin, top)
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
  }

  function seaSurface(): number {
    return app.screen.height * (1 - seaHeight / 100);
  }

  function absorb(x: number, y: number, color: string): void {
    if (blooms.length >= maxBlooms) {
      bloomLayer.removeParticle(blooms.shift()!.particle);
    }

    const particle: Particle = new Particle({
      texture: plumeTexture,
      anchorX: 0.5,
      anchorY: 0.5,
      tint: color,
      alpha: 0,
    });
    bloomLayer.addParticle(particle);
    blooms.push({ particle: particle, x: x, y: y, age: 0 });
  }

  function drawBlooms(delta: number, height: number): void {
    let expired: number = 0;

    for (let index = 0; index < blooms.length; index++) {
      const bloom: Bloom = blooms[index]!;
      bloom.age += delta;

      const progress: number = Math.min(bloom.age / bloomLife, 1);
      const spread: number = 1 - Math.pow(1 - progress, 3);
      const particle: Particle = bloom.particle;

      if (progress >= 1) {
        expired++;
      }

      const depth: number = Math.max(height - bloom.y, 1) * bloomReach;

      particle.x = bloom.x;
      particle.y = bloom.y;
      particle.scaleX =
        mix(bloomMinWidth, bloomMaxWidth, spread) / glowTextureSize;
      particle.scaleY =
        (depth * mix(bloomMinDepth, 1, spread)) / glowTextureSize;
      particle.alpha = bloomAlpha * Math.pow(1 - progress, 1.2);
    }

    if (expired > 0) {
      bloomLayer.removeParticle(
        ...blooms.splice(0, expired).map((bloom: Bloom) => bloom.particle),
      );
    }
  }

  onTheme((theme: Theme) => {
    skyStops.splice(
      0,
      skyStops.length,
      theme.skyTop,
      theme.skyMiddle,
      theme.horizon,
      theme.horizon,
    );
    seaStops.splice(
      0,
      seaStops.length,
      theme.seaSurface,
      theme.seaMiddle,
      theme.seaDeep,
    );
    gradient.destroy();
    gradient = verticalGradient(skyStops);

    build();
  });

  onSky((sky: Sky) => {
    nightTarget = sky === "night" ? 1 : 0;
  });
  night = nightTarget;

  build();
  app.renderer.on("resize", build);

  app.ticker.add((ticker: Ticker) => {
    const delta: number = Math.min(ticker.deltaMS / 1000, maxDelta);
    const width: number = app.screen.width;
    const height: number = app.screen.height;

    time += delta;

    witch.update(width, height, delta);

    const target: Point | null = beamTarget?.() ?? null;

    if (target !== null) {
      if (witch.hovered()) {
        beamLocal.copyFrom(witch.view.position);
      } else {
        scene.toLocal(target, undefined, beamLocal);
      }
    }

    lighthouse.update(
      width,
      height,
      height * (1 - seaHeight / 100),
      target === null ? null : beamLocal,
      delta,
    );

    drawNight(width, height * (1 - seaHeight / 100), delta);
    drawSea(width, height, delta);
    drawDeep(width, height, height * (1 - seaHeight / 100));
    drawBlooms(delta, height);
  });

  return {
    view: view,
    scene: scene,
    setDepth: setDepth,
    setFlip: setFlip,
    setScenery: setScenery,
    setBeamTarget: (target: Target) => {
      beamTarget = target;
    },
    resetBeam: lighthouse.reset,
    setHoverBlocker: (blocker: (point: Point) => boolean) => {
      hoverBlocker = blocker;
    },
    aboveSea: aboveSea,
    rainLayer: rainLayer,
    surface: seaSurface,
    absorb: absorb,
  };
}

export { seaHeight, createVivid };
export type { Vivid };
