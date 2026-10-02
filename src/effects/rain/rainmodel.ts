import type { Rectangle } from "pixi.js";

type Layer = -1 | 0 | 1;

type LayerChance = {
  layer: Layer;
  chance: number;
};

type RainSprite = {
  path: string;
  size: number; // px
};

type RainConfig = {
  density: number;
  minSpeed: number;
  maxSpeed: number;
  minLength: number;
  maxLength: number;
  wind: number;
  gravity: number;
  splashLife: number;
  splashBounce: number;
  splashSize: number;
  dropWidth: number;
  color: string;
  layerChances: Array<LayerChance>;
  sprites: Array<RainSprite>;
  spriteMinAlpha: number;
  spriteMaxAlpha: number;
};

type Drop = {
  x: number;
  y: number;
  speed: number;
  length: number;
  alpha: number;
  layer: Layer;
  sprite: number;
  spriteAlpha: number;
  hit: boolean;
  hitX: number;
  hitY: number;
};

type Hit = {
  x: number;
  y: number;
  side: number;
  surface: Rectangle | null;
};

type Splash = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  age: number;
  alpha: number;
  layer: Layer;
  bounces: number;
  floor: number;
  left: number;
  right: number;
  bouncing: boolean;
};

const maxBounces: number = 4;
const bounceDrag: number = 0.8;

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function layerSplit(config: RainConfig): Array<number> {
  let front: number = 0;
  let ui: number = 0;
  let total: number = 0;

  for (let index = 0; index < config.layerChances.length; index++) {
    const layerChance: LayerChance = config.layerChances[index]!;
    total += layerChance.chance;

    if (layerChance.layer === 1) {
      front += layerChance.chance;
    } else if (layerChance.layer === 0) {
      ui += layerChance.chance;
    }
  }

  if (total <= 0) {
    return [0, 0];
  }

  return [front / total, (front + ui) / total];
}

function dropCount(config: RainConfig, width: number, height: number): number {
  const averageSpeed: number = (config.minSpeed + config.maxSpeed) / 2;
  const drift: number =
    Math.abs(config.wind) * ((height + config.maxLength) / averageSpeed);

  return Math.floor((width + drift) * config.density);
}

function spawnDrop(
  drop: Drop,
  config: RainConfig,
  width: number,
  height: number,
): void {
  const split: Array<number> = layerSplit(config);
  const roll: number = Math.random();
  drop.layer = roll < split[0]! ? 1 : roll < split[1]! ? 0 : -1;
  drop.speed = mix(config.minSpeed, config.maxSpeed, Math.random());
  drop.length = mix(config.minLength, config.maxLength, Math.random());
  drop.alpha = mix(0.15, 0.45, Math.random());
  drop.sprite = Math.min(
    Math.floor(Math.random() * config.sprites.length),
    Math.max(config.sprites.length - 1, 0),
  );
  drop.spriteAlpha = mix(
    config.spriteMinAlpha,
    config.spriteMaxAlpha,
    Math.random(),
  );
  drop.y = -config.maxLength;

  const drift: number = config.wind * ((height - drop.y) / drop.speed);
  drop.x = mix(
    Math.min(0, -drift),
    Math.max(width, width - drift),
    Math.random(),
  );
  drop.hit = false;
  drop.hitX = 0;
  drop.hitY = 0;
}

function createDrop(config: RainConfig, width: number, height: number): Drop {
  const drop: Drop = {
    x: 0,
    y: 0,
    speed: 0,
    length: 0,
    alpha: 0,
    layer: -1,
    sprite: 0,
    spriteAlpha: 0,
    hit: false,
    hitX: 0,
    hitY: 0,
  };
  spawnDrop(drop, config, width, height);

  const time: number =
    (Math.random() * (height + 2 * config.maxLength)) / drop.speed;
  drop.x += config.wind * time;
  drop.y += drop.speed * time;

  if (drop.y > height) {
    drop.hit = true;
    drop.hitX = drop.x - (config.wind * (drop.y - height)) / drop.speed;
    drop.hitY = height;
  }

  return drop;
}

