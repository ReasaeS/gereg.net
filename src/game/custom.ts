import type { Container, Texture } from "pixi.js";
import { createPreview, type Preview } from "../create/preview/preview";
import { loadCreations, usedSprites } from "../create/storage";
import { loadTexture } from "../create/images";
import { minPower } from "./drones";
import { startBombs } from "./bomb";
import { difficulties, rarityOf, type Rarity } from "../create/rarity";
import { packLength, runStages } from "../create/packs";
import type {
  Background,
  Creations,
  Difficulty,
  Game as GameCard,
  Enemy,
  Palette,
  Pattern,
  Run as RunCard,
  Sigil,
  Sound,
  Spawn,
  Spell,
  Stage,
  Wallpaper,
} from "../create/types";
import type { Choice } from "./selector";
import { bestScore } from "./records";
import { playTrack, type Track } from "../create/sound";

type Outcome = "clear" | "over" | "next";

type Plan = {
  id: string;
  name: string;
  stages: Array<Stage>;
  difficulty: Difficulty;
  first: number;
  practice: boolean;
};

type Leg = {
  stage: Stage;
  wallpaper: Wallpaper | null;
  palette: Palette | null;
  difficulty: string;
  order: number;
  total: number;
};

type Mode = "play" | "attract" | "watch";

type Tally = {
  cleared: number;
  total: number;
  graze: number;
  items: number;
  bombs: number;
  misses: number;
  continues: number;
};

type Entry = {
  kind: "stage" | "run" | "game";
  id: string;
};

type Controls = {
  x: number;
  y: number;
  focused: boolean;
  shooting: boolean;
  bombing: boolean;
};

type Custom = {
  view: Container;
  choices: () => Array<Choice>;
  count: () => number;
  isGame: (index: number) => boolean;
  gameChoices: (index: number) => Array<Choice>;
  plan: (index: number, difficulty: number) => Plan | null;
  start: (plan: Plan) => Promise<Leg | null>;
  advance: () => Leg | null;
  resurrect: () => void;
  setPaused: (paused: boolean) => void;
  continues: () => number;
  tally: (outcome: Outcome) => Tally;
  attract: (plan: Plan) => Promise<Leg | null>;
  watch: () => Promise<Leg | null>;
  takeLeg: () => Leg | null;
  stop: () => void;
  update: (delta: number, controls: Controls) => void;
  outcome: () => Outcome | null;
  score: () => number;
  hits: () => number;
  bombs: () => number;
  grazes: () => number;
  power: () => number;
  current: () => Plan | null;
};

const startLives: number = 2;
const outroTime: number = 1.5; // s

function byId<T extends { id: string }>(
  items: Array<T>,
  id: string | null,
): T | null {
  return id === null ? null : (items.find((item: T) => item.id === id) ?? null);
}

function formatLength(seconds: number): string {
  const whole: number = Math.round(seconds);

  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
}

function bestText(id: string): string {
  const best: number = bestScore(id);

  return best > 0 ? "  Best " + best : "";
}

function plural(count: number, word: string): string {
  return count + " " + word + (count === 1 ? "" : "s");
}

