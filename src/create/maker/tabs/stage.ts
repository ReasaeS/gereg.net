import type {
  Background,
  Curve,
  Difficulty,
  Enemy,
  Keyframe,
  Palette,
  Sound,
  Spawn,
  Vector,
  Wallpaper,
  Wave,
} from "../../types";
import { createId, defaultKeyframe, derivativeNames } from "../../defaults";
import { difficulties } from "../../rarity";
import { saveCreations } from "../../storage";
import { curveOptions } from "../swatches";
import { waveAmplitude } from "../kit";
import type { Studio } from "../studio";

const positionMin: number = -0.2;
const positionMax: number = 1.2;
const derivativeLimit: number = 400; // units/s^n
const derivativeStep: number = 5; // units/s^n
const pasteOffset: number = 0.05; // of field width

type StageTab = {
  selectKeyframe: (index: number) => void;
  copy: (whole: boolean) => string;
  paste: () => string | null;
  duplicate: () => string;
  mirror: () => string;
};

type Clip = { spawn: Spawn } | { keyframe: Keyframe };

function addStageTab(studio: Studio): StageTab {
  const {
    creations,
    preview,
    cursor,
    addTab,
    changed,
    refresh,
    renameDefault,
    pause,
    buildMarkers,
    placeMarkers,
  } = studio;
  const {
    rarityOptions,
    slider,
    choice,
    section,
    actionRow,
    vector,
    waveRows,
    derivativeActions,
  } = studio.kit;
  const { stage, keyframe, spawn, backgroundById, resolve } = studio.pick;

  function selectKeyframe(index: number): void {
    cursor.keyframe = index;
    cursor.spawn = 0;
    pause();
    preview.seek(keyframe().time);
    refresh();
  }

  let clip: Clip | null = null;

  function cloneSpawn(value: Spawn): Spawn {
    return { ...structuredClone(value), id: createId() };
  }

  function addSpawn(value: Spawn): void {
    keyframe().spawns.push(value);
    cursor.spawn = keyframe().spawns.length - 1;
    changed();
    refresh();
  }

  function copy(whole: boolean): string {
    clip = whole
      ? { keyframe: structuredClone(keyframe()) }
      : { spawn: structuredClone(spawn()) };

    return whole ? "Copied keyframe" : "Copied enemy";
  }

  function paste(): string | null {
    if (clip === null) {
      return null;
    }

    if ("spawn" in clip) {
      addSpawn(cloneSpawn(clip.spawn));
      return "Pasted enemy";
    }

    const time: number =
      Math.round(Math.min(preview.stageTime(), stage().length) * 2) / 2;

    stage().keyframes.push({
      id: createId(),
      time: time,
      spawns: clip.keyframe.spawns.map(cloneSpawn),
    });
    saveCreations(creations);
    selectKeyframe(stage().keyframes.length - 1);

    return "Pasted keyframe at " + time.toFixed(1) + "s";
  }

  function duplicate(): string {
    const copied: Spawn = cloneSpawn(spawn());

    copied.x = Math.min(copied.x + pasteOffset, positionMax);
    addSpawn(copied);

    return "Duplicated enemy";
  }

  function mirror(): string {
    const copied: Spawn = cloneSpawn(spawn());

    copied.x = 1 - copied.x;
    copied.derivatives = copied.derivatives.map((value: Vector) => ({
      x: -value.x,
      y: value.y,
    }));

    for (const wave of copied.waves) {
      wave.amplitude = { x: -wave.amplitude.x, y: wave.amplitude.y };
    }

    addSpawn(copied);

    return "Mirrored enemy";
  }

  function keyframeLabel(value: Keyframe): string {
    return (
      value.time.toFixed(1) +
      "s  ·  " +
      value.spawns.length +
      (value.spawns.length === 1 ? " enemy" : " enemies")
    );
  }

  addTab(
    "stage",
    () => creations.stages,
    [
      ...section("Stage", [
        choice(
          "Difficulty",
          rarityOptions(difficulties),
          () => stage().difficulty,
          (value: Difficulty) => {
            stage().difficulty = value;
            renameDefault("stage", stage());
          },
        ),
        choice(
          "Background",
          () => [
            { value: null, label: "None" },
            ...creations.backgrounds.map((value: Background) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => stage().background,
          (value: string | null) => {
            stage().background = value;
          },
        ),
        choice(
          "Wallpaper",
          () => [
            { value: null, label: "Default" },
            ...creations.wallpapers.map((value: Wallpaper) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => stage().wallpaper,
          (value: string | null) => {
            stage().wallpaper = value;
          },
        ),
        choice(
          "Palette",
          () => [
            { value: null, label: "Default" },
            ...creations.palettes.map((value: Palette) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => stage().palette,
          (value: string | null) => {
            stage().palette = value;
          },
        ),
        choice(
          "Music",
          () => [
            { value: null, label: "None" },
            ...creations.sounds
              .filter((value: Sound) => value.source === "file")
              .map((value: Sound) => ({
                value: value.id as string | null,
                label: value.name,
              })),
          ],
          () => stage().music,
          (value: string | null) => {
            stage().music = value;
          },
        ),
        slider(
          "Length",
          5,
          300,
          5,
          () => stage().length,
          (value: number) => {
            stage().length = value;
          },
        ),
      ]),
      ...section("Keyframes", [
        actionRow(
          "Add frame",
          () => {
            const time: number =
              Math.round(Math.min(preview.stageTime(), stage().length) * 2) / 2;

            stage().keyframes.push(
              defaultKeyframe(time, [{ ...spawn(), id: createId() }]),
            );
            saveCreations(creations);
            selectKeyframe(stage().keyframes.length - 1);
          },
          "Remove frame",
          () => {
            if (stage().keyframes.length <= 1) {
              return;
            }

            stage().keyframes.splice(cursor.keyframe, 1);
            saveCreations(creations);
            selectKeyframe(Math.max(cursor.keyframe - 1, 0));
          },
        ),
        choice(
          "Keyframe",
          () =>
            stage()
              .keyframes.map((value: Keyframe, index: number) => ({
                value: index,
                label: keyframeLabel(value),
                time: value.time,
              }))
              .sort((first, second) => first.time - second.time),
          () => cursor.keyframe,
          (value: number) => selectKeyframe(value),
        ),
        slider(
          "Time",
          0,
          () => stage().length,
          0.5,
          () => keyframe().time,
          (value: number) => {
            keyframe().time = value;
            preview.seek(value);
          },
        ),
      ]),
      ...section("Enemy", [
        actionRow(
          "Add enemy",
          () => {
            const source: Spawn = spawn();

            keyframe().spawns.push({
              ...source,
              derivatives: source.derivatives.map((value: Vector) => ({
                ...value,
              })),
              waves: source.waves.map((value: Wave<Vector>) => ({
                ...value,
                amplitude: { ...value.amplitude },
              })),
              id: createId(),
              x: Math.min(source.x + 0.15, 0.95),
            });
            cursor.spawn = keyframe().spawns.length - 1;
            changed();
            refresh();
          },
          "Remove enemy",
          () => {
            if (keyframe().spawns.length <= 1) {
              return;
            }

            keyframe().spawns.splice(cursor.spawn, 1);
            cursor.spawn = Math.max(cursor.spawn - 1, 0);
            changed();
            refresh();
          },
        ),
        choice(
          "Enemy",
          () => [
            { value: null, label: "None" },
            ...creations.enemies.map((value: Enemy) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => spawn().enemy,
          (value: string | null) => {
            spawn().enemy = value;
            buildMarkers();
          },
        ),
        slider(
          "Count",
          1,
          20,
          1,
          () => spawn().count,
          (value: number) => {
            spawn().count = value;
          },
        ),
        slider(
          "Gap",
          0.1,
          5,
          0.1,
          () => spawn().gap,
          (value: number) => {
            spawn().gap = value;
          },
        ),
      ]),
      ...section("Movement", [
        vector(
          "Position",
          positionMin,
          positionMax,
          0.01,
          () => ({ x: spawn().x, y: spawn().y }),
          (value: Vector) => {
            spawn().x = value.x;
            spawn().y = value.y;
            placeMarkers();
          },
        ),
        choice(
          "Mode",
          () => curveOptions,
          () => spawn().curve,
          (value: Curve) => {
            spawn().curve = value;
            placeMarkers();
          },
        ),
        ...derivativeNames.map((name: string, order: number) => ({
          ...vector(
            name,
            -derivativeLimit,
            derivativeLimit,
            derivativeStep,
            () => spawn().derivatives[order] ?? { x: 0, y: 0 },
            (value: Vector) => {
              spawn().derivatives[order] = value;
              placeMarkers();
            },
          ),
          shown: () =>
            spawn().curve === "polynomial" &&
            spawn().derivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => spawn().derivatives,
            derivativeNames,
            () => ({ x: 0, y: 0 }),
          ),
          shown: () => spawn().curve === "polynomial",
        },
        ...waveRows(
          () => spawn().waves,
          (name: string, get: () => Vector, set: (value: Vector) => void) =>
            vector(
              name,
              -derivativeLimit,
              derivativeLimit,
              derivativeStep,
              get,
              set,
            ),
          () => ({ x: waveAmplitude, y: 0 }),
          () => spawn().curve === "sinusoidal",
          placeMarkers,
        ),
      ]),
    ],
    () => {
      preview.setBackground(backgroundById(stage().background));
      preview.setPlayerVisible(true);
      preview.setStage(stage(), resolve);
    },
  );

  return {
    selectKeyframe: selectKeyframe,
    copy: copy,
    paste: paste,
    duplicate: duplicate,
    mirror: mirror,
  };
}

export { addStageTab };
export type { StageTab };
