import type { Blend, Glow, Look, Pattern, Shape } from "../../types";
import { defaultPattern } from "../../defaults";
import type { Control, Option } from "../../../ui/widgets";
import { getTheme } from "../../../theme/theme";
import { brightColors } from "../swatches";
import type { Studio } from "../studio";

const lengthMax: number = 3; // of width
const glowLimit: number = 12;
const glowNames: Array<string> = new Array(glowLimit)
  .fill("")
  .map((_: string, index: number) => "glow " + (index + 1));
const glowColors: Array<string> = [...brightColors, getTheme().bullets];
const blendOptions: Array<Option<Blend>> = [
  { value: "normal", label: "Normal" },
  { value: "light", label: "Light" },
];
const demoSize: number = 26; // units
const lookOptions: Array<Option<Look>> = [
  { value: "energy", label: "Energy" },
  { value: "sprite", label: "Sprite" },
];
const shapeOptions: Array<Option<Shape>> = [
  { value: "orb", label: "Orb" },
  { value: "rice", label: "Rice" },
  { value: "star", label: "Star" },
  { value: "kunai", label: "Kunai" },
  { value: "ring", label: "Ring" },
  { value: "heart", label: "Heart" },
  { value: "diamond", label: "Diamond" },
];

function bulletDemo(bullet: string): Pattern {
  return {
    ...defaultPattern(),
    bullet: bullet,
    size: demoSize,
    count: 12,
    rate: 1.5,
    speed: 90,
    angleDerivatives: [20],
  };
}

function addBulletTab(studio: Studio): void {
  const { creations, preview, addTab, paintBullet } = studio;
  const { slider, colors, choice, section, buttonRow, derivativeActions } =
    studio.kit;
  const { bullet } = studio.pick;

  function glowRows(order: number): Array<Control> {
    const name: string = "Glow " + (order + 1);
    const shown: () => boolean = () => bullet().glows.length > order;
    const glow: () => Glow = () =>
      bullet()?.glows[order] ?? {
        color: "#ffffff",
        size: 1,
        opacity: 100,
        softness: 0,
        blend: "normal",
      };

    return [
      {
        ...colors(
          name,
          glowColors,
          () => glow().color,
          (value: string) => {
            glow().color = value;
          },
        ),
        shown: shown,
      },
      {
        ...choice(
          name + " blend",
          () => blendOptions,
          () => glow().blend,
          (value: Blend) => {
            glow().blend = value;
          },
        ),
        shown: shown,
      },
      {
        ...slider(
          name + " size",
          0.05,
          1,
          0.01,
          () => glow().size,
          (value: number) => {
            glow().size = value;
          },
        ),
        shown: shown,
      },
      {
        ...slider(
          name + " opacity (%)",
          0,
          100,
          1,
          () => glow().opacity,
          (value: number) => {
            glow().opacity = value;
          },
        ),
        shown: shown,
      },
      {
        ...slider(
          name + " softness",
          0,
          1,
          0.05,
          () => glow().softness,
          (value: number) => {
            glow().softness = value;
          },
        ),
        shown: shown,
      },
    ];
  }

  addTab(
    "bullet",
    () => creations.bullets,
    [
      ...section("Look", [
        choice(
          "Look",
          () => lookOptions,
          () => bullet().look,
          (value: Look) => {
            bullet().look = value;
          },
        ),
        {
          ...buttonRow("Draw sprite", paintBullet),
          shown: () => bullet().look === "sprite",
        },
      ]),
      ...section(
        "Shape",
        [
          choice(
            "Shape",
            () => shapeOptions,
            () => bullet().shape,
            (value: Shape) => {
              bullet().shape = value;
            },
          ),
          slider(
            "Length",
            1,
            lengthMax,
            0.1,
            () => bullet().length,
            (value: number) => {
              bullet().length = value;
            },
          ),
        ],
        () => bullet().look === "energy",
      ),
      ...section(
        "Glows",
        [
          ...new Array(glowLimit)
            .fill(0)
            .flatMap((_: number, order: number) => glowRows(order)),
          derivativeActions(
            () => bullet().glows,
            glowNames,
            (): Glow => ({
              color: "#ffffff",
              size: 0.5,
              opacity: 100,
              softness: 0.2,
              blend: "light",
            }),
          ),
        ],
        () => bullet().look === "energy",
      ),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setPattern(bulletDemo(bullet().id));
    },
  );
}

export { addBulletTab, bulletDemo };
