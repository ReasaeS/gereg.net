type Stat =
  | "runs"
  | "clears"
  | "gameOvers"
  | "misses"
  | "bombs"
  | "grazes"
  | "items"
  | "score"
  | "best"
  | "zen";

type StatListener = () => void;

const storageKey: string = "geregnet.stats";
const statList: Array<Stat> = [
  "runs",
  "clears",
  "gameOvers",
  "misses",
  "bombs",
  "grazes",
  "items",
  "score",
  "best",
  "zen",
];
const listeners: Array<StatListener> = new Array();
const stats: Map<Stat, number> = loadStats();

function loadStats(): Map<Stat, number> {
  const loaded: Map<Stat, number> = new Map();
  let saved: Record<string, unknown> = {};

  try {
    saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      unknown
    >;
  } catch {
    saved = {};
  }

  for (const stat of statList) {
    const value: unknown = saved[stat];

    loaded.set(
      stat,
      typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : 0,
    );
  }

  return loaded;
}

function saveStats(): void {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(Object.fromEntries(stats.entries())),
    );
  } catch {
    console.warn("Could not save the stats");
  }

  for (const listener of listeners) {
    listener();
  }
}

function getStat(stat: Stat): number {
  return stats.get(stat)!;
}

function addStats(changes: Partial<Record<Stat, number>>): void {
  for (const stat of statList) {
    const change: number | undefined = changes[stat];

    if (change !== undefined && change > 0) {
      stats.set(
        stat,
        stat === "best"
          ? Math.max(getStat(stat), change)
          : getStat(stat) + change,
      );
    }
  }

  saveStats();
}

function resetStats(): void {
  for (const stat of statList) {
    stats.set(stat, 0);
  }

  saveStats();
}

function onStats(listener: StatListener): void {
  listeners.push(listener);
}

export { getStat, addStats, resetStats, onStats };
export type { Stat };
