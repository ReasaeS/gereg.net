import type { EffectTarget, Modifier, Stat } from "../../types";
import { effectTargets } from "../../rarity";
import {
  fitModifiers,
  modifierLimit,
  statsFor,
  type StatInfo,
} from "../../effects";
import type { Control } from "../../../ui/widgets";
import { brightColors, soundOptions } from "../swatches";
import type { Studio } from "../studio";

const modifierNames: Array<string> = new Array(modifierLimit)
  .fill("")
  .map((_: string, index: number) => "modifier " + (index + 1));

function addEffectTab(studio: Studio): void {
  const { creations, preview, addTab, renameDefault } = studio;
  const { choice, colors, slider, section, rarityOptions, derivativeActions } =
    studio.kit;
  const { effect } = studio.pick;

  function modifierRows(order: number): Array<Control> {
    const name: string = "Modifier " + (order + 1);
    const shown: () => boolean = () => effect().modifiers.length > order;
    const modifier: () => Modifier = () =>
      effect().modifiers[order] ?? { stat: "fireRate", amount: 0 };

    return [
      {
        ...choice(
          name,
          () =>
            statsFor(effect().target).map((info: StatInfo) => ({
              value: info.value,
              label: info.label,
            })),
          () => modifier().stat,
          (value: Stat) => {
            modifier().stat = value;
          },
        ),
        shown: shown,
      },
      {
        ...slider(
          name + " amount (%)",
          -90,
          200,
          5,
          () => modifier().amount,
          (value: number) => {
            modifier().amount = value;
          },
        ),
        shown: shown,
      },
    ];
  }

  addTab(
    "effect",
    () => creations.effects,
    [
      ...section("Effect", [
        choice(
          "Applies to",
          rarityOptions(effectTargets),
          () => effect().target,
          (value: EffectTarget) => {
            effect().target = value;
            fitModifiers(effect());
            renameDefault("effect", effect());
          },
        ),
        colors(
          "Colour",
          brightColors,
          () => effect().color,
          (value: string) => {
            effect().color = value;
          },
        ),
        slider(
          "Duration (s)",
          1,
          60,
          1,
          () => effect().duration,
          (value: number) => {
            effect().duration = value;
          },
        ),
      ]),
      ...section("Modifiers", [
        ...new Array(modifierLimit)
          .fill(0)
          .flatMap((_: number, order: number) => modifierRows(order)),
        derivativeActions(
          () => effect().modifiers,
          modifierNames,
          (): Modifier => ({
            stat: statsFor(effect().target)[0]!.value,
            amount: 25,
          }),
        ),
      ]),
      ...section("Sound", [
        choice(
          "Pickup sound",
          () => soundOptions(creations),
          () => effect().pickupSound,
          (value: string | null) => {
            effect().pickupSound = value;
          },
          "sound",
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setPattern(null);
    },
  );
}

export { addEffectTab };
