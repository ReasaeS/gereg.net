import type { Cutscene, Emotion } from "../../types";
import { defaultEmotion } from "../../defaults";
import { getTexture } from "../../images";
import { cleanName } from "../../transcript";
import { createSpriteRow } from "../../../ui/widgets";
import { brightColors } from "../swatches";
import { nameLength } from "../items";
import type { Studio } from "../studio";

function addCharacterTab(studio: Studio): void {
  const {
    creations,
    preview,
    cursor,
    addTab,
    changed,
    refresh,
    cleanup,
    pickImage,
    playScene,
  } = studio;
  const { choice, colors, section, actionRow, buttonRow } = studio.kit;
  const { character, emotion } = studio.pick;

  function promptText(
    label: string,
    value: string,
    limit: number,
    set: (value: string) => void,
  ): void {
    const typed: string | null = window.prompt(label, value);
    const name: string = cleanName(typed ?? "").slice(0, limit);

    if (name === "") {
      return;
    }

    set(name);
    changed();
    refresh();
  }

  function addEmotion(): void {
    const emotions: Array<Emotion> = character().emotions;

    emotions.push(defaultEmotion("Emotion " + (emotions.length + 1)));
    cursor.emotion = emotions.length - 1;
    changed();
    refresh();
  }

  function removeEmotion(): void {
    const emotions: Array<Emotion> = character().emotions;
    const gone: Emotion = emotion();

    if (emotions.length <= 1) {
      return;
    }

    emotions.splice(cursor.emotion, 1);

    for (const value of creations.cutscenes.flatMap(
      (item: Cutscene) => item.lines,
    )) {
      if (value.emotion === gone.id) {
        value.emotion = emotions[0]!.id;
      }
    }

    cursor.emotion = Math.max(cursor.emotion - 1, 0);
    changed();
    refresh();
    cleanup();
  }

  addTab(
    "character",
    () => creations.characters,
    [
      ...section("Character", [
        colors(
          "Name colour",
          brightColors,
          () => character().color,
          (value: string) => {
            character().color = value;
          },
        ),
      ]),
      ...section("Emotions", [
        actionRow("Add emotion", addEmotion, "Remove emotion", removeEmotion),
        choice(
          "Emotion",
          () =>
            character().emotions.map((value: Emotion, index: number) => ({
              value: index,
              label: value.name,
            })),
          () => cursor.emotion,
          (value: number) => {
            cursor.emotion = value;
          },
        ),
        buttonRow("Rename emotion", () =>
          promptText("Emotion", emotion().name, nameLength, (value: string) => {
            emotion().name = value;
          }),
        ),
        createSpriteRow(
          "Sprite",
          () => getTexture(emotion().sprite),
          () => pickImage(),
          () => {
            emotion().sprite = null;
            changed();
            refresh();
            cleanup();
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSigil(null);
      playScene();
    },
  );
}

export { addCharacterTab };
