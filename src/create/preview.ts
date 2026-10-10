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
import type {
  Background,
  Curve,
  Enemy,
  Vector,
  Pattern,
  Spawn,
  Spell,
  Stage,
  Wave,
} from "./data";
import { placeAlong, solidSpans } from "./data";
import { drawSpell } from "./sigil";
import {
  focusSpeed,
  hitboxColor,
  hitboxRadius,
  playerSpeed,
} from "../game/playfield";

type Path = Pick<Spawn, "curve" | "derivatives" | "waves">;

type Resolve = (spawn: Spawn) => [Enemy, Pattern | null, Spell | null] | null;

type Preview = {
  view: Container;
  overlay: Container;
  setBackground: (background: Background | null) => void;
  setPattern: (pattern: Pattern | null) => void;
  setEnemy: (
    enemy: Enemy | null,
    pattern: Pattern | null,
    spell: Spell | null,
  ) => void;
  setSpell: (spell: Spell | null) => void;
  setStage: (stage: Stage | null, resolve: Resolve) => void;
  seek: (time: number) => void;
  setPlayerVisible: (visible: boolean) => void;
  stageTime: () => number;
  patternTime: () => number;
  seekPattern: (time: number) => void;
  clear: () => void;
  update: (delta: number) => void;
  setPlaytest: (on: boolean) => void;
  steer: (x: number, y: number, focused: boolean) => void;
  hits: () => number;
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
  derivatives: Array<number>; // units/s^(n+1)
  drift: Array<Vector>; // units/s^(n+1)
  curve: Curve;
  angleWaves: Array<Wave<number>>; // deg
  swayWaves: Array<Wave<Vector>>; // units
  age: number; // s
  launch: number; // s
  radius: number; // units
  marginX: number; // units
  marginY: number; // units
  shownX: number; // units
  shownY: number; // units
};

type Emitter = {
  timer: number; // s
  time: number; // s
};

type Actor = {
  enemy: Enemy;
  pattern: Pattern | null;
  spell: Spell | null;
  view: Container;
  sigil: Graphics;
  body: Graphics;
  sprite: Sprite;
  health: Graphics;
  x: number; // units
  y: number; // units
  path: Path;
  time: number; // s
  facing: number; // rad
  emitter: Emitter;
};

type Arrival = {
  time: number; // s
  spawn: Spawn;
};

const previewWidth: number = 384; // units
const previewHeight: number = 448; // units
const bulletPath: string = "./sprites/bullets/orb.png";
const maxBullets: number = 6000;
const bulletMargin: number = 48; // units
const bulletLife: number = 20; // s
const stepSize: number = 1 / 240; // s
const none: Array<never> = [];
const emitterX: number = previewWidth / 2; // units
const emitterY: number = 140; // units
const playerX: number = previewWidth / 2; // units
const playerY: number = 400; // units
const playerSize: number = 32; // units
const bulletHitbox: number = 0.25; // of size
const hitGrace: number = 1; // s
const blinkRate: number = 12; // Hz
const blinkAlpha: number = 0.3;
const hoverY: number = 120; // units
const actorMargin: number = 60; // units
const actorGrace: number = 2; // s
const healthWidth: number = 36; // units
const healthHeight: number = 3; // units
const seekLookback: number = 8; // s
const seekStep: number = 1 / 30; // s
const patternLimit: number = 3600; // s
const forward: number = Math.PI / 2; // rad
const still: Path = {
  curve: "polynomial",
  derivatives: new Array(),
  waves: new Array(),
};
const stillSpeed: number = 1; // units/s
const edgeOffset: number = 8; // units

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

function series(derivatives: Array<number>, time: number): number {
  let term: number = 1;
  let total: number = 0;

  for (let order = 0; order < derivatives.length; order++) {
    term *= time / (order + 1);
    total += derivatives[order]! * term;
  }

  return total;
}

function drift(derivatives: Array<Vector>, time: number): [number, number] {
  let term: number = 1;
  let x: number = 0;
  let y: number = 0;

  for (let order = 0; order < derivatives.length; order++) {
    term *= time / (order + 1);
    x += derivatives[order]!.x * term;
    y += derivatives[order]!.y * term;
  }

  return [x, y];
}

function phaseAt(wave: Wave<unknown>, clock: number): number {
  return ((wave.phase + wave.phaseShift * clock) * Math.PI) / 180;
}

