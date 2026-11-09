import type { Parallax } from "../../types";
import { skyColors } from "../swatches";
import type { Studio } from "../studio";

const layerLimit: number = 6;

function addBackgroundTab(studio: Studio): void {
  const { creations, preview, addTab, spriteRow, changed, refresh } = studio;
  const { slider, colors, section, choice, actionRow } = studio.kit;
  const { background } = studio.pick;
  const blank: Parallax = { sprite: null, scroll: 0, drift: 0, opacity: 1 };
  let selected: number = 0;

  function layer(): Parallax {
    const layers: Array<Parallax> = background().layers;

    selected = Math.min(Math.max(selected, 0), Math.max(layers.length - 1, 0));

    return layers[selected] ?? blank;
  }

  function hasLayers(): boolean {
    return background().layers.length > 0;
  }

  function restyle(): void {
    preview.setBackground(background());
  }

  addTab(
    "background",
    () => creations.backgrounds,
    [
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
      ...section("Layers", [
        actionRow(
          "Add layer",
          () => {
            if (background().layers.length >= layerLimit) {
              return;
            }

            background().layers.push({
              sprite: null,
              scroll: background().scroll * 2,
              drift: 0,
              opacity: 1,
            });
            selected = background().layers.length - 1;
            changed();
            restyle();
            refresh();
          },
          "Remove layer",
          () => {
            if (!hasLayers()) {
              return;
            }

            background().layers.splice(selected, 1);
            selected = Math.max(selected - 1, 0);
            changed();
            restyle();
            refresh();
          },
        ),
        {
          ...choice(
            "Layer",
            () =>
              background().layers.map((value: Parallax, index: number) => ({
                value: index,
                label:
                  "Layer " +
                  (index + 1) +
                  (value.sprite === null ? "  ·  No sprite" : ""),
              })),
            () => selected,
            (value: number) => {
              selected = value;
            },
          ),
          shown: hasLayers,
        },
        {
          ...spriteRow("Layer sprite", layer),
          shown: hasLayers,
        },
        {
          ...slider(
            "Layer scroll",
            -400,
            400,
            5,
            () => layer().scroll,
            (value: number) => {
              layer().scroll = value;
            },
          ),
          shown: hasLayers,
        },
        {
          ...slider(
            "Layer drift",
            -200,
            200,
            5,
            () => layer().drift,
            (value: number) => {
              layer().drift = value;
            },
          ),
          shown: hasLayers,
        },
        {
          ...slider(
            "Layer opacity",
            0,
            1,
            0.05,
            () => layer().opacity,
            (value: number) => {
              layer().opacity = value;
              restyle();
            },
          ),
          shown: hasLayers,
        },
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
