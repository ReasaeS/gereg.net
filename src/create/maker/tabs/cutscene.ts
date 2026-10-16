import type { Sound } from "../../types";
import {
  applyTranscript,
  editTranscript,
  formatTranscript,
} from "../../transcript";
import type { Studio } from "../studio";

const lineSpeedMin: number = 5; // chars/s
const lineSpeedMax: number = 120; // chars/s

function addCutsceneTab(studio: Studio): void {
  const {
    creations,
    preview,
    addTab,
    changed,
    refresh,
    cosmeticSection,
    playScene,
  } = studio;
  const { slider, choice, section, buttonRow } = studio.kit;
  const { cutscene } = studio.pick;

  addTab(
    "cutscene",
    () => creations.cutscenes,
    [
      ...cosmeticSection("cutscene"),
      ...section("Scene", [
        choice(
          "Voice",
          () => [
            { value: null, label: "None" },
            ...creations.sounds.map((value: Sound) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => cutscene().voice,
          (value: string | null) => {
            cutscene().voice = value;
          },
        ),
        slider(
          "Text speed",
          lineSpeedMin,
          lineSpeedMax,
          5,
          () => cutscene().speed,
          (value: number) => {
            cutscene().speed = value;
          },
        ),
      ]),
      ...section("Transcript", [
        buttonRow("Edit transcript", () =>
          editTranscript(
            formatTranscript(cutscene(), creations.characters),
            (text: string) => {
              const problem: string | null = applyTranscript(
                cutscene(),
                creations.characters,
                text,
              );

              if (problem === null) {
                changed();
                refresh();
              }

              return problem;
            },
          ),
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

export { addCutsceneTab };
