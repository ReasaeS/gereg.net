import {
  Assets,
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
} from "pixi.js";
import { getTexture } from "./images";
import type { Background, Enemy, Vector, Pattern, Spawn, Stage } from "./data";

type Resolve = (spawn: Spawn) => [Enemy, Pattern | null] | null;

type Preview = {
  view: Container;
  overlay: Container;
  setBackground: (background: Background | null) => void;
  setPattern: (pattern: Pattern | null) => void;
  setEnemy: (enemy: Enemy | null, pattern: Pattern | null) => void;
  setStage: (stage: Stage | null, resolve: Resolve) => void;
  seek: (time: number) => void;
  stageTime: () => number;
  clear: () => void;
  update: (delta: number) => void;
};

type BulletLayers = {
  color: Texture;
  core: Texture;
};

type Bullet = {
  color: Sprite;
  core: Sprite | null;
  x: number; // units
  y: number; // units
  angle: number; // rad
  speed: number; // units/s
  accel: number; // units/s²
  age: number; // s
};

type Emitter = {
  timer: number; // s
  spin: number; // deg
};

type Actor = {
  enemy: Enemy;
  pattern: Pattern | null;
  view: Container;
  body: Graphics;
  sprite: Sprite;
  health: Graphics;
  x: number; // units
  y: number; // units
  derivatives: Array<Vector>; // units/s^n
  time: number; // s
  emitter: Emitter;
};

type Arrival = {
  time: number; // s
  spawn: Spawn;
};

const previewWidth: number = 384; // units
const previewHeight: number = 448; // units
const bulletPath: string = "./sprites/bullets/orb.png";
const maxBullets: number = 1200;
const bulletMargin: number = 48; // units
const bulletLife: number = 20; // s
const emitterX: number = previewWidth / 2; // units
const emitterY: number = 140; // units
const playerX: number = previewWidth / 2; // units
const playerY: number = 400; // units
const playerSize: number = 32; // units
const hoverY: number = 120; // units
const actorMargin: number = 60; // units
const actorGrace: number = 2; // s
const healthWidth: number = 36; // units
const healthHeight: number = 3; // units
const seekLookback: number = 8; // s
const seekStep: number = 1 / 30; // s

async function loadBullet(): Promise<BulletLayers> {
  const texture: Texture = await Assets.load<Texture>(bulletPath);
  const half: number = texture.width / 2;

  texture.source.scaleMode = "linear";

  return {
    color: new Texture({
      source: texture.source,
      frame: new Rectangle(0, 0, half, texture.height),
    }),
    core: new Texture({
      source: texture.source,
      frame: new Rectangle(half, 0, half, texture.height),
    }),
  };
}

function drawShape(graphics: Graphics, color: string, size: number): void {
  const radius: number = size / 2;

  graphics
    .clear()
    .ellipse(-radius * 0.7, -radius * 0.2, radius * 0.6, radius * 0.35)
    .ellipse(radius * 0.7, -radius * 0.2, radius * 0.6, radius * 0.35)
    .fill({ color: "#ffffff", alpha: 0.55 })
    .circle(0, 0, radius * 0.5)
    .fill(color)
    .circle(0, -radius * 0.55, radius * 0.3)
    .fill("#ffe0c8");
}

function motion(
  x: number,
  y: number,
  derivatives: Array<Vector>,
  time: number,
): [number, number] {
  let term: number = 1;

  for (let order = 0; order < derivatives.length; order++) {
    term *= time / (order + 1);
    x += derivatives[order]!.x * term;
    y += derivatives[order]!.y * term;
  }

  return [x, y];
}