function oscillation(wave: Wave<unknown>, time: number, clock: number): number {
  return (
    Math.sin(Math.PI * 2 * wave.frequency * time + phaseAt(wave, clock)) -
    Math.sin(phaseAt(wave, clock - time))
  );
}

function slope(wave: Wave<unknown>, time: number): number {
  return (
    (Math.PI * 2 * wave.frequency + (wave.phaseShift * Math.PI) / 180) *
    Math.cos(Math.PI * 2 * wave.frequency * time + phaseAt(wave, time))
  );
}

function sway(
  waves: Array<Wave<number>>,
  time: number,
  clock: number = time,
): number {
  let total: number = 0;

  for (const wave of waves) {
    total += wave.amplitude * oscillation(wave, time, clock);
  }

  return total;
}

function swayVector(
  waves: Array<Wave<Vector>>,
  time: number,
  clock: number = time,
): [number, number] {
  let x: number = 0;
  let y: number = 0;

  for (const wave of waves) {
    x += wave.amplitude.x * oscillation(wave, time, clock);
    y += wave.amplitude.y * oscillation(wave, time, clock);
  }

  return [x, y];
}

function velocity(path: Path, time: number): [number, number] {
  let term: number = 1;
  let x: number = 0;
  let y: number = 0;

  if (path.curve === "sinusoidal") {
    for (const wave of path.waves) {
      x += wave.amplitude.x * slope(wave, time);
      y += wave.amplitude.y * slope(wave, time);
    }

    return [x, y];
  }

  for (let order = 0; order < path.derivatives.length; order++) {
    x += path.derivatives[order]!.x * term;
    y += path.derivatives[order]!.y * term;
    term *= time / (order + 1);
  }

  return [x, y];
}

