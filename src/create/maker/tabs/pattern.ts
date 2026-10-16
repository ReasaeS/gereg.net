import type { Curve, Vector, Wall } from "../../types";
import { derivativeNames } from "../../defaults";
import { attacks, type Attack } from "../../rarity";
import { wallAngle } from "../../geometry";
import type { Option } from "../../../ui/widgets";
import { brightColors, curveOptions } from "../swatches";
import { phaseLimit, waveAmplitude } from "../kit";
import type { Studio } from "../studio";

const angleLimit: number = 360; // deg/s^n
const speedLimit: number = 400; // units/s^(n+1)
const speedNames: Array<string> = derivativeNames.slice(1);
const angleAmplitude: number = 30; // deg
const swayLimit: number = 200; // units
const gapPhaseShiftLimit: number = 1; // of wall/s
const wallOptions: Array<Option<Wall>> = [
  { value: "top", label: "Top" },
  { value: "right", label: "Right" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
];
const aimOptions: Array<Option<boolean>> = [
  { value: false, label: "Fixed angle" },
  { value: true, label: "At player" },
];

function addPatternTab(studio: Studio): void {
  const { creations, preview, addTab, spriteRow, keyed, convertAttack } =
    studio;
  const {
    rarityOptions,
    slider,
    choice,
    colors,
    section,
    vector,
    waveRows,
    derivativeActions,
  } = studio.kit;
  const { pattern } = studio.pick;

  addTab(
    "pattern",
    () => creations.patterns,
    [
      ...section("Look", [
        spriteRow(),
        slider(
          "Size",
          4,
          64,
          1,
          () => pattern().size,
          (value: number) => {
            pattern().size = value;
          },
        ),
        colors(
          "Colour",
          brightColors,
          () => pattern().color,
          (value: string) => {
            pattern().color = value;
          },
        ),
      ]),
      ...section("Spread", [
        slider(
          "Count",
          1,
          36,
          1,
          () => pattern().count,
          (value: number) => {
            pattern().count = value;
          },
        ),
        {
          ...slider(
            "Coverage",
            0.05,
            5,
            0.05,
            () => pattern().cover,
            (value: number) => {
              pattern().cover = value;
            },
          ),
          shown: () => pattern().frame === "objective",
        },
        {
          ...slider(
            "Spread",
            0,
            360,
            5,
            () => pattern().spread,
            (value: number) => {
              pattern().spread = value;
            },
          ),
          shown: () =>
            pattern().frame === "subjective" && Math.round(pattern().count) > 1,
        },
      ]),
      ...section(
        "Gaps",
        [
          slider(
            "Frequency",
            0,
            8,
            1,
            () => pattern().gapFrequency,
            (value: number) => {
              pattern().gapFrequency = value;
            },
          ),
          {
            ...slider(
              "Offset",
              -0.5,
              0.5,
              0.01,
              () => pattern().gapShift,
              (value: number) => {
                pattern().gapShift = value;
              },
            ),
            shown: () => pattern().gapFrequency > 0,
          },
          {
            ...slider(
              "Phase shift",
              -gapPhaseShiftLimit,
              gapPhaseShiftLimit,
              0.01,
              () => pattern().gapPhaseShift,
              (value: number) => {
                pattern().gapPhaseShift = value;
              },
            ),
            shown: () => pattern().gapFrequency > 0,
          },
          {
            ...slider(
              "Width",
              0.01,
              1,
              0.01,
              () => pattern().gapWidth,
              (value: number) => {
                pattern().gapWidth = value;
              },
            ),
            shown: () => pattern().gapFrequency > 0,
          },
        ],
        () => pattern().frame === "objective",
      ),
      ...keyed(
        "pattern",
        section("Aim", [
          choice(
            "Frame",
            rarityOptions(attacks),
            () => pattern().frame as Attack,
            (value: Attack) => convertAttack(value),
          ),
          {
            ...choice(
              "Wall",
              () => wallOptions,
              () => pattern().wall,
              (value: Wall) => {
                const turn: number =
                  wallAngle(value) - wallAngle(pattern().wall);
                const velocity: Vector = pattern().velocity;

                pattern().velocity = {
                  x: Math.round(
                    velocity.x * Math.cos(turn) - velocity.y * Math.sin(turn),
                  ),
                  y: Math.round(
                    velocity.x * Math.sin(turn) + velocity.y * Math.cos(turn),
                  ),
                };
                pattern().wall = value;
              },
            ),
            shown: () => pattern().frame === "objective",
          },
          {
            ...choice(
              "Aim",
              () => aimOptions,
              () => pattern().aim,
              (value: boolean) => {
                pattern().aim = value;
              },
            ),
            shown: () => pattern().frame === "subjective",
          },
          {
            ...slider(
              "Angle",
              -180,
              180,
              5,
              () => pattern().heading,
              (value: number) => {
                pattern().heading = value;
              },
            ),
            shown: () => pattern().frame === "subjective" && !pattern().aim,
          },
          {
            ...choice(
              "Mode",
              () => curveOptions,
              () => pattern().aimCurve,
              (value: Curve) => {
                pattern().aimCurve = value;
              },
            ),
            shown: () => pattern().frame === "subjective",
          },
          ...derivativeNames.map((name: string, order: number) => ({
            ...slider(
              name,
              -angleLimit,
              angleLimit,
              5,
              () => pattern().angleDerivatives[order] ?? 0,
              (value: number) => {
                pattern().angleDerivatives[order] = value;
              },
            ),
            shown: () =>
              pattern().frame === "subjective" &&
              pattern().aimCurve === "polynomial" &&
              pattern().angleDerivatives.length > order,
          })),
          {
            ...derivativeActions(
              () => pattern().angleDerivatives,
              derivativeNames,
              () => 0,
            ),
            shown: () =>
              pattern().frame === "subjective" &&
              pattern().aimCurve === "polynomial",
          },
          ...waveRows(
            () => pattern().aimWaves,
            (name: string, get: () => number, set: (value: number) => void) =>
              slider(name, -phaseLimit, phaseLimit, 5, get, set),
            () => angleAmplitude,
            () =>
              pattern().frame === "subjective" &&
              pattern().aimCurve === "sinusoidal",
          ),
        ]),
      ),
      ...section("Fire", [
        slider(
          "Rate",
          0.5,
          20,
          0.5,
          () => pattern().rate,
          (value: number) => {
            pattern().rate = value;
          },
        ),
        {
          ...slider(
            "Speed",
            20,
            400,
            5,
            () => pattern().speed,
            (value: number) => {
              pattern().speed = value;
            },
          ),
          shown: () => pattern().frame === "subjective",
        },
        {
          ...vector(
            "Speed",
            -speedLimit,
            speedLimit,
            5,
            () => pattern().velocity,
            (value: Vector) => {
              pattern().velocity = value;
            },
          ),
          shown: () => pattern().frame === "objective",
        },
        choice(
          "Mode",
          () => curveOptions,
          () => pattern().curve,
          (value: Curve) => {
            pattern().curve = value;
          },
        ),
        ...speedNames.map((name: string, order: number) => ({
          ...slider(
            name,
            -speedLimit,
            speedLimit,
            5,
            () => pattern().speedDerivatives[order] ?? 0,
            (value: number) => {
              pattern().speedDerivatives[order] = value;
            },
          ),
          shown: () =>
            pattern().frame === "subjective" &&
            pattern().curve === "polynomial" &&
            pattern().speedDerivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => pattern().speedDerivatives,
            speedNames,
            () => 0,
          ),
          shown: () =>
            pattern().frame === "subjective" &&
            pattern().curve === "polynomial",
        },
        ...speedNames.map((name: string, order: number) => ({
          ...vector(
            name,
            -speedLimit,
            speedLimit,
            5,
            () => pattern().driftDerivatives[order] ?? { x: 0, y: 0 },
            (value: Vector) => {
              pattern().driftDerivatives[order] = value;
            },
          ),
          shown: () =>
            pattern().frame === "objective" &&
            pattern().curve === "polynomial" &&
            pattern().driftDerivatives.length > order,
        })),
        {
          ...derivativeActions(
            () => pattern().driftDerivatives,
            speedNames,
            () => ({ x: 0, y: 0 }),
          ),
          shown: () =>
            pattern().frame === "objective" && pattern().curve === "polynomial",
        },
        ...waveRows(
          () => pattern().angleWaves,
          (name: string, get: () => number, set: (value: number) => void) =>
            slider(name, -phaseLimit, phaseLimit, 5, get, set),
          () => angleAmplitude,
          () =>
            pattern().frame === "subjective" &&
            pattern().curve === "sinusoidal",
        ),
        ...waveRows(
          () => pattern().swayWaves,
          (name: string, get: () => Vector, set: (value: Vector) => void) =>
            vector(name, -swayLimit, swayLimit, 5, get, set),
          () => ({ x: waveAmplitude, y: 0 }),
          () =>
            pattern().frame === "objective" && pattern().curve === "sinusoidal",
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setPattern(pattern());
    },
  );
}

export { addPatternTab };
