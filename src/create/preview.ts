import {
  Assets,
  Container,
  FillGradient,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  TilingSprite,
} from "pixi.js";
import { createSquad, type Squad, type Target } from "../game/drones";
import { getTexture } from "./images";
import type {
  Background,
  Bar,
  Curve,
  Enemy,
  Vector,
  Pattern,
  Spawn,
  Sigil,
  Spell,
  Stage,
  Wave,
} from "./data";
import { placeAlong, solidSpans } from "./data";
import { drawSigil } from "./sigil";
import { hitboxColor, hitboxRadius } from "../game/playfield";
import { archetype } from "../game/archetype";

type Path = Pick<Spawn, "curve" | "derivatives" | "waves">;

type Resolve = (spawn: Spawn) => Enemy | null;

type Preview = {
  view: Container;
  overlay: Container;
  setBackground: (background: Background | null) => void;
  setPattern: (pattern: Pattern | null) => void;
  setEnemy: (enemy: Enemy | null, bar: number | null) => void;
  setSigil: (sigil: Sigil | null) => void;
  setSpell: (spell: Spell | null, attack: Pattern | null) => void;
  setStage: (stage: Stage | null, resolve: Resolve) => void;
  seek: (time: number) => void;
  setPlayerVisible: (visible: boolean) => void;
  stageTime: () => number;
  patternTime: () => number;
  seekPattern: (time: number) => void;
  clear: () => void;
  update: (delta: number) => void;
  setPlaytest: (on: boolean) => void;
  steer: (x: number, y: number, focused: boolean, shooting: boolean) => void;
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
  bar: number;
  barTime: number; // s
  locked: boolean;
  staged: boolean;
  hp: number;
  fill: number;
  dead: boolean;
};

type BossHud = {
  view: Container;
  graphics: Graphics;
  stages: Text;
  timer: Text;
  name: Text;
  stars: Text;
  spell: Text;
  tag: Container;
  tagBack: Graphics;
  tagText: Text;
};

type Sky = {
  view: Container;
  fill: Graphics;
  tiles: TilingSprite;
  gradient: FillGradient | null;
  background: Background | null;
  painted: string;
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
const healthScale: number = 200;
const pipSize: number = 3; // units
const pipGap: number = 2; // units
const barLeft: number = 22; // units
const barRight: number = previewWidth - 34; // units
const barTop: number = 6; // units
const barHeight: number = 4; // units
const hudMargin: number = 6; // units
const hudResolution: number = 3;
const fillTime: number = 1; // s
const hurryTime: number = 10; // s
const spellTop: number = 24; // units
const spellPadding: number = 4; // units
const tagPadding: number = 3; // units
const hudFont: Array<string> = [
  "Barlow Condensed",
  "Arial Black",
  "Impact",
  "sans-serif",
];
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
const fadeTime: number = 1; // s

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

function createSky(): Sky {
  const sky: Sky = {
    view: new Container(),
    fill: new Graphics(),
    tiles: new TilingSprite({ width: previewWidth, height: previewHeight }),
    gradient: null,
    background: null,
    painted: "",
  };

  sky.tiles.visible = false;
  sky.view.addChild(sky.fill, sky.tiles);

  return sky;
}

function skyKey(background: Background | null): string {
  return background === null
    ? ""
    : (getTexture(background.sprite) === null ? "" : background.sprite) +
        background.top +
        background.bottom;
}

function paintSky(sky: Sky): void {
  const background: Background | null = sky.background;
  const texture: Texture | null = getTexture(background?.sprite ?? null);

  sky.painted = skyKey(background);
  sky.tiles.visible = texture !== null;

  if (texture !== null) {
    sky.tiles.texture = texture;
    sky.tiles.tileScale.set(previewWidth / texture.width);
  }

  sky.gradient?.destroy();
  sky.gradient = null;
  sky.fill.clear();

  if (background === null) {
    sky.fill.rect(0, 0, previewWidth, previewHeight).fill("#01040f");
    return;
  }

  sky.gradient = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: background.top },
      { offset: 1, color: background.bottom },
    ],
  });
  sky.fill.rect(0, 0, previewWidth, previewHeight).fill(sky.gradient);
}

