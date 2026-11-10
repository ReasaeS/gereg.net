import type {
  Appearance,
  Bar,
  Drop,
  Effect,
  EffectDrop,
  Pattern,
  Rank,
  Vessel,
  Sound,
  Spell,
} from "../../types";
import { defaultBar, limitBars, rankDrops } from "../../defaults";
import type { Control, Option } from "../../../ui/widgets";
import { effectDropLimit } from "../../effects";
import { ranks } from "../../rarity";
import { brightColors, soundOptions } from "../swatches";
import type { Studio } from "../studio";
import { isMusic } from "../../sound";

const dropRows: Array<[Drop, string, number]> = [
  ["power", "Power", 16],
  ["point", "Point", 16],
  ["big", "Big power", 4],
  ["life", "Extra life", 3],
  ["lifepiece", "Life piece", 6],
  ["bomb", "Bomb", 3],
  ["bombpiece", "Bomb piece", 6],
];
const effectNames: Array<string> = new Array(effectDropLimit)
  .fill("")
  .map((_: string, index: number) => "effect " + (index + 1));
const appearances: Array<Option<Appearance>> = [
  { value: "always", label: "Always" },
  { value: "nomiss", label: "No misses" },
  { value: "nobomb", label: "No bombs" },
  { value: "perfect", label: "No misses or bombs" },
];
const movements: Array<Option<boolean>> = [
  { value: false, label: "Stay on path" },
  { value: true, label: "Move to point" },
];

function addEnemyTab(studio: Studio): void {
  const {
    creations,
    preview,
    cursor,
    addTab,
    changed,
    refresh,
    renameDefault,
  } = studio;
  const {
    rarityOptions,
    slider,
    choice,
    colors,
    section,
    actionRow,
    derivativeActions,
  } = studio.kit;
  const { enemy, bar, spellById } = studio.pick;

  function effectRows(order: number): Array<Control> {
    const name: string = "Effect " + (order + 1);
    const shown: () => boolean = () => enemy().effects.length > order;
    const drop: () => EffectDrop = () =>
      enemy().effects[order] ?? { effect: null, chance: 0 };

    return [
      {
        ...choice(
          name,
          () => [
            { value: null, label: "None" },
            ...creations.effects.map((value: Effect) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => drop().effect,
          (value: string | null) => {
            drop().effect = value;
          },
          "effect",
        ),
        shown: shown,
      },
      {
        ...slider(
          name + " chance (%)",
          0,
          100,
          1,
          () => drop().chance,
          (value: number) => {
            drop().chance = value;
          },
        ),
        shown: shown,
      },
    ];
  }

  function selectBar(index: number): void {
    cursor.bar = index;
    refresh();
  }

  addTab(
    "enemy",
    () => creations.enemies,
    [
      ...section("Look", [
        choice(
          "Vessel",
          () => [
            { value: null, label: "None" },
            ...creations.vessels.map((value: Vessel) => ({
              value: value.id as string | null,
              label: value.name,
            })),
          ],
          () => enemy().vessel,
          (value: string | null) => {
            enemy().vessel = value;
          },
          "vessel",
        ),
        {
          ...colors(
            "Colour",
            brightColors,
            () => enemy().color,
            (value: string) => {
              enemy().color = value;
            },
          ),
          shown: () => enemy().vessel === null,
        },
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
            if (
              JSON.stringify(enemy().drops) ===
              JSON.stringify(rankDrops(enemy().rank))
            ) {
              enemy().drops = rankDrops(value);
            }

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
          "pattern",
        ),
        {
          ...choice(
            "Theme",
            () => [
              { value: null, label: "Stage music" },
              ...creations.sounds.filter(isMusic).map((value: Sound) => ({
                value: value.id as string | null,
                label: value.name,
              })),
            ],
            () => enemy().theme,
            (value: string | null) => {
              enemy().theme = value;
            },
            "sound",
          ),
          shown: () => enemy().rank !== "regular",
        },
        choice(
          "Defeat sound",
          () => soundOptions(creations),
          () => enemy().defeatSound,
          (value: string | null) => {
            enemy().defeatSound = value;
          },
          "sound",
        ),
      ]),
      ...section("Drops", [
        ...dropRows.map(([kind, name, most]: [Drop, string, number]) =>
          slider(
            name,
            0,
            most,
            1,
            () => enemy().drops[kind],
            (value: number) => {
              enemy().drops[kind] = value;
            },
          ),
        ),
        actionRow("Rank defaults", () => {
          enemy().drops = rankDrops(enemy().rank);
          changed();
          refresh();
        }),
      ]),
      ...section("Effect drops", [
        ...new Array(effectDropLimit)
          .fill(0)
          .flatMap((_: number, order: number) => effectRows(order)),
        derivativeActions(
          () => enemy().effects,
          effectNames,
          (): EffectDrop => ({
            effect: creations.effects[0]?.id ?? null,
            chance: 25,
          }),
        ),
      ]),
      ...section(
        "Stages",
        [
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
                    (spellById(value.spell)?.name ?? "No spell") +
                    (value.appears === "always" ? "" : "  ·  Hidden"),
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
              "spell",
            ),
            shown: () => enemy().rank !== "regular",
          },
          {
            ...choice(
              "Normal attack",
              () => [
                {
                  value: null,
                  label: bar().spell === null ? "Enemy pattern" : "None",
                },
                ...creations.patterns.map((value: Pattern) => ({
                  value: value.id as string | null,
                  label: value.name,
                })),
              ],
              () => bar().attack,
              (value: string | null) => {
                bar().attack = value;
              },
              "pattern",
            ),
            shown: () => enemy().rank !== "regular",
          },
          {
            ...choice(
              "Movement",
              () => movements,
              () => bar().move !== null,
              (value: boolean) => {
                bar().move = value ? { x: 0.5, y: 0.25 } : null;
              },
            ),
            shown: () => enemy().rank !== "regular",
          },
          {
            ...slider(
              "Move to X",
              0,
              100,
              5,
              () => Math.round((bar().move?.x ?? 0.5) * 100),
              (value: number) => {
                bar().move = { x: value / 100, y: bar().move?.y ?? 0.25 };
              },
            ),
            shown: () => enemy().rank !== "regular" && bar().move !== null,
          },
          {
            ...slider(
              "Move to Y",
              0,
              100,
              5,
              () => Math.round((bar().move?.y ?? 0.25) * 100),
              (value: number) => {
                bar().move = { x: bar().move?.x ?? 0.5, y: value / 100 };
              },
            ),
            shown: () => enemy().rank !== "regular" && bar().move !== null,
          },
          {
            ...choice(
              "Appears",
              () => appearances,
              () => bar().appears,
              (value: Appearance) => {
                bar().appears = value;
              },
            ),
            shown: () => enemy().rank === "boss",
          },
        ],
        () => true,
        false,
      ),
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
