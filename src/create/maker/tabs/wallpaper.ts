import { wallColors } from "../swatches";
import type { Studio } from "../studio";

const stripeMax: number = 12; // units

function addWallpaperTab(studio: Studio): void {
  const { creations, preview, addTab, spriteRow, cosmeticSection } = studio;
  const { slider, colors, section } = studio.kit;
  const { wallpaper } = studio.pick;

  addTab(
    "wallpaper",
    () => creations.wallpapers,
    [
      ...cosmeticSection("wallpaper"),
      ...section("Look", [
        spriteRow(),
        colors(
          "Base",
          wallColors,
          () => wallpaper().base,
          (value: string) => {
            wallpaper().base = value;
          },
        ),
        colors(
          "Stripe",
          wallColors,
          () => wallpaper().stripe,
          (value: string) => {
            wallpaper().stripe = value;
          },
        ),
        slider(
          "Stripe width",
          0,
          stripeMax,
          1,
          () => wallpaper().stripes,
          (value: number) => {
            wallpaper().stripes = value;
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