async function createPreview(playerTexture: Texture): Promise<Preview> {
  const view: Container = new Container();
  const sky: Graphics = new Graphics();
  const bulletLayer: Container = new Container();
  const coreLayer: Container = new Container();
  const actorLayer: Container = new Container();
  const overlay: Container = new Container();
  const backdrop: TilingSprite = new TilingSprite({
    width: previewWidth,
    height: previewHeight,
  });
  const player: Sprite = new Sprite(playerTexture);
  const mask: Graphics = new Graphics();
  const bullets: Array<Bullet> = new Array();
  const actors: Array<Actor> = new Array();
  const emitter: Emitter = { timer: 0, spin: 0 };
  const layers: BulletLayers = await loadBullet();
  let background: Background | null = null;
  let pattern: Pattern | null = null;
  let stage: Stage | null = null;
  let resolve: Resolve = () => null;
  let arrivals: Array<Arrival> = new Array();
  let nextArrival: number = 0;
  let time: number = 0;
  let gradient: FillGradient | null = null;

  coreLayer.blendMode = "add";
  player.anchor.set(0.5);
  player.width = playerSize;
  player.height = playerSize;
  player.position.set(playerX, playerY);
  backdrop.visible = false;
  mask.rect(0, 0, previewWidth, previewHeight).fill(0xffffff);
  view.addChild(
    sky,
    backdrop,
    player,
    actorLayer,
    bulletLayer,
    coreLayer,
    overlay,
    mask,
  );
  view.mask = mask;

  function drawSky(): void {
    const texture: Texture | null = getTexture(background?.sprite ?? null);

    backdrop.visible = texture !== null;

    if (texture !== null) {
      backdrop.texture = texture;
      backdrop.tileScale.set(previewWidth / texture.width);
    }

    gradient?.destroy();
    gradient = null;
    sky.clear();

    if (background === null) {
      sky.rect(0, 0, previewWidth, previewHeight).fill("#01040f");
      return;
    }

    gradient = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: background.top },
        { offset: 1, color: background.bottom },
      ],
    });
    sky.rect(0, 0, previewWidth, previewHeight).fill(gradient);
  }

  function dress(actor: Actor): void {
    const enemy: Enemy = actor.enemy;
    const texture: Texture | null = getTexture(enemy.sprite);

    actor.body.visible = texture === null;
    actor.sprite.visible = texture !== null;

    if (texture !== null) {
      actor.sprite.texture = texture;
      actor.sprite.scale.set(
        enemy.size / Math.max(texture.width, texture.height),
      );
    }

    drawShape(actor.body, enemy.color, enemy.size);
    actor.health
      .clear()
      .rect(-healthWidth / 2, -enemy.size / 2 - 8, healthWidth, healthHeight)
      .fill({ color: "#000000", alpha: 0.6 })
      .rect(
        -healthWidth / 2,
        -enemy.size / 2 - 8,
        healthWidth * Math.min(enemy.health / 200, 1),
        healthHeight,
      )
      .fill("#ff3b3b");
  }

  function addActor(
    enemy: Enemy,
    attack: Pattern | null,
    x: number,
    y: number,
    derivatives: Array<Vector>,
  ): Actor {
    const actor: Actor = {
      enemy: enemy,
      pattern: attack,
      view: new Container(),
      body: new Graphics(),
      sprite: new Sprite(),
      health: new Graphics(),
      x: x,
      y: y,
      derivatives: derivatives,
      time: 0,
      emitter: { timer: 0, spin: 0 },
    };

    actor.sprite.anchor.set(0.5);
    actor.view.addChild(actor.body, actor.sprite, actor.health);
    actorLayer.addChild(actor.view);
    actors.push(actor);
    dress(actor);

    return actor;
  }

  function clearActors(): void {
    for (let index = 0; index < actors.length; index++) {
      actors[index]!.view.destroy({ children: true });
    }

    actors.length = 0;
  }

  function clearBullets(): void {
    for (let index = 0; index < bullets.length; index++) {
      bullets[index]!.color.destroy();
      bullets[index]!.core?.destroy();
    }

    bullets.length = 0;
  }

  function spawn(source: Pattern, x: number, y: number, base: number): void {
    const count: number = Math.max(Math.round(source.count), 1);
    const full: boolean = source.spread >= 360;

    for (let index = 0; index < count; index++) {
      if (bullets.length >= maxBullets) {
        return;
      }

      const offset: number =
        count === 1
          ? 0
          : full
            ? (index * 360) / count
            : -source.spread / 2 + (index * source.spread) / (count - 1);
      const custom: Texture | null = getTexture(source.sprite);
      const color: Sprite = new Sprite(custom ?? layers.color);
      const core: Sprite | null =
        custom === null ? new Sprite(layers.core) : null;
      const scale: number =
        source.size / Math.max(color.texture.width, color.texture.height);

      color.anchor.set(0.5);
      color.scale.set(scale);
      color.tint = custom === null ? source.color : 0xffffff;
      bulletLayer.addChild(color);

      if (core !== null) {
        core.anchor.set(0.5);
        core.scale.set(scale);
        coreLayer.addChild(core);
      }

      bullets.push({
        color: color,
        core: core,
        x: x,
        y: y,
        angle: base + (offset * Math.PI) / 180,
        speed: source.speed,
        accel: source.accel,
        age: 0,
      });
    }
  }

  function fire(
    source: Pattern,
    state: Emitter,
    x: number,
    y: number,
    delta: number,
  ): void {
    state.spin += source.spin * delta;
    state.timer += delta;

    const interval: number = 1 / Math.max(source.rate, 0.01);

    while (state.timer >= interval) {
      state.timer -= interval;

      const aim: number = source.aim
        ? Math.atan2(playerY - y, playerX - x)
        : (source.angle * Math.PI) / 180;

      spawn(source, x, y, aim + (state.spin * Math.PI) / 180);
    }
  }

  function moveBullets(delta: number): void {
    let write: number = 0;

    for (let index = 0; index < bullets.length; index++) {
      const bullet: Bullet = bullets[index]!;

      bullet.age += delta;
      bullet.speed += bullet.accel * delta;
      bullet.x += Math.cos(bullet.angle) * bullet.speed * delta;
      bullet.y += Math.sin(bullet.angle) * bullet.speed * delta;

      const outside: boolean =
        bullet.x < -bulletMargin ||
        bullet.y < -bulletMargin ||
        bullet.x > previewWidth + bulletMargin ||
        bullet.y > previewHeight + bulletMargin;

      if (outside || bullet.age > bulletLife) {
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      const rotation: number =
        bullet.angle - Math.PI / 2 + (bullet.speed < 0 ? Math.PI : 0);

      bullet.color.position.set(bullet.x, bullet.y);
      bullet.color.rotation = rotation;

      if (bullet.core !== null) {
        bullet.core.position.set(bullet.x, bullet.y);
        bullet.core.rotation = rotation;
      }

      bullets[write++] = bullet;
    }

    bullets.length = write;
  }

  function moveActors(delta: number): void {
    let write: number = 0;

    for (let index = 0; index < actors.length; index++) {
      const actor: Actor = actors[index]!;

      actor.time += delta;

      const [x, y] = motion(actor.x, actor.y, actor.derivatives, actor.time);
      const outside: boolean =
        x < -actorMargin ||
        y < -actorMargin ||
        x > previewWidth + actorMargin ||
        y > previewHeight + actorMargin;

      if (outside && actor.time > actorGrace) {
        actor.view.destroy({ children: true });
        continue;
      }

      actor.view.position.set(x, y);

      if (
        actor.pattern !== null &&
        x > 0 &&
        y > 0 &&
        x < previewWidth &&
        y < previewHeight
      ) {
        fire(actor.pattern, actor.emitter, x, y, delta);
      }

      actors[write++] = actor;
    }

    actors.length = write;
  }

  function schedule(): void {
    arrivals = new Array();

    if (stage === null) {
      return;
    }

    for (const keyframe of stage.keyframes) {
      for (const spawn of keyframe.spawns) {
        for (
          let wave = 0;
          wave < Math.max(Math.round(spawn.count), 1);
          wave++
        ) {
          arrivals.push({
            time: keyframe.time + wave * spawn.gap,
            spawn: spawn,
          });
        }
      }
    }

    arrivals.sort(
      (first: Arrival, second: Arrival) => first.time - second.time,
    );
    nextArrival = arrivals.findIndex(
      (arrival: Arrival) => arrival.time >= time,
    );

    if (nextArrival < 0) {
      nextArrival = arrivals.length;
    }
  }

  function seek(value: number): void {
    const end: number =
      stage === null ? Infinity : Math.max(stage.length - seekStep, 0);
    const goal: number = Math.min(Math.max(value, 0), end);

    clearActors();
    clearBullets();
    time = Math.max(goal - seekLookback, 0);
    schedule();

    while (time < goal) {
      update(Math.min(seekStep, goal - time));
    }
  }

  function runStage(delta: number): void {
    if (stage === null) {
      return;
    }

    time += delta;

    if (time >= stage.length) {
      seek(0);
      return;
    }

    while (
      nextArrival < arrivals.length &&
      arrivals[nextArrival]!.time <= time
    ) {
      const arrival: Arrival = arrivals[nextArrival]!;
      const resolved: [Enemy, Pattern | null] | null = resolve(arrival.spawn);

      nextArrival++;

      if (resolved !== null) {
        addActor(
          resolved[0],
          resolved[1],
          arrival.spawn.x * previewWidth,
          arrival.spawn.y * previewHeight,
          arrival.spawn.derivatives,
        );
      }
    }

    moveActors(delta);
  }

  function update(delta: number): void {
    if (backdrop.visible && background !== null) {
      backdrop.tilePosition.y += background.scroll * delta;
    }

    if (stage !== null) {
      runStage(delta);
    } else if (actors.length > 0) {
      moveActors(delta);
    } else if (pattern !== null) {
      fire(pattern, emitter, emitterX, emitterY, delta);
    }

    moveBullets(delta);
  }

  function clear(): void {
    clearActors();
    clearBullets();
    emitter.timer = 0;
    emitter.spin = 0;
    time = 0;
  }

  drawSky();

  return {
    view: view,
    overlay: overlay,
    setBackground: (value: Background | null) => {
      background = value;
      drawSky();
    },
    setPattern: (value: Pattern | null) => {
      stage = null;
      pattern = value;

      if (actors.length > 0) {
        clearActors();
      }
    },
    setEnemy: (value: Enemy | null, attack: Pattern | null) => {
      stage = null;
      pattern = null;

      const actor: Actor | undefined = actors[0];

      if (value === null) {
        clearActors();
        return;
      }

      if (actor === undefined || actor.enemy !== value || actors.length > 1) {
        clearActors();
        addActor(value, attack, previewWidth / 2, hoverY, new Array());
        return;
      }

      actor.pattern = attack;
      dress(actor);
    },
    setStage: (value: Stage | null, lookup: Resolve) => {
      const changed: boolean = value !== stage;

      stage = value;
      resolve = lookup;
      pattern = null;

      if (changed) {
        seek(0);
        return;
      }

      for (let index = 0; index < actors.length; index++) {
        dress(actors[index]!);
      }

      schedule();
    },
    seek: seek,
    stageTime: () => time,
    clear: clear,
    update: update,
  };
}

export { previewWidth, previewHeight, createPreview, drawShape, motion };
export type { Preview };
