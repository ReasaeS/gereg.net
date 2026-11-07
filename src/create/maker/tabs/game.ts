import type { Difficulty, GameEffect, Ost, Run, Stage } from "../../types";
import { soundOptions } from "../swatches";
import { difficulties, type Rarity } from "../../rarity";
import { gameStages } from "../../packs";
import type { Studio } from "../studio";

const effectNames: Array<[GameEffect, string]> = [
  ["graze", "Graze"],
  ["item", "Item pickup"],
  ["power", "Full power"],
  ["miss", "Player hit"],
  ["capture", "Spell capture"],
  ["timeout", "Timer tick"],
  ["cancel", "Bullet cancel"],
];

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
            "run",
          ),
        ),
      ),
      ...section("Soundtrack", [
        choice(
          "OST",
          () => [
            { value: null, label: "None" },
            ...creations.osts.map((value: Ost) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => game().ost,
          (value: string | null) => {
            game().ost = value;
          },
          "ost",
        ),
      ]),
      ...section(
        "Sounds",
        effectNames.map(([effect, name]: [GameEffect, string]) =>
          choice(
            name,
            () => soundOptions(creations),
            () => game().sounds[effect],
            (value: string | null) => {
              game().sounds[effect] = value;
            },
            "sound",
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
