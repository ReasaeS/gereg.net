import type { Creations, Cutscene, Line, Sound } from "../types";
import { createScene, type Scene } from "../cutscene";
import { defaultCutscene } from "../defaults";
import { playSound } from "../sound";
import type { Selection, Tab } from "./studio";

type Scenes = {
  scene: Scene;
  shown: () => boolean;
  play: () => void;
  showPalette: () => void;
};

function createScenes(
  creations: Creations,
  pick: () => Selection,
  tab: () => Tab,
): Scenes {
  const scene: Scene = createScene(
    speak,
    say,
    () => creations.characters,
    false,
  );
  let placeholderShown: boolean = false;
  let stopLine: () => void = () => undefined;

  function speak(value: Cutscene): void {
    const voice: Sound | null = pick().soundById(value.voice);

    if (voice !== null) {
      playSound(voice);
    }
  }

  function say(line: Line): void {
    const sound: Sound | null = pick().soundById(line.sound ?? null);

    stopLine();
    stopLine = sound === null ? () => undefined : playSound(sound);
  }

  function shown(): boolean {
    return (
      tab().name === "cutscene" ||
      tab().name === "character" ||
      tab().name === "palette"
    );
  }

  function showcase(): Cutscene {
    return {
      id: "",
      name: "",
      voice: null,
      background: null,
      speed: defaultCutscene(new Array()).speed,
      lines: [
        {
          id: "",
          character: pick().character().id,
          emotion: pick().emotion().id,
          text: pick().emotion().name,
        },
      ],
    };
  }

  function play(): void {
    placeholderShown = tab().name === "palette";
    scene.setPalette(placeholderShown ? pick().palette() : null);
    scene.play(
      tab().name === "character"
        ? showcase()
        : placeholderShown
          ? defaultCutscene(creations.characters)
          : pick().cutscene(),
      0,
    );
  }

  function showPalette(): void {
    if (placeholderShown) {
      scene.setPalette(pick().palette());
    } else {
      play();
    }
  }

  return { scene: scene, shown: shown, play: play, showPalette: showPalette };
}

export { createScenes };
export type { Scenes };
