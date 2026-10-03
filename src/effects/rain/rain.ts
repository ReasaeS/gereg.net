import {
  Container,
  Particle,
  ParticleContainer,
  Texture,
  type Application,
  type Rectangle,
  type Ticker,
} from "pixi.js";
import { loadSprites, type SpriteLayers } from "./rainsprites";
import { getTheme, onTheme, type Theme } from "../../theme/theme";
import {
  dropCount,
  createDrop,
  spawnDrop,
  stepDrop,
  dropFinished,
  createSplashes,
  stepSplash,
  type Drop,
  type Hit,
  type LayerChance,
  type RainConfig,
  type RainSprite,
  type Splash,
} from "./rainmodel";

const dropDensity: number = 0.5;
const dropMinSpeed: number = 200;
const dropMaxSpeed: number = 400;
const dropMinLength: number = 22;
const dropMaxLength: number = 28;
const dropWidth: number = 1;
const wind: number = 100;
const splashGravity: number = 1200;
const splashLife: number = 0.35;
const splashBounce: number = 0.4;
const splashSize: number = 1.5;
const spriteMinAlpha: number = 0.25;
const spriteMaxAlpha: number = 0.45;
const spritePath: string = "./sprites/bullets/";
const spriteScale: number = 1;
const maxDelta: number = 0.05; // s

type SpriteKind = {
  name: string;
  size: number; // px
};

const spriteKinds: Array<SpriteKind> = [
  { name: "small", size: 12 },
  { name: "orb", size: 18 },
  { name: "big", size: 38 },
];

function rainSprites(): Array<RainSprite> {
  return spriteKinds.map((kind: SpriteKind) => ({
    path: spritePath + kind.name + ".png",
    size: kind.size * spriteScale,
  }));
}

const layerChances: Array<LayerChance> = [
  { layer: 0, chance: 0.01 },
  { layer: -1, chance: 0.3 },
];

const config: RainConfig = {
  density: dropDensity,
  minSpeed: dropMinSpeed,
  maxSpeed: dropMaxSpeed,
  minLength: dropMinLength,
  maxLength: dropMaxLength,
  wind: wind,
  gravity: splashGravity,
  splashLife: splashLife,
  splashBounce: splashBounce,
  splashSize: splashSize,
  dropWidth: dropWidth,
  color: getTheme().rain,
  layerChances: layerChances,
  sprites: rainSprites(),
  spriteColors: [getTheme().bullets],
  spriteMinAlpha: spriteMinAlpha,
  spriteMaxAlpha: spriteMaxAlpha,
};

type RainLayer = {
  rain: Container;
  streaks: ParticleContainer;
  splashes: ParticleContainer;
  bullets: Container;
  bulletColors: ParticleContainer;
  bulletCores: ParticleContainer;
};

type RainLayers = {
  backRain: Container;
  backBullets: Container;
  frontRain: Container;
  frontBullets: Container;
};

type DropView = {
  drop: Drop;
  layer: RainLayer;
  streak: Particle;
  bullet: Particle;
  core: Particle;
};

type Floor = (x: number) => number;
type Impact = (x: number, y: number, color: string) => void;

type SplashView = {
  splash: Splash;
  layer: RainLayer;
  particle: Particle;
};

const surfaces: Array<Container> = new Array();
const rects: Array<Rectangle> = new Array();

let surfacesActive: boolean = true;
let floor: Floor | null = null;
let rainFloor: number = 1; // of screen height
let impact: Impact | null = null;

function setBulletFloor(value: Floor | null): void {
  floor = value;
}

function setRainFloor(value: number): void {
  rainFloor = value;
}

function onBulletImpact(value: Impact | null): void {
  impact = value;
}

function addSurface(surface: Container): void {
  surfaces.push(surface);
}

function setSurfacesActive(active: boolean): void {
  surfacesActive = active;
}

function isShown(container: Container): boolean {
  let current: Container | null = container;

  while (current !== null) {
    if (!current.visible) {
      return false;
    }

    current = current.parent;
  }

  return true;
}

function readRects(): void {
  rects.length = 0;

  if (!surfacesActive) {
    return;
  }

  for (let index = 0; index < surfaces.length; index++) {
    const surface: Container = surfaces[index]!;

    if (!isShown(surface)) {
      continue;
    }

    const rect: Rectangle = surface.getBounds().rectangle;

    if (rect.width > 0 && rect.height > 0) {
      rects.push(rect);
    }
  }
}

