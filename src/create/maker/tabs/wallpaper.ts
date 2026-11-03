import type { Motif } from "../../types";
import type { Option } from "../../../ui/widgets";
import { wallColors } from "../swatches";
import type { Studio } from "../studio";

const sizeMax: number = 24; // units
const spacingMin: number = 4; // units
const spacingMax: number = 48; // units
const angleLimit: number = 90; // deg
const angleStep: number = 5; // deg
const motifOptions: Array<Option<Motif>> = [
  { value: "stripes", label: "Stripes" },
  { value: "checks", label: "Checks" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "diamonds", label: "Diamonds" },
  { value: "zigzag", label: "Zigzag" },
  { value: "waves", label: "Waves" },
];

function addWallpaperTab(studio: Studio): void {
  const { creations, preview, addTab } = studio;
  const { slider, colors, choice, section } = studio.kit;
  const { wallpaper } = studio.pick;

  addTab(
    "wallpaper",
    () => creations.wallpapers,
    [
      ...section("Look", [
        colors(
          "Base",
          wallColors,
          () => wallpaper().base,
          (value: string) => {
            wallpaper().base = value;
          },
        ),
        colors(
          "Ink",
          wallColors,
          () => wallpaper().ink,
          (value: string) => {
            wallpaper().ink = value;
          },
        ),
      ]),
      ...section("Pattern", [
        choice(
          "Motif",
          () => motifOptions,
          () => wallpaper().motif,
          (value: Motif) => {
            wallpaper().motif = value;
          },
        ),
        slider(
          "Size",
          0,
          sizeMax,
          1,
          () => wallpaper().size,
          (value: number) => {
            wallpaper().size = value;
          },
        ),
        slider(
          "Spacing",
          spacingMin,
          spacingMax,
          1,
          () => wallpaper().spacing,
          (value: number) => {
            wallpaper().spacing = value;
          },
        ),
        slider(
          "Angle",
          -angleLimit,
          angleLimit,
          angleStep,
          () => wallpaper().angle,
          (value: number) => {
            wallpaper().angle = value;
          },
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

export { addWallpaperTab };
