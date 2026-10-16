import { menuColors } from "../swatches";
import type { Studio } from "../studio";

function addPaletteTab(studio: Studio): void {
  const { creations, preview, addTab, cosmeticSection, showPalette } = studio;
  const { colors, section } = studio.kit;
  const { palette } = studio.pick;

  addTab(
    "palette",
    () => creations.palettes,
    [
      ...cosmeticSection("palette"),
      ...section("Colours", [
        colors(
          "Accent",
          menuColors,
          () => palette().accent,
          (value: string) => {
            palette().accent = value;
          },
        ),
        colors(
          "Highlight",
          menuColors,
          () => palette().highlight,
          (value: string) => {
            palette().highlight = value;
          },
        ),
        colors(
          "Text",
          menuColors,
          () => palette().text,
          (value: string) => {
            palette().text = value;
          },
        ),
        colors(
          "Labels",
          menuColors,
          () => palette().label,
          (value: string) => {
            palette().label = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setPattern(null);
      showPalette();
    },
  );
}

export { addPaletteTab };