function findHit(
  drop: Drop,
  fromX: number,
  fromY: number,
  rects: Array<Rectangle>,
  height: number,
): Hit | null {
  const moveX: number = drop.x - fromX;
  const moveY: number = drop.y - fromY;
  let hit: Hit | null = null;
  let hitTime: number = Infinity;

  if (drop.y >= height) {
    hitTime = (height - fromY) / moveY;
    hit = { x: fromX + moveX * hitTime, y: height, side: 0, surface: null };
  }

  if (drop.layer !== 0) {
    return hit;
  }

  for (let index = 0; index < rects.length; index++) {
    const rect: Rectangle = rects[index]!;

    if (fromY < rect.top && drop.y >= rect.top) {
      const time: number = (rect.top - fromY) / moveY;
      const x: number = fromX + moveX * time;

      if (time < hitTime && x >= rect.left && x <= rect.right) {
        hitTime = time;
        hit = { x: x, y: rect.top, side: 1, surface: rect };
      }
    }

    if (moveX > 0 && fromX < rect.left && drop.x >= rect.left) {
      const time: number = (rect.left - fromX) / moveX;
      const y: number = fromY + moveY * time;

      if (time < hitTime && y >= rect.top && y <= rect.bottom) {
        hitTime = time;
        hit = { x: rect.left, y: y, side: 2, surface: null };
      }
    }
  }

  return hit;
}

function stepDrop(
  drop: Drop,
  delta: number,
  config: RainConfig,
  rects: Array<Rectangle>,
  height: number,
): Hit | null {
  const fromX: number = drop.x;
  const fromY: number = drop.y;
  drop.x += config.wind * delta;
  drop.y += drop.speed * delta;

  if (drop.hit) {
    return null;
  }

  const hit: Hit | null = findHit(drop, fromX, fromY, rects, height);

  if (hit !== null) {
    drop.hit = true;
    drop.hitX = hit.x;
    drop.hitY = hit.y;
  }

  return hit;
}

function dropFinished(drop: Drop, height: number): boolean {
  return drop.y - drop.length > height;
}

function createSplashes(hit: Hit, layer: Layer): Array<Splash> {
  const splashes: Array<Splash> = new Array();
  const count: number = 2 + Math.floor(Math.random() * 3);
  const side: boolean = hit.side === 2;

  for (let index = 0; index < count; index++) {
    const first: number = Math.random();
    const second: number = Math.random();
    splashes.push({
      x: hit.x,
      y: hit.y,
      velocityX: side ? mix(-260, -120, first) : mix(-80, 80, first),
      velocityY: side ? mix(-120, 40, second) : mix(-260, -120, second),
      age: 0,
      alpha: 0.5,
      layer: layer,
      bounces: 0,
      floor: hit.y,
      left: hit.surface?.left ?? 0,
      right: hit.surface?.right ?? 0,
      bouncing: hit.surface !== null,
    });
  }

  return splashes;
}

function stepSplash(
  splash: Splash,
  delta: number,
  config: RainConfig,
): boolean {
  splash.age += delta;

  if (splash.age > config.splashLife) {
    return false;
  }

  splash.velocityY += config.gravity * delta;
  splash.x += splash.velocityX * delta;
  splash.y += splash.velocityY * delta;
  splash.alpha = (1 - splash.age / config.splashLife) * 0.5;

  if (splash.bouncing && splash.velocityY > 0 && splash.y >= splash.floor) {
    if (
      splash.x < splash.left ||
      splash.x > splash.right ||
      splash.bounces >= maxBounces
    ) {
      splash.bouncing = false;
    } else {
      splash.y = splash.floor;
      splash.velocityY *= -config.splashBounce;
      splash.velocityX *= bounceDrag;
      splash.bounces++;
    }
  }

  return true;
}

export {
  dropCount,
  createDrop,
  spawnDrop,
  stepDrop,
  dropFinished,
  createSplashes,
  stepSplash,
};
export type { Layer, LayerChance, RainSprite, RainConfig, Drop, Hit, Splash };
