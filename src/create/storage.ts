import type {
  Wave,
  Pattern,
  Enemy,
  Bar,
  Sigil,
  Emotion,
  Character,
  Cutscene,
  Spawn,
  Keyframe,
  Stage,
  Creations,
  Side,
} from "./types";
import {
  createId,
  defaultBar,
  repairSpells,
  limitBars,
  defaultEmotion,
  defaultCharacter,
  defaultCutscene,
  defaultSpawn,
  defaultKeyframe,
  defaultStage,
  defaultSpawnY,
  repairPacks,
} from "./defaults";
import { wallAngle } from "./geometry";
import { defaultCreations } from "./starter";

const storageKey: string = "geregnet.creations";
const saveListeners: Array<() => void> = new Array();

type OldLine = {
  id: string;
  speaker: string;
  text: string;
  side: Side;
  color: string;
  portrait: string | null;
};

type OldCutscene = Cutscene & {
  background?: unknown;
  characters?: Array<Character>;
};

function embedCharacters(cutscene: OldCutscene): Array<Character> {
  const cast: Map<string, Character> = new Map();
  const characters: Array<Character> = new Array();

  cutscene.lines = (cutscene.lines as unknown as Array<OldLine>).map(
    (old: OldLine) => {
      const key: string = old.side + " " + old.speaker;
      let character: Character | undefined = cast.get(key);

      if (character === undefined) {
        character = {
          ...defaultCharacter(old.speaker),
          color: old.color,
          emotions: new Array(),
        };
        cast.set(key, character);
        characters.push(character);
      }

      let emotion: Emotion | undefined = character.emotions.find(
        (value: Emotion) => value.sprite === old.portrait,
      );

      if (emotion === undefined) {
        emotion = {
          ...defaultEmotion(
            character.emotions.length === 0
              ? "Neutral"
              : "Emotion " + (character.emotions.length + 1),
          ),
          sprite: old.portrait,
        };
        character.emotions.push(emotion);
      }

      return {
        id: old.id,
        character: character.id,
        emotion: emotion.id,
        text: old.text,
      };
    },
  );

  return characters;
}

function sameName(first: string, second: string): boolean {
  return first.toLowerCase() === second.toLowerCase();
}

function upgradeCutscene(cutscene: OldCutscene, cast: Array<Character>): void {
  const embedded: Array<Character> =
    cutscene.lines.length > 0 && "speaker" in cutscene.lines[0]!
      ? embedCharacters(cutscene)
      : (cutscene.characters ?? new Array());
  const renamed: Map<string, string> = new Map();

  delete cutscene.background;
  delete cutscene.characters;

  for (const character of embedded) {
    const match: Character | undefined = cast.find((value: Character) =>
      sameName(value.name, character.name),
    );

    if (match === undefined) {
      cast.push(character);
      continue;
    }

    renamed.set(character.id, match.id);

    for (const emotion of character.emotions) {
      const twin: Emotion | undefined = match.emotions.find((value: Emotion) =>
        sameName(value.name, emotion.name),
      );

      if (twin === undefined) {
        match.emotions.push(emotion);
      } else {
        renamed.set(emotion.id, twin.id);
      }
    }
  }

  for (const line of cutscene.lines) {
    line.character = renamed.get(line.character) ?? line.character;
    line.emotion = renamed.get(line.emotion) ?? line.emotion;
  }

  if (cutscene.lines.length === 0) {
    cutscene.lines = defaultCutscene(cast).lines;
  }
}

