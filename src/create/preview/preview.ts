import { Container, Graphics, type Sprite, type Texture } from "pixi.js";
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
import { previewHeight, previewWidth } from "./bounds";
import { createSky, paintSky, skyKey, type Sky } from "./sky";
import { createBullets, type Bullets, type Emitter } from "./bullets";
import { createActors, forward, type Actor, type Actors } from "./actors";
import { createBossHud, drawBossBar, type BossHud } from "./bosshud";

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
  steer: (
    x: number,
    y: number,
    focused: boolean,
    shooting: boolean,
    bombing: boolean,
  ) => void;
  hits: () => number;
  bombs: () => number;
};

type Arrival = {
  time: number; // s
  spawn: Spawn;
};

const emitterX: number = previewWidth / 2; // units
const emitterY: number = 140; // units
const playerX: number = previewWidth / 2; // units
const playerY: number = 400; // units
const hitGrace: number = 1; // s
const blinkRate: number = 12; // Hz
const blinkAlpha: number = 0.3;
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

  coreLayer.blendMode = "add";
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
    bulletLayer,
    coreLayer,
    bomb.view,
    hitbox,
    bossHud.view,
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

  function movePlayer(delta: number): void {
    if (
      pilot.update(delta, input, focused, shooting, bombing, actors.targets())
    ) {
      dying = 0;
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
        grace = hitGrace;
        bomb.setStock(startBombs);
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
      dying = deathbombWindow;
    }
  }

  function setPlaytest(on: boolean): void {
    playtest = on;
    hitCount = 0;
    grace = 0;
    focused = false;
    shooting = false;
    bombing = false;
    dying = 0;
    pilot.reset(playerX, playerY);
    bomb.setStock(startBombs);
    squad.view.visible = on;
    input.x = 0;
    input.y = 0;
    player.alpha = 1;

    if (on) {
      player.visible = true;
    }
  }

  function update(delta: number): void {
    if (playtest) {
      movePlayer(delta);
    }

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
    }

    drawBossBar(bossHud, actors.list, delta);
  }

  function clear(): void {
    actors.clear();
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
  };
}

export { previewWidth, previewHeight, createPreview };
export type { Preview };
