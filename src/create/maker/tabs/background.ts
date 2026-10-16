import { skyColors } from "../swatches";
import type { Studio } from "../studio";

function addBackgroundTab(studio: Studio): void {
  const { creations, preview, addTab, spriteRow, cosmeticSection } = studio;
  const { slider, colors, section } = studio.kit;
  const { background } = studio.pick;

  addTab(
    "background",
    () => creations.backgrounds,
    [
      ...cosmeticSection("background"),
      ...section("Look", [
        spriteRow(),
        colors(
          "Top",
          skyColors,
          () => background().top,
          (value: string) => {
            background().top = value;
          },
        ),
        colors(
          "Bottom",
          skyColors,
          () => background().bottom,
          (value: string) => {
            background().bottom = value;
          },
        ),
      ]),
      ...section("Motion", [
        slider(
          "Scroll",
          0,
          400,
          5,
          () => background().scroll,
          (value: number) => {
            background().scroll = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(background());
      preview.setPlayerVisible(false);
      preview.setPattern(null);
    },
  );
}

export { addBackgroundTab };