function loadCreations(): Creations {
  try {
    const saved: string | null = localStorage.getItem(storageKey);

    if (saved === null) {
      return defaultCreations();
    }

    const parsed: Creations = JSON.parse(saved) as Creations;
    const fallback: Creations = defaultCreations();
    const creations: Creations = {
      stages: parsed.stages ?? new Array(),
      runs: parsed.runs ?? new Array(),
      games: parsed.games ?? new Array(),
      patterns: parsed.patterns ?? fallback.patterns,
      enemies: parsed.enemies ?? fallback.enemies,
      backgrounds: parsed.backgrounds ?? fallback.backgrounds,
      wallpapers: parsed.wallpapers ?? fallback.wallpapers,
      palettes: parsed.palettes ?? fallback.palettes,
      sigils: parsed.sigils ?? new Array(),
      spells:
        parsed.sigils === undefined
          ? new Array()
          : (parsed.spells ?? new Array()),
      sounds: parsed.sounds ?? fallback.sounds,
      characters:
        parsed.characters ??
        (parsed.cutscenes === undefined ? fallback.characters : new Array()),
      cutscenes: parsed.cutscenes ?? fallback.cutscenes,
    };

    for (const sound of creations.sounds) {
      sound.source = sound.source ?? "synth";
      sound.file = sound.file ?? null;
      sound.fileName = sound.fileName ?? "";
    }

    for (const cutscene of creations.cutscenes) {
      upgradeCutscene(cutscene, creations.characters);
    }

    for (const character of creations.characters as Array<
      Character & { side?: unknown }
    >) {
      delete character.side;
    }

    for (const enemy of creations.enemies as Array<
      Enemy & { health?: number; spell?: string | null }
    >) {
      enemy.rank = enemy.rank ?? "regular";
      enemy.theme = enemy.theme ?? null;
      enemy.bars = enemy.bars ?? [
        { ...defaultBar(enemy.health ?? 20), spell: enemy.spell ?? null },
      ];
      delete enemy.health;
      delete enemy.spell;
      limitBars(enemy);
    }

    if (parsed.sigils === undefined) {
      upgradeSigils(
        creations,
        (parsed.spells as unknown as Array<OldSigil> | undefined) ??
          fallback.sigils,
      );
    }

    repairSpells(creations);

    for (const item of [
      ...creations.patterns,
      ...creations.enemies,
      ...creations.backgrounds,
      ...creations.wallpapers,
    ]) {
      item.sprite = item.sprite ?? null;
    }

    for (const pattern of creations.patterns as Array<
      Pattern & {
        spin?: number;
        accel?: number;
        angle?: number;
        gapOffset?: number;
        speedWaves?: unknown;
        driftWaves?: unknown;
      }
    >) {
      pattern.size = pattern.size ?? 18;
      pattern.frame = pattern.frame ?? "objective";
      pattern.wall = pattern.wall ?? "top";
      pattern.gapShift = pattern.gapShift ?? 0;
      pattern.gapPhaseShift = pattern.gapPhaseShift ?? 0;
      pattern.cover = pattern.cover ?? 1;
      delete pattern.gapOffset;
      pattern.gapFrequency = pattern.gapFrequency ?? 0;
      pattern.gapWidth = pattern.gapWidth ?? 0.1;
      pattern.driftDerivatives = pattern.driftDerivatives ?? new Array();
      pattern.curve = pattern.curve ?? "polynomial";
      pattern.angleWaves = pattern.angleWaves ?? new Array();
      pattern.aimCurve = pattern.aimCurve ?? "polynomial";
      pattern.aimWaves = pattern.aimWaves ?? new Array();
      pattern.swayWaves = pattern.swayWaves ?? new Array();
      shiftWaves(pattern.angleWaves);
      shiftWaves(pattern.aimWaves);
      shiftWaves(pattern.swayWaves);
      delete pattern.speedWaves;
      delete pattern.driftWaves;
      pattern.velocity = pattern.velocity ?? {
        x: Math.round(Math.cos(wallAngle(pattern.wall)) * pattern.speed),
        y: Math.round(Math.sin(wallAngle(pattern.wall)) * pattern.speed),
      };
      pattern.heading =
        pattern.heading ?? (((pattern.angle ?? 90) - 90 + 540) % 360) - 180;
      delete pattern.angle;
      pattern.angleDerivatives =
        pattern.angleDerivatives ??
        (pattern.spin !== undefined && pattern.spin !== 0
          ? [pattern.spin]
          : []);
      pattern.speedDerivatives =
        pattern.speedDerivatives ??
        (pattern.accel !== undefined && pattern.accel !== 0
          ? [pattern.accel]
          : []);
      delete pattern.spin;
      delete pattern.accel;
    }

    for (const stage of creations.stages) {
      upgradeStage(stage);
    }

    if (parsed.stages === undefined) {
      creations.stages.push(
        defaultStage(
          creations.enemies[0]?.id ?? null,
          creations.backgrounds[0]?.id ?? null,
          creations.wallpapers[0]?.id ?? null,
          creations.palettes[0]?.id ?? null,
        ),
      );
    }

    repairPacks(creations);

    return creations;
  } catch {
    return defaultCreations();
  }
}

