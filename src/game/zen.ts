import {
  Container,
  FillGradient,
  Graphics,
  Texture,
  TilingSprite,
} from "pixi.js";
import { loadCreations } from "../create/storage";
import { loadTexture } from "../create/images";
import { playTrack, type Track } from "../create/sound";
import type {
  Background,
  Creations,
  Palette,
  Sound,
  Wallpaper,
} from "../create/types";
import { fieldHeight, fieldWidth } from "./field";

type Zen = {
  view: Container;
  start: () => void;
  stop: () => void;
  update: (delta: number) => void;
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

type Scene = {
  view: Container;
  fill: Graphics;
  tiles: TilingSprite;
  gradient: FillGradient | null;
  background: Background | null;
};

const sceneTime: number = 30; // s
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

function stageLooks(creations: Creations): Array<Look> {
  const found: Array<Look> = new Array();

  for (const stage of creations.stages) {
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

function createZen(onLook: LookListener): Zen {
  const view: Container = new Container();
  const front: Scene = createScene();
  const back: Scene = createScene();
  let scenes: Array<Scene> = [front, back];
  let looks: Array<Look> = new Array();
  let sceneIndex: number = 0;
  let sceneElapsed: number = 0;
  let fading: number = -1;
  let tracks: Array<Sound> = new Array();
  let trackIndex: number = 0;
  let track: Track | null = null;
  let running: boolean = false;

  function nextTrack(): void {
    if (!running || tracks.length === 0) {
      track = null;
      return;
    }

    const sound: Sound = tracks[trackIndex % tracks.length]!;

    trackIndex = (trackIndex + 1) % tracks.length;
    track = playTrack(sound, (played: boolean) => {
      if (!played) {
        tracks = tracks.filter((candidate: Sound) => candidate !== sound);
        trackIndex = 0;
      }

      nextTrack();
    });
  }

  function start(): void {
    const creations: Creations = loadCreations();

    running = true;
    looks = shuffled(stageLooks(creations));
    sceneIndex = 0;
    sceneElapsed = 0;
    fading = -1;
    paintScene(scenes[0]!, looks[0]?.background ?? null);
    onLook(looks[0]?.wallpaper ?? null, looks[0]?.palette ?? null);
    scenes[0]!.view.alpha = 1;
    scenes[1]!.view.visible = false;
    view.visible = true;
    tracks = shuffled(
      creations.sounds.filter(
        (sound: Sound) => sound.source === "file" && sound.file !== null,
      ),
    );
    trackIndex = 0;
    nextTrack();
  }

  function stop(): void {
    running = false;
    onLook(null, null);
    track?.stop();
    track = null;
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

    if (sceneElapsed < sceneTime || looks.length < 2) {
      return;
    }

    sceneElapsed = 0;
    sceneIndex = (sceneIndex + 1) % looks.length;
    paintScene(scenes[1]!, looks[sceneIndex]!.background);
    onLook(looks[sceneIndex]!.wallpaper, looks[sceneIndex]!.palette);
    scenes[1]!.view.alpha = 0;
    scenes[1]!.view.visible = true;
    view.addChild(scenes[0]!.view, scenes[1]!.view);
    fading = 0;
  }

  view.addChild(back.view, front.view);
  view.visible = false;

  return { view: view, start: start, stop: stop, update: update };
}

export { createZen };
export type { Zen };
