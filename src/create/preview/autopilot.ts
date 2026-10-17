import type { Vector } from "../types";
import type { Target } from "../../game/drones";
import { archetype } from "../../game/archetype";
import { hitboxRadius, playerSize } from "../../game/player";
import { previewHeight, previewWidth } from "./bounds";

type Threat = {
  shownX: number; // units
  shownY: number; // units
  vx: number; // units/s
  vy: number; // units/s
  radius: number; // units
};

type Sight = {
  x: number; // units
  y: number; // units
  threats: ReadonlyArray<Threat>;
  enemies: Array<Target>;
  items: ReadonlyArray<Vector>;
  bombs: number;
  dying: boolean;
};

type Decision = {
  x: number;
  y: number;
  focused: boolean;
  shooting: boolean;
  bombing: boolean;
};

type Move = {
  x: number;
  y: number;
  focused: boolean;
};

type Autopilot = {
  decide: (sight: Sight, delta: number) => Decision;
  reset: () => void;
};

const sightRange: number = 170; // units
const lookahead: number = 0.6; // s
const clearance: number = 22; // units
const urgency: number = 0.12; // s
const avoidWeight: number = 3;
const separationRange: number = 36; // units
const separationWeight: number = 1.6;
const itemWeight: number = 1.2;
const itemArrive: number = 40; // units
const vacuumCount: number = 8;
const vacuumY: number = 0.2; // of field height
const aimWeight: number = 0.7;
const aimArrive: number = 30; // units
const aimSlack: number = 8; // units
const homeY: number = 0.82; // of field height
const homeWeight: number = 0.5;
const homeArrive: number = 60; // units
const wallRange: number = 40; // units
const wallWeight: number = 1.5;
const wanderWeight: number = 0.35;
const wanderRate: number = 0.6; // rad/s
const wanderReach: number = 28; // units
const calmTurn: number = 5; // 1/s
const dodgeTurn: number = 14; // 1/s
const dodgePressure: number = 0.4;
const switchMargin: number = 0.08; // of unfocused speed
const safeHorizon: number = 0.15; // s
const safeStep: number = 1 / 60; // s
const safeMargin: number = 2; // units

