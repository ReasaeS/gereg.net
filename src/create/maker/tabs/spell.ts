import type { Background, Pattern, Sigil } from "../../types";
import type { Studio } from "../studio";

function addSpellTab(studio: Studio): void {
  const { creations, preview, addTab } = studio;
  const { choice, section } = studio.kit;
  const { spell, patternById } = studio.pick;

  addTab(
    "spell",
    () => creations.spells,
    [
      ...section("Spell", [
        choice(
          "Sigil",
          () =>
            creations.sigils.map((value: Sigil) => ({
              value: value.id,
              label: value.name,
            })),
          () => spell().sigil,
          (value: string) => {
            spell().sigil = value;
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
          () => spell().background,
          (value: string | null) => {
            spell().background = value;
          },
        ),
        choice(
          "Pattern",
          () => [
            { value: null, label: "Enemy pattern" },
            ...creations.patterns.map((value: Pattern) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => spell().pattern,
          (value: string | null) => {
            spell().pattern = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSpell(spell(), patternById(spell().pattern));
    },
  );
}

export { addSpellTab };
