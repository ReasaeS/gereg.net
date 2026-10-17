import type { Bar, Pattern, Rank, Sound, Spell } from "../../types";
import { defaultBar, limitBars } from "../../defaults";
import { ranks } from "../../rarity";
import { brightColors } from "../swatches";
import type { Studio } from "../studio";

function addEnemyTab(studio: Studio): void {
  const {
    creations,
    preview,
    cursor,
    addTab,
    changed,
    refresh,
    spriteRow,
    renameDefault,
  } = studio;
  const { rarityOptions, slider, choice, colors, section, actionRow } =
    studio.kit;
  const { enemy, bar, spellById } = studio.pick;

  function selectBar(index: number): void {
    cursor.bar = index;
    refresh();
  }

  addTab(
    "enemy",
    () => creations.enemies,
    [
      ...section("Look", [
        spriteRow(),
        colors(
          "Colour",
          brightColors,
          () => enemy().color,
          (value: string) => {
            enemy().color = value;
          },
        ),
        slider(
          "Size",
          12,
          64,
          1,
          () => enemy().size,
          (value: number) => {
            enemy().size = value;
          },
        ),
      ]),
      ...section("Combat", [
        choice(
          "Rank",
          rarityOptions(ranks),
          () => enemy().rank,
          (value: Rank) => {
            enemy().rank = value;
            limitBars(enemy());
            renameDefault("enemy", enemy());
          },
        ),
        choice(
          "Pattern",
          () => [
            { value: null, label: "None" },
            ...creations.patterns.map((value: Pattern) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => enemy().pattern,
          (value: string | null) => {
            enemy().pattern = value;
          },
        ),
        {
          ...choice(
            "Theme",
            () => [
              { value: null, label: "Stage music" },
              ...creations.sounds
                .filter((value: Sound) => value.source === "file")
                .map((value: Sound) => ({
                  value: value.id as string | null,
                  label: value.name,
                })),
            ],
            () => enemy().theme,
            (value: string | null) => {
              enemy().theme = value;
            },
          ),
          shown: () => enemy().rank !== "regular",
        },
      ]),
      ...section("Stages", [
        {
          ...actionRow(
            "Add stage",
            () => {
              enemy().bars.push({
                ...defaultBar(bar().health),
                time: bar().time,
              });
              changed();
              selectBar(enemy().bars.length - 1);
            },
            "Remove stage",
            () => {
              if (enemy().bars.length <= 1) {
                return;
              }

              enemy().bars.splice(cursor.bar, 1);
              changed();
              selectBar(Math.max(cursor.bar - 1, 0));
            },
          ),
          shown: () => enemy().rank === "boss",
        },
        {
          ...choice(
            "Stage",
            () =>
              enemy().bars.map((value: Bar, index: number) => ({
                value: index,
                label:
                  "Stage " +
                  (index + 1) +
                  "  ·  " +
                  (spellById(value.spell)?.name ?? "No spell"),
              })),
            () => cursor.bar,
            (value: number) => selectBar(value),
          ),
          shown: () => enemy().rank === "boss",
        },
        slider(
          "Health",
          1,
          200,
          1,
          () => bar().health,
          (value: number) => {
            bar().health = value;
          },
        ),
        {
          ...slider(
            "Time limit",
            0,
            120,
            1,
            () => bar().time,
            (value: number) => {
              bar().time = value;
            },
          ),
          shown: () => enemy().rank !== "regular",
        },
        {
          ...choice(
            "Spell",
            () => [
              { value: null, label: "None" },
              ...creations.spells.map((value: Spell) => ({
                value: value.id as string | null,
                label: value.name,
              })),
            ],
            () => bar().spell,
            (value: string | null) => {
              bar().spell = value;
            },
          ),
          shown: () => enemy().rank !== "regular",
        },
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      bar();
      preview.setEnemy(enemy(), cursor.bar);
    },
  );
}

export { addEnemyTab };
