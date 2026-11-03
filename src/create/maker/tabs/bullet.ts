import type { Look, Pattern, Shape } from "../../types";
import { defaultPattern } from "../../defaults";
import type { Option } from "../../../ui/widgets";
import { brightColors } from "../swatches";
import type { Studio } from "../studio";

const lengthMax: number = 3; // of width
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
  const { slider, colors, choice, section, buttonRow } = studio.kit;
  const { bullet } = studio.pick;

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
        "Energy",
        [
          colors(
            "Glow",
            brightColors,
            () => bullet().glow,
            (value: string) => {
              bullet().glow = value;
            },
          ),
          colors(
            "Core",
            brightColors,
            () => bullet().core,
            (value: string) => {
              bullet().core = value;
            },
          ),
          slider(
            "Core size",
            0.1,
            1,
            0.05,
            () => bullet().coreSize,
            (value: number) => {
              bullet().coreSize = value;
            },
          ),
          slider(
            "Glow size",
            0,
            1,
            0.05,
            () => bullet().glowSize,
            (value: number) => {
              bullet().glowSize = value;
            },
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
