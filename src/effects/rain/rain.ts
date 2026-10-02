import {
  Container,
  Particle,
  ParticleContainer,
  Texture,
  type Application,
  type Rectangle,
  type Ticker,
} from "pixi.js";
import { loadSprites } from "./rainsprites";
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
const rainColor: string = "#aabedc";
const spriteMinAlpha: number = 0.6;
const spriteMaxAlpha: number = 1;
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

const spriteColors: Array<string> = [
  "white",
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
];

function rainSprites(): Array<RainSprite> {
  const sprites: Array<RainSprite> = new Array();

  for (let kind = 0; kind < spriteKinds.length; kind++) {
    for (let color = 0; color < spriteColors.length; color++) {
      const spriteKind: SpriteKind = spriteKinds[kind]!;
      sprites.push({
        path:
          spritePath + spriteKind.name + "_" + spriteColors[color]! + ".png",
        size: spriteKind.size * spriteScale,
      });
    }
  }

  return sprites;
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
  color: rainColor,
  layerChances: layerChances,
  sprites: rainSprites(),
  spriteMinAlpha: spriteMinAlpha,
  spriteMaxAlpha: spriteMaxAlpha,
};

type RainLayer = {
  rain: Container;
  streaks: ParticleContainer;
  splashes: ParticleContainer;
  bullets: ParticleContainer;
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
};

type SplashView = {
  splash: Splash;
  layer: RainLayer;
  particle: Particle;
};

const surfaces: Array<Container> = new Array();
const rects: Array<Rectangle> = new Array();

let surfacesActive: boolean = true;

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
  const bullets: ParticleContainer = new ParticleContainer({
    texture: bulletTexture,
    dynamicProperties: {
      position: true,
      vertex: true,
      uvs: true,
      color: true,
    },
  });

  rain.eventMode = "none";
  bullets.eventMode = "none";
  rain.addChild(streaks, splashes);

  return {
    rain: rain,
    streaks: streaks,
    splashes: splashes,
    bullets: bullets,
  };
}

async function createRain(app: Application): Promise<RainLayers> {
  const textures: Array<Texture> = await loadSprites(
    app.renderer,
    config.sprites,
  );
  const back: RainLayer = createLayer(textures[0] ?? Texture.WHITE);
  const front: RainLayer = createLayer(textures[0] ?? Texture.WHITE);
  const drops: Array<DropView> = new Array();
  const splashes: Array<SplashView> = new Array();

  function layerOf(drop: Drop): RainLayer {
    return drop.layer === 1 ? front : back;
  }

  function placeDrop(view: DropView): void {
    const layer: RainLayer = layerOf(view.drop);

    if (layer === view.layer) {
      return;
    }

    view.layer.streaks.removeParticle(view.streak);
    view.layer.bullets.removeParticle(view.bullet);
    layer.streaks.addParticle(view.streak);
    layer.bullets.addParticle(view.bullet);
    view.layer = layer;
  }

  function addDrop(width: number, height: number): void {
    const drop: Drop = createDrop(config, width, height);
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
      bullet: new Particle({ texture: textures[0] ?? Texture.WHITE }),
    };
    view.bullet.anchorX = 0.5;
    view.bullet.anchorY = 0.5;
    layer.streaks.addParticle(view.streak);
    layer.bullets.addParticle(view.bullet);
    drops.push(view);
  }

  function removeDrop(): void {
    const view: DropView | undefined = drops.pop();

    if (view !== undefined) {
      view.layer.streaks.removeParticle(view.streak);
      view.layer.bullets.removeParticle(view.bullet);
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

    const texture: Texture | undefined = textures[drop.sprite];

    if (texture === undefined) {
      bullet.alpha = 0;
      return;
    }

    const size: number = config.sprites[drop.sprite]!.size;
    const scale: number = size / texture.width;
    const speed: number = Math.hypot(config.wind, drop.speed);
    const reach: number =
      (Math.hypot(texture.width, texture.height) * scale) / 2;
    const past: number =
      ((drop.y - drop.hitY - drop.length / 2) / drop.speed) * speed - reach;

    bullet.texture = texture;
    bullet.scaleX = scale;
    bullet.scaleY = scale;
    bullet.x = drop.x - (config.wind * drop.length) / drop.speed / 2;
    bullet.y = drop.y - drop.length / 2;
    bullet.alpha = drop.hit && past >= 0 ? 0 : drop.spriteAlpha;
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
      const hit: Hit | null = stepDrop(view.drop, delta, config, rects, height);

      if (hit !== null) {
        addSplashes(hit, view.drop);
      }

      if (dropFinished(view.drop, height)) {
        spawnDrop(view.drop, config, width, height);
        placeDrop(view);
      }

      drawDrop(view);
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

export { createRain, addSurface, setSurfacesActive };
export type { RainLayers };
