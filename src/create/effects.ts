import type {
  AuraKind,
  Cleanse,
  Effect,
  EffectMode,
  EffectGroup,
  InstantAction,
  Modifier,
  ModifierTarget,
  RampShape,
  Stat,
  World,
  WorldKind,
} from "./types";
import type { Option } from "../ui/widgets";

type StatInfo = {
  value: Stat;
  label: string;
};

type WorldInfo = {
  value: WorldKind;
  label: string;
  target: "player" | "stage";
};

type Factors = Record<Stat, number>;

type Weighted = {
  effect: Effect;
  scale: number;
  layers: number;
};

const modifierLimit: number = 4;
const worldLimit: number = 4;
const modes: Array<Option<EffectMode>> = [
  { value: "timed", label: "Timed" },
  { value: "instant", label: "Instant" },
  { value: "shield", label: "Shield" },
  { value: "stacking", label: "Stacking" },
  { value: "curse", label: "Curse" },
  { value: "aura", label: "Aura" },
  { value: "ramp", label: "Ramp" },
  { value: "focus", label: "Focus only" },
];
const actions: Array<Option<InstantAction>> = [
  { value: "clear", label: "Clear bullets" },
  { value: "score", label: "Bullets to score" },
  { value: "bomb", label: "Bomb +1" },
  { value: "life", label: "Life +1" },
  { value: "shield", label: "Repair shields" },
];
const cleanses: Array<Option<Cleanse>> = [
  { value: "graze", label: "Grazing" },
  { value: "defeat", label: "Defeating enemies" },
];
const ramps: Array<Option<RampShape>> = [
  { value: "rise", label: "Rise" },
  { value: "fade", label: "Fade" },
];
const auras: Array<Option<AuraKind>> = [
  { value: "slow", label: "Slow bullets" },
  { value: "erase", label: "Erase bullets" },
];
const worlds: Array<WorldInfo> = [
  { value: "freeze", label: "Bullet freeze", target: "stage" },
  { value: "mirror", label: "Mirror volleys", target: "stage" },
  { value: "fog", label: "Fog", target: "stage" },
  { value: "windBullets", label: "Bullet wind", target: "stage" },
  { value: "windPlayer", label: "Player wind", target: "player" },
  { value: "recolor", label: "Bullet recolor", target: "stage" },
];
const effectDropLimit: number = 4;
const factorFloor: number = 0.1;
const modifierTargets: Array<Option<ModifierTarget>> = [
  { value: "player", label: "Player" },
  { value: "enemies", label: "Enemies" },
];
const stats: Array<StatInfo> = [
  { value: "fireRate", label: "Fire rate" },
  { value: "bulletSpeed", label: "Bullet speed" },
  { value: "moveSpeed", label: "Move speed" },
  { value: "damage", label: "Damage" },
];
const legacyStats: Map<string, Stat> = new Map([
  ["enemyFireRate", "fireRate"],
  ["shotDamage", "damage"],
]);

function repairStat(stat: string | undefined): Stat {
  const value: string = stat ?? "fireRate";

  return (
    legacyStats.get(value) ??
    stats.find((info: StatInfo) => info.value === value)?.value ??
    "fireRate"
  );
}

function labelOf<T>(list: Array<Option<T>>, value: T): string {
  return list.find((option: Option<T>) => option.value === value)?.label ?? "";
}

function isWindy(kind: WorldKind): boolean {
  return kind === "windBullets" || kind === "windPlayer";
}

function hasStrength(kind: WorldKind): boolean {
  return kind !== "mirror" && kind !== "recolor";
}

function describeWorld(world: World): string {
  const label: string =
    worlds.find((info: WorldInfo) => info.value === world.kind)?.label ??
    world.kind;

  return !hasStrength(world.kind)
    ? label
    : label + " " + world.strength + (isWindy(world.kind) ? "" : "%");
}

function effectLines(effect: Effect): Array<string> {
  if (effect.mode === "instant") {
    return [labelOf(actions, effect.action)];
  }

  return [
    ...effect.modifiers.map(describeModifier),
    ...effect.world.map(describeWorld),
  ];
}

function lasts(effect: Effect): boolean {
  return effect.mode !== "instant" && effect.mode !== "shield";
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

function effectGroup(effect: Effect): EffectGroup {
  return effect.mode === "instant"
    ? "instant"
    : effect.mode === "shield" ||
        effect.mode === "aura" ||
        effect.mode === "curse"
      ? "special"
      : "lasting";
}

function neutralFactors(): Factors {
  return {
    fireRate: 1,
    bulletSpeed: 1,
    moveSpeed: 1,
    damage: 1,
  };
}

function combineFactors(list: Array<Weighted>): Factors {
  const factors: Factors = neutralFactors();

  for (const entry of list) {
    for (const modifier of entry.effect.modifiers) {
      factors[modifier.stat] *= Math.pow(
        Math.max(1 + (modifier.amount * entry.scale) / 100, 0),
        entry.layers,
      );
    }
  }

  for (const stat of Object.keys(factors) as Array<Stat>) {
    factors[stat] = Math.max(factors[stat], factorFloor);
  }

  return factors;
}

export {
  worldLimit,
  modes,
  actions,
  cleanses,
  ramps,
  auras,
  worlds,
  modifierTargets,
  effectGroup,
  labelOf,
  isWindy,
  hasStrength,
  describeWorld,
  effectLines,
  lasts,
  modifierLimit,
  effectDropLimit,
  stats,
  repairStat,
  statLabel,
  describeModifier,
  neutralFactors,
  combineFactors,
};
export type { StatInfo, WorldInfo, Factors, Weighted };
