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
import { createSky, paintSky, skyKey, type Sky } from "./sky";
import { createBullets, type Bullets, type Emitter } from "./bullets";
import { createActors, forward, type Actor, type Actors } from "./actors";
import { createBossHud, drawBossBar, type BossHud } from "./bosshud";
import { createItems, type Haul, type Items } from "./items";
import { createShadowText, createText } from "../../ui/text";
import type { Capture } from "./actors";
import { getShake } from "../../settings/settings";
import { rumble } from "../../game/gamepad";
import { createAutopilot, type Autopilot, type Decision } from "./autopilot";
import { maxPower, minPower } from "../../game/drones";

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
  power: () => number;
  themes: () => Array<string>;
  setAutopilot: (on: boolean) => void;
  collected: () => number;
  bombsUsed: () => number;
  setBombs: (value: number) => void;
  finished: () => boolean;
};

type Arrival = {
  time: number; // s
  spawn: Spawn;
};

const emitterX: number = previewWidth / 2; // units
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
  const input: Vector = { x: 0, y: 0 };
  const mask: Graphics = new Graphics();
  const bullets: Bullets = await createBullets(bulletLayer, coreLayer, player);
  const actors: Actors = createActors(
    actorLayer,
    { sigil: findSigil, spell: findSpell, pattern: findPattern },
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
  pilot.reset(playerX, playerY);
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
    itemLayer,
    bulletLayer,
    coreLayer,
    bomb.view,
    hitbox,
    bossHud.view,
    declaration,
    callout,
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

    actors.clear();
    bullets.clear();
    blend = 0;
    ended = false;
    time = Math.max(goal - seekLookback, 0);
    schedule();

    while (time < goal) {
      update(Math.min(seekStep, goal - time));
    }
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

    if (ended) {
      actors.move(delta);
      return;
    }

    time += delta;

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

    if (bomb.stock() < stock) {
      bombsUsed++;
      feel(bombRumble, bombRumbleTime);
      actors.spoil();
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
      if (!autopilot) {
        dying = deathbombWindow;
        actors.spoil();
      }
    }

    if (dying <= 0) {
      grazeCount += bullets.graze(player.x, player.y);
    }
  }

  function setPower(value: number): void {
    power = Math.min(Math.max(value, minPower), maxPower);
    squad.setPower(power);
  }

  function collect(delta: number): void {
    for (const defeat of actors.defeats()) {
      items.drop(defeat);
    }

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

    if (haul.power > 0) {
      setPower(power + haul.power);
    }
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
    items.clear();
    actors.defeats();
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
      base.tiles.tilePosition.y = (base.background?.scroll ?? 0) * time;
    } else {
      base.tiles.tilePosition.y += (base.background?.scroll ?? 0) * delta;

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

    cover.tiles.tilePosition.y += (cover.background?.scroll ?? 0) * delta;
    fade(delta);

    if (playtest) {
      actors.shoot(squad);
      actors.bomb(bomb, delta);
      collide();
      collect(delta);
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

      if (actors.list.length > 0) {
        actors.clear();
      }
    },
    setEnemy: (value: Enemy | null, bar: number | null) => {
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
      stage = null;
      pattern = null;
      actors.clear();
      spell = null;
      showSigil(value);
    },
    setSpell: (value: Spell | null, attack: Pattern | null) => {
      stage = null;
      pattern = attack;
      actors.clear();
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
    finished: () =>
      ended &&
      !actors.list.some(
        (actor: Actor) =>
          actor.staged && !actor.dead && actor.enemy.rank !== "regular",
      ),
  };
}

export { previewWidth, previewHeight, createPreview };
export type { Preview };