function createAutopilot(): Autopilot {
  const moves: Array<Move> = [{ x: 0, y: 0, focused: false }];
  let velocity: Vector = { x: 0, y: 0 };
  let current: Move = moves[0]!;
  let clock: number = 0;

  for (const focused of [false, true]) {
    for (let index = 0; index < 8; index++) {
      const angle: number = (index * Math.PI) / 4;

      moves.push({ x: Math.cos(angle), y: Math.sin(angle), focused: focused });
    }
  }

  function speedOf(move: Move): number {
    return move.focused ? archetype().focusSpeed : archetype().speed;
  }

  function mismatch(move: Move, wanted: Vector): number {
    const speed: number = speedOf(move);

    return Math.hypot(move.x * speed - wanted.x, move.y * speed - wanted.y);
  }

  function survival(move: Move, sight: Sight, near: Array<Threat>): number {
    const speed: number = speedOf(move);
    const edge: number = playerSize / 2;

    for (let step = 1; step * safeStep <= safeHorizon + 0.0001; step++) {
      const time: number = step * safeStep;
      const x: number = Math.min(
        Math.max(sight.x + move.x * speed * time, edge),
        previewWidth - edge,
      );
      const y: number = Math.min(
        Math.max(sight.y + move.y * speed * time, edge),
        previewHeight - edge,
      );

      for (const threat of near) {
        if (
          Math.hypot(
            threat.shownX + threat.vx * time - x,
            threat.shownY + threat.vy * time - y,
          ) <
          threat.radius + hitboxRadius + safeMargin
        ) {
          return time;
        }
      }
    }

    return Infinity;
  }

  function nearestMove(
    wanted: Vector,
    sight: Sight,
    near: Array<Threat>,
  ): [Move, boolean] {
    const lives: Map<Move, number> = new Map();
    let best: Move | null = null;
    let bestGap: number = Infinity;
    let longest: Move = current;

    for (const move of moves) {
      const life: number = survival(move, sight, near);
      const gap: number =
        mismatch(move, wanted) -
        (move === current ? switchMargin * archetype().speed : 0);

      lives.set(move, life);

      if (life === Infinity && gap < bestGap) {
        best = move;
        bestGap = gap;
      }

      if (life > lives.get(longest)!) {
        longest = move;
      }
    }

    return best === null ? [longest, true] : [best, false];
  }

  function add(target: Vector, x: number, y: number, weight: number): void {
    target.x += x * weight;
    target.y += y * weight;
  }

  function arrive(
    target: Vector,
    dx: number,
    dy: number,
    reach: number,
    weight: number,
  ): void {
    const distance: number = Math.hypot(dx, dy);

    if (distance > 0.001) {
      add(
        target,
        dx / distance,
        dy / distance,
        Math.min(distance / reach, 1) * weight,
      );
    }
  }

  function avoid(sight: Sight, near: Array<Threat>): Vector {
    const speed: number = speedOf(current);
    const force: Vector = { x: 0, y: 0 };

    for (const threat of near) {
      const rx: number = threat.shownX - sight.x;
      const ry: number = threat.shownY - sight.y;

      const vx: number = threat.vx - current.x * speed;
      const vy: number = threat.vy - current.y * speed;
      const closing: number = vx * vx + vy * vy;
      const time: number =
        closing > 0.001
          ? Math.min(Math.max(-(rx * vx + ry * vy) / closing, 0), lookahead)
          : 0;
      const missX: number = rx + vx * time;
      const missY: number = ry + vy * time;
      const miss: number = Math.hypot(missX, missY);
      const touch: number = threat.radius + hitboxRadius;
      const safe: number = touch + clearance;

      if (miss < safe) {
        const strength: number =
          ((safe - miss) / safe) * (urgency / (time + urgency));

        if (miss > 0.001) {
          add(force, -missX / miss, -missY / miss, strength);
        } else {
          const along: number = Math.sqrt(closing);

          add(force, -vy / along, vx / along, strength);
        }
      }

      const distance: number = Math.hypot(rx, ry);

      if (distance < separationRange && distance > 0.001) {
        const push: number = (separationRange - distance) / separationRange;

        add(
          force,
          -rx / distance,
          -ry / distance,
          push * push * separationWeight,
        );
      }
    }

    return force;
  }

  function seek(sight: Sight): Vector {
    const force: Vector = { x: 0, y: 0 };
    let item: Vector | null = null;
    let aim: Target | null = null;

    if (sight.items.length >= vacuumCount) {
      item = { x: sight.x, y: previewHeight * vacuumY };
    } else {
      let nearest: number = Infinity;

      for (const candidate of sight.items) {
        const gap: number = Math.hypot(
          candidate.x - sight.x,
          candidate.y - sight.y,
        );

        if (gap < nearest) {
          item = candidate;
          nearest = gap;
        }
      }
    }

    for (const enemy of sight.enemies) {
      if (
        enemy.y < sight.y &&
        (aim === null ||
          Math.abs(enemy.x - sight.x) < Math.abs(aim.x - sight.x))
      ) {
        aim = enemy;
      }
    }

    if (item !== null) {
      arrive(force, item.x - sight.x, item.y - sight.y, itemArrive, itemWeight);
    } else {
      arrive(force, 0, previewHeight * homeY - sight.y, homeArrive, homeWeight);
    }

    if (aim !== null) {
      const gap: number = aim.x - sight.x;

      if (Math.abs(gap) > aimSlack) {
        arrive(force, gap - Math.sign(gap) * aimSlack, 0, aimArrive, aimWeight);
      }
    } else if (item === null) {
      arrive(
        force,
        previewWidth / 2 + Math.sin(clock * wanderRate) * wanderReach - sight.x,
        0,
        wanderReach,
        wanderWeight,
      );
    }

    return force;
  }

  function walls(sight: Sight): Vector {
    const force: Vector = { x: 0, y: 0 };

    add(force, 1, 0, Math.max(1 - sight.x / wallRange, 0) * wallWeight);
    add(
      force,
      -1,
      0,
      Math.max(1 - (previewWidth - sight.x) / wallRange, 0) * wallWeight,
    );
    add(force, 0, 1, Math.max(1 - sight.y / wallRange, 0) * wallWeight);
    add(
      force,
      0,
      -1,
      Math.max(1 - (previewHeight - sight.y) / wallRange, 0) * wallWeight,
    );

    return force;
  }

  function decide(sight: Sight, delta: number): Decision {
    const near: Array<Threat> = sight.threats.filter(
      (threat: Threat) =>
        Math.abs(threat.shownX - sight.x) < sightRange &&
        Math.abs(threat.shownY - sight.y) < sightRange,
    );
    const dodge: Vector = avoid(sight, near);
    const pressure: number = Math.min(
      Math.hypot(dodge.x, dodge.y) * avoidWeight,
      1,
    );
    const pull: Vector = seek(sight);
    const edge: Vector = walls(sight);
    const desired: Vector = {
      x: dodge.x * avoidWeight + pull.x * (1 - pressure) + edge.x,
      y: dodge.y * avoidWeight + pull.y * (1 - pressure) + edge.y,
    };
    const length: number = Math.hypot(desired.x, desired.y);
    const turn: number =
      (pressure > dodgePressure ? dodgeTurn : calmTurn) * delta;

    clock += delta;

    if (length > 1) {
      desired.x /= length;
      desired.y /= length;
    }

    velocity = {
      x: velocity.x + (desired.x - velocity.x) * Math.min(turn, 1),
      y: velocity.y + (desired.y - velocity.y) * Math.min(turn, 1),
    };

    const [move, trapped] = nearestMove(
      {
        x: velocity.x * archetype().speed,
        y: velocity.y * archetype().speed,
      },
      sight,
      near,
    );

    current = move;

    return {
      x: current.x,
      y: current.y,
      focused: current.focused,
      shooting: true,
      bombing: sight.bombs > 0 && (trapped || sight.dying),
    };
  }

  return {
    decide: decide,
    reset: () => {
      velocity = { x: 0, y: 0 };
      current = moves[0]!;
      clock = 0;
    },
  };
}

export { createAutopilot };
export type { Autopilot, Decision, Threat };
