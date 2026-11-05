import {
  Container,
  FillGradient,
  Graphics,
  Texture,
  TilingSprite,
} from "pixi.js";
import { loadCreations } from "../create/storage";
import { loadTexture } from "../create/images";
import { canPlay, playTrack, type Track } from "../create/sound";
import type {
  Background,
  Creations,
  Game,
  Ost,
  Palette,
  Sound,
  Stage,
  Wallpaper,
} from "../create/types";
import { gameStages } from "../create/packs";
import { fieldHeight, fieldWidth } from "./field";

type Zen = {
  view: Container;
  start: (ost: Ost | null) => void;
  stop: () => void;
  update: (delta: number) => void;
  next: () => void;
  previousTrack: () => void;
  toggleTrack: () => void;
  nextTrack: () => void;
};

type Look = {
  background: Background | null;
  wallpaper: Wallpaper | null;
  palette: Palette | null;
};

type LookListener = (
  wallpaper: Wallpaper | null,
  palette: Palette | null,
) => void;

type Song = {
  sound: Sound;
  look: Look | null;
};

type TrackListener = (name: string | null, playing: boolean) => void;

type Scene = {
  view: Container;
  fill: Graphics;
  tiles: TilingSprite;
  gradient: FillGradient | null;
  background: Background | null;
};

const sceneTime: number = 30; // s
const restartTime: number = 3; // s
const fadeTime: number = 3; // s
const emptyColor: string = "#01040f";

function createScene(): Scene {
  const view: Container = new Container();
  const fill: Graphics = new Graphics();
  const tiles: TilingSprite = new TilingSprite({
    texture: Texture.EMPTY,
    width: fieldWidth,
    height: fieldHeight,
  });

  view.addChild(fill, tiles);

  return {
    view: view,
    fill: fill,
    tiles: tiles,
    gradient: null,
    background: null,
  };
}

function paintScene(scene: Scene, background: Background | null): void {
  scene.background = background;
  scene.gradient?.destroy();
  scene.gradient = null;
  scene.fill.clear();
  scene.tiles.visible = false;
  scene.tiles.tilePosition.set(0, 0);

  if (background === null) {
    scene.fill.rect(0, 0, fieldWidth, fieldHeight).fill(emptyColor);
    return;
  }

  scene.gradient = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: background.top },
      { offset: 1, color: background.bottom },
    ],
  });
  scene.fill.rect(0, 0, fieldWidth, fieldHeight).fill(scene.gradient);

  void loadTexture(background.sprite).then((texture: Texture | null) => {
    if (texture === null || scene.background !== background) {
      return;
    }

    scene.tiles.texture = texture;
    scene.tiles.tileScale.set(fieldWidth / texture.width);
    scene.tiles.visible = true;
  });
}

function stageLooks(creations: Creations, stages: Array<Stage>): Array<Look> {
  const found: Array<Look> = new Array();

  for (const stage of stages) {
    const look: Look = {
      background:
        creations.backgrounds.find(
          (candidate: Background) => candidate.id === stage.background,
        ) ?? null,
      wallpaper:
        creations.wallpapers.find(
          (candidate: Wallpaper) => candidate.id === stage.wallpaper,
        ) ?? null,
      palette:
        creations.palettes.find(
          (candidate: Palette) => candidate.id === stage.palette,
        ) ?? null,
    };

    if (
      (look.background !== null ||
        look.wallpaper !== null ||
        look.palette !== null) &&
      !found.some(
        (other: Look) =>
          other.background === look.background &&
          other.wallpaper === look.wallpaper &&
          other.palette === look.palette,
      )
    ) {
      found.push(look);
    }
  }

  return found;
}

function shuffled<T>(list: Array<T>): Array<T> {
  const copy: Array<T> = list.slice();

  for (let index = copy.length - 1; index > 0; index--) {
    const other: number = Math.floor(Math.random() * (index + 1));
    const held: T = copy[index]!;

    copy[index] = copy[other]!;
    copy[other] = held;
  }

  return copy;
}

function paletteFor(
  creations: Creations,
  wallpaper: Wallpaper | null,
): Palette | null {
  const stage: Stage | undefined = creations.stages.find(
    (candidate: Stage) =>
      wallpaper !== null && candidate.wallpaper === wallpaper.id,
  );

  return (
    creations.palettes.find(
      (candidate: Palette) => candidate.id === stage?.palette,
    ) ?? null
  );
}

function ostSongs(creations: Creations, ost: Ost | null): Array<Song> {
  if (ost === null) {
    return shuffled(creations.sounds.filter(canPlay)).map((sound: Sound) => ({
      sound: sound,
      look: null,
    }));
  }

  const found: Array<Song> = new Array();

  for (const track of ost.tracks) {
    const sound: Sound | undefined = creations.sounds.find(
      (candidate: Sound) => candidate.id === track.sound,
    );
    const background: Background | null =
      creations.backgrounds.find(
        (candidate: Background) => candidate.id === track.background,
      ) ?? null;
    const wallpaper: Wallpaper | null =
      creations.wallpapers.find(
        (candidate: Wallpaper) => candidate.id === track.wallpaper,
      ) ?? null;

    if (sound === undefined || !canPlay(sound)) {
      continue;
    }

    found.push({
      sound: sound,
      look:
        background === null && wallpaper === null
          ? null
          : {
              background: background,
              wallpaper: wallpaper,
              palette: paletteFor(creations, wallpaper),
            },
    });
  }

  return found;
}