function hudText(size: number, color: string): Text {
  return new Text({
    text: "",
    resolution: hudResolution,
    style: {
      fontFamily: hudFont,
      fontSize: size,
      fontStyle: "italic",
      fontWeight: "900",
      fill: color,
      dropShadow: {
        color: "#000000",
        alpha: 0.85,
        blur: 0,
        distance: 1,
        angle: Math.PI / 3,
      },
    },
  });
}

function createBossHud(): BossHud {
  const hud: BossHud = {
    view: new Container(),
    graphics: new Graphics(),
    stages: hudText(12, "#ffffff"),
    timer: hudText(14, "#ffffff"),
    name: hudText(9, "#9fd8ff"),
    stars: hudText(9, "#ffd84a"),
    spell: hudText(11, "#ffffff"),
    tag: new Container(),
    tagBack: new Graphics(),
    tagText: hudText(8, "#ff8a80"),
  };

  hud.stages.anchor.set(0, 0.5);
  hud.stages.position.set(hudMargin, barTop + barHeight / 2);
  hud.timer.anchor.set(1, 0.5);
  hud.timer.position.set(previewWidth - hudMargin, barTop + barHeight / 2);
  hud.name.position.set(barLeft, barTop + barHeight + 3);
  hud.stars.y = hud.name.y;
  hud.spell.anchor.set(1, 0);
  hud.spell.position.set(previewWidth - hudMargin - spellPadding, spellTop);
  hud.tagText.text = "ENEMY";
  hud.tagText.anchor.set(0.5, 1);
  hud.tagBack
    .rect(
      -hud.tagText.width / 2 - tagPadding,
      -hud.tagText.height - tagPadding / 2,
      hud.tagText.width + tagPadding * 2,
      hud.tagText.height + tagPadding / 2,
    )
    .fill({ color: "#000000", alpha: 0.6 });
  hud.tag.addChild(hud.tagBack, hud.tagText);
  hud.tag.y = previewHeight;
  hud.view.addChild(
    hud.graphics,
    hud.stages,
    hud.timer,
    hud.name,
    hud.stars,
    hud.spell,
    hud.tag,
  );
  hud.view.visible = false;

  return hud;
}

