import type { Difficulty, Run, Stage } from "../../types";
import { difficulties, type Rarity } from "../../rarity";
import { gameStages } from "../../packs";
import type { Studio } from "../studio";

function addGameTab(studio: Studio): void {
  const { creations, preview, addTab } = studio;
  const { choice, section } = studio.kit;
  const { game, backgroundById, resolve } = studio.pick;

  addTab(
    "game",
    () => creations.games,
    [
      ...section(
        "Runs",
        difficulties.map((entry: Rarity<Difficulty>) =>
          choice(
            entry.label + " run",
            () => [
              { value: null, label: "None" },
              ...creations.runs
                .filter((value: Run) => value.difficulty === entry.value)
                .map((value: Run) => ({
                  value: value.id as string | null,
                  label: value.name,
                })),
            ],
            () => game().runs[entry.value],
            (value: string | null) => {
              game().runs[entry.value] = value;
            },
          ),
        ),
      ),
    ],
    () => {
      const first: Stage | null = gameStages(creations, game())[0] ?? null;

      preview.setBackground(backgroundById(first?.background ?? null));
      preview.setPlayerVisible(first !== null);
      preview.setStage(first, resolve);
    },
  );
}

export { addGameTab };
