import {
  Container,
  Graphics,
  type Sprite,
  type Text,
  type Texture,
} from "pixi.js";
import type { Squad } from "../../game/drones";
import type {
  Background,
  Bullet,
  Effect,
  ModifierTarget,
  Vessel,
  Enemy,
  Pattern,
  Sigil,
  Spawn,
  Spell,
  Stage,
  Vector,
} from "../types";
import { drawSigil } from "../sigil";
import type { Path } from "../kinematics";
import { deathbombWindow, startBombs, type Bomb } from "../../game/bomb";
import { createPilot, type Pilot } from "../../game/pilot";
import { archetype } from "../../game/archetype";
import { previewHeight, previewWidth } from "./bounds";
import {
  advanceSky,
  createSky,
  paintSky,
  setSkyTime,
  skyKey,
  type Sky,
} from "./sky";
import { createBullets, type Bullets, type Emitter } from "./bullets";
import { createActors, forward, type Actor, type Actors } from "./actors";
import { createBossHud, drawBossBar, type BossHud } from "./bosshud";
import {
  createItems,
  type Defeat,
  type Granted,
  type Haul,
  type Items,
} from "./items";
import { createShadowText, createText } from "../../ui/text";
import type { Capture } from "./actors";
import { getShake } from "../../settings/settings";
import { rumble } from "../../game/gamepad";
import { createAutopilot, type Autopilot, type Decision } from "./autopilot";
import { maxPower, minPower } from "../../game/drones";
import { cue, hush } from "../../game/sfx";
import {
  combineFactors,
  lasts,
  neutralFactors,
  type Factors,
  type Weighted,
} from "../effects";
import { playerSize } from "../../game/player";
import { defaultEnemy, defaultPattern } from "../defaults";

type Resolve = (spawn: Spawn) => Enemy | null;

type Preview = {
  view: Container;
  overlay: Container;
  setBackground: (background: Background | null) => void;
  setPattern: (pattern: Pattern | null) => void;
  setEnemy: (enemy: Enemy | null, bar: number | null) => void;
  setEffect: (effect: Effect | null) => void;
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
  setPlaytest: (on: boolean, carry?: boolean) => void;
  steer: (
    x: number,
    y: number,
    focused: boolean,
    shooting: boolean,
    bombing: boolean,
  ) => void;
  hits: () => number;
  bombs: () => number;
  score: () => number;
  grazes: () => number;
  setLoop: (loop: boolean) => void;
  setPower: (value: number) => void;
  setDim: (amount: number) => void;
  power: () => number;
  themes: () => Array<string>;
  setAutopilot: (on: boolean) => void;
  collected: () => number;
  bombsUsed: () => number;
  setBombs: (value: number) => void;
  finished: () => boolean;
  takeCue: () => string | null;
  lifeGains: () => number;
  setChapter: (text: string) => void;
  announce: (name: string) => void;
};

type Arrival = {
  time: number; // s
  spawn: Spawn;
};

type Cue = {
  time: number; // s
  cutscene: string;
};

type Boost = {
  effect: Effect;
  target: ModifierTarget;
  left: number; // s
  age: number; // s
  hits: number;
  layers: number;
};

const emitterX: number = previewWidth / 2; // units
const maxDim: number = 0.8;
const emitterY: number = 140; // units
const playerX: number = previewWidth / 2; // units
const playerY: number = 400; // units
const hitPower: number = 0.5;
const calloutY: number = 90; // units
const shakeTime: number = 0.35; // s
const declareY: number = 200; // units
const declareTime: number = 1.8; // s
const declareSlide: number = 0.35; // s
const declareFade: number = 0.45; // s
const declareDrift: number = 30; // units
const declareSize: number = 18; // units
const declareBand: number = 40; // units
const shakeAmount: number = 6; // units
const hitRumble: number = 0.9;
const hitRumbleTime: number = 260; // ms
const bombRumble: number = 0.45;
const bombRumbleTime: number = 420; // ms
const calloutGap: number = 26; // units
const calloutTime: number = 2.2; // s
const calloutFade: number = 0.4; // s
const calloutTitleSize: number = 20; // units
const calloutValueSize: number = 15; // units
const hitGrace: number = 1; // s
const blinkRate: number = 12; // Hz
const blinkAlpha: number = 0.3;
const guideSnap: number = 0.5; // units
const hoverY: number = 120; // units
const seekLookback: number = 8; // s
const seekStep: number = 1 / 30; // s
const patternLimit: number = 3600; // s
const still: Path = {
  curve: "polynomial",
  derivatives: new Array(),
  waves: new Array(),
};
const fadeTime: number = 1; // s
const grazePoints: number = 50;
const maxBombs: number = 8;
const piecesPerLife: number = 3;
const piecesPerBomb: number = 3;
const titleStart: number = 0.6; // s
const titleIn: number = 0.7; // s
const titleHold: number = 2.6; // s
const titleOut: number = 0.9; // s
const titleY: number = 170; // units
const titleRise: number = 10; // units
const titleSize: number = 26; // units
const chapterSize: number = 13; // units
const chapterGap: number = 26; // units
const titleLine: number = 150; // units
const bgmTime: number = 4.5; // s
const bgmFade: number = 0.6; // s
const bgmSlide: number = 30; // units
const bgmSize: number = 10; // units
const bgmMargin: number = 6; // units
const boostSize: number = 10; // units
const boostGap: number = 13; // units
const boostLimit: number = 6;
const boostWarning: number = 3; // s
const boostBlink: number = 6; // Hz
const bulletPoints: number = 100;
const fogLight: number = 70; // units
const fogRings: number = 4;
const fogDepth: number = 0.95;
const auraAlpha: number = 0.4;
const auraFill: number = 0.06;
const idleBoostAlpha: number = 0.45;
const demoId: string = "effect-demo";
const demoEvery: number = 3; // s
const demoSway: number = 90; // units
const demoFrequency: number = 0.25; // Hz
const demoPattern: Pattern = {
  ...defaultPattern(),
  id: demoId,
  aim: true,
  count: 5,
  spread: 50,
  rate: 1.5,
  speed: 120,
};
const demoEnemy: Enemy = { ...defaultEnemy(demoId), id: demoId };
const demoPath: Path = {
  curve: "sinusoidal",
  derivatives: new Array(),
  waves: [
    {
      amplitude: { x: demoSway, y: 0 },
      frequency: demoFrequency,
      phase: 0,
      phaseShift: 0,
    },
  ],
};