async function createPreview(
  playerTexture: Texture,
  droneTexture: Texture,
  findBackground: (id: string | null) => Background | null,
  findSigil: (id: string | null) => Sigil | null,
  findSpell: (id: string | null) => Spell | null,
  findPattern: (id: string | null) => Pattern | null,
): Promise<Preview> {
  const view: Container = new Container();
  const base: Sky = createSky();
  const cover: Sky = createSky();
  const bulletLayer: Container = new Container();
  const coreLayer: Container = new Container();
  const actorLayer: Container = new Container();
  const overlay: Container = new Container();
  const bossHud: BossHud = createBossHud();
  const squad: Squad = createSquad(droneTexture, previewWidth, previewHeight);
  const sigil: Graphics = new Graphics();
  const player: Sprite = new Sprite(playerTexture);
  const hitbox: Graphics = new Graphics();
  const input: Vector = { x: 0, y: 0 };
  const mask: Graphics = new Graphics();
  const bullets: Array<Bullet> = new Array();
  let retired: number = 0;
  const actors: Array<Actor> = new Array();
  const emitter: Emitter = { timer: 0, time: 0 };
  const layers: BulletLayers = await loadBullet();
  let blend: number = 0;
  let pattern: Pattern | null = null;
  let spell: Spell | null = null;
  let shown: Sigil | null = null;
  let spellTime: number = 0;
  let stage: Stage | null = null;
  let resolve: Resolve = () => null;
  let arrivals: Array<Arrival> = new Array();
  let nextArrival: number = 0;
  let time: number = 0;
  let playtest: boolean = false;
  let focused: boolean = false;
  let shooting: boolean = false;
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
  squad.view.visible = false;
  sigil.position.set(previewWidth / 2, previewHeight / 2);
  cover.view.visible = false;
  mask.rect(0, 0, previewWidth, previewHeight).fill(0xffffff);
  view.addChild(
    base.view,
    cover.view,
    sigil,
    squad.shotLayer,
    player,
    squad.view,
    actorLayer,
    bulletLayer,
    coreLayer,
    hitbox,
    bossHud.view,
    overlay,
    mask,
  );
  view.mask = mask;

  function spellBackground(): Background | null {
    for (let index = actors.length - 1; index >= 0; index--) {
      const found: Background | null = findBackground(
        actors[index]!.spell?.background ?? null,
      );

      if (found !== null) {
        return found;
      }
    }

    return spell === null ? null : findBackground(spell.background);
  }

  function fade(delta: number): void {
    const target: Background | null = spellBackground();

    if (target !== null && target === cover.background) {
      blend = Math.min(blend + delta / fadeTime, 1);

      if (cover.painted !== skyKey(target)) {
        paintSky(cover);
      }
    } else {
      blend = Math.max(blend - delta / fadeTime, 0);

      if (blend === 0 && target !== null) {
        cover.background = target;
        paintSky(cover);
      }
    }

    cover.view.alpha = blend;
    cover.view.visible = blend > 0;
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

    const found: Sigil | null = findSigil(actor.spell?.sigil ?? null);

    if (found === null) {
      actor.sigil.clear();
    } else {
      drawSigil(actor.sigil, found, actor.time);
    }

    actor.health.clear();

    if (enemy.rank !== "regular") {
      return;
    }

    actor.health
      .rect(-healthWidth / 2, -enemy.size / 2 - 8, healthWidth, healthHeight)
      .fill({ color: "#000000", alpha: 0.6 })
      .rect(
        -healthWidth / 2,
        -enemy.size / 2 - 8,
        healthWidth *
          Math.min((enemy.bars[actor.bar]?.health ?? 0) / healthScale, 1) *
          Math.min(
            Math.max(
              actor.hp / Math.max(enemy.bars[actor.bar]?.health ?? 1, 1),
              0,
            ),
            1,
          ),
        healthHeight,
      )
      .fill("#ff3b3b");

    for (let index = actor.bar + 1; index < barCount(enemy); index++) {
      actor.health
        .rect(
          -healthWidth / 2 + (index - actor.bar - 1) * (pipSize + pipGap),
          -enemy.size / 2 - 8 + healthHeight + pipGap,
          pipSize,
          pipSize,
        )
        .fill("#ff3b3b");
    }
  }

  function drawBossBar(delta: number): void {
    let boss: Actor | null = null;

    for (let index = actors.length - 1; index >= 0; index--) {
      if (actors[index]!.enemy.rank !== "regular" && !actors[index]!.dead) {
        boss = actors[index]!;
        break;
      }
    }

    bossHud.view.visible = boss !== null;

    if (boss === null) {
      return;
    }

    const enemy: Enemy = boss.enemy;
    const maximum: number = Math.max(enemy.bars[boss.bar]?.health ?? 1, 1);
    const limit: number = enemy.bars[boss.bar]?.time ?? 0;
    const left: number = Math.max(limit - boss.barTime, 0);
    const spells: number = enemy.bars
      .slice(boss.bar + 1, barCount(enemy))
      .filter((bar: Bar) => bar.spell !== null).length;
    const width: number = barRight - barLeft;

    boss.fill = Math.min(boss.fill + delta / fillTime, 1);

    const amount: number = Math.min(boss.fill, Math.max(boss.hp, 0) / maximum);

    bossHud.graphics
      .clear()
      .rect(barLeft, barTop, width, barHeight)
      .fill({ color: "#000000", alpha: 0.55 })
      .rect(barLeft, barTop, width * amount, barHeight)
      .fill("#ff5a7a")
      .rect(barLeft, barTop, width * amount, 1)
      .fill("#ffd0da")
      .rect(barLeft, barTop, width, barHeight)
      .stroke({ color: "#ffffff", width: 0.5, alpha: 0.5, alignment: 1 });
    bossHud.stages.text = String(barCount(enemy) - boss.bar - 1);
    bossHud.timer.visible = limit > 0;
    bossHud.timer.text = String(Math.ceil(left)).padStart(2, "0");
    bossHud.timer.style.fill = left < hurryTime ? "#ff3b3b" : "#ffffff";
    bossHud.name.text = enemy.name.toUpperCase();
    bossHud.stars.text = "★".repeat(spells);
    bossHud.stars.x = bossHud.name.x + bossHud.name.width + 3;
    bossHud.spell.visible = boss.spell !== null;

    if (boss.spell !== null) {
      bossHud.spell.text = boss.spell.name;
      bossHud.graphics
        .rect(
          bossHud.spell.x - bossHud.spell.width - spellPadding,
          spellTop - 1,
          bossHud.spell.width + spellPadding * 2,
          bossHud.spell.height + 2,
        )
        .fill({ color: "#000000", alpha: 0.45 });
    }

    bossHud.tag.visible = boss.view.x > 0 && boss.view.x < previewWidth;
    bossHud.tag.x = boss.view.x;
  }

  function finishBar(actor: Actor): void {
    const next: number = actor.bar + 1;

    if (next >= barCount(actor.enemy) && actor.staged) {
      actor.dead = true;
      return;
    }

    if (actor.enemy.rank !== "regular") {
      clearBullets();
    }

    arm(actor, next < barCount(actor.enemy) ? next : 0);
  }

  function damage(actor: Actor, amount: number): void {
    actor.hp -= amount;

    if (actor.hp > 0) {
      if (actor.enemy.rank === "regular") {
        dress(actor);
      }

      return;
    }

    if (actor.locked) {
      actor.hp = Math.max(actor.enemy.bars[actor.bar]?.health ?? 1, 1);
      actor.fill = 0;
      dress(actor);
      return;
    }

    finishBar(actor);
  }

  function targets(): Array<Target> {
    return actors
      .filter(
        (actor: Actor) =>
          !actor.dead &&
          actor.view.x >= 0 &&
          actor.view.x <= previewWidth &&
          actor.view.y >= 0 &&
          actor.view.y <= previewHeight,
      )
      .map((actor: Actor) => ({ x: actor.view.x, y: actor.view.y }));
  }

  function hitActors(): void {
    for (const shot of squad.shots) {
      if (shot.spent) {
        continue;
      }

      for (const actor of actors) {
        const reach: number = actor.enemy.size / 2;

        if (
          actor.dead ||
          actor.view.x < 0 ||
          actor.view.x > previewWidth ||
          actor.view.y < 0 ||
          actor.view.y > previewHeight ||
          (shot.x - actor.view.x) ** 2 + (shot.y - actor.view.y) ** 2 >
            reach * reach
        ) {
          continue;
        }

        shot.spent = true;
        damage(actor, shot.damage);
        break;
      }
    }
  }

  function barCount(enemy: Enemy): number {
    return enemy.rank === "boss" ? enemy.bars.length : 1;
  }

  function arm(actor: Actor, index: number): void {
    const enemy: Enemy = actor.enemy;

    actor.bar = Math.max(Math.min(index, barCount(enemy) - 1), 0);
    actor.barTime = 0;
    actor.hp = Math.max(enemy.bars[actor.bar]?.health ?? 1, 1);
    actor.fill = 0;
    actor.spell =
      enemy.rank === "regular"
        ? null
        : findSpell(enemy.bars[actor.bar]?.spell ?? null);
    actor.pattern =
      findPattern(actor.spell?.pattern ?? null) ?? findPattern(enemy.pattern);
    actor.emitter.timer = 0;
    actor.emitter.time = 0;
    dress(actor);
  }

  function addActor(
    enemy: Enemy,
    x: number,
    y: number,
    path: Path,
    bar: number | null,
    staged: boolean,
  ): Actor {
    const actor: Actor = {
      enemy: enemy,
      pattern: null,
      spell: null,
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
      bar: 0,
      barTime: 0,
      hp: 1,
      fill: 0,
      dead: false,
      locked: bar !== null,
      staged: staged,
    };

    actor.sprite.anchor.set(0.5);
    actor.view.addChild(actor.sigil, actor.body, actor.sprite, actor.health);
    actorLayer.addChild(actor.view);
    actors.push(actor);
    arm(actor, bar ?? 0);

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

      if (actor.dead) {
        actor.view.destroy({ children: true });
        continue;
      }

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

      const limit: number = actor.enemy.bars[actor.bar]?.time ?? 0;

      actor.barTime += delta;

      if (
        actor.enemy.rank !== "regular" &&
        limit > 0 &&
        actor.barTime >= limit
      ) {
        if (actor.locked || (!actor.staged && barCount(actor.enemy) === 1)) {
          actor.barTime = 0;
        } else {
          finishBar(actor);

          if (actor.dead) {
            actor.view.destroy({ children: true });
            continue;
          }
        }
      }

      actor.view.position.set(x, y);

      const [speedX, speedY] = velocity(actor.path, actor.time);

      if (Math.hypot(speedX, speedY) > stillSpeed) {
        actor.facing = Math.atan2(speedY, speedX);
      }

      const found: Sigil | null = findSigil(actor.spell?.sigil ?? null);

      if (found !== null) {
        drawSigil(actor.sigil, found, actor.time);
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
    blend = 0;
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
      const resolved: Enemy | null = resolve(arrival.spawn);

      nextArrival++;

      if (resolved !== null) {
        addActor(
          resolved,
          arrival.spawn.x * previewWidth,
          arrival.spawn.y * previewHeight,
          arrival.spawn,
          null,
          true,
        );
      }
    }

    moveActors(delta);
  }

  function movePlayer(delta: number): void {
    const speed: number = focused ? archetype().focusSpeed : archetype().speed;

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
    shooting = false;
    squad.clear();
    squad.view.visible = on;
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
      base.tiles.tilePosition.y = (base.background?.scroll ?? 0) * time;
    } else {
      base.tiles.tilePosition.y += (base.background?.scroll ?? 0) * delta;

      if (actors.length > 0) {
        moveActors(delta);
      } else if (pattern !== null) {
        fire(pattern, emitter, emitterX, emitterY, forward, delta);
      }
    }

    if (shown !== null) {
      spellTime += delta;
      drawSigil(sigil, shown, spellTime);
    }

    cover.tiles.tilePosition.y += (cover.background?.scroll ?? 0) * delta;
    fade(delta);

    if (playtest) {
      squad.update(delta, player.x, player.y, focused, shooting, targets());
      hitActors();
      collide();
    }

    drawBossBar(delta);
  }

  function clear(): void {
    clearActors();
    clearBullets();
    squad.clear();
    emitter.timer = 0;
    emitter.time = 0;
    time = 0;
    spellTime = 0;
    blend = 0;
    cover.view.visible = false;
    base.tiles.tilePosition.y = 0;
  }

  function showSigil(value: Sigil | null): void {
    shown = value;
    sigil.visible = value !== null;

    if (value !== null) {
      drawSigil(sigil, value, spellTime);
    }
  }

  function showSpell(value: Spell | null): void {
    spell = value;
    showSigil(value === null ? null : findSigil(value.sigil));
  }

  paintSky(base);

  return {
    view: view,
    overlay: overlay,
    setBackground: (value: Background | null) => {
      base.background = value;
      paintSky(base);
      paintSky(cover);
    },
    setPattern: (value: Pattern | null) => {
      showSpell(null);
      stage = null;
      pattern = value;

      if (actors.length > 0) {
        clearActors();
      }
    },
    setEnemy: (value: Enemy | null, bar: number | null) => {
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
        addActor(value, previewWidth / 2, hoverY, still, bar, false);
        return;
      }

      const elapsed: number = actor.barTime;

      actor.locked = bar !== null;
      arm(actor, bar ?? actor.bar);
      actor.barTime = bar === null ? elapsed : 0;
    },
    setSigil: (value: Sigil | null) => {
      stage = null;
      pattern = null;
      clearActors();
      spell = null;
      showSigil(value);
    },
    setSpell: (value: Spell | null, attack: Pattern | null) => {
      stage = null;
      pattern = attack;
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
    steer: (x: number, y: number, focus: boolean, shoot: boolean) => {
      input.x = x;
      input.y = y;
      focused = focus;
      shooting = shoot;
    },
    hits: () => hitCount,
  };
}

export { previewWidth, previewHeight, createPreview, drawShape, motion };
export type { Preview };
