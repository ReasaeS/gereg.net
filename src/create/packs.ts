import type {
  Creations,
  Difficulty,
  Game,
  Ost,
  OstTrack,
  Run,
  Sound,
  Stage,
} from "./types";
import { difficulties, rarityOf, type Rarity } from "./rarity";
import { canPlay } from "./sound";

const runLimit: number = 8;
const layerLimit: number = 3;
const layerMinimum: number = 2;

function byId<T extends { id: string }>(
  list: Array<T>,
  id: string | null,
): T | null {
  return list.find((value: T) => value.id === id) ?? null;
}

function runStages(creations: Creations, run: Run): Array<Stage> {
  return run.stages
    .map((id: string | null) => byId(creations.stages, id))
    .filter((stage: Stage | null): stage is Stage => stage !== null);
}

function gameRuns(creations: Creations, game: Game): Array<Run> {
  return difficulties
    .map((entry: Rarity<Difficulty>) =>
      byId(creations.runs, game.runs[entry.value]),
    )
    .filter((run: Run | null): run is Run => run !== null);
}

function gameStages(creations: Creations, game: Game): Array<Stage> {
  return gameRuns(creations, game).flatMap((run: Run) =>
    runStages(creations, run),
  );
}

function ostTracks(creations: Creations, ost: Ost): Array<Sound> {
  return ost.tracks
    .map((track: OstTrack) => byId(creations.sounds, track.sound))
    .filter(
      (sound: Sound | null): sound is Sound => sound !== null && canPlay(sound),
    );
}

function gameOst(creations: Creations, game: Game): Ost | null {
  return byId(creations.osts, game.ost);
}

function packLength(stages: Array<Stage>): number {
  return stages.reduce(
    (total: number, stage: Stage) => total + stage.length,
    0,
  );
}

function runLayers(creations: Creations, run: Run): Array<string> {
  const color: string = rarityOf(difficulties, run.difficulty).color;
  const count: number = Math.min(
    Math.max(runStages(creations, run).length, layerMinimum),
    layerLimit,
  );

  return new Array(count).fill(color);
}

function gameLayers(): Array<string> {
  return difficulties
    .map((difficulty: Rarity<Difficulty>) => difficulty.color)
    .reverse();
}

export {
  runLimit,
  ostTracks,
  gameOst,
  runStages,
  gameRuns,
  gameStages,
  packLength,
  runLayers,
  gameLayers,
};