async function createPreview(
  playerTexture: Texture,
  droneTexture: Texture,
  findBackground: (id: string | null) => Background | null,
  findSigil: (id: string | null) => Sigil | null,
  findSpell: (id: string | null) => Spell | null,
  findPattern: (id: string | null) => Pattern | null,
  findBullet: (id: string | null) => Bullet | null,
  findVessel: (id: string | null) => Vessel | null,
  findEffect: (id: string | null) => Effect | null,
): Promise<Preview> {
  const view: Container = new Container();
  const base: Sky = createSky();
  const cover: Sky = createSky();
  const bulletLayer: Container = new Container();
  const coreLayer: Container = new Container();
  const actorLayer: Container = new Container();
  const itemLayer: Container = new Container();
  const overlay: Container = new Container();
  const bossHud: BossHud = createBossHud();
  const pilot: Pilot = createPilot(
    playerTexture,
    droneTexture,
    previewWidth,
    previewHeight,
  );
  const squad: Squad = pilot.squad;
  const bomb: Bomb = pilot.bomb;
  const player: Sprite = pilot.player;
  const hitbox: Graphics = pilot.hitbox;
  const sigil: Graphics = new Graphics();
  const dim: Graphics = new Graphics();
  const fog: Graphics = new Graphics();
  const halo: Graphics = new Graphics();
  const playerWind: Vector = { x: 0, y: 0 };
  let fogAmount: number = 0;
  let demo: Effect | null = null;
  let demoClock: number = 0;
  const input: Vector = { x: 0, y: 0 };
  const mask: Graphics = new Graphics();
  const bullets: Bullets = await createBullets(
    bulletLayer,
    coreLayer,
    player,
    findBullet,
  );
  const actors: Actors = createActors(
    actorLayer,
    {
      sigil: findSigil,
      spell: findSpell,
      pattern: (id: string | null) =>
        id === demoId ? demoPattern : findPattern(id),
      vessel: findVessel,
      effect: findEffect,
    },
    bullets,
  );
  const emitter: Emitter = { timer: 0, time: 0 };
  const items: Items = createItems(itemLayer);
  let power: number = maxPower;
  let itemPoints: number = 0;
  let calloutLeft: number = 0;
  let shakeLeft: number = 0;
  let autopilot: boolean = false;
  const brain: Autopilot = createAutopilot();
  let declareLeft: number = 0;
  const declaration: Container = new Container();
  const declareBack: Graphics = new Graphics()
    .rect(0, -declareBand / 2, previewWidth, declareBand)
    .fill({ color: "#01040f", alpha: 0.6 })
    .rect(0, -declareBand / 2, previewWidth, 1)
    .rect(0, declareBand / 2 - 1, previewWidth, 1)
    .fill({ color: "#ffffff", alpha: 0.5 });
  const declareText: Text = createShadowText(
    "",
    declareSize,
    "#ffffff",
    "#020b30",
    3,
  );
  const callout: Container = new Container();
  const calloutTitle: Text = createShadowText(
    "SPELL CARD BONUS",
    calloutTitleSize,
    "#ffffff",
    "#020b30",
    3,
  );
  const calloutValue: Text = createText(calloutValueSize, "#ffe27a");
  const title: Container = new Container();
  const titleText: Text = createShadowText(
    "",
    titleSize,
    "#ffffff",
    "#020b30",
    3,
  );
  const chapterText: Text = createShadowText(
    "",
    chapterSize,
    "#9fd8ff",
    "#020b30",
    2,
  );
  const titleRule: Graphics = new Graphics()
    .rect(-titleLine / 2, 0, titleLine, 1)
    .fill({ color: "#ffffff", alpha: 0.7 });
  const bgm: Text = createShadowText("", bgmSize, "#ffffff", "#020b30", 2);
  let bgmLeft: number = 0;
  const boostList: Container = new Container();
  const boostTexts: Array<Text> = new Array();
  let boosts: Array<Boost> = new Array();
  let factors: Factors = neutralFactors();
  let enemyFactors: Factors = neutralFactors();
  let boostClock: number = 0;
  let lifeGains: number = 0;
  let lifePieces: number = 0;
  let bombPieces: number = 0;
  let itemCount: number = 0;
  let bombsUsed: number = 0;
  let blend: number = 0;
  let pattern: Pattern | null = null;
  let spell: Spell | null = null;
  let shown: Sigil | null = null;
  let spellTime: number = 0;
  let stage: Stage | null = null;
  let resolve: Resolve = () => null;
  let arrivals: Array<Arrival> = new Array();
  let nextArrival: number = 0;
  let cues: Array<Cue> = new Array();
  let nextCue: number = 0;
  let cued: string | null = null;
  let time: number = 0;
  let playtest: boolean = false;
  let focused: boolean = false;
  let shooting: boolean = false;
  let hitCount: number = 0;
  let grace: number = 0;
  let bombing: boolean = false;
  let dying: number = 0;
  let blink: number = 0;
  let grazeCount: number = 0;
  let looping: boolean = true;
  let ended: boolean = false;
  let guiding: boolean = false;

  coreLayer.blendMode = "add";
  calloutTitle.anchor.set(0.5);
  calloutValue.anchor.set(0.5);
  calloutValue.y = calloutGap;
  callout.addChild(calloutTitle, calloutValue);
  declareText.anchor.set(0.5);
  declaration.addChild(declareBack, declareText);
  declaration.y = declareY;
  declaration.visible = false;
  callout.position.set(previewWidth / 2, calloutY);
  callout.visible = false;
  titleText.anchor.set(0.5);
  chapterText.anchor.set(0.5);
  chapterText.y = -chapterGap;
  titleRule.y = -chapterGap / 2;
  title.addChild(chapterText, titleRule, titleText);
  title.position.set(previewWidth / 2, titleY);
  title.visible = false;
  bgm.anchor.set(1, 1);
  bgm.position.set(previewWidth - bgmMargin, previewHeight - bgmMargin);
  bgm.visible = false;

  for (let index = 0; index < boostLimit; index++) {
    const line: Text = createShadowText("", boostSize, "#ffffff", "#020b30", 2);

    line.anchor.set(0, 1);
    line.position.set(bgmMargin, previewHeight - bgmMargin - index * boostGap);
    line.visible = false;
    boostList.addChild(line);
    boostTexts.push(line);
  }

  pilot.reset(playerX, playerY);
  squad.view.visible = false;
  sigil.position.set(previewWidth / 2, previewHeight / 2);
  cover.view.visible = false;
  mask.rect(0, 0, previewWidth, previewHeight).fill(0xffffff);
  view.addChild(
    base.view,
    cover.view,
    sigil,
    dim,
    squad.shotLayer,
    player,
    squad.view,
    actorLayer,
    itemLayer,
    bulletLayer,
    coreLayer,
    fog,
    halo,
    bomb.view,
    hitbox,
    bossHud.view,
    declaration,
    callout,
    title,
    bgm,
    boostList,
    overlay,
    mask,
  );
  view.mask = mask;

  function spellBackground(): Background | null {
    for (let index = actors.list.length - 1; index >= 0; index--) {
      const found: Background | null = findBackground(
        actors.list[index]!.spell?.background ?? null,
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

  function schedule(): void {
    arrivals = new Array();
    cues = new Array();
    cued = null;

    if (stage === null) {
      return;
    }

    for (const keyframe of stage.keyframes) {
      if (keyframe.cutscene !== null) {
        cues.push({ time: keyframe.time, cutscene: keyframe.cutscene });
        continue;
      }

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

    cues.sort((first: Cue, second: Cue) => first.time - second.time);
    findCue();
  }

  function findCue(): void {
    nextCue = cues.findIndex((cue: Cue) => cue.time >= time);

    if (nextCue < 0) {
      nextCue = cues.length;
    }
  }

  function cleared(): boolean {
    return !actors.list.some(
      (actor: Actor) =>
        actor.staged && !actor.dead && actor.enemy.rank !== "regular",
    );
  }

  function seek(value: number): void {
    const end: number =
      stage === null ? Infinity : Math.max(stage.length - seekStep, 0);
    const goal: number = Math.min(Math.max(value, 0), end);

    actors.clear();
    bullets.clear();
    blend = 0;
    ended = false;
    time = Math.max(goal - seekLookback, 0);
    schedule();
    hush(true);

    while (time < goal) {
      update(Math.min(seekStep, goal - time));
    }

    hush(false);

    cued = null;
    findCue();
  }

  function seekPattern(value: number): void {
    const goal: number = Math.min(Math.max(value, 0), patternLimit);

    bullets.clear();
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

    const cue: Cue | undefined = cues[nextCue];

    if (ended) {
      actors.move(delta);

      if (cue !== undefined && cleared()) {
        cued = cue.cutscene;
        nextCue++;
      }

      return;
    }

    if (
      cue !== undefined &&
      cue.time < stage.length &&
      time + delta >= cue.time
    ) {
      time = Math.max(cue.time, time);
      cued = cue.cutscene;
      nextCue++;
    } else {
      time += delta;
    }

    if (time >= stage.length && looping) {
      seek(0);
      return;
    }

    if (time >= stage.length) {
      time = stage.length;
      ended = true;
      actors.move(delta);
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
        actors.add(
          resolved,
          arrival.spawn.x * previewWidth,
          arrival.spawn.y * previewHeight,
          arrival.spawn,
          null,
          true,
          arrival.spawn.effectsTo ?? "player",
        );
      }
    }

    actors.move(delta);
  }

  function think(delta: number): void {
    const decision: Decision = brain.decide(
      {
        x: player.x,
        y: player.y,
        threats: bullets.threats(),
        enemies: actors.targets(),
        items: items.positions(),
        bombs: bomb.stock(),
        dying: dying > 0,
      },
      delta,
    );

    input.x = decision.x;
    input.y = decision.y;
    focused = decision.focused;
    shooting = decision.shooting;
    bombing = decision.bombing;
  }

  function guide(delta: number): void {
    const dx: number = playerX - player.x;
    const dy: number = playerY - player.y;
    const distance: number = Math.hypot(dx, dy);
    const step: number = archetype().speed * delta;

    focused = false;
    shooting = false;
    bombing = false;

    if (distance <= guideSnap) {
      player.position.set(playerX, playerY);
      input.x = 0;
      input.y = 0;
      guiding = false;
      return;
    }

    input.x = (dx / distance) * Math.min(distance / step, 1);
    input.y = (dy / distance) * Math.min(distance / step, 1);
  }

  function movePlayer(delta: number): void {
    const stock: number = bomb.stock();

    if (guiding) {
      guide(delta);
    } else if (autopilot) {
      think(delta);
    }

    if (
      pilot.update(delta, input, focused, shooting, bombing, actors.targets())
    ) {
      dying = 0;
    }

    if (playerWind.x !== 0 || playerWind.y !== 0) {
      player.position.set(
        Math.min(
          Math.max(player.x + playerWind.x * delta, playerSize / 2),
          previewWidth - playerSize / 2,
        ),
        Math.min(
          Math.max(player.y + playerWind.y * delta, playerSize / 2),
          previewHeight - playerSize / 2,
        ),
      );
      hitbox.position.copyFrom(player.position);
    }

    if (bomb.stock() < stock) {
      cue("bomb");
      bombsUsed++;
      feel(bombRumble, bombRumbleTime);
      actors.spoil("bomb");
    }

    grace = Math.max(grace - delta, 0);
    blink += delta;
    player.alpha =
      (grace > 0 || bomb.invincible()) &&
      Math.floor(blink * blinkRate) % 2 === 0
        ? blinkAlpha
        : 1;

    if (dying > 0) {
      dying -= delta;

      if (dying <= 0) {
        dying = 0;
        hitCount++;
        shakeLeft = shakeTime;
        feel(hitRumble, hitRumbleTime);
        grace = hitGrace;
        bomb.setStock(startBombs);
        setPower(power - hitPower);
      }
    }
  }

  function collide(): void {
    if (
      bullets.collide(
        player.x,
        player.y,
        bomb,
        grace <= 0 && dying <= 0 && !bomb.invincible(),
      )
    ) {
      const shield: Boost | undefined = boosts.find(
        (boost: Boost) => boost.effect.mode === "shield" && boost.hits > 0,
      );

      if (!autopilot && shield !== undefined) {
        shield.hits--;
        grace = hitGrace;
        cue("cancel");
      } else if (!autopilot) {
        cue("miss");
        dying = deathbombWindow;
        actors.spoil("miss");
      }
    }

    if (dying <= 0) {
      const grazed: number = bullets.graze(player.x, player.y);

      if (grazed > 0) {
        cue("graze");
        cleanse("graze", grazed);
      }

      grazeCount += grazed;
    }
  }

  function setPower(value: number): void {
    power = Math.min(Math.max(value, minPower), maxPower);
    squad.setPower(power);
  }

  function collect(delta: number): void {
    const defeats: Array<Defeat> = actors.defeats();

    for (const defeat of defeats) {
      items.drop(defeat);
    }

    cleanse("defeat", defeats.length);

    const haul: Haul = items.update(delta, player.x, player.y, dying <= 0);

    for (const capture of actors.captures()) {
      showCallout(capture);
    }

    for (const name of actors.declarations()) {
      declareText.text = name.toUpperCase();
      declareLeft = declareTime;
    }

    declareLeft = Math.max(declareLeft - delta, 0);
    placeDeclaration();

    calloutLeft = Math.max(calloutLeft - delta, 0);
    callout.visible = calloutLeft > 0;
    callout.alpha = Math.min(
      (calloutTime - calloutLeft) / calloutFade,
      calloutLeft / calloutFade,
      1,
    );

    itemPoints += haul.points;
    itemCount += haul.count;
    lifePieces += haul.lifePieces;
    bombPieces += haul.bombPieces;

    const lives: number = haul.lives + Math.floor(lifePieces / piecesPerLife);
    const bombs: number = haul.bombs + Math.floor(bombPieces / piecesPerBomb);

    lifePieces %= piecesPerLife;
    bombPieces %= piecesPerBomb;

    if (lives > 0) {
      lifeGains += lives;
      cue("extend");
    }

    if (bombs > 0) {
      bomb.setStock(Math.min(bomb.stock() + bombs, maxBombs));
      cue("bombget");
    }

    if (haul.count > 0) {
      cue("item");
    }

    gainBoosts(haul.effects, delta);

    if (haul.power > 0) {
      const before: number = power;

      setPower(power + haul.power);

      if (before < maxPower && power >= maxPower) {
        cue("power");
      }
    }
  }

  function cleanse(kind: "graze" | "defeat", count: number): void {
    for (const boost of boosts) {
      if (boost.effect.mode === "curse" && boost.effect.cleanse === kind) {
        boost.left -= count * boost.effect.cleanseTime;
      }
    }
  }

  function scaleOf(boost: Boost): number {
    const effect: Effect = boost.effect;

    if (effect.mode === "focus") {
      return focused ? 1 : 0;
    }

    if (effect.mode === "ramp") {
      const progress: number = Math.min(
        boost.age / Math.max(effect.duration, 0.001),
        1,
      );

      return effect.ramp === "rise" ? progress : 1 - progress;
    }

    return 1;
  }

  function factorsFor(target: ModifierTarget): Factors {
    return combineFactors(
      boosts
        .filter((boost: Boost) => boost.target === target)
        .map((boost: Boost): Weighted => ({
          effect: boost.effect,
          scale: scaleOf(boost),
          layers: boost.layers,
        })),
    );
  }

  function applyFactors(): void {
    factors = factorsFor("player");
    enemyFactors = factorsFor("enemies");
    squad.setTempo(factors.fireRate);
    squad.setPace(factors.bulletSpeed);
    pilot.setPace(factors.moveSpeed);
    bullets.setTempo(enemyFactors.fireRate);
    bullets.setPace(enemyFactors.bulletSpeed);
    actors.setPace(enemyFactors.moveSpeed);
    applyWorld();
  }

  function applyWorld(): void {
    let freeze: number = 0;
    let mirror: boolean = false;
    let darkness: number = 0;
    let recolor: string | null = null;
    let auraRadius: number = 0;
    let auraSlow: number = 0;
    let erase: boolean = false;
    const wind: Vector = { x: 0, y: 0 };

    playerWind.x = 0;
    playerWind.y = 0;

    for (const boost of boosts) {
      const scale: number = scaleOf(boost);

      if (scale <= 0) {
        continue;
      }

      if (boost.effect.mode === "aura") {
        auraRadius = Math.max(auraRadius, boost.effect.auraRadius * scale);

        if (boost.effect.aura === "erase") {
          erase = true;
        } else {
          auraSlow = Math.max(auraSlow, boost.effect.auraSlow / 100);
        }
      }

      for (const world of boost.effect.world) {
        const amount: number = world.strength * scale;
        const angle: number = forward + (world.angle * Math.PI) / 180;

        if (world.kind === "freeze") {
          freeze = Math.max(freeze, amount / 100);
        } else if (world.kind === "mirror") {
          mirror = true;
        } else if (world.kind === "fog") {
          darkness = Math.max(darkness, amount / 100);
        } else if (world.kind === "recolor") {
          recolor = world.color;
        } else {
          const push: Vector = world.kind === "windBullets" ? wind : playerWind;

          push.x += Math.cos(angle) * amount;
          push.y += Math.sin(angle) * amount;
        }
      }
    }

    bullets.setFreeze(freeze);
    bullets.setMirror(mirror);
    bullets.setWind(wind.x, wind.y);
    bullets.setRecolor(recolor);
    bullets.setAura(
      auraRadius > 0
        ? { radius: auraRadius, slow: erase ? 1 : auraSlow, erase: erase }
        : null,
    );
    fogAmount = darkness;
    drawWorld();
  }

  function drawWorld(): void {
    const aura: Boost | undefined = boosts.find(
      (boost: Boost) => boost.effect.mode === "aura" && scaleOf(boost) > 0,
    );

    fog.clear();
    halo.clear();

    if (fogAmount > 0) {
      const alpha: number = Math.min(fogAmount, 1) * fogDepth;

      fog
        .rect(0, 0, previewWidth, previewHeight)
        .fill({ color: "#000000", alpha: alpha })
        .circle(player.x, player.y, fogLight)
        .cut();

      for (let ring = 0; ring < fogRings; ring++) {
        const outer: number = fogLight * (1 - ring / fogRings);
        const inner: number = fogLight * (1 - (ring + 1) / fogRings);

        fog
          .circle(player.x, player.y, outer)
          .fill({ color: "#000000", alpha: alpha * (1 - ring / fogRings) })
          .circle(player.x, player.y, inner)
          .cut();
      }
    }

    if (aura !== undefined) {
      const radius: number = aura.effect.auraRadius * scaleOf(aura);

      halo
        .circle(player.x, player.y, radius)
        .fill({ color: aura.effect.color, alpha: auraFill })
        .stroke({ color: aura.effect.color, width: 1.5, alpha: auraAlpha });
    }
  }

  function instant(effect: Effect): void {
    if (effect.action === "clear" || effect.action === "score") {
      const count: number = bullets.cancel();

      if (effect.action === "score") {
        itemPoints += count * bulletPoints;
      }

      cue("cancel");
    } else if (effect.action === "bomb") {
      bomb.setStock(Math.min(bomb.stock() + 1, maxBombs));
      cue("bombget");
    } else if (effect.action === "life") {
      lifeGains++;
      cue("extend");
    } else {
      for (const boost of boosts) {
        if (boost.effect.mode === "shield") {
          boost.hits = Math.min(boost.hits + 1, boost.effect.hits);
        }
      }
    }
  }

  function gainBoosts(granted: Array<Granted>, delta: number): void {
    for (const { effect, target } of granted) {
      cue("pickup", effect.pickupSound);

      if (effect.mode === "instant") {
        instant(effect);
        continue;
      }

      const held: Boost | undefined = boosts.find(
        (boost: Boost) =>
          boost.effect.id === effect.id && boost.target === target,
      );

      if (held === undefined) {
        boosts.push({
          effect: effect,
          target: target,
          left: effect.duration,
          age: 0,
          hits: effect.hits,
          layers: 1,
        });
        continue;
      }

      held.left = effect.duration;
      held.age = 0;
      held.hits = effect.hits;

      if (effect.mode === "stacking") {
        held.layers = Math.min(held.layers + 1, Math.max(effect.stacks, 1));
      }
    }

    for (const boost of boosts) {
      boost.age += delta;

      if (lasts(boost.effect)) {
        boost.left -= delta;
      }
    }

    boosts = boosts.filter((boost: Boost) =>
      lasts(boost.effect) ? boost.left > 0 : boost.hits > 0,
    );
    applyFactors();
    paintBoosts(delta);
  }

  function paintBoosts(delta: number): void {
    boostClock += delta;

    for (let index = 0; index < boostTexts.length; index++) {
      const line: Text = boostTexts[index]!;
      const boost: Boost | undefined = boosts[index];

      line.visible = boost !== undefined;

      if (boost === undefined) {
        continue;
      }

      line.text =
        (boost.target === "enemies" ? "ENEMY " : "") +
        boost.effect.name.toUpperCase() +
        (boost.effect.mode === "stacking" ? "  x" + boost.layers : "") +
        (lasts(boost.effect)
          ? "  " + Math.ceil(boost.left) + "s"
          : "  x" + boost.hits);
      line.tint = boost.effect.color;
      line.alpha =
        lasts(boost.effect) &&
        boost.left < boostWarning &&
        Math.floor(boostClock * boostBlink) % 2 === 0
          ? 0.4
          : scaleOf(boost) <= 0
            ? idleBoostAlpha
            : 1;
    }
  }

  function endDemo(): void {
    if (demo === null) {
      return;
    }

    demo = null;
    actors.clear();
    bullets.clear();
    clearBoosts();
  }

  function showEffect(value: Effect | null): void {
    if (value === null) {
      endDemo();
      return;
    }

    showSpell(null);
    stage = null;
    pattern = null;

    if (demo === null || actors.list[0]?.enemy !== demoEnemy) {
      actors.clear();
      bullets.clear();
      boosts = new Array();
      actors.add(demoEnemy, previewWidth / 2, hoverY, demoPath, null, false);
      pilot.reset(playerX, playerY);
      demoClock = 0;
      grace = 0;
    }

    demo = value;
    player.visible = true;
  }

  function runDemo(delta: number): void {
    const effect: Effect = demo!;

    focused = true;
    demoClock += delta;

    if (effect.mode === "instant") {
      boosts = new Array();

      if (demoClock >= demoEvery) {
        demoClock = 0;
        instant(effect);
      }
    } else {
      let boost: Boost | undefined = boosts[0];

      if (boost === undefined || boost.effect.id !== effect.id) {
        boost = {
          effect: effect,
          target: "enemies",
          left: effect.duration,
          age: 0,
          hits: effect.hits,
          layers: 1,
        };
        boosts = [boost];
      }

      boost.effect = effect;
      boost.layers = effect.mode === "stacking" ? effect.stacks : 1;
      boost.age += delta;

      if (lasts(effect)) {
        boost.left -= delta;
      }

      if (boost.left <= 0 || boost.hits <= 0) {
        boost.left = effect.duration;
        boost.age = 0;
        boost.hits = effect.hits;
      }
    }

    if (bullets.collide(player.x, player.y, bomb, grace <= 0)) {
      const shield: Boost | undefined = boosts.find(
        (boost: Boost) => boost.effect.mode === "shield" && boost.hits > 0,
      );

      if (shield !== undefined) {
        shield.hits--;
      }

      grace = hitGrace;
    }

    cleanse("graze", bullets.graze(player.x, player.y));
    grace = Math.max(grace - delta, 0);
    blink += delta;
    player.alpha =
      grace > 0 && Math.floor(blink * blinkRate) % 2 === 0 ? blinkAlpha : 1;
    applyFactors();
    paintBoosts(delta);
  }

  function clearBoosts(): void {
    boosts = new Array();
    applyFactors();
    paintBoosts(0);
  }

  function placeDeclaration(): void {
    const elapsed: number = declareTime - declareLeft;
    const slide: number = Math.min(elapsed / declareSlide, 1);
    const eased: number = 1 - Math.pow(1 - slide, 3);

    declaration.visible = declareLeft > 0;
    declaration.alpha = Math.min(slide * 2, declareLeft / declareFade, 1);
    declareText.x =
      previewWidth / 2 +
      (1 - eased) * previewWidth -
      declareDrift * (elapsed / declareTime);
  }

  function showCallout(capture: Capture): void {
    calloutValue.text =
      capture.name.toUpperCase() + "  +" + capture.bonus.toLocaleString();
    calloutLeft = calloutTime;
  }

  function setPlaytest(on: boolean, carry: boolean = false): void {
    const fromX: number = player.x;
    const fromY: number = player.y;

    playtest = on;
    itemPoints = 0;
    itemCount = 0;
    calloutLeft = 0;
    shakeLeft = 0;
    declareLeft = 0;
    declaration.visible = false;
    actors.declarations();
    view.pivot.set(0, 0);
    callout.visible = false;
    actors.captures();
    bombsUsed = 0;
    lifeGains = 0;
    lifePieces = 0;
    bombPieces = 0;
    items.clear();
    actors.defeats();
    clearBoosts();
    setPower(maxPower);
    hitCount = 0;
    grazeCount = 0;
    actors.resetPoints();
    grace = 0;
    focused = false;
    shooting = false;
    bombing = false;
    dying = 0;
    guiding = on && carry;
    pilot.reset(guiding ? fromX : playerX, guiding ? fromY : playerY);
    bomb.setStock(startBombs);
    squad.view.visible = on;
    input.x = 0;
    input.y = 0;
    player.alpha = 1;

    if (on) {
      player.visible = true;
    }
  }

  function feel(strength: number, duration: number): void {
    if (getShake()) {
      rumble(strength, duration);
    }
  }

  function shakeView(delta: number): void {
    shakeLeft = Math.max(shakeLeft - delta, 0);

    const amount: number = getShake()
      ? (shakeAmount * shakeLeft) / shakeTime
      : 0;

    view.pivot.set(
      (Math.random() * 2 - 1) * amount,
      (Math.random() * 2 - 1) * amount,
    );
  }

  function update(delta: number): void {
    if (playtest) {
      movePlayer(delta);
    }

    shakeView(delta);

    bullets.move(delta);

    if (stage !== null) {
      runStage(delta);
      setSkyTime(base, time);
    } else {
      advanceSky(base, delta);

      if (actors.list.length > 0) {
        actors.move(delta);
      } else if (pattern !== null) {
        bullets.fire(pattern, emitter, emitterX, emitterY, forward, delta);
      }
    }

    if (shown !== null) {
      spellTime += delta;
      drawSigil(sigil, shown, spellTime);
    }

    advanceSky(cover, delta);
    fade(delta);
    placeTitle();
    placeBgm(delta);

    if (playtest) {
      actors.shoot(squad, factors.damage / enemyFactors.damage);
      actors.bomb(bomb, delta);
      collide();
      collect(delta);
    } else if (demo !== null) {
      runDemo(delta);
    } else {
      actors.declarations();
      actors.themes();
    }

    drawBossBar(bossHud, actors.list, delta);
  }

  function clear(): void {
    actors.clear();
    actors.defeats();
    items.clear();
    bullets.clear();
    squad.clear();
    bomb.clear();
    emitter.timer = 0;
    emitter.time = 0;
    time = 0;
    spellTime = 0;
    blend = 0;
    cover.view.visible = false;
    setSkyTime(base, 0);
    bgmLeft = 0;
    bgm.visible = false;
  }

  function placeTitle(): void {
    const end: number = titleStart + titleIn + titleHold + titleOut;
    const showing: boolean =
      stage !== null &&
      stage.titleCard &&
      time > titleStart &&
      time < end &&
      stage.name !== "";

    title.visible = showing;

    if (!showing) {
      return;
    }

    const rise: number = Math.min((time - titleStart) / titleIn, 1);

    titleText.text = stage!.name.toUpperCase();
    title.alpha = Math.min(rise, (end - time) / titleOut, 1);
    title.y = titleY + titleRise * Math.pow(1 - rise, 3);
    chapterText.visible = chapterText.text !== "";
    titleRule.visible = chapterText.visible;
  }

  function placeBgm(delta: number): void {
    bgmLeft = Math.max(bgmLeft - delta, 0);
    bgm.visible = bgmLeft > 0;

    const elapsed: number = bgmTime - bgmLeft;
    const slide: number = Math.min(elapsed / bgmFade, 1);

    bgm.alpha = Math.min(slide, bgmLeft / bgmFade, 1);
    bgm.x = previewWidth - bgmMargin + bgmSlide * Math.pow(1 - slide, 3);
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

  dim.rect(0, 0, previewWidth, previewHeight).fill("#000000");
  dim.alpha = 0;

  return {
    view: view,
    overlay: overlay,
    setDim: (amount: number) => {
      dim.alpha = amount * maxDim;
    },
    setEffect: showEffect,
    setBackground: (value: Background | null) => {
      base.background = value;
      paintSky(base);
      paintSky(cover);
    },
    setPattern: (value: Pattern | null) => {
      endDemo();
      showSpell(null);
      stage = null;
      pattern = value;

      if (actors.list.length > 0) {
        actors.clear();
      }
    },
    setEnemy: (value: Enemy | null, bar: number | null) => {
      endDemo();
      showSpell(null);
      stage = null;
      pattern = null;

      const actor: Actor | undefined = actors.list[0];

      if (value === null) {
        actors.clear();
        return;
      }

      if (
        actor === undefined ||
        actor.enemy !== value ||
        actors.list.length > 1
      ) {
        actors.clear();
        actors.add(value, previewWidth / 2, hoverY, still, bar, false);
        return;
      }

      const elapsed: number = actor.barTime;

      actor.locked = bar !== null;
      actors.arm(actor, bar ?? actor.bar);
      actor.barTime = bar === null ? elapsed : 0;
    },
    setSigil: (value: Sigil | null) => {
      endDemo();
      stage = null;
      pattern = null;
      actors.clear();
      spell = null;
      showSigil(value);
    },
    setSpell: (value: Spell | null, attack: Pattern | null) => {
      endDemo();
      stage = null;
      pattern = attack;
      actors.clear();
      showSpell(value);
    },
    setStage: (value: Stage | null, lookup: Resolve) => {
      endDemo();
      showSpell(null);

      const changed: boolean = value !== stage;

      stage = value;
      resolve = lookup;
      pattern = null;

      if (changed) {
        seek(0);
        return;
      }

      for (let index = 0; index < actors.list.length; index++) {
        actors.dress(actors.list[index]!);
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
    steer: (
      x: number,
      y: number,
      focus: boolean,
      shoot: boolean,
      bombKey: boolean,
    ) => {
      input.x = x;
      input.y = y;
      focused = focus;
      shooting = shoot;
      bombing = bombKey;
    },
    hits: () => hitCount,
    bombs: () => bomb.stock(),
    score: () => actors.points() + grazeCount * grazePoints + itemPoints,
    grazes: () => grazeCount,
    setPower: setPower,
    power: () => power,
    themes: actors.themes,
    setAutopilot: (on: boolean) => {
      autopilot = on;
      brain.reset();
    },
    collected: () => itemCount,
    bombsUsed: () => bombsUsed,
    setBombs: (value: number) => bomb.setStock(value),
    setLoop: (loop: boolean) => {
      looping = loop;
    },
    takeCue: () => {
      const taken: string | null = cued;

      cued = null;
      return taken;
    },
    finished: () => ended && cleared() && nextCue >= cues.length,
    lifeGains: () => lifeGains,
    setChapter: (text: string) => {
      chapterText.text = text.toUpperCase();
    },
    announce: (name: string) => {
      bgm.text = "BGM: " + name;
      bgmLeft = bgmTime;
    },
  };
}

export { previewWidth, previewHeight, createPreview };
export type { Preview };
