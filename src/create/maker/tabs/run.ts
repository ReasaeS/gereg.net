import type { Difficulty, Stage } from "../../types";
import { difficulties } from "../../rarity";
import { runLimit, runStages } from "../../packs";
import type { Control } from "../../../ui/widgets";
import type { Studio } from "../studio";

function addRunTab(studio: Studio): void {
  const { creations, preview, addTab, changed, refresh, renameDefault } =
    studio;
  const { rarityOptions, choice, section, actionRow } = studio.kit;
  const { run, backgroundById, resolve } = studio.pick;

  const slots: Array<Control> = new Array();

  for (let order = 0; order < runLimit; order++) {
    slots.push({
      ...choice(
        "Stage " + (order + 1),
        () => [
          { value: null, label: "None" },
          ...creations.stages
            .filter((value: Stage) => value.difficulty === run().difficulty)
            .map((value: Stage) => ({
              value: value.id as string | null,
              label: value.name,
            })),
        ],
        () => run().stages[order] ?? null,
        (value: string | null) => {
          run().stages[order] = value;
        },
      ),
      shown: () => run().stages.length > order,
    });
  }

  addTab(
    "run",
    () => creations.runs,
    [
      ...section("Run", [
        choice(
          "Difficulty",
          rarityOptions(difficulties),
          () => run().difficulty,
          (value: Difficulty) => {
            run().difficulty = value;
            renameDefault("run", run());
          },
        ),
      ]),
      ...section("Stages", [
        actionRow(
          "Add stage",
          () => {
            if (run().stages.length >= runLimit) {
              return;
            }

            const used: Set<string | null> = new Set(run().stages);

            run().stages.push(
              creations.stages.find(
                (value: Stage) =>
                  value.difficulty === run().difficulty && !used.has(value.id),
              )?.id ?? null,
            );
            changed();
            refresh();
          },
          "Remove stage",
          () => {
            if (run().stages.length <= 1) {
              return;
            }

            run().stages.pop();
            changed();
            refresh();
          },
        ),
        ...slots,
      ]),
    ],
    () => {
      const first: Stage | null = runStages(creations, run())[0] ?? null;

      preview.setBackground(backgroundById(first?.background ?? null));
      preview.setPlayerVisible(first !== null);
      preview.setStage(first, resolve);
    },
  );
}

export { addRunTab };
