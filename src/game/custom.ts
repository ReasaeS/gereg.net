import type { Container, Texture } from "pixi.js";
import { createPreview, type Preview } from "../create/preview/preview";
import { loadCreations, usedSprites } from "../create/storage";
import { loadTexture } from "../create/images";
import { minPower } from "./drones";
import { difficulties, rarityOf } from "../create/rarity";
import type {
  Background,
  Creations,
  Enemy,
  Palette,
  Pattern,
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

type Outcome = "clear" | "over";

type Run = {
  stage: Stage;
  wallpaper: Wallpaper | null;
  palette: Palette | null;
  difficulty: string;
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
  start: (index: number) => Promise<Run | null>;
  stop: () => void;
  update: (delta: number, controls: Controls) => void;
  outcome: () => Outcome | null;
  score: () => number;
  hits: () => number;
  bombs: () => number;
  grazes: () => number;
  stage: () => Stage | null;
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

async function createCustom(
  playerTexture: Texture,
  droneTexture: Texture,
): Promise<Custom> {
  let creations: Creations = loadCreations();
  let stage: Stage | null = null;
  let outro: number = 0;
  let track: Track | null = null;
  const preview: Preview = await createPreview(
    playerTexture,
    droneTexture,
    (id: string | null) => byId<Background>(creations.backgrounds, id),
    (id: string | null) => byId<Sigil>(creations.sigils, id),
    (id: string | null) => byId<Spell>(creations.spells, id),
    (id: string | null) => byId<Pattern>(creations.patterns, id),
  );

  preview.view.visible = false;

  function choices(): Array<Choice> {
    creations = loadCreations();

    if (creations.stages.length === 0) {
      return [{ name: "No stages yet", title: "Build one in the create menu" }];
    }

    return creations.stages.map((value: Stage) => {
      const best: number = bestScore(value.id);

      return {
        name: value.name,
        title:
          rarityOf(difficulties, value.difficulty).label +
          "  " +
          formatLength(value.length) +
          (best > 0 ? "  Best " + best : ""),
      };
    });
  }

  function loop(sound: Sound, owner: Stage): void {
    track = playTrack(sound, (played: boolean) => {
      if (played && stage === owner) {
        loop(sound, owner);
      }
    });
  }

  async function start(index: number): Promise<Run | null> {
    const chosen: Stage | undefined = creations.stages[index];

    if (chosen === undefined) {
      return null;
    }

    await Promise.all([...usedSprites(creations)].map(loadTexture));
    stage = chosen;
    outro = 0;
    preview.clear();
    preview.setBackground(byId(creations.backgrounds, chosen.background));
    preview.setStage(null, () => null);
    preview.setLoop(false);
    preview.setStage(chosen, (spawn: Spawn) =>
      byId<Enemy>(creations.enemies, spawn.enemy),
    );
    preview.setPlaytest(true);
    preview.setPower(minPower);
    preview.view.visible = true;

    const music: Sound | null = byId(creations.sounds, chosen.music);

    if (music !== null) {
      loop(music, chosen);
    }

    return {
      stage: chosen,
      wallpaper: byId(creations.wallpapers, chosen.wallpaper),
      palette: byId(creations.palettes, chosen.palette),
      difficulty: rarityOf(difficulties, chosen.difficulty).label,
    };
  }

  function stop(): void {
    stage = null;
    track?.stop();
    track = null;
    preview.setPlaytest(false);
    preview.setLoop(true);
    preview.setStage(null, () => null);
    preview.clear();
    preview.view.visible = false;
  }

  function outcome(): Outcome | null {
    if (stage === null) {
      return null;
    }

    if (preview.hits() > startLives) {
      return "over";
    }

    return preview.finished() && outro >= outroTime ? "clear" : null;
  }

  function update(delta: number, controls: Controls): void {
    if (stage === null) {
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

    if (preview.finished()) {
      outro += delta;
    }
  }

  return {
    view: preview.view,
    choices: choices,
    count: () => creations.stages.length,
    start: start,
    stop: stop,
    update: update,
    outcome: outcome,
    score: preview.score,
    hits: preview.hits,
    bombs: preview.bombs,
    grazes: preview.grazes,
    stage: () => stage,
  };
}

export { createCustom, startLives };
export type { Custom, Outcome, Run };