function createLayer(bulletTexture: Texture): RainLayer {
  const rain: Container = new Container();
  const streaks: ParticleContainer = new ParticleContainer({
    texture: Texture.WHITE,
    dynamicProperties: {
      position: true,
      vertex: true,
      rotation: true,
      color: true,
    },
  });
  const splashes: ParticleContainer = new ParticleContainer({
    texture: Texture.WHITE,
    dynamicProperties: {
      position: true,
      color: true,
    },
  });
  const bullets: Container = new Container();
  const bulletColors: ParticleContainer = new ParticleContainer({
    texture: bulletTexture,
    dynamicProperties: {
      position: true,
      vertex: true,
      uvs: true,
      color: true,
    },
  });
  const bulletCores: ParticleContainer = new ParticleContainer({
    texture: bulletTexture,
    dynamicProperties: {
      position: true,
      vertex: true,
      uvs: true,
      color: true,
    },
  });

  bulletCores.blendMode = "add";
  bullets.addChild(bulletColors, bulletCores);
  rain.eventMode = "none";
  bullets.eventMode = "none";
  rain.addChild(streaks, splashes);

  return {
    rain: rain,
    streaks: streaks,
    splashes: splashes,
    bullets: bullets,
    bulletColors: bulletColors,
    bulletCores: bulletCores,
  };
}

