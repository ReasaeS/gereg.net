import { getStat, onStats } from "./stats";

type Run = {
  cleared: boolean;
  misses: number;
  bombs: number;
  continues: number;
  stages: number;
};

type Achievement = {
  id: string;
  name: string;
  description: string;
  earned: (run: Run | null) => boolean;
};

type UnlockListener = (achievement: Achievement) => void;
type ChangeListener = () => void;

const storageKey: string = "geregnet.achievements";
const achievements: Array<Achievement> = [
  {
    id: "first-run",
    name: "First flight",
    description: "Start a run",
    earned: () => getStat("runs") >= 1,
  },
  {
    id: "first-clear",
    name: "Clear skies",
    description: "Clear a run",
    earned: (run: Run | null) => run?.cleared === true,
  },
  {
    id: "untouched",
    name: "Untouched",
    description: "Clear a run without a miss",
    earned: (run: Run | null) => run?.cleared === true && run.misses === 0,
  },
  {
    id: "no-bombs",
    name: "Steady hands",
    description: "Clear a run without a bomb",
    earned: (run: Run | null) => run?.cleared === true && run.bombs === 0,
  },
  {
    id: "perfect",
    name: "Perfect",
    description: "Clear a run with no misses and no bombs",
    earned: (run: Run | null) =>
      run?.cleared === true && run.misses === 0 && run.bombs === 0,
  },
  {
    id: "comeback",
    name: "Never give up",
    description: "Clear a run after a continue",
    earned: (run: Run | null) => run?.cleared === true && run.continues > 0,
  },
  {
    id: "marathon",
    name: "Marathon",
    description: "Clear a run of 3 or more stages",
    earned: (run: Run | null) => run?.cleared === true && run.stages >= 3,
  },
  {
    id: "regular",
    name: "Regular",
    description: "Start 25 runs",
    earned: () => getStat("runs") >= 25,
  },
  {
    id: "persistent",
    name: "Persistent",
    description: "See 10 game overs",
    earned: () => getStat("gameOvers") >= 10,
  },
  {
    id: "grazer",
    name: "Close calls",
    description: "Graze 1,000 bullets",
    earned: () => getStat("grazes") >= 1000,
  },
  {
    id: "collector",
    name: "Collector",
    description: "Collect 1,000 items",
    earned: () => getStat("items") >= 1000,
  },
  {
    id: "high-score",
    name: "Big numbers",
    description: "Score 100,000 in one run",
    earned: () => getStat("best") >= 100000,
  },
  {
    id: "millionaire",
    name: "Millionaire",
    description: "Score 1,000,000 in total",
    earned: () => getStat("score") >= 1000000,
  },
  {
    id: "zen",
    name: "Drifting",
    description: "Spend 10 minutes in Zen",
    earned: () => getStat("zen") >= 600,
  },
];
const listeners: Array<UnlockListener> = new Array();
const changeListeners: Array<ChangeListener> = new Array();
const unlocked: Set<string> = loadUnlocked();

function loadUnlocked(): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");

    return new Set(
      Array.isArray(saved)
        ? saved.filter((id: unknown): id is string => typeof id === "string")
        : new Array<string>(),
    );
  } catch {
    return new Set();
  }
}

function saveUnlocked(): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...unlocked]));
  } catch {
    console.warn("Could not save the achievements");
  }
}

function checkAchievements(run: Run | null): void {
  const fresh: Array<Achievement> = achievements.filter(
    (achievement: Achievement) =>
      !unlocked.has(achievement.id) && achievement.earned(run),
  );

  if (fresh.length === 0) {
    return;
  }

  for (const achievement of fresh) {
    unlocked.add(achievement.id);
  }

  saveUnlocked();

  for (const listener of changeListeners) {
    listener();
  }

  for (const achievement of fresh) {
    for (const listener of listeners) {
      listener(achievement);
    }
  }
}

function isUnlocked(achievement: Achievement): boolean {
  return unlocked.has(achievement.id);
}

function resetAchievements(): void {
  unlocked.clear();
  saveUnlocked();

  for (const listener of changeListeners) {
    listener();
  }
}

function onUnlock(listener: UnlockListener): void {
  listeners.push(listener);
}

function onAchievements(listener: ChangeListener): void {
  changeListeners.push(listener);
}

onStats(() => checkAchievements(null));

export {
  achievements,
  checkAchievements,
  isUnlocked,
  resetAchievements,
  onUnlock,
  onAchievements,
};
export type { Achievement, Run };
