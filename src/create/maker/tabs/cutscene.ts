import type { Background, Sound } from "../../types";
import { applyTranscript, formatTranscript } from "../../transcript";
import type { Studio } from "../studio";

function addCutsceneTab(studio: Studio): void {
  const {
    creations,
    preview,
    addTab,
    changed,
    refresh,
    playScene,
    editTranscript,
  } = studio;
  const { choice, section, buttonRow } = studio.kit;
  const { cutscene, backgroundById } = studio.pick;

  addTab(
    "cutscene",
    () => creations.cutscenes,
    [
      ...section("Setting", [
        choice(
          "Background",
          () => [
            { value: null, label: "None" },
            ...creations.backgrounds.map((value: Background) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => cutscene().background,
          (value: string | null) => {
            cutscene().background = value;
            preview.setBackground(backgroundById(value));
          },
          "background",
        ),
      ]),
      ...section("Transcript", [
        buttonRow("Edit transcript", () =>
          editTranscript(
            formatTranscript(
              cutscene(),
              creations.characters,
              creations.sounds,
            ),
            (text: string) => {
              const problem: string | null = applyTranscript(
                cutscene(),
                creations.characters,
                creations.sounds,
                text,
              );

              if (problem === null) {
                changed();
                refresh();
              }

              return problem;
            },
            creations.sounds.map((value: Sound) => value.name),
          ),
        ),
      ]),
    ],
    () => {
      preview.setBackground(backgroundById(cutscene().background));
      preview.setPlayerVisible(false);
      preview.setSigil(null);
      playScene();
    },
  );
}

export { addCutsceneTab };
