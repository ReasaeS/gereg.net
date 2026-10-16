import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import { getTexture } from "../images";
import type { Enemy, Pattern, Rank, Sigil, Spell } from "../types";
import { drawSigil } from "../sigil";
import { drawShape } from "../shape";
import { motion, velocity, type Path } from "../kinematics";
import type { Squad, Target } from "../../game/drones";
import type { Bomb } from "../../game/bomb";
import { previewHeight, previewWidth } from "./bounds";
import type { Bullets, Emitter } from "./bullets";

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

type Lookups = {
  sigil: (id: string | null) => Sigil | null;
  spell: (id: string | null) => Spell | null;
  pattern: (id: string | null) => Pattern | null;
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
  arm: (actor: Actor, index: number) => void;
  dress: (actor: Actor) => void;
  clear: () => void;
  move: (delta: number) => void;
  targets: () => Array<Target>;
  shoot: (squad: Squad) => void;
  bomb: (bomb: Bomb, delta: number) => void;
  points: () => number;
  resetPoints: () => void;
};

const forward: number = Math.PI / 2; // rad
const actorMargin: number = 60; // units
const actorGrace: number = 2; // s
const healthWidth: number = 36; // units
const healthHeight: number = 3; // units
const healthScale: number = 200;
const pipSize: number = 3; // units
const pipGap: number = 2; // units
const stillSpeed: number = 1; // units/s
const damagePoints: number = 10;
const defeatPoints: Map<Rank, number> = new Map([
  ["regular", 1000],
  ["subboss", 10000],
  ["boss", 50000],
]);

function barCount(enemy: Enemy): number {
  return enemy.rank === "boss" ? enemy.bars.length : 1;
}

function createActors(
  layer: Container,
  find: Lookups,
  bullets: Bullets,
): Actors {
  const actors: Array<Actor> = new Array();
  let points: number = 0;

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

    const found: Sigil | null = find.sigil(actor.spell?.sigil ?? null);

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

  function finishBar(actor: Actor): void {
    const next: number = actor.bar + 1;

    if (next >= barCount(actor.enemy) && actor.staged) {
      actor.dead = true;
      return;
    }

    if (actor.enemy.rank !== "regular") {
      bullets.clear();
    }

    arm(actor, next < barCount(actor.enemy) ? next : 0);
  }

  function damage(actor: Actor, amount: number): void {
    if (!actor.locked) {
      points += Math.min(amount, Math.max(actor.hp, 0)) * damagePoints;
    }

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

    points += defeatPoints.get(actor.enemy.rank) ?? 0;
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

  function shoot(squad: Squad): void {
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

  function bomb(source: Bomb, delta: number): void {
    for (const actor of actors) {
      if (
        !actor.dead &&
        source.covers(actor.view.x, actor.view.y, actor.enemy.size / 2)
      ) {
        damage(actor, source.damage() * delta);
      }
    }
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
        : find.spell(enemy.bars[actor.bar]?.spell ?? null);
    actor.pattern =
      find.pattern(actor.spell?.pattern ?? null) ?? find.pattern(enemy.pattern);
    actor.emitter.timer = 0;
    actor.emitter.time = 0;
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
    layer.addChild(actor.view);
    actors.push(actor);
    arm(actor, bar ?? 0);

    return actor;
  }

  function clear(): void {
    for (let index = 0; index < actors.length; index++) {
      actors[index]!.view.destroy({ children: true });
    }

    actors.length = 0;
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
        bullets.fire(actor.pattern, actor.emitter, x, y, actor.facing, delta);
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
  };
}

export { createActors, barCount, forward };
export type { Actor, Actors };
