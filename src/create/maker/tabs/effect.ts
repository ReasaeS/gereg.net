import type {
  AuraKind,
  Cleanse,
  EffectMode,
  InstantAction,
  Modifier,
  RampShape,
  Stat,
  World,
  WorldKind,
} from "../../types";
import {
  actions,
  auras,
  cleanses,
  hasStrength,
  isWindy,
  lasts,
  modes,
  modifierLimit,
  ramps,
  stats,
  worldLimit,
  worlds,
  type StatInfo,
  type WorldInfo,
} from "../../effects";
import type { Control } from "../../../ui/widgets";
import { brightColors, soundOptions } from "../swatches";
import type { Studio } from "../studio";

const modifierNames: Array<string> = new Array(modifierLimit)
  .fill("")
  .map((_: string, index: number) => "modifier " + (index + 1));
const worldNames: Array<string> = new Array(worldLimit)
  .fill("")
  .map((_: string, index: number) => "world " + (index + 1));
const strengthMax: number = 100; // %
const windMax: number = 300; // units/s
const angleLimit: number = 180; // deg

function addEffectTab(studio: Studio): void {
  const { creations, preview, addTab, renameDefault } = studio;
  const { choice, colors, slider, section, derivativeActions } = studio.kit;
  const { effect } = studio.pick;
  const mode: () => EffectMode = () => effect().mode;

  function modifierRows(order: number): Array<Control> {
    const name: string = "Modifier " + (order + 1);
    const shown: () => boolean = () => effect().modifiers.length > order;
    const modifier: () => Modifier = () =>
      effect()?.modifiers[order] ?? { stat: "fireRate", amount: 0 };

    return [
      {
        ...choice(
          name,
          () =>
            stats.map((info: StatInfo) => ({
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

  function worldRows(order: number): Array<Control> {
    const name: string = "World " + (order + 1);
    const shown: () => boolean = () => effect().world.length > order;
    const world: () => World = () =>
      effect()?.world[order] ?? {
        kind: "freeze",
        strength: 0,
        angle: 0,
        color: "#ffffff",
      };

    return [
      {
        ...choice(
          name,
          () =>
            worlds.map((info: WorldInfo) => ({
              value: info.value,
              label: info.label,
            })),
          () => world().kind,
          (value: WorldKind) => {
            world().kind = value;
            world().strength = Math.min(
              world().strength,
              isWindy(value) ? windMax : strengthMax,
            );
          },
        ),
        shown: shown,
      },
      {
        ...slider(
          name + " strength",
          0,
          () => (isWindy(world().kind) ? windMax : strengthMax),
          5,
          () => world().strength,
          (value: number) => {
            world().strength = value;
          },
        ),
        shown: () => shown() && hasStrength(world().kind),
      },
      {
        ...slider(
          name + " direction (deg)",
          -angleLimit,
          angleLimit,
          15,
          () => world().angle,
          (value: number) => {
            world().angle = value;
          },
        ),
        shown: () => shown() && isWindy(world().kind),
      },
      {
        ...colors(
          name + " colour",
          brightColors,
          () => world().color,
          (value: string) => {
            world().color = value;
          },
        ),
        shown: () => shown() && world().kind === "recolor",
      },
    ];
  }

  addTab(
    "effect",
    () => creations.effects,
    [
      ...section("Effect", [
        choice(
          "Mode",
          () => modes,
          () => effect().mode,
          (value: EffectMode) => {
            effect().mode = value;
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
        {
          ...slider(
            "Duration (s)",
            1,
            60,
            1,
            () => effect().duration,
            (value: number) => {
              effect().duration = value;
            },
          ),
          shown: () => lasts(effect()),
        },
      ]),
      ...section(
        "Behaviour",
        [
          {
            ...choice(
              "Action",
              () => actions,
              () => effect().action,
              (value: InstantAction) => {
                effect().action = value;
              },
            ),
            shown: () => mode() === "instant",
          },
          {
            ...slider(
              "Shield hits",
              1,
              9,
              1,
              () => effect().hits,
              (value: number) => {
                effect().hits = value;
              },
            ),
            shown: () => mode() === "shield",
          },
          {
            ...slider(
              "Stack limit",
              2,
              9,
              1,
              () => effect().stacks,
              (value: number) => {
                effect().stacks = value;
              },
            ),
            shown: () => mode() === "stacking",
          },
          {
            ...choice(
              "Cleansed by",
              () => cleanses,
              () => effect().cleanse,
              (value: Cleanse) => {
                effect().cleanse = value;
              },
            ),
            shown: () => mode() === "curse",
          },
          {
            ...slider(
              "Cleansed each (s)",
              0.1,
              5,
              0.1,
              () => effect().cleanseTime,
              (value: number) => {
                effect().cleanseTime = value;
              },
            ),
            shown: () => mode() === "curse",
          },
          {
            ...choice(
              "Ramp",
              () => ramps,
              () => effect().ramp,
              (value: RampShape) => {
                effect().ramp = value;
              },
            ),
            shown: () => mode() === "ramp",
          },
          {
            ...choice(
              "Aura",
              () => auras,
              () => effect().aura,
              (value: AuraKind) => {
                effect().aura = value;
              },
            ),
            shown: () => mode() === "aura",
          },
          {
            ...slider(
              "Aura radius (units)",
              20,
              200,
              5,
              () => effect().auraRadius,
              (value: number) => {
                effect().auraRadius = value;
              },
            ),
            shown: () => mode() === "aura",
          },
          {
            ...slider(
              "Aura slow (%)",
              10,
              100,
              5,
              () => effect().auraSlow,
              (value: number) => {
                effect().auraSlow = value;
              },
            ),
            shown: () => mode() === "aura" && effect().aura === "slow",
          },
        ],
        () => mode() !== "timed" && mode() !== "focus",
      ),
      ...section(
        "Modifiers",
        [
          ...new Array(modifierLimit)
            .fill(0)
            .flatMap((_: number, order: number) => modifierRows(order)),
          derivativeActions(
            () => effect().modifiers,
            modifierNames,
            (): Modifier => ({
              stat: "fireRate",
              amount: 25,
            }),
          ),
        ],
        () => mode() !== "instant",
      ),
      ...section(
        "World",
        [
          ...new Array(worldLimit)
            .fill(0)
            .flatMap((_: number, order: number) => worldRows(order)),
          derivativeActions(
            () => effect().world,
            worldNames,
            (): World => ({
              kind: "freeze",
              strength: 100,
              angle: 0,
              color: "#ffffff",
            }),
          ),
        ],
        () => mode() !== "instant",
      ),
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
      preview.setPlayerVisible(true);
      preview.setEffect(effect());
    },
  );
}

export { addEffectTab };