type OldSigil = Sigil & { background?: string | null };

function upgradeSigils(creations: Creations, old: Array<OldSigil>): void {
  for (const item of old) {
    const used: boolean = creations.enemies.some((enemy: Enemy) =>
      enemy.bars.some((bar: Bar) => bar.spell === item.id),
    );
    const sigil: Sigil = {
      id: used ? createId() : item.id,
      name: item.name,
      color: item.color,
      opacity: item.opacity,
      rings: item.rings,
    };

    creations.sigils.push(sigil);

    if (used) {
      creations.spells.push({
        id: item.id,
        name: item.name,
        sigil: sigil.id,
        background: item.background ?? null,
        pattern: null,
      });
    }
  }
}

type OldSpawn = Spawn & { time?: number };

function upgradeStage(stage: Stage & { spawns?: Array<OldSpawn> }): void {
  stage.difficulty = stage.difficulty ?? "normal";
  stage.wallpaper = stage.wallpaper ?? null;
  stage.palette = stage.palette ?? null;
  stage.music = stage.music ?? null;

  if (stage.keyframes === undefined) {
    const keyframes: Map<number, Keyframe> = new Map();

    for (const spawn of stage.spawns ?? []) {
      const time: number = spawn.time ?? 0;
      let keyframe: Keyframe | undefined = keyframes.get(time);

      if (keyframe === undefined) {
        keyframe = defaultKeyframe(time, new Array());
        keyframes.set(time, keyframe);
      }

      keyframe.spawns.push({
        id: spawn.id,
        enemy: spawn.enemy,
        x: spawn.x,
        y: spawn.y ?? defaultSpawnY,
        derivatives: new Array(),
        curve: "polynomial",
        waves: new Array(),
        count: spawn.count,
        gap: spawn.gap,
      });
    }

    stage.keyframes = [...keyframes.values()].sort(
      (first: Keyframe, second: Keyframe) => first.time - second.time,
    );
    delete stage.spawns;
  }

  if (stage.keyframes.length === 0) {
    stage.keyframes.push(defaultKeyframe(0, [defaultSpawn(null, 0.5)]));
  }

  for (const keyframe of stage.keyframes) {
    if (keyframe.spawns.length === 0) {
      keyframe.spawns.push(defaultSpawn(null, 0.5));
    }

    for (const spawn of keyframe.spawns) {
      spawn.derivatives = spawn.derivatives ?? new Array();
      spawn.curve = spawn.curve ?? "polynomial";
      spawn.waves = spawn.waves ?? new Array();
      shiftWaves(spawn.waves);
    }
  }
}

function shiftWaves(waves: Array<Wave<unknown>>): void {
  for (const wave of waves) {
    wave.phaseShift = wave.phaseShift ?? 0;
  }
}

function usedSprites(creations: Creations): Set<string> {
  const used: Set<string> = new Set();

  for (const item of [
    ...creations.patterns,
    ...creations.enemies,
    ...creations.backgrounds,
    ...creations.wallpapers,
  ]) {
    if (item.sprite !== null) {
      used.add(item.sprite);
    }
  }

  for (const character of creations.characters) {
    for (const emotion of character.emotions) {
      if (emotion.sprite !== null) {
        used.add(emotion.sprite);
      }
    }
  }

  return used;
}

function usedFiles(creations: Creations): Set<string> {
  const used: Set<string> = usedSprites(creations);

  for (const sound of creations.sounds) {
    if (sound.file !== null) {
      used.add(sound.file);
    }
  }

  return used;
}

function saveCreations(creations: Creations): void {
  repairPacks(creations);

  try {
    localStorage.setItem(storageKey, JSON.stringify(creations));
  } catch {
    console.warn("Could not save the creations");
  }

  for (const listener of saveListeners) {
    listener();
  }
}

function onSave(listener: () => void): void {
  saveListeners.push(listener);
}

export { loadCreations, saveCreations, onSave, usedSprites, usedFiles };
