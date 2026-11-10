import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import { energyOf, type Energy } from "../energy";
import type { Bullet, Curve, Pattern, Vector, Wave } from "../types";
import { placeAlong, solidSpans } from "../geometry";
import { drift, series, sway, swayVector } from "../kinematics";
import { hitboxRadius } from "../../game/player";
import type { Bomb } from "../../game/bomb";
import { previewHeight, previewWidth } from "./bounds";
import type { Threat } from "./autopilot";

type BulletLayers = {
  color: Texture;
  core: Texture;
};

type Round = {
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
  vx: number; // units/s
  vy: number; // units/s
  grazed: boolean;
  originX: number; // units
  mirrored: boolean;
  pushX: number; // units
  pushY: number; // units
  fade: number;
  tone: string | number;
};

type Aura = {
  radius: number; // units
  slow: number;
  erase: boolean;
};

type Emitter = {
  timer: number; // s
  time: number; // s
};

type Bullets = {
  fire: (
    source: Pattern,
    state: Emitter,
    x: number,
    y: number,
    facing: number,
    delta: number,
  ) => boolean;
  move: (delta: number) => void;
  clear: () => void;
  collide: (x: number, y: number, bomb: Bomb, vulnerable: boolean) => boolean;
  graze: (x: number, y: number) => number;
  threats: () => ReadonlyArray<Threat>;
  setTempo: (value: number) => void;
  setPace: (value: number) => void;
  setFreeze: (value: number) => void;
  setMirror: (on: boolean) => void;
  setWind: (x: number, y: number) => void;
  setRecolor: (color: string | null) => void;
  setAura: (aura: Aura | null) => void;
  cancel: () => number;
};

const bulletPath: string = "./sprites/bullets/orb.png";
const maxBullets: number = 6000;
const bulletMargin: number = 48; // units
const bulletLife: number = 20; // s
const stepSize: number = 1 / 240; // s
const grazeReach: number = 16; // units
const none: Array<never> = [];
const bulletHitbox: number = 0.25; // of size
const edgeOffset: number = 8; // units
const eraseTime: number = 0.4; // s

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

