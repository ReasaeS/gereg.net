import { Container, Graphics } from "pixi.js";
import type {
  Bar,
  Effect,
  EffectDrop,
  Enemy,
  Pattern,
  Rank,
  Vessel,
  Sigil,
  Spell,
} from "../types";
import { drawSigil } from "../sigil";
import { drawBody } from "../vessel";
import { motion, velocity, type Path } from "../kinematics";
import type { Squad, Target } from "../../game/drones";
import type { Bomb } from "../../game/bomb";
import { previewHeight, previewWidth } from "./bounds";
import type { Bullets, Emitter } from "./bullets";
import type { Defeat } from "./items";
import { cue } from "../../game/sfx";

type Phase = "attack" | "spell";

type Reason = "miss" | "bomb";

type Glide = {
  fromX: number; // units
  fromY: number; // units
  toX: number; // units
  toY: number; // units
  time: number; // s
};

type Actor = {
  enemy: Enemy;
  pattern: Pattern | null;
  spell: Spell | null;
  view: Container;
  sigil: Graphics;
  body: Graphics;
  x: number; // units
  y: number; // units
  path: Path;
  time: number; // s
  facing: number; // rad
  emitter: Emitter;
  bar: number;
  phase: number;
  barTime: number; // s
  locked: boolean;
  staged: boolean;
  hp: number;
  fill: number;
  dead: boolean;
  capture: boolean;
  survival: boolean;
  glide: Glide | null;
  missed: boolean;
  bombed: boolean;
};

type Capture = {
  name: string;
  bonus: number;
};

type Lookups = {
  sigil: (id: string | null) => Sigil | null;
  spell: (id: string | null) => Spell | null;
  pattern: (id: string | null) => Pattern | null;
  vessel: (id: string | null) => Vessel | null;
  effect: (id: string | null) => Effect | null;
};

type Actors = {
  list: Array<Actor>;
  add: (
    enemy: Enemy,
    x: number,
    y: number,
    path: Path,
    bar: number | null,
    staged: boolean,
  ) => Actor;
  arm: (actor: Actor, index: number, phase?: number) => void;
  dress: (actor: Actor) => void;
  clear: () => void;
  move: (delta: number) => void;
  targets: () => Array<Target>;
  shoot: (squad: Squad, strength: number) => void;
  bomb: (bomb: Bomb, delta: number) => void;
  points: () => number;
  resetPoints: () => void;
  defeats: () => Array<Defeat>;
  captures: () => Array<Capture>;
  declarations: () => Array<string>;
  themes: () => Array<string>;
  spoil: (reason: Reason) => void;
};

const forward: number = Math.PI / 2; // rad
const actorMargin: number = 60; // units
const actorGrace: number = 2; // s
const stillSpeed: number = 1; // units/s
const hitPoints: number = 10;
const bombTick: number = 0.1; // s
const defeatPoints: Map<Rank, number> = new Map([
  ["regular", 1000],
  ["subboss", 10000],
  ["boss", 50000],
]);
const spellBonus: number = 200000;
const spellDecay: number = 0.5;
const countdown: number = 10; // s
const survivalTime: number = 30; // s
const glideTime: number = 1.2; // s

function barCount(enemy: Enemy): number {
  return enemy.rank === "boss" ? enemy.bars.length : 1;
}

function phasesOf(enemy: Enemy, bar: Bar | undefined): Array<Phase> {
  if (enemy.rank === "regular" || bar === undefined || bar.spell === null) {
    return ["attack"];
  }

  return bar.attack === null ? ["spell"] : ["attack", "spell"];
}

function limitOf(actor: Actor): number {
  const time: number = actor.enemy.bars[actor.bar]?.time ?? 0;

  return time > 0 ? time : actor.survival ? survivalTime : 0;
}

function shows(actor: Actor, bar: Bar): boolean {
  return (
    bar.appears === "always" ||
    (bar.appears === "nomiss" && !actor.missed) ||
    (bar.appears === "nobomb" && !actor.bombed) ||
    (bar.appears === "perfect" && !actor.missed && !actor.bombed)
  );
}

function nextBar(actor: Actor, from: number): number {
  for (let index = from; index < barCount(actor.enemy); index++) {
    if (shows(actor, actor.enemy.bars[index]!)) {
      return index;
    }
  }

  return barCount(actor.enemy);
}