async function createRain(app: Application): Promise<RainLayers> {
  const textures: Array<SpriteLayers> = await loadSprites(
    app.renderer,
    config.sprites,
  );
  const bulletTexture: Texture = textures[0]?.color ?? Texture.WHITE;
  const back: RainLayer = createLayer(bulletTexture);
  const front: RainLayer = createLayer(bulletTexture);
  const drops: Array<DropView> = new Array();
  const splashes: Array<SplashView> = new Array();

  onTheme((theme: Theme) => {
    config.color = theme.rain;
    config.spriteColors = [theme.bullets];

    for (let index = 0; index < drops.length; index++) {
      drops[index]!.streak.tint = theme.rain;
    }

    for (let index = 0; index < splashes.length; index++) {
      splashes[index]!.particle.tint = theme.rain;
    }
  });

  function layerOf(drop: Drop): RainLayer {
    return drop.layer === 1 ? front : back;
  }

  function placeDrop(view: DropView): void {
    const layer: RainLayer = layerOf(view.drop);

    if (layer === view.layer) {
      return;
    }

    view.layer.streaks.removeParticle(view.streak);
    view.layer.bulletColors.removeParticle(view.bullet);
    view.layer.bulletCores.removeParticle(view.core);
    layer.streaks.addParticle(view.streak);
    layer.bulletColors.addParticle(view.bullet);
    layer.bulletCores.addParticle(view.core);
    view.layer = layer;
  }

  function addDrop(width: number, height: number): void {
    const drop: Drop = createDrop(config, width, height, height * rainFloor);
    const layer: RainLayer = layerOf(drop);
    const view: DropView = {
      drop: drop,
      layer: layer,
      streak: new Particle({
        texture: Texture.WHITE,
        anchorX: 0.5,
        anchorY: 1,
        scaleX: config.dropWidth,
        rotation: Math.atan2(-config.wind, drop.speed),
        tint: config.color,
      }),
      bullet: new Particle({
        texture: bulletTexture,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
      core: new Particle({
        texture: bulletTexture,
        anchorX: 0.5,
        anchorY: 0.5,
      }),
    };
    layer.streaks.addParticle(view.streak);
    layer.bulletColors.addParticle(view.bullet);
    layer.bulletCores.addParticle(view.core);
    drops.push(view);
    drawDrop(view);

    if (belowFloor(view)) {
      view.drop.absorbed = true;
      drawDrop(view);
    }
  }

  function removeDrop(): void {
    const view: DropView | undefined = drops.pop();

    if (view !== undefined) {
      view.layer.streaks.removeParticle(view.streak);
      view.layer.bulletColors.removeParticle(view.bullet);
      view.layer.bulletCores.removeParticle(view.core);
    }
  }

  function addSplashes(hit: Hit, drop: Drop): void {
    const created: Array<Splash> = createSplashes(hit, drop.layer);
    const layer: RainLayer = layerOf(drop);

    for (let index = 0; index < created.length; index++) {
      const splash: Splash = created[index]!;
      const particle: Particle = new Particle({
        texture: Texture.WHITE,
        x: splash.x,
        y: splash.y,
        scaleX: config.splashSize,
        scaleY: config.splashSize,
        tint: config.color,
        alpha: splash.alpha,
      });
      layer.splashes.addParticle(particle);
      splashes.push({ splash: splash, layer: layer, particle: particle });
    }
  }

  function drawDrop(view: DropView): void {
    const drop: Drop = view.drop;
    const streak: Particle = view.streak;
    const bullet: Particle = view.bullet;
    let visible: number = drop.length;

    streak.rotation = Math.atan2(-config.wind, drop.speed);
    streak.x = drop.x;
    streak.y = drop.y;

    if (drop.hit) {
      visible -= Math.hypot(drop.x - drop.hitX, drop.y - drop.hitY);
      streak.x = drop.hitX;
      streak.y = drop.hitY;
    }

    streak.scaleY = Math.max(visible, 0);
    streak.alpha = visible > 0 ? drop.alpha : 0;

    const layers: SpriteLayers | undefined = textures[drop.sprite];

    if (layers === undefined) {
      bullet.alpha = 0;
      view.core.alpha = 0;
      return;
    }

    const size: number = config.sprites[drop.sprite]!.size;
    const scale: number = size / layers.color.width;
    const speed: number = Math.hypot(config.wind, drop.speed);
    const reach: number =
      (Math.hypot(layers.color.width, layers.color.height) * scale) / 2;
    const past: number =
      ((drop.y - drop.hitY - drop.length / 2) / drop.speed) * speed - reach;
    const x: number = drop.x - (config.wind * drop.length) / drop.speed / 2;
    const y: number = drop.y - drop.length / 2;
    const sunk: boolean =
      drop.absorbed &&
      floor !== null &&
      y - (layers.color.height * scale) / 2 >= floor(x);
    const alpha: number =
      (drop.hit && past >= 0) || sunk ? 0 : drop.spriteAlpha;

    bullet.texture = layers.color;
    bullet.tint = config.spriteColors[drop.spriteColor]!;
    view.core.texture = layers.core;

    for (const particle of [bullet, view.core]) {
      particle.scaleX = scale;
      particle.scaleY = scale;
      particle.x = x;
      particle.y = y;
      particle.alpha = alpha;
    }
  }

  function belowFloor(view: DropView): boolean {
    return floor !== null && view.bullet.y >= floor(view.bullet.x);
  }

  function absorb(view: DropView): void {
    if (view.drop.absorbed || view.bullet.alpha === 0 || !belowFloor(view)) {
      return;
    }

    view.drop.absorbed = true;
    impact?.(
      view.bullet.x,
      floor!(view.bullet.x),
      config.spriteColors[view.drop.spriteColor]!,
    );
  }

  app.ticker.add((ticker: Ticker) => {
    const delta: number = Math.min(ticker.deltaMS / 1000, maxDelta);
    const width: number = app.screen.width;
    const height: number = app.screen.height;
    const count: number = dropCount(config, width, height);

    readRects();

    while (drops.length < count) {
      addDrop(width, height);
    }

    while (drops.length > count) {
      removeDrop();
    }

    for (let index = 0; index < drops.length; index++) {
      const view: DropView = drops[index]!;
      const hit: Hit | null = stepDrop(
        view.drop,
        delta,
        config,
        rects,
        height * rainFloor,
      );

      if (hit !== null) {
        addSplashes(hit, view.drop);
      }

      if (dropFinished(view.drop, height)) {
        spawnDrop(view.drop, config, width, height);
        placeDrop(view);
      }

      drawDrop(view);
      absorb(view);
    }

    for (let index = splashes.length - 1; index >= 0; index--) {
      const view: SplashView = splashes[index]!;

      if (stepSplash(view.splash, delta, config)) {
        view.particle.x = view.splash.x;
        view.particle.y = view.splash.y;
        view.particle.alpha = view.splash.alpha;
        continue;
      }

      view.layer.splashes.removeParticle(view.particle);
      splashes[index] = splashes[splashes.length - 1]!;
      splashes.pop();
    }
  });

  return {
    backRain: back.rain,
    backBullets: back.bullets,
    frontRain: front.rain,
    frontBullets: front.bullets,
  };
}

export {
  createRain,
  addSurface,
  setSurfacesActive,
  setBulletFloor,
  setRainFloor,
  onBulletImpact,
};
export type { RainLayers };
