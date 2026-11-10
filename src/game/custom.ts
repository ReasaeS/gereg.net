import { rollCreations } from "../create/dice";
import { Container, type Texture } from "pixi.js";
import { createPreview, type Preview } from "../create/preview/preview";
import { onDim } from "../settings/settings";
import { loadCreations, usedSprites } from "../create/storage";
import { loadTexture } from "../create/images";
import { minPower } from "./drones";
import { startBombs } from "./bomb";
import { difficulties, rarityOf, type Rarity } from "../create/rarity";
import { packLength, runStages } from "../create/packs";
import type {
  Background,
  Bullet,
  Vessel,
  Effect,
  Creations,
  Cutscene,
  Line,
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
import { createScene, type Scene } from "../create/cutscene";
import { cue, useEffects } from "./sfx";
import { createGlide, type Glide } from "../ui/motion";
import {
  playSound,
  playTrack,
  prepareTrack,
  trackReady,
  type Track,
} from "../create/sound";

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
  kind: "game";
  id: string;
};

type Controls = {
  x: number;
  y: number;
  focused: boolean;
  shooting: boolean;
  bombing: boolean;
};

type Loader = (work: () => Promise<void>, name: string) => Promise<void>;

type Custom = {
  view: Container;
  setLoader: (loader: Loader) => void;
  upcoming: () => Stage | null;
  upcomingReady: () => boolean;
  prepareUpcoming: () => Promise<void>;
  choices: () => Array<Choice>;
  count: () => number;
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
  toggleFavourite: (index: number) => number;
  update: (delta: number, controls: Controls) => void;
  outcome: () => Outcome | null;
  score: () => number;
  hits: () => number;
  lives: () => number;
  bombs: () => number;
  grazes: () => number;
  power: () => number;
  current: () => Plan | null;
};

const startLives: number = 2;
const maxLives: number = 8;
const sceneSmoothing: number = 0.12; // s
const favouriteStorageKey: string = "geregnet.favourites";

function loadFavourites(): Set<string> {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(favouriteStorageKey) ?? "[]",
    );

    return new Set(
      Array.isArray(saved)
        ? saved.filter((key: unknown): key is string => typeof key === "string")
        : new Array<string>(),
    );
  } catch {
    return new Set();
  }
}

