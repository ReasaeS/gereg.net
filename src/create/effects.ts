import type { Effect, EffectTarget, Modifier, Stat } from "./types";

type StatInfo = {
  value: Stat;
  label: string;
  target: "player" | "stage";
};

type Factors = Record<Stat, number>;

const modifierLimit: number = 4;
const effectDropLimit: number = 4;
const factorFloor: number = 0.1;
const stats: Array<StatInfo> = [
  { value: "fireRate", label: "Fire rate", target: "player" },
  { value: "shotDamage", label: "Shot damage", target: "player" },
  { value: "moveSpeed", label: "Move speed", target: "player" },
  { value: "enemyFireRate", label: "Enemy fire rate", target: "stage" },
  { value: "bulletSpeed", label: "Enemy bullet speed", target: "stage" },
];

function statsFor(target: EffectTarget): Array<StatInfo> {
  return target === "both"
    ? stats
    : stats.filter((info: StatInfo) => info.target === target);
}

function statLabel(stat: Stat): string {
  return stats.find((info: StatInfo) => info.value === stat)?.label ?? stat;
}

function describeModifier(modifier: Modifier): string {
  return (
    statLabel(modifier.stat) +
    " " +
    (modifier.amount >= 0 ? "+" : "") +
    modifier.amount +
    "%"
  );
}

function fitModifiers(effect: Effect): void {
  const allowed: Array<StatInfo> = statsFor(effect.target);

  for (const modifier of effect.modifiers) {
    if (!allowed.some((info: StatInfo) => info.value === modifier.stat)) {
      modifier.stat = allowed[0]!.value;
    }
  }
}

function neutralFactors(): Factors {
  return {
    fireRate: 1,
    shotDamage: 1,
    moveSpeed: 1,
    enemyFireRate: 1,
    bulletSpeed: 1,
  };
}

function combineFactors(effects: Array<Effect>): Factors {
  const factors: Factors = neutralFactors();

  for (const effect of effects) {
    for (const modifier of effect.modifiers) {
      factors[modifier.stat] *= 1 + modifier.amount / 100;
    }
  }

  for (const stat of Object.keys(factors) as Array<Stat>) {
    factors[stat] = Math.max(factors[stat], factorFloor);
  }

  return factors;
}

export {
  modifierLimit,
  effectDropLimit,
  stats,
  statsFor,
  statLabel,
  describeModifier,
  fitModifiers,
  neutralFactors,
  combineFactors,
};
export type { StatInfo, Factors };