async function createBullets(
  bulletLayer: Container,
  coreLayer: Container,
  target: Vector,
  findBullet: (id: string | null) => Bullet | null,
): Promise<Bullets> {
  const bullets: Array<Round> = new Array();
  const layers: BulletLayers = await loadBullet();
  let retired: number = 0;
  let tempo: number = 1;
  let pace: number = 1;
  let freeze: number = 0;
  let mirror: boolean = false;
  let windX: number = 0; // units/s
  let windY: number = 0; // units/s
  let recolor: string | null = null;
  let aura: Aura | null = null;

  function clear(): void {
    for (let index = 0; index < bullets.length; index++) {
      bullets[index]!.color.destroy();
      bullets[index]!.core?.destroy();
    }

    bullets.length = 0;
    retired = 0;
  }

  function retireOldest(): void {
    const oldest: Round = bullets[retired++]!;

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
    originX: number,
  ): void {
    if (bullets.length - retired >= maxBullets) {
      retireOldest();
    }

    const look: Bullet | null = findBullet(source.bullet);
    const energy: Energy | null = look === null ? null : energyOf(look);
    const color: Sprite = new Sprite(energy?.glow ?? layers.color);
    const core: Sprite = new Sprite(energy?.core ?? layers.core);
    const scale: number =
      source.size / Math.max(color.texture.width, color.texture.height);

    color.anchor.set(0.5);
    color.scale.set(scale);
    const tone: string | number = energy === null ? source.color : 0xffffff;

    color.tint = recolor ?? tone;
    bulletLayer.addChild(color);
    core.anchor.set(0.5);
    core.scale.set(scale);
    coreLayer.addChild(core);

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
      vx: 0,
      vy: 0,
      derivatives:
        source.frame === "subjective" ? source.speedDerivatives : none,
      drift: source.frame === "objective" ? source.driftDerivatives : none,
      curve: source.curve,
      angleWaves: source.angleWaves,
      swayWaves: source.swayWaves,
      age: 0,
      launch: launch,
      radius: (source.size * bulletHitbox) / 2,
      grazed: false,
      originX: originX,
      mirrored: mirror,
      pushX: 0,
      pushY: 0,
      fade: 1,
      tone: tone,
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
        x,
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
        previewWidth / 2,
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
  ): boolean {
    state.time += delta;
    state.timer += delta;

    const interval: number = 1 / Math.max(source.rate * tempo, 0.01);
    let fired: boolean = false;

    while (state.timer >= interval) {
      fired = true;
      state.timer -= interval;

      const lag: number = state.timer;
      const first: number = bullets.length;

      volley(source, state.time - lag, x, y, facing);

      for (let index = first; index < bullets.length; index++) {
        advance(bullets[index]!, lag);
        render(bullets[index]!);
      }
    }

    return fired;
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

    const aimX: number = mirror ? 2 * x - target.x : target.x;
    const aim: number = source.aim
      ? Math.atan2(target.y - y, aimX - x)
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

  function speedOf(bullet: Round): number {
    return bullet.curve === "sinusoidal"
      ? bullet.speed
      : bullet.speed + series(bullet.derivatives, bullet.age);
  }

  function headingOf(bullet: Round): number {
    return bullet.curve === "sinusoidal"
      ? bullet.angle +
          (sway(bullet.angleWaves, bullet.age, bullet.launch + bullet.age) *
            Math.PI) /
            180
      : bullet.angle;
  }

  function steady(bullet: Round): boolean {
    return bullet.curve === "sinusoidal"
      ? bullet.angleWaves.length === 0
      : bullet.derivatives.length === 0 && bullet.drift.length === 0;
  }

  function advance(bullet: Round, seconds: number): void {
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

  function render(bullet: Round): void {
    const [swayX, swayY] =
      bullet.curve === "sinusoidal"
        ? swayVector(bullet.swayWaves, bullet.age, bullet.launch + bullet.age)
        : [0, 0];
    const turn: number =
      headingOf(bullet) - Math.PI / 2 + (speedOf(bullet) < 0 ? Math.PI : 0);
    const rotation: number = bullet.mirrored ? -turn : turn;
    const rawX: number = bullet.x + swayX;

    bullet.shownX =
      (bullet.mirrored ? 2 * bullet.originX - rawX : rawX) + bullet.pushX;
    bullet.shownY = bullet.y + swayY + bullet.pushY;
    bullet.color.position.set(bullet.shownX, bullet.shownY);
    bullet.color.rotation = rotation;

    if (bullet.core !== null) {
      bullet.core.position.set(bullet.shownX, bullet.shownY);
      bullet.core.rotation = rotation;
    }
  }

  function gone(bullet: Round): boolean {
    return (
      bullet.age > bulletLife ||
      bullet.shownX < -bullet.marginX ||
      bullet.shownY < -bullet.marginY ||
      bullet.shownX > previewWidth + bullet.marginX ||
      bullet.shownY > previewHeight + bullet.marginY
    );
  }

  function move(delta: number): void {
    let write: number = 0;

    for (let index = 0; index < bullets.length; index++) {
      const bullet: Round = bullets[index]!;
      const fromX: number = bullet.shownX;
      const fromY: number = bullet.shownY;

      const inside: boolean =
        aura !== null &&
        (bullet.shownX - target.x) ** 2 + (bullet.shownY - target.y) ** 2 <
          (aura.radius + bullet.radius) ** 2;
      const flow: number =
        delta * (1 - freeze) * (inside && !aura!.erase ? 1 - aura!.slow : 1);

      advance(bullet, flow * pace);
      bullet.pushX += windX * flow;
      bullet.pushY += windY * flow;

      if (bullet.fade < 1 || (inside && aura!.erase)) {
        bullet.fade -= delta / eraseTime;
        bullet.color.alpha = Math.max(bullet.fade, 0);

        if (bullet.core !== null) {
          bullet.core.alpha = Math.max(bullet.fade, 0);
        }
      }

      render(bullet);

      if (delta > 0) {
        bullet.vx = (bullet.shownX - fromX) / delta;
        bullet.vy = (bullet.shownY - fromY) / delta;
      }

      if (gone(bullet) || bullet.fade <= 0) {
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      bullets[write++] = bullet;
    }

    bullets.length = write;
    retired = 0;
  }

  function collide(
    x: number,
    y: number,
    bomb: Bomb,
    vulnerable: boolean,
  ): boolean {
    let write: number = 0;
    let hit: boolean = false;

    for (let index = 0; index < bullets.length; index++) {
      const bullet: Round = bullets[index]!;
      const reach: number = hitboxRadius + bullet.radius;
      const touching: boolean =
        (bullet.shownX - x) ** 2 + (bullet.shownY - y) ** 2 < reach * reach;

      if (
        bullet.age === Infinity ||
        bomb.covers(bullet.shownX, bullet.shownY, bullet.radius)
      ) {
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      if (touching && vulnerable && !hit && bullet.fade >= 1) {
        hit = true;
        bullet.color.destroy();
        bullet.core?.destroy();
        continue;
      }

      bullets[write++] = bullet;
    }

    bullets.length = write;
    retired = 0;

    return hit;
  }

  function graze(x: number, y: number): number {
    let count: number = 0;

    for (let index = retired; index < bullets.length; index++) {
      const bullet: Round = bullets[index]!;
      const reach: number = grazeReach + bullet.radius;

      if (
        !bullet.grazed &&
        bullet.age !== Infinity &&
        bullet.fade >= 1 &&
        (bullet.shownX - x) ** 2 + (bullet.shownY - y) ** 2 < reach * reach
      ) {
        bullet.grazed = true;
        count++;
      }
    }

    return count;
  }

  return {
    fire: fire,
    move: move,
    clear: clear,
    collide: collide,
    graze: graze,
    threats: () => bullets,
    setTempo: (value: number) => {
      tempo = value;
    },
    setPace: (value: number) => {
      pace = value;
    },
    setFreeze: (value: number) => {
      freeze = Math.min(Math.max(value, 0), 1);
    },
    setMirror: (on: boolean) => {
      mirror = on;
    },
    setWind: (x: number, y: number) => {
      windX = x;
      windY = y;
    },
    setRecolor: (color: string | null) => {
      if (color === recolor) {
        return;
      }

      recolor = color;

      for (const bullet of bullets) {
        bullet.color.tint = recolor ?? bullet.tone;
      }
    },
    setAura: (value: Aura | null) => {
      aura = value;
    },
    cancel: () => {
      const count: number = bullets.filter(
        (bullet: Round) => bullet.age !== Infinity,
      ).length;

      clear();

      return count;
    },
  };
}

export { createBullets };
export type { Bullets, Emitter, Aura };
