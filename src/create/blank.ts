import type { Creations, EffectMode, Game, Run, Sound, Stage } from "./types";
import {
  defaultBackground,
  defaultBullet,
  defaultCharacter,
  defaultCutscene,
  defaultEffect,
  defaultEnemy,
  defaultGame,
  defaultOst,
  defaultPalette,
  defaultPattern,
  defaultRun,
  defaultVessel,
  defaultSigil,
  defaultSound,
  defaultSpell,
  defaultStage,
  defaultWallpaper,
} from "./defaults";
import { difficulties } from "./rarity";
import type { Creation, Deal } from "./gallery/kinds";
import { isMusic } from "./sound";

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

      game.ost = creations.osts[0]?.id ?? null;
    }

    return game;
  }

  if (kind === "ost") {
    return defaultOst(
      sample
        ? creations.sounds
            .filter(isMusic)
            .slice(0, sampleStages)
            .map((sound: Sound) => sound.id)
        : new Array(),
    );
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

  if (kind === "bullet") {
    return defaultBullet();
  }

  if (kind === "vessel") {
    return defaultVessel();
  }

  if (kind === "palette") {
    return defaultPalette();
  }

  if (kind === "sigil") {
    return defaultSigil();
  }

  if (kind === "sound") {
    return { ...defaultSound(), source: deal.source ?? "synth" };
  }

  if (kind === "character") {
    return defaultCharacter("Character");
  }

  if (kind === "cutscene") {
    return defaultCutscene(creations.characters);
  }

  if (kind === "effect") {
    const mode: EffectMode =
      deal.group === "instant"
        ? "instant"
        : deal.group === "special"
          ? "shield"
          : "timed";

    return { ...defaultEffect(), mode: mode };
  }

  return defaultBackground();
}

export { blankEntry };