function entryKey(entry: Entry): string {
  return entry.kind + ":" + entry.id;
}
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
  let creations: Creations = rollCreations(loadCreations());
  let entries: Array<Entry> = new Array();
  const favourites: Set<string> = loadFavourites();
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
  let extraLives: number = 0;
  let countedGains: number = 0;
  let extendIndex: number = 0;
  let extendScores: Array<number> = new Array();
  let track: Track | null = null;
  let playing: Sound | null = null;
  let resumeAt: number = 0;
  let queued: Plan | null = null;
  let loader: Loader = (work: () => Promise<void>) => work();
  const preview: Preview = await createPreview(
    playerTexture,
    droneTexture,
    (id: string | null) => byId<Background>(creations.backgrounds, id),
    (id: string | null) => byId<Sigil>(creations.sigils, id),
    (id: string | null) => byId<Spell>(creations.spells, id),
    (id: string | null) => byId<Pattern>(creations.patterns, id),
    (id: string | null) => byId<Bullet>(creations.bullets, id),
    (id: string | null) => byId<Vessel>(creations.vessels, id),
    (id: string | null) => byId<Effect>(creations.effects, id),
  );

  const scene: Scene = createScene(
    speak,
    say,
    () => creations.characters,
    false,
    false,
  );
  const view: Container = new Container();
  const sceneShown: Glide = createGlide(
    0,
    (value: number) => {
      scene.view.alpha = value;
      scene.view.visible = value > 0;
    },
    sceneSmoothing,
  );
  let showing: Cutscene | null = null;
  let held: boolean = true;
  let stopLine: () => void = () => undefined;

  preview.view.visible = false;
  scene.view.visible = false;
  view.addChild(preview.view, scene.view);
  onDim(preview.setDim);

  function speak(value: Cutscene): void {
    const voice: Sound | null = byId<Sound>(creations.sounds, value.voice);

    if (voice !== null) {
      playSound(voice);
    }
  }

  function say(line: Line): void {
    const sound: Sound | null = byId<Sound>(
      creations.sounds,
      line.sound ?? null,
    );

    stopLine();
    stopLine = sound === null ? () => undefined : playSound(sound);
  }

  function stageBackground(): Background | null {
    return byId<Background>(
      creations.backgrounds,
      plan?.stages[leg]?.background ?? null,
    );
  }

  function startCutscene(id: string): void {
    const found: Cutscene | null = byId<Cutscene>(creations.cutscenes, id);

    if (found === null || found.lines.length === 0 || mode === "attract") {
      return;
    }

    showing = found;
    held = true;
    scene.setAuto(mode !== "play");
    scene.setPalette(
      byId<Palette>(creations.palettes, plan?.stages[leg]?.palette ?? null),
    );
    scene.play(found, 0);
    sceneShown.set(1);

    if (found.background !== null) {
      preview.setBackground(
        byId<Background>(creations.backgrounds, found.background),
      );
    }
  }

  function endCutscene(): void {
    if (showing === null) {
      return;
    }

    if (showing.background !== null) {
      preview.setBackground(stageBackground());
    }

    showing = null;
    stopLine();
    stopLine = () => undefined;
    sceneShown.set(0);
  }

  function playCutscene(delta: number, shooting: boolean): void {
    scene.update(delta);

    if (shooting && !held) {
      scene.advance();
    }

    held = shooting;

    if (scene.finished()) {
      endCutscene();
    }
  }

  function gameDifficulties(game: GameCard): Array<Rarity<Difficulty>> {
    return difficulties.filter((entry: Rarity<Difficulty>) => {
      const run: RunCard | null = byId(creations.runs, game.runs[entry.value]);

      return run !== null && runStages(creations, run).length > 0;
    });
  }

  function choices(): Array<Choice> {
    creations = rollCreations(loadCreations());
    entries = [
      ...creations.games
        .filter((game: GameCard) => gameDifficulties(game).length > 0)
        .map((game: GameCard): Entry => ({ kind: "game", id: game.id })),
    ];
    entries.sort(
      (first: Entry, second: Entry) =>
        Number(favourites.has(entryKey(second))) -
        Number(favourites.has(entryKey(first))),
    );

    if (entries.length === 0) {
      return [{ name: "No games yet", title: "Build one in the create menu" }];
    }

    return entries.map((entry: Entry): Choice => {
      const choice: Choice = describe(entry);

      return favourites.has(entryKey(entry))
        ? { ...choice, title: "Favourite  " + choice.title, starred: true }
        : choice;
    });
  }

  function toggleFavourite(index: number): number {
    const entry: Entry | undefined = entries[index];

    if (entry === undefined) {
      return index;
    }

    const key: string = entryKey(entry);

    if (!favourites.delete(key)) {
      favourites.add(key);
    }

    try {
      localStorage.setItem(
        favouriteStorageKey,
        JSON.stringify([...favourites]),
      );
    } catch {
      console.warn("Could not save the favourites");
    }

    choices();

    return entries.findIndex((other: Entry) => entryKey(other) === key);
  }

  function describe(entry: Entry): Choice {
    const game: GameCard = byId(creations.games, entry.id)!;

    return {
      name: game.name,
      title:
        "Game  " +
        gameDifficulties(game).length +
        (gameDifficulties(game).length === 1 ? " difficulty" : " difficulties"),
    };
  }

  function gameOf(index: number): GameCard | null {
    const entry: Entry | undefined = entries[index];

    return entry === undefined ? null : byId(creations.games, entry.id);
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
    const game: GameCard | null = gameOf(index);
    const chosen: Rarity<Difficulty> | undefined =
      game === null ? undefined : gameDifficulties(game)[difficulty];
    const run: RunCard | null =
      game === null || chosen === undefined
        ? null
        : byId(creations.runs, game.runs[chosen.value]);

    return game === null || chosen === undefined || run === null
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

  function loop(sound: Sound, offset: number = 0): void {
    track = playTrack(
      sound,
      (played: boolean) => {
        if (played && playing === sound) {
          loop(sound);
        }
      },
      offset,
      true,
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
      preview.announce(sound.name);
    }
  }

  function lives(): number {
    return startLives + extraLives - carriedHits - preview.hits();
  }

  function gainLives(count: number): void {
    extraLives = Math.max(
      extraLives,
      Math.min(
        extraLives + count,
        maxLives - startLives + carriedHits + preview.hits(),
      ),
    );
  }

  function extend(): void {
    const gained: number = preview.lifeGains() - countedGains;
    const score: number = carriedScore + preview.score();

    countedGains = preview.lifeGains();

    if (gained > 0) {
      gainLives(gained);
    }

    while (
      extendIndex < extendScores.length &&
      score >= extendScores[extendIndex]!
    ) {
      extendIndex++;
      gainLives(1);
      cue("extend");
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

    endCutscene();
    leg = index;
    outro = 0;
    countedGains = 0;
    preview.clear();
    preview.setChapter(
      mode === "watch" || plan.stages.length <= 1 ? "" : "Stage " + (index + 1),
    );
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
    const card: GameCard | null =
      creations.games.find((entry: GameCard) =>
        chosen.id.startsWith(entry.id + ":"),
      ) ?? null;

    useEffects(next === "attract" ? null : creations.sounds, card);
    extraLives = 0;
    countedGains = 0;
    extendIndex = 0;
    extendScores = (card?.extends ?? new Array())
      .filter((score: number) => score > 0)
      .sort((first: number, second: number) => first - second);
    carriedScore = 0;
    carriedHits = 0;
    carriedGrazes = 0;
    continues = 0;
    carriedItems = 0;
    carriedBombs = 0;
    misses = 0;
    countedHits = 0;
    queued = null;

    const first: Stage | undefined = chosen.stages[0];

    if (first !== undefined && !stageReady(first)) {
      await loader(() => prepareStage(first), first.name);

      if (owner !== token) {
        return null;
      }
    }

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
    creations = rollCreations(loadCreations());

    return begin(watchPlan(), "watch");
  }

  function roll(): void {
    if (plan === null) {
      return;
    }

    if (lives() < 0) {
      carriedHits = -preview.hits();
      extraLives = 0;
      preview.setBombs(startBombs);
    }

    if (!preview.finished() || outro < outroTime) {
      return;
    }

    if (mode === "watch" && leg + 1 >= plan.stages.length && queued === null) {
      queued = { ...watchPlan(), stages: shuffled() };
    }

    if (!upcomingReady()) {
      return;
    }

    if (leg + 1 >= plan.stages.length) {
      if (queued !== null) {
        plan = queued;
        queued = null;
      }

      carriedScore += preview.score();
      carriedHits += preview.hits();
      carriedGrazes += preview.grazes();
      fresh = load(0, preview.bombs(), preview.power());
      return;
    }

    fresh = advance();
  }

  function stageSounds(stage: Stage): Array<Sound> {
    if (mode === "attract") {
      return new Array();
    }

    const ids: Set<string | null> = new Set([stage.music]);

    for (const keyframe of stage.keyframes) {
      if (keyframe.cutscene !== null) {
        continue;
      }

      for (const spawn of keyframe.spawns) {
        ids.add(byId<Enemy>(creations.enemies, spawn.enemy)?.theme ?? null);
      }
    }

    return [...ids]
      .map((id: string | null) => byId<Sound>(creations.sounds, id))
      .filter((sound: Sound | null): sound is Sound => sound !== null);
  }

  function stageReady(stage: Stage): boolean {
    return stageSounds(stage).every((sound: Sound) => trackReady(sound, true));
  }

  async function prepareStage(stage: Stage): Promise<void> {
    for (const sound of stageSounds(stage)) {
      await prepareTrack(sound, true);
    }
  }

  function upcoming(): Stage | null {
    if (plan === null) {
      return null;
    }

    return leg + 1 < plan.stages.length
      ? (plan.stages[leg + 1] ?? null)
      : ((queued ?? plan).stages[0] ?? null);
  }

  function upcomingReady(): boolean {
    const next: Stage | null = upcoming();

    return next === null || stageReady(next);
  }

  function prepareUpcoming(): Promise<void> {
    const next: Stage | null = upcoming();

    return next === null ? Promise.resolve() : prepareStage(next);
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
    extraLives = 0;
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
    endCutscene();
    useEffects(null, null);
    plan = null;
    queued = null;
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

    if (lives() < 0) {
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

    if (showing !== null) {
      playCutscene(delta, controls.shooting);
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
    extend();

    const cued: string | null = preview.takeCue();

    if (cued !== null) {
      startCutscene(cued);
    }

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
    view: view,
    setLoader: (next: Loader) => {
      loader = next;
    },
    upcoming: upcoming,
    upcomingReady: upcomingReady,
    prepareUpcoming: prepareUpcoming,
    choices: choices,
    count: () => entries.length,
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
    toggleFavourite: toggleFavourite,
    update: update,
    outcome: outcome,
    score: () => carriedScore + preview.score(),
    hits: () => carriedHits + preview.hits(),
    lives: () => Math.max(lives(), 0),
    bombs: preview.bombs,
    grazes: () => carriedGrazes + preview.grazes(),
    power: preview.power,
    current: () => plan,
  };
}

export { createCustom, formatLength, startLives };
export type { Custom, Outcome, Leg, Plan, Tally, Loader };
