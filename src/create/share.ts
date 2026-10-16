import type {
  Creations,
  Cutscene,
  Difficulty,
  Enemy,
  Game,
  Run,
  Spell,
  Stage,
} from "./types";
import { createId } from "./defaults";
import { builtinPrefix, readBlob, storeBlob } from "./images";
import { usedFiles } from "./storage";
import type { Creation, Kind } from "./gallery/kinds";

type Bundle = {
  format: string;
  version: number;
  kind: Kind;
  root: string;
  creations: Creations;
  files: Record<string, string>;
};

type Imported = {
  kind: Kind;
  index: number;
};

const bundleFormat: string = "geregnet-card";
const bundleVersion: number = 1;
const fileExtension: string = ".geregnet.json";
const kindList: Array<Kind> = [
  "stage",
  "run",
  "game",
  "pattern",
  "enemy",
  "background",
  "wallpaper",
  "palette",
  "sigil",
  "spell",
  "sound",
  "character",
  "cutscene",
];

function listOf(creations: Creations, kind: Kind): Array<Creation> {
  const lists: Record<Kind, Array<Creation>> = {
    stage: creations.stages,
    run: creations.runs,
    game: creations.games,
    pattern: creations.patterns,
    enemy: creations.enemies,
    background: creations.backgrounds,
    wallpaper: creations.wallpapers,
    palette: creations.palettes,
    sigil: creations.sigils,
    spell: creations.spells,
    sound: creations.sounds,
    character: creations.characters,
    cutscene: creations.cutscenes,
  };

  return lists[kind];
}

function emptyCreations(): Creations {
  return {
    stages: new Array(),
    runs: new Array(),
    games: new Array(),
    patterns: new Array(),
    enemies: new Array(),
    backgrounds: new Array(),
    wallpapers: new Array(),
    palettes: new Array(),
    sigils: new Array(),
    spells: new Array(),
    sounds: new Array(),
    characters: new Array(),
    cutscenes: new Array(),
  };
}

function collect(source: Creations, kind: Kind, item: Creation): Creations {
  const bundle: Creations = emptyCreations();

  function add(target: Kind, id: string | null): void {
    if (id === null) {
      return;
    }

    const list: Array<Creation> = listOf(bundle, target);

    if (list.some((value: Creation) => value.id === id)) {
      return;
    }

    const found: Creation | undefined = listOf(source, target).find(
      (value: Creation) => value.id === id,
    );

    if (found !== undefined) {
      include(target, found);
    }
  }

  function include(target: Kind, value: Creation): void {
    listOf(bundle, target).push(structuredClone(value));

    if (target === "stage") {
      const stage: Stage = value as Stage;

      add("background", stage.background);
      add("wallpaper", stage.wallpaper);
      add("palette", stage.palette);
      add("sound", stage.music);

      for (const keyframe of stage.keyframes) {
        for (const spawn of keyframe.spawns) {
          add("enemy", spawn.enemy);
        }
      }
    } else if (target === "run") {
      for (const stage of (value as Run).stages) {
        add("stage", stage);
      }
    } else if (target === "game") {
      const game: Game = value as Game;

      for (const difficulty of Object.keys(game.runs) as Array<Difficulty>) {
        add("run", game.runs[difficulty]);
      }
    } else if (target === "enemy") {
      const enemy: Enemy = value as Enemy;

      add("pattern", enemy.pattern);

      for (const bar of enemy.bars) {
        add("spell", bar.spell);
      }
    } else if (target === "spell") {
      const spell: Spell = value as Spell;

      add("sigil", spell.sigil);
      add("background", spell.background);
      add("pattern", spell.pattern);
    } else if (target === "cutscene") {
      const cutscene: Cutscene = value as Cutscene;

      add("sound", cutscene.voice);

      for (const line of cutscene.lines) {
        add("character", line.character);
      }
    }
  }

  include(kind, item);

  return bundle;
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader: FileReader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function fileName(name: string): string {
  const slug: string = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (slug === "" ? "card" : slug) + fileExtension;
}

async function exportCard(
  source: Creations,
  kind: Kind,
  index: number,
): Promise<void> {
  const item: Creation | undefined = listOf(source, kind)[index];

  if (item === undefined) {
    return;
  }

  const creations: Creations = collect(source, kind, item);
  const files: Record<string, string> = {};

  for (const id of usedFiles(creations)) {
    if (id.startsWith(builtinPrefix)) {
      continue;
    }

    const blob: Blob | undefined = await readBlob(id);

    if (blob !== undefined) {
      files[id] = await toDataUrl(blob);
    }
  }

  const bundle: Bundle = {
    format: bundleFormat,
    version: bundleVersion,
    kind: kind,
    root: item.id,
    creations: creations,
    files: files,
  };
  const link: HTMLAnchorElement = document.createElement("a");
  const url: string = URL.createObjectURL(
    new Blob([JSON.stringify(bundle)], { type: "application/json" }),
  );

  link.href = url;
  link.download = fileName(item.name);
  link.click();
  URL.revokeObjectURL(url);
}

function isBundle(value: unknown): value is Bundle {
  const bundle: Partial<Bundle> = value as Partial<Bundle>;

  return (
    typeof value === "object" &&
    value !== null &&
    bundle.format === bundleFormat &&
    typeof bundle.root === "string" &&
    kindList.includes(bundle.kind as Kind) &&
    typeof bundle.creations === "object" &&
    bundle.creations !== null &&
    typeof bundle.files === "object" &&
    bundle.files !== null
  );
}

function remapFiles(creations: Creations, files: Map<string, string>): void {
  function swap(id: string | null): string | null {
    return id === null ? null : (files.get(id) ?? id);
  }

  for (const item of [
    ...creations.patterns,
    ...creations.enemies,
    ...creations.backgrounds,
    ...creations.wallpapers,
  ]) {
    item.sprite = swap(item.sprite);
  }

  for (const character of creations.characters) {
    for (const emotion of character.emotions) {
      emotion.sprite = swap(emotion.sprite);
    }
  }

  for (const sound of creations.sounds) {
    sound.file = swap(sound.file);
  }
}

async function importCard(
  target: Creations,
  file: File,
): Promise<Imported | null> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return null;
  }

  if (!isBundle(parsed)) {
    return null;
  }

  const bundle: Bundle = parsed;
  const incoming: Creations = { ...emptyCreations(), ...bundle.creations };
  const files: Map<string, string> = new Map();
  const root: Creation | undefined = listOf(incoming, bundle.kind).find(
    (value: Creation) => value.id === bundle.root,
  );

  if (root === undefined) {
    return null;
  }

  for (const [id, data] of Object.entries(bundle.files)) {
    try {
      const blob: Blob = await (await fetch(data)).blob();

      files.set(id, await storeBlob(blob));
    } catch {
      console.warn("Could not import the file " + id);
    }
  }

  remapFiles(incoming, files);

  for (const kind of kindList) {
    const list: Array<Creation> = listOf(target, kind);

    for (const value of listOf(incoming, kind)) {
      const taken: boolean = list.some(
        (other: Creation) => other.id === value.id,
      );

      if (value === root && taken) {
        value.id = createId();
      } else if (taken) {
        continue;
      }

      list.push(value);
    }
  }

  return {
    kind: bundle.kind,
    index: listOf(target, bundle.kind).indexOf(root),
  };
}

export { exportCard, importCard, fileExtension };
export type { Imported };