function createActors(
  layer: Container,
  find: Lookups,
  bullets: Bullets,
): Actors {
  const actors: Array<Actor> = new Array();
  const defeated: Array<Defeat> = new Array();
  const captured: Array<Capture> = new Array();
  const declared: Array<string> = new Array();
  const themed: Array<string> = new Array();
  let points: number = 0;
  let bombClock: number = 0; // s

  function dress(actor: Actor): void {
    const enemy: Enemy = actor.enemy;

    drawBody(actor.body, enemy, find.vessel(enemy.vessel));

    const found: Sigil | null = find.sigil(actor.spell?.sigil ?? null);

    if (found === null) {
      actor.sigil.clear();
    } else {
      drawSigil(actor.sigil, found, actor.time);
    }
  }

  function cancel(actor: Actor): void {
    if (actor.enemy.rank !== "regular") {
      bullets.clear();
      cue("cancel");
    }
  }

  function cycle(actor: Actor): void {
    const phases: number = phasesOf(
      actor.enemy,
      actor.enemy.bars[actor.bar],
    ).length;

    if (phases > 1) {
      arm(actor, actor.bar, (actor.phase + 1) % phases);
    } else {
      actor.hp = Math.max(actor.enemy.bars[actor.bar]?.health ?? 1, 1);
      actor.barTime = 0;
      actor.fill = 0;
      dress(actor);
    }
  }

  function finishBar(actor: Actor): void {
    const phases: Array<Phase> = phasesOf(
      actor.enemy,
      actor.enemy.bars[actor.bar],
    );

    if (actor.phase + 1 < phases.length) {
      cancel(actor);
      arm(actor, actor.bar, actor.phase + 1);
      return;
    }

    const next: number = nextBar(actor, actor.bar + 1);

    if (next >= barCount(actor.enemy) && actor.staged) {
      actor.dead = true;
      return;
    }

    cancel(actor);
    arm(actor, next < barCount(actor.enemy) ? next : nextBar(actor, 0));
  }

  function rollEffects(enemy: Enemy): Array<Effect> {
    const rolled: Array<Effect> = new Array();

    for (const drop of enemy.effects as Array<EffectDrop>) {
      const found: Effect | null = find.effect(drop.effect);

      if (found !== null && Math.random() * 100 < drop.chance) {
        rolled.push(found);
      }
    }

    return rolled;
  }

  function reward(actor: Actor, bonus: number): void {
    points += defeatPoints.get(actor.enemy.rank) ?? 0;

    if (actor.capture && actor.spell !== null) {
      points += bonus;
      captured.push({ name: actor.spell.name, bonus: bonus });
      cue("capture");
    }

    cue("defeat", actor.enemy.defeatSound);
    defeated.push({
      x: actor.view.x,
      y: actor.view.y,
      drops: actor.enemy.drops,
      effects: rollEffects(actor.enemy),
    });
    finishBar(actor);
  }

  function damage(actor: Actor, amount: number): void {
    if (actor.survival) {
      return;
    }

    if (!actor.locked && actor.hp > 0) {
      points += hitPoints;
    }

    actor.hp -= amount;

    if (actor.hp > 0) {
      if (actor.enemy.rank === "regular") {
        dress(actor);
      }

      return;
    }

    if (actor.locked) {
      cycle(actor);
      return;
    }

    const limit: number = limitOf(actor);

    reward(
      actor,
      Math.round(
        (spellBonus *
          (1 -
            spellDecay *
              (limit > 0 ? Math.min(actor.barTime / limit, 1) : 0))) /
          10,
      ) * 10,
    );
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

  function shoot(squad: Squad, strength: number): void {
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
        cue("hit");
        damage(actor, shot.damage * strength);
        break;
      }
    }
  }

  function bomb(source: Bomb, delta: number): void {
    bombClock += delta;

    while (bombClock >= bombTick) {
      bombClock -= bombTick;

      for (const actor of actors) {
        if (
          !actor.dead &&
          source.covers(actor.view.x, actor.view.y, actor.enemy.size / 2)
        ) {
          damage(actor, source.damage() * bombTick);
        }
      }
    }
  }

  function arm(actor: Actor, index: number, phase: number = 0): void {
    const enemy: Enemy = actor.enemy;

    actor.bar = Math.max(Math.min(index, barCount(enemy) - 1), 0);

    const bar: Bar | undefined = enemy.bars[actor.bar];
    const phases: Array<Phase> = phasesOf(enemy, bar);

    actor.phase = Math.max(Math.min(phase, phases.length - 1), 0);
    actor.barTime = 0;
    actor.hp = Math.max(bar?.health ?? 1, 1);
    actor.fill = 0;
    actor.spell =
      phases[actor.phase] === "spell" ? find.spell(bar?.spell ?? null) : null;
    actor.pattern =
      actor.spell === null
        ? (find.pattern(bar?.attack ?? null) ?? find.pattern(enemy.pattern))
        : (find.pattern(actor.spell.pattern) ?? find.pattern(enemy.pattern));
    actor.survival = actor.spell?.survival ?? false;
    actor.emitter.timer = 0;
    actor.emitter.time = 0;
    actor.capture = actor.spell !== null && !actor.locked;

    if (enemy.rank !== "regular" && bar !== undefined && bar.move !== null) {
      actor.glide = {
        fromX: actor.view.x,
        fromY: actor.view.y,
        toX: bar.move.x * previewWidth,
        toY: bar.move.y * previewHeight,
        time: 0,
      };
    } else if (!actor.staged && actor.glide !== null) {
      actor.glide = {
        fromX: actor.view.x,
        fromY: actor.view.y,
        toX: actor.x,
        toY: actor.y,
        time: 0,
      };
    }

    if (actor.capture) {
      declared.push(actor.spell!.name);
      cue("declare", actor.spell!.declareSound);
    }
    dress(actor);
  }

  function add(
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
      x: x,
      y: y,
      path: path,
      time: 0,
      facing: forward,
      emitter: { timer: 0, time: 0 },
      bar: 0,
      phase: 0,
      barTime: 0,
      hp: 1,
      fill: 0,
      dead: false,
      capture: false,
      survival: false,
      glide: null,
      missed: false,
      bombed: false,
      locked: bar !== null,
      staged: staged,
    };

    actor.view.addChild(actor.sigil, actor.body);
    actor.view.position.set(x, y);
    layer.addChild(actor.view);
    actors.push(actor);
    arm(actor, bar ?? nextBar(actor, 0));

    if (staged && enemy.rank !== "regular" && enemy.theme !== null) {
      themed.push(enemy.theme);
    }

    return actor;
  }

  function clear(): void {
    for (let index = 0; index < actors.length; index++) {
      actors[index]!.view.destroy({ children: true });
    }

    actors.length = 0;
  }

  function place(actor: Actor, delta: number): [number, number] {
    const glide: Glide | null = actor.glide;

    if (glide === null) {
      return motion(actor.x, actor.y, actor.path, actor.time);
    }

    glide.time += delta;

    const progress: number = Math.min(glide.time / glideTime, 1);
    const eased: number = 1 - Math.pow(1 - progress, 3);

    return [
      glide.fromX + (glide.toX - glide.fromX) * eased,
      glide.fromY + (glide.toY - glide.fromY) * eased,
    ];
  }

  function move(delta: number): void {
    let write: number = 0;

    for (let index = 0; index < actors.length; index++) {
      const actor: Actor = actors[index]!;

      actor.time += delta;

      if (actor.dead) {
        actor.view.destroy({ children: true });
        continue;
      }

      const [x, y] = place(actor, delta);
      const outside: boolean =
        x < -actorMargin ||
        y < -actorMargin ||
        x > previewWidth + actorMargin ||
        y > previewHeight + actorMargin;

      if (outside && actor.time > actorGrace && actor.glide === null) {
        actor.view.destroy({ children: true });
        continue;
      }

      const limit: number = limitOf(actor);
      const before: number = limit - actor.barTime;

      actor.barTime += delta;

      const left: number = limit - actor.barTime;

      if (
        actor.capture &&
        actor.staged &&
        limit > 0 &&
        left > 0 &&
        left <= countdown &&
        Math.ceil(left) < Math.ceil(before)
      ) {
        cue("timeout");
      }

      if (
        actor.enemy.rank !== "regular" &&
        limit > 0 &&
        actor.barTime >= limit
      ) {
        if (actor.locked || (!actor.staged && barCount(actor.enemy) === 1)) {
          cycle(actor);
        } else if (actor.survival) {
          reward(actor, spellBonus);

          if (actor.dead) {
            actor.view.destroy({ children: true });
            continue;
          }
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

      if (actor.glide !== null) {
        actor.facing = forward;
      } else if (Math.hypot(speedX, speedY) > stillSpeed) {
        actor.facing = Math.atan2(speedY, speedX);
      }

      const found: Sigil | null = find.sigil(actor.spell?.sigil ?? null);

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
        if (
          bullets.fire(actor.pattern, actor.emitter, x, y, actor.facing, delta)
        ) {
          cue("fire", actor.pattern.fireSound);
        }
      }

      actors[write++] = actor;
    }

    actors.length = write;
  }

  return {
    list: actors,
    add: add,
    arm: arm,
    dress: dress,
    clear: clear,
    move: move,
    targets: targets,
    shoot: shoot,
    bomb: bomb,
    points: () => points,
    resetPoints: () => {
      points = 0;
    },
    defeats: () => defeated.splice(0, defeated.length),
    captures: () => captured.splice(0, captured.length),
    declarations: () => declared.splice(0, declared.length),
    themes: () => themed.splice(0, themed.length),
    spoil: (reason: Reason) => {
      for (const actor of actors) {
        actor.capture = false;

        if (actor.staged && actor.enemy.rank !== "regular") {
          actor.missed = actor.missed || reason === "miss";
          actor.bombed = actor.bombed || reason === "bomb";
        }
      }
    },
  };
}

export { createActors, barCount, forward, limitOf };
export type { Actor, Actors, Capture };
