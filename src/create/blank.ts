import type { Creations, Game, Run, Stage } from "./types";
import {
  defaultBackground,
  defaultCharacter,
  defaultCutscene,
  defaultEnemy,
  defaultGame,
  defaultPalette,
  defaultPattern,
  defaultRun,
  defaultSigil,
  defaultSound,
  defaultSpell,
  defaultStage,
  defaultWallpaper,
} from "./defaults";
import { difficulties } from "./rarity";
import type { Creation, Deal } from "./gallery/kinds";

const sampleStages: number = 3;

function blankEntry(
  creations: Creations,
  deal: Deal,
  sample: boolean,
): Creation {
  const kind: Deal["kind"] = deal.kind;

  if (kind === "stage") {
    return defaultStage(
      creations.enemies[0]?.id ?? null,
      creations.backgrounds[0]?.id ?? null,
      creations.wallpapers[0]?.id ?? null,
      creations.palettes[0]?.id ?? null,
    );
  }

  if (kind === "run") {
    return defaultRun(
      "normal",
      sample
        ? creations.stages
            .slice(0, sampleStages)
            .map((stage: Stage) => stage.id)
        : new Array(),
    );
  }

  if (kind === "game") {
    const game: Game = defaultGame();

    if (sample) {
      for (const entry of difficulties) {
        game.runs[entry.value] =
          creations.runs.find((run: Run) => run.difficulty === entry.value)
            ?.id ?? null;
      }
    }

    return game;
  }

  if (kind === "pattern") {
    return { ...defaultPattern(), frame: deal.frame ?? "subjective" };
  }

  if (kind === "spell") {
    return defaultSpell(creations.sigils[0]?.id ?? "");
  }

  if (kind === "enemy") {
    return {
      ...defaultEnemy(creations.patterns[0]?.id ?? null),
      rank: deal.rank ?? "regular",
    };
  }

  if (kind === "wallpaper") {
    return defaultWallpaper();
  }

  if (kind === "palette") {
    return defaultPalette();
  }

  if (kind === "sigil") {
    return defaultSigil();
  }

  if (kind === "sound") {
    return defaultSound();
  }

  if (kind === "character") {
    return defaultCharacter("Character");
  }

  if (kind === "cutscene") {
    return defaultCutscene(creations.characters);
  }

  return defaultBackground();
}

export { blankEntry };