function motion(
  x: number,
  y: number,
  path: Path,
  time: number,
): [number, number] {
  let term: number = 1;

  if (path.curve === "sinusoidal") {
    const [swayX, swayY] = swayVector(path.waves, time);

    return [x + swayX, y + swayY];
  }

  for (let order = 0; order < path.derivatives.length; order++) {
    term *= time / (order + 1);
    x += path.derivatives[order]!.x * term;
    y += path.derivatives[order]!.y * term;
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
  const sigil: Graphics = new Graphics();
  const backdrop: TilingSprite = new TilingSprite({
    width: previewWidth,
    height: previewHeight,
  });
  const player: Sprite = new Sprite(playerTexture);
  const hitbox: Graphics = new Graphics();
  const input: Vector = { x: 0, y: 0 };
  const mask: Graphics = new Graphics();
  const bullets: Array<Bullet> = new Array();
  let retired: number = 0;
  const actors: Array<Actor> = new Array();
  const emitter: Emitter = { timer: 0, time: 0 };
  const layers: BulletLayers = await loadBullet();
  let background: Background | null = null;
  let pattern: Pattern | null = null;
  let spell: Spell | null = null;
  let spellTime: number = 0;
  let stage: Stage | null = null;
  let resolve: Resolve = () => null;
  let arrivals: Array<Arrival> = new Array();
  let nextArrival: number = 0;
  let time: number = 0;
  let gradient: FillGradient | null = null;
  let playtest: boolean = false;
  let focused: boolean = false;
  let hitCount: number = 0;
  let grace: number = 0;

  coreLayer.blendMode = "add";
  player.anchor.set(0.5);
  player.width = playerSize;
  player.height = playerSize;
  player.position.set(playerX, playerY);
  hitbox
    .circle(0, 0, hitboxRadius)
    .fill(hitboxColor)
    .stroke({ color: "#ffffff", width: 1 });
  hitbox.visible = false;
  sigil.position.set(previewWidth / 2, previewHeight / 2);
  backdrop.visible = false;
  mask.rect(0, 0, previewWidth, previewHeight).fill(0xffffff);
  view.addChild(
    sky,
    backdrop,
    sigil,
    player,
    actorLayer,
    bulletLayer,
    coreLayer,
    hitbox,
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

    if (actor.spell === null) {
      actor.sigil.clear();
    } else {
      drawSpell(actor.sigil, actor.spell, actor.time);
    }

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
    seal: Spell | null,
    x: number,
    y: number,
    path: Path,
  ): Actor {
    const actor: Actor = {
      enemy: enemy,
      pattern: attack,
      spell: seal,
      view: new Container(),
      sigil: new Graphics(),
      body: new Graphics(),
      sprite: new Sprite(),
      health: new Graphics(),
      x: x,
      y: y,
      path: path,
      time: 0,
      facing: forward,
      emitter: { timer: 0, time: 0 },
    };

    actor.sprite.anchor.set(0.5);
    actor.view.addChild(actor.sigil, actor.body, actor.sprite, actor.health);
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
    retired = 0;
  }

  function retireOldest(): void {
    const oldest: Bullet = bullets[retired++]!;

    oldest.age = Infinity;
    oldest.color.visible = false;

    if (oldest.core !== null) {
      oldest.core.visible = false;
    }
  }

  function addBullet(
    source: Pattern,
    x: number,
    y: number,
    angle: number,
    speed: number,
    marginX: number,
    marginY: number,
    launch: number,
  ): void {
    if (bullets.length - retired >= maxBullets) {
      retireOldest();
    }

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
      angle: angle,
      speed: speed,
      marginX: marginX,
      marginY: marginY,
      shownX: x,
      shownY: y,
      derivatives:
        source.frame === "subjective" ? source.speedDerivatives : none,
      drift: source.frame === "objective" ? source.driftDerivatives : none,
      curve: source.curve,
      angleWaves: source.angleWaves,
      swayWaves: source.swayWaves,
      age: 0,
      launch: launch,
      radius: (source.size * bulletHitbox) / 2,
    });
  }

  function spawn(
    source: Pattern,
    x: number,
    y: number,
    base: number,
    time: number,
  ): void {
    const count: number = Math.max(Math.round(source.count), 1);
    const full: boolean = source.spread >= 360;

    for (let index = 0; index < count; index++) {
      const offset: number =
        count === 1
          ? 0
          : full
            ? (index * 360) / count
            : -source.spread / 2 + (index * source.spread) / (count - 1);

      addBullet(
        source,
        x,
        y,
        base + (offset * Math.PI) / 180,
        source.speed,
        bulletMargin,
        bulletMargin,
        time,
      );
    }
  }

  function spawnFromWall(source: Pattern, time: number): void {
    const count: number = Math.max(Math.round(source.count), 1);
    const angle: number = Math.atan2(source.velocity.y, source.velocity.x);
    const speed: number = Math.hypot(source.velocity.x, source.velocity.y);
    const vertical: boolean = source.wall === "top" || source.wall === "bottom";
    const span: number = vertical ? previewWidth : previewHeight;
    const cover: number = span * source.cover;
    const margin: number = bulletMargin + Math.max(cover - span, 0) / 2;
    const marginX: number = vertical ? margin : bulletMargin;
    const marginY: number = vertical ? bulletMargin : margin;
    const spans: Array<[number, number]> = solidSpans(source, time);
    const edge: number =
      source.wall === "top" || source.wall === "left"
        ? -edgeOffset
        : (vertical ? previewHeight : previewWidth) + edgeOffset;

    for (let index = 0; index < count; index++) {
      const along: number | null = placeAlong(spans, (index + 0.5) / count);

      if (along === null) {
        return;
      }

      const lane: number = span / 2 + (along - 0.5) * cover;

      addBullet(
        source,
        vertical ? lane : edge,
        vertical ? edge : lane,
        angle,
        speed,
        marginX,
        marginY,
        time,
      );
    }
  }

  function fire(
    source: Pattern,
    state: Emitter,
    x: number,
    y: number,
    facing: number,
    delta: number,
  ): void {
    state.time += delta;
    state.timer += delta;

    const interval: number = 1 / Math.max(source.rate, 0.01);

    while (state.timer >= interval) {
      state.timer -= interval;

      const lag: number = state.timer;
      const first: number = bullets.length;

      volley(source, state.time - lag, x, y, facing);

      for (let index = first; index < bullets.length; index++) {
        advance(bullets[index]!, lag);
        render(bullets[index]!);
      }
    }
  }

  function volley(
    source: Pattern,
    time: number,
    x: number,
    y: number,
    facing: number,
  ): void {
    if (source.frame === "objective") {
      spawnFromWall(source, time);
      return;
    }

    const aim: number = source.aim
      ? Math.atan2(player.y - y, player.x - x)
      : facing + (source.heading * Math.PI) / 180;

    spawn(
      source,
      x,
      y,
      aim +
        ((source.aimCurve === "sinusoidal"
          ? sway(source.aimWaves, time)
          : series(source.angleDerivatives, time)) *
          Math.PI) /
          180,
      time,
    );
  }

  function speedOf(bullet: Bullet): number {
    return bullet.curve === "sinusoidal"
      ? bullet.speed
      : bullet.speed + series(bullet.derivatives, bullet.age);
  }

  function headingOf(bullet: Bullet): number {
    return bullet.curve === "sinusoidal"
      ? bullet.angle +
          (sway(bullet.angleWaves, bullet.age, bullet.launch + bullet.age) *
            Math.PI) /
            180
      : bullet.angle;
  }

  function steady(bullet: Bullet): boolean {
    return bullet.curve === "sinusoidal"
      ? bullet.angleWaves.length === 0
      : bullet.derivatives.length === 0 && bullet.drift.length === 0;
  }

  function advance(bullet: Bullet, seconds: number): void {
    const size: number = steady(bullet) ? seconds : stepSize;
    let left: number = seconds;

    while (left > 0) {
      const step: number = Math.min(left, size);

      left -= step;
      bullet.age += step;

      const speed: number = speedOf(bullet);
      const heading: number = headingOf(bullet);
      const [driftX, driftY] =
        bullet.curve === "sinusoidal"
          ? [0, 0]
          : drift(bullet.drift, bullet.age);

      bullet.x += (Math.cos(heading) * speed + driftX) * step;
      bullet.y += (Math.sin(heading) * speed + driftY) * step;
    }
  }

  function render(bullet: Bullet): void {
    const [swayX, swayY] =
      bullet.curve === "sinusoidal"
        ? swayVector(bullet.swayWaves, bullet.age, bullet.launch + bullet.age)
        : [0, 0];
    const rotation: number =
      headingOf(bullet) - Math.PI / 2 + (speedOf(bullet) < 0 ? Math.PI : 0);

    bullet.shownX = bullet.x + swayX;
    bullet.shownY = bullet.y + swayY;
    bullet.color.position.set(bullet.shownX, bullet.shownY);
    bullet.color.rotation = rotation;

    if (bullet.core !== null) {
      bullet.core.position.set(bullet.shownX, bullet.shownY);
      bullet.core.rotation = rotation;
    }
  }

  function gone(bullet: Bullet): boolean {
    return (
      bullet.age > bulletLife ||
      bullet.shownX < -bullet.marginX ||
      bullet.shownY < -bullet.marginY ||
      bullet.shownX > previewWidth + bullet.marginX ||
      bullet.shownY > previewHeight + bullet.marginY
    );
  }

  function moveBullets(delta: number): void {
    let write: number = 0;

    for (let index = 0; index < bullets.length; index++) {
      const bullet: Bullet = bullets[index]!;

      advance(bullet, delta);
      render(bullet);

      if (gone(bullet)) {
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      bullets[write++] = bullet;
    }

    bullets.length = write;
    retired = 0;
  }

  function moveActors(delta: number): void {
    let write: number = 0;

    for (let index = 0; index < actors.length; index++) {
      const actor: Actor = actors[index]!;

      actor.time += delta;

      const [x, y] = motion(actor.x, actor.y, actor.path, actor.time);
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

      const [speedX, speedY] = velocity(actor.path, actor.time);

      if (Math.hypot(speedX, speedY) > stillSpeed) {
        actor.facing = Math.atan2(speedY, speedX);
      }

      if (actor.spell !== null) {
        drawSpell(actor.sigil, actor.spell, actor.time);
      }

      if (
        actor.pattern !== null &&
        x > 0 &&
        y > 0 &&
        x < previewWidth &&
        y < previewHeight
      ) {
        fire(actor.pattern, actor.emitter, x, y, actor.facing, delta);
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

  function seekPattern(value: number): void {
    const goal: number = Math.min(Math.max(value, 0), patternLimit);

    clearBullets();
    emitter.timer = 0;
    emitter.time = Math.max(goal - seekLookback, 0);

    while (pattern !== null && emitter.time < goal) {
      update(Math.min(seekStep, goal - emitter.time));
    }

    emitter.time = goal;
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
      const resolved: [Enemy, Pattern | null, Spell | null] | null = resolve(
        arrival.spawn,
      );

      nextArrival++;

      if (resolved !== null) {
        addActor(
          resolved[0],
          resolved[1],
          resolved[2],
          arrival.spawn.x * previewWidth,
          arrival.spawn.y * previewHeight,
          arrival.spawn,
        );
      }
    }

    moveActors(delta);
  }

  function movePlayer(delta: number): void {
    const speed: number = focused ? focusSpeed : playerSpeed;

    player.position.set(
      Math.min(
        Math.max(player.x + input.x * speed * delta, playerSize / 2),
        previewWidth - playerSize / 2,
      ),
      Math.min(
        Math.max(player.y + input.y * speed * delta, playerSize / 2),
        previewHeight - playerSize / 2,
      ),
    );
    hitbox.position.copyFrom(player.position);
    hitbox.visible = focused;
    grace = Math.max(grace - delta, 0);
    player.alpha =
      grace > 0 && Math.floor(grace * blinkRate) % 2 === 0 ? blinkAlpha : 1;
  }

  function collide(): void {
    let write: number = 0;

    for (let index = 0; index < bullets.length; index++) {
      const bullet: Bullet = bullets[index]!;
      const reach: number = hitboxRadius + bullet.radius;
      const touching: boolean =
        (bullet.shownX - player.x) ** 2 + (bullet.shownY - player.y) ** 2 <
        reach * reach;

      if (bullet.age === Infinity) {
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      if (touching && grace <= 0) {
        hitCount++;
        grace = hitGrace;
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      bullets[write++] = bullet;
    }

    bullets.length = write;
    retired = 0;
  }

  function setPlaytest(on: boolean): void {
    playtest = on;
    hitCount = 0;
    grace = 0;
    focused = false;
    input.x = 0;
    input.y = 0;
    player.alpha = 1;
    player.position.set(playerX, playerY);
    hitbox.position.copyFrom(player.position);
    hitbox.visible = false;

    if (on) {
      player.visible = true;
    }
  }

  function update(delta: number): void {
    if (playtest) {
      movePlayer(delta);
    }

    moveBullets(delta);

    if (stage !== null) {
      runStage(delta);
      backdrop.tilePosition.y = (background?.scroll ?? 0) * time;
    } else {
      backdrop.tilePosition.y += (background?.scroll ?? 0) * delta;

      if (actors.length > 0) {
        moveActors(delta);
      } else if (pattern !== null) {
        fire(pattern, emitter, emitterX, emitterY, forward, delta);
      }
    }

    if (spell !== null) {
      spellTime += delta;
      drawSpell(sigil, spell, spellTime);
    }

    if (playtest) {
      collide();
    }
  }

  function clear(): void {
    clearActors();
    clearBullets();
    emitter.timer = 0;
    emitter.time = 0;
    time = 0;
    spellTime = 0;
    backdrop.tilePosition.y = 0;
  }

  function showSpell(value: Spell | null): void {
    spell = value;
    sigil.visible = value !== null;

    if (value !== null) {
      drawSpell(sigil, value, spellTime);
    }
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
      showSpell(null);
      stage = null;
      pattern = value;

      if (actors.length > 0) {
        clearActors();
      }
    },
    setEnemy: (
      value: Enemy | null,
      attack: Pattern | null,
      seal: Spell | null,
    ) => {
      showSpell(null);
      stage = null;
      pattern = null;

      const actor: Actor | undefined = actors[0];

      if (value === null) {
        clearActors();
        return;
      }

      if (actor === undefined || actor.enemy !== value || actors.length > 1) {
        clearActors();
        addActor(value, attack, seal, previewWidth / 2, hoverY, still);
        return;
      }

      actor.pattern = attack;
      actor.spell = seal;
      dress(actor);
    },
    setSpell: (value: Spell | null) => {
      stage = null;
      pattern = null;
      clearActors();
      showSpell(value);
    },
    setStage: (value: Stage | null, lookup: Resolve) => {
      showSpell(null);

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
    setPlayerVisible: (visible: boolean) => {
      player.visible = visible || playtest;
    },
    stageTime: () => time,
    patternTime: () => emitter.time,
    seekPattern: seekPattern,
    clear: clear,
    update: update,
    setPlaytest: setPlaytest,
    steer: (x: number, y: number, focus: boolean) => {
      input.x = x;
      input.y = y;
      focused = focus;
    },
    hits: () => hitCount,
  };
}

export { previewWidth, previewHeight, createPreview, drawShape, motion };
export type { Preview };