function ostLooks(creations: Creations, ost: Ost | null): Array<Look> {
  const game: Game | undefined =
    ost === null
      ? undefined
      : creations.games.find((candidate: Game) => candidate.ost === ost.id);
  const looks: Array<Look> =
    game === undefined
      ? new Array()
      : stageLooks(creations, gameStages(creations, game));

  return looks.length > 0
    ? looks
    : shuffled(stageLooks(creations, creations.stages));
}

function createZen(onLook: LookListener, onTrack: TrackListener): Zen {
  const view: Container = new Container();
  const front: Scene = createScene();
  const back: Scene = createScene();
  let scenes: Array<Scene> = [front, back];
  let looks: Array<Look> = new Array();
  let sceneIndex: number = 0;
  let sceneElapsed: number = 0;
  let fading: number = -1;
  let tracks: Array<Song> = new Array();
  let current: Look | null = null;
  let tied: boolean = false;
  let trackIndex: number = 0;
  let track: Track | null = null;
  let paused: boolean = false;
  let resumeAt: number = 0;
  let running: boolean = false;

  function announce(): void {
    onTrack(
      tracks[trackIndex]?.sound.name ?? null,
      !paused && tracks.length > 0,
    );
  }

  function play(index: number, offset: number = 0): void {
    track?.stop();
    track = null;
    paused = false;

    if (!running || tracks.length === 0) {
      announce();
      return;
    }

    trackIndex = ((index % tracks.length) + tracks.length) % tracks.length;

    const song: Song = tracks[trackIndex]!;

    if (song.look !== null) {
      showLook({
        background: song.look.background ?? current?.background ?? null,
        wallpaper: song.look.wallpaper ?? current?.wallpaper ?? null,
        palette:
          song.look.wallpaper === null
            ? (current?.palette ?? null)
            : song.look.palette,
      });
    }

    track = playTrack(
      song.sound,
      (played: boolean) => {
        if (played) {
          play(trackIndex + 1);
          return;
        }

        tracks = tracks.filter((candidate: Song) => candidate !== song);
        play(trackIndex);
      },
      offset,
      true,
    );
    announce();
  }

  function previousTrack(): void {
    if (!running) {
      return;
    }

    if (track !== null && track.position() > restartTime) {
      play(trackIndex);
    } else {
      play(trackIndex - 1);
    }
  }

  function toggleTrack(): void {
    if (!running || tracks.length === 0) {
      return;
    }

    if (paused) {
      play(trackIndex, resumeAt);
      return;
    }

    resumeAt = track?.position() ?? 0;
    track?.stop();
    track = null;
    paused = true;
    announce();
  }

  function start(ost: Ost | null): void {
    const creations: Creations = loadCreations();

    running = true;
    looks = ostLooks(creations, ost);
    tracks = ostSongs(creations, ost);
    tied = tracks.some((song: Song) => song.look !== null);
    sceneIndex = 0;
    sceneElapsed = 0;
    fading = -1;
    current = looks[0] ?? null;

    const first: Look | null = tracks[0]?.look ?? null;

    if (first !== null) {
      current = {
        background: first.background ?? current?.background ?? null,
        wallpaper: first.wallpaper ?? current?.wallpaper ?? null,
        palette:
          first.wallpaper === null ? (current?.palette ?? null) : first.palette,
      };
    }

    paintScene(scenes[0]!, current?.background ?? null);
    onLook(current?.wallpaper ?? null, current?.palette ?? null);
    scenes[0]!.view.alpha = 1;
    scenes[1]!.view.visible = false;
    view.visible = true;
    play(0);
  }

  function stop(): void {
    running = false;
    onLook(null, null);
    track?.stop();
    track = null;
    paused = false;
    view.visible = false;
  }

  function scroll(scene: Scene, delta: number): void {
    scene.tiles.tilePosition.y += (scene.background?.scroll ?? 0) * delta;
  }

  function update(delta: number): void {
    if (!running) {
      return;
    }

    scroll(scenes[0]!, delta);
    sceneElapsed += delta;

    if (fading >= 0) {
      fading += delta;
      scroll(scenes[1]!, delta);
      scenes[1]!.view.alpha = Math.min(fading / fadeTime, 1);

      if (fading >= fadeTime) {
        fading = -1;
        scenes = [scenes[1]!, scenes[0]!];
        scenes[1]!.view.visible = false;
      }

      return;
    }

    if (tied || sceneElapsed < sceneTime || looks.length < 2) {
      return;
    }

    advance();
  }

  function next(): void {
    if (running && fading < 0 && looks.length >= 2) {
      advance();
    }
  }

  function advance(): void {
    sceneIndex = (sceneIndex + 1) % looks.length;
    showLook(looks[sceneIndex]!);
  }

  function showLook(look: Look): void {
    if (
      current !== null &&
      current.background === look.background &&
      current.wallpaper === look.wallpaper
    ) {
      return;
    }

    if (fading >= 0) {
      fading = -1;
      scenes = [scenes[1]!, scenes[0]!];
      scenes[0]!.view.alpha = 1;
      scenes[1]!.view.visible = false;
    }

    current = look;
    sceneElapsed = 0;
    paintScene(scenes[1]!, look.background);
    onLook(look.wallpaper, look.palette);
    scenes[1]!.view.alpha = 0;
    scenes[1]!.view.visible = true;
    view.addChild(scenes[0]!.view, scenes[1]!.view);
    fading = 0;
  }

  view.addChild(back.view, front.view);
  view.visible = false;

  return {
    view: view,
    start: start,
    stop: stop,
    update: update,
    next: next,
    previousTrack: previousTrack,
    toggleTrack: toggleTrack,
    nextTrack: () => {
      if (running) {
        play(trackIndex + 1);
      }
    },
  };
}

export { createZen };
export type { Zen };