async function createCustom(
  playerTexture: Texture,
  droneTexture: Texture,
): Promise<Custom> {
  let creations: Creations = loadCreations();
  let entries: Array<Entry> = new Array();
  let plan: Plan | null = null;
  let leg: number = 0;
  let outro: number = 0;
  let carriedScore: number = 0;
  let carriedHits: number = 0;
  let carriedGrazes: number = 0;
  let continues: number = 0;
  let mode: Mode = "play";
  let fresh: Leg | null = null;
  let token: number = 0;
  let carriedItems: number = 0;
  let carriedBombs: number = 0;
  let misses: number = 0;
  let countedHits: number = 0;
  let track: Track | null = null;
  let playing: Sound | null = null;
  let resumeAt: number = 0;
  const preview: Preview = await createPreview(
    playerTexture,
    droneTexture,
    (id: string | null) => byId<Background>(creations.backgrounds, id),
    (id: string | null) => byId<Sigil>(creations.sigils, id),
    (id: string | null) => byId<Spell>(creations.spells, id),
    (id: string | null) => byId<Pattern>(creations.patterns, id),
  );

  preview.view.visible = false;

  function gameDifficulties(game: GameCard): Array<Rarity<Difficulty>> {
    return difficulties.filter((entry: Rarity<Difficulty>) => {
      const run: RunCard | null = byId(creations.runs, game.runs[entry.value]);

      return run !== null && runStages(creations, run).length > 0;
    });
  }

  function choices(): Array<Choice> {
    creations = loadCreations();
    entries = [
      ...creations.games
        .filter((game: GameCard) => gameDifficulties(game).length > 0)
        .map((game: GameCard): Entry => ({ kind: "game", id: game.id })),
      ...creations.runs
        .filter((run: RunCard) => runStages(creations, run).length > 0)
        .map((run: RunCard): Entry => ({ kind: "run", id: run.id })),
      ...creations.stages.map((stage: Stage): Entry => ({
        kind: "stage",
        id: stage.id,
      })),
    ];

    if (entries.length === 0) {
      return [{ name: "No stages yet", title: "Build one in the create menu" }];
    }

    return entries.map((entry: Entry) => {
      if (entry.kind === "game") {
        const game: GameCard = byId(creations.games, entry.id)!;

        return {
          name: game.name,
          title:
            "Game  " +
            gameDifficulties(game).length +
            (gameDifficulties(game).length === 1
              ? " difficulty"
              : " difficulties"),
        };
      }

      if (entry.kind === "run") {
        const run: RunCard = byId(creations.runs, entry.id)!;
        const stages: Array<Stage> = runStages(creations, run);

        return {
          name: run.name,
          title:
            "Run  " +
            rarityOf(difficulties, run.difficulty).label +
            "  " +
            plural(stages.length, "stage") +
            "  " +
            formatLength(packLength(stages)) +
            bestText(run.id),
        };
      }

      const stage: Stage = byId(creations.stages, entry.id)!;

      return {
        name: stage.name,
        title:
          rarityOf(difficulties, stage.difficulty).label +
          "  " +
          formatLength(stage.length) +
          bestText(stage.id),
      };
    });
  }

  function gameOf(index: number): GameCard | null {
    const entry: Entry | undefined = entries[index];

    return entry?.kind === "game" ? byId(creations.games, entry.id) : null;
  }

  function gameChoices(index: number): Array<Choice> {
    const game: GameCard | null = gameOf(index);

    if (game === null) {
      return new Array();
    }

    return gameDifficulties(game).map((entry: Rarity<Difficulty>) => {
      const run: RunCard = byId(creations.runs, game.runs[entry.value])!;
      const stages: Array<Stage> = runStages(creations, run);

      return {
        name: entry.label,
        title:
          plural(stages.length, "stage") +
          "  " +
          formatLength(packLength(stages)) +
          bestText(game.id + ":" + entry.value),
      };
    });
  }

  function planOf(index: number, difficulty: number): Plan | null {
    const entry: Entry | undefined = entries[index];

    if (entry === undefined) {
      return null;
    }

    if (entry.kind === "game") {
      const game: GameCard = byId(creations.games, entry.id)!;
      const chosen: Rarity<Difficulty> | undefined =
        gameDifficulties(game)[difficulty];
      const run: RunCard | null =
        chosen === undefined
          ? null
          : byId(creations.runs, game.runs[chosen.value]);

      return chosen === undefined || run === null
        ? null
        : {
            id: game.id + ":" + chosen.value,
            name: game.name,
            stages: runStages(creations, run),
            difficulty: chosen.value,
            first: 0,
            practice: false,
          };
    }

    if (entry.kind === "run") {
      const run: RunCard = byId(creations.runs, entry.id)!;

      return {
        id: run.id,
        name: run.name,
        stages: runStages(creations, run),
        difficulty: run.difficulty,
        first: 0,
        practice: false,
      };
    }

    const stage: Stage = byId(creations.stages, entry.id)!;

    return {
      id: stage.id,
      name: stage.name,
      stages: [stage],
      difficulty: stage.difficulty,
      first: 0,
      practice: false,
    };
  }

  function loop(sound: Sound, offset: number = 0): void {
    track = playTrack(
      sound,
      (played: boolean) => {
        if (played && playing === sound) {
          loop(sound);
        }
      },
      offset,
    );
  }

  function setPaused(paused: boolean): void {
    if (playing === null) {
      return;
    }

    if (paused && track !== null) {
      resumeAt = track.position();
      track.stop();
      track = null;
    } else if (!paused && track === null) {
      loop(playing, resumeAt);
    }
  }

  function setMusic(sound: Sound | null): void {
    if (sound === playing) {
      return;
    }

    playing = sound;
    track?.stop();
    track = null;

    if (sound !== null) {
      loop(sound);
    }
  }

  function load(
    index: number,
    bombs: number | null,
    power: number,
    carry: boolean = true,
  ): Leg | null {
    const chosen: Stage | undefined = plan?.stages[index];

    if (plan === null || chosen === undefined) {
      return null;
    }

    leg = index;
    outro = 0;
    preview.clear();
    preview.setBackground(byId(creations.backgrounds, chosen.background));
    preview.setStage(null, () => null);
    preview.setLoop(false);
    preview.setStage(chosen, (spawn: Spawn) =>
      byId<Enemy>(creations.enemies, spawn.enemy),
    );
    preview.setPlaytest(true, carry);
    preview.setPower(power);

    if (bombs !== null) {
      preview.setBombs(bombs);
    }

    preview.view.visible = true;
    preview.themes();
    preview.setAutopilot(mode !== "play");
    setMusic(mode === "attract" ? null : byId(creations.sounds, chosen.music));

    return {
      stage: chosen,
      wallpaper: byId(creations.wallpapers, chosen.wallpaper),
      palette: byId(creations.palettes, chosen.palette),
      difficulty: rarityOf(
        difficulties,
        mode === "watch" ? chosen.difficulty : plan.difficulty,
      ).label,
      order: index,
      total: plan.stages.length,
    };
  }

  async function begin(chosen: Plan, next: Mode): Promise<Leg | null> {
    const owner: number = ++token;

    if (chosen.stages.length === 0) {
      return null;
    }

    await Promise.all([...usedSprites(creations)].map(loadTexture));

    if (owner !== token) {
      return null;
    }

    mode = next;
    fresh = null;
    plan = chosen;
    carriedScore = 0;
    carriedHits = 0;
    carriedGrazes = 0;
    continues = 0;
    carriedItems = 0;
    carriedBombs = 0;
    misses = 0;
    countedHits = 0;

    return load(0, null, minPower, false);
  }

  function start(chosen: Plan): Promise<Leg | null> {
    return begin(chosen, "play");
  }

  function attract(chosen: Plan): Promise<Leg | null> {
    return begin(chosen, "attract");
  }

  function shuffled(): Array<Stage> {
    const list: Array<Stage> = [...creations.stages];

    for (let index = list.length - 1; index > 0; index--) {
      const other: number = Math.floor(Math.random() * (index + 1));

      [list[index], list[other]] = [list[other]!, list[index]!];
    }

    return list;
  }

  function watchPlan(): Plan {
    return {
      id: "",
      name: "Watch",
      stages: shuffled(),
      difficulty: "normal",
      first: 0,
      practice: true,
    };
  }

  function watch(): Promise<Leg | null> {
    creations = loadCreations();

    return begin(watchPlan(), "watch");
  }

  function roll(): void {
    if (plan === null) {
      return;
    }

    if (carriedHits + preview.hits() > startLives) {
      carriedHits = -preview.hits();
      preview.setBombs(startBombs);
    }

    if (!preview.finished() || outro < outroTime) {
      return;
    }

    if (leg + 1 >= plan.stages.length) {
      if (mode === "watch") {
        plan = { ...watchPlan(), stages: shuffled() };
      }

      carriedScore += preview.score();
      carriedHits += preview.hits();
      carriedGrazes += preview.grazes();
      fresh = load(0, preview.bombs(), preview.power());
      return;
    }

    fresh = advance();
  }

  function advance(): Leg | null {
    carriedScore += preview.score();
    carriedHits += preview.hits();
    carriedGrazes += preview.grazes();
    carriedItems += preview.collected();
    carriedBombs += preview.bombsUsed();
    misses += preview.hits() - countedHits;
    countedHits = 0;

    return load(leg + 1, preview.bombs(), preview.power());
  }

  function resurrect(): void {
    misses += preview.hits() - countedHits;
    countedHits = preview.hits();
    carriedScore = -preview.score();
    carriedHits = -preview.hits();
    preview.setBombs(startBombs);
    continues++;
  }

  function tally(outcome: Outcome): Tally {
    return {
      cleared: outcome === "over" ? leg : (plan?.stages.length ?? 0),
      total: plan?.stages.length ?? 0,
      graze: carriedGrazes + preview.grazes(),
      items: carriedItems + preview.collected(),
      bombs: carriedBombs + preview.bombsUsed(),
      misses: misses + preview.hits() - countedHits,
      continues: continues,
    };
  }

  function stop(): void {
    token++;
    plan = null;
    mode = "play";
    fresh = null;
    preview.setAutopilot(false);
    setMusic(null);
    preview.setPlaytest(false);
    preview.setLoop(true);
    preview.setStage(null, () => null);
    preview.clear();
    preview.view.visible = false;
  }

  function outcome(): Outcome | null {
    if (plan === null) {
      return null;
    }

    if (carriedHits + preview.hits() > startLives) {
      return "over";
    }

    if (!preview.finished() || outro < outroTime) {
      return null;
    }

    return leg + 1 < plan.stages.length ? "next" : "clear";
  }

  function update(delta: number, controls: Controls): void {
    if (plan === null) {
      return;
    }

    preview.steer(
      controls.x,
      controls.y,
      controls.focused,
      controls.shooting,
      controls.bombing,
    );
    preview.update(delta);

    for (const id of preview.themes()) {
      if (mode !== "attract") {
        setMusic(byId(creations.sounds, id));
      }
    }

    if (preview.finished()) {
      outro += delta;
    }

    if (mode !== "play") {
      roll();
    }
  }

  return {
    view: preview.view,
    choices: choices,
    count: () => entries.length,
    isGame: (index: number) => gameOf(index) !== null,
    gameChoices: gameChoices,
    plan: planOf,
    start: start,
    attract: attract,
    watch: watch,
    takeLeg: () => {
      const next: Leg | null = fresh;

      fresh = null;
      return next;
    },
    advance: advance,
    resurrect: resurrect,
    setPaused: setPaused,
    continues: () => continues,
    tally: tally,
    stop: stop,
    update: update,
    outcome: outcome,
    score: () => carriedScore + preview.score(),
    hits: () => carriedHits + preview.hits(),
    bombs: preview.bombs,
    grazes: () => carriedGrazes + preview.grazes(),
    power: preview.power,
    current: () => plan,
  };
}

export { createCustom, startLives };
export type { Custom, Outcome, Leg, Plan, Tally };
