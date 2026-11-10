import type { Parallax, SceneKind, Scenery } from "../../types";
import {
  defaultScenery,
  newSeed,
  randomizeBackground,
  sceneColors,
  sceneKinds,
} from "../../scenery";
import { skyColors } from "../swatches";
import type { Control, Option } from "../../../ui/widgets";
import type { Studio } from "../studio";

type Source = "scene" | "image";

const layerLimit: number = 6;
const sourceOptions: Array<Option<Source>> = [
  { value: "scene", label: "Scenery" },
  { value: "image", label: "Image" },
];

function addBackgroundTab(studio: Studio): void {
  const { creations, preview, addTab, spriteRow, changed, refresh } = studio;
  const { slider, colors, section, choice, actionRow } = studio.kit;
  const { background } = studio.pick;
  const blank: Parallax = {
    sprite: null,
    scene: null,
    scroll: 0,
    drift: 0,
    opacity: 1,
  };
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

  function scenic(): boolean {
    return hasLayers() && layer().scene !== null;
  }

  function scene(): Scenery {
    return layer().scene ?? defaultScenery();
  }

  function sceneRow(control: Control): Control {
    return { ...control, shown: scenic };
  }

  function layerName(value: Parallax): string {
    return value.scene !== null
      ? sceneKinds.find(
          (option: Option<SceneKind>) => option.value === value.scene!.kind,
        )!.label
      : value.sprite === null
        ? "No sprite"
        : "Image";
  }

  addTab(
    "background",
    () => creations.backgrounds,
    [
      ...section("Look", [
        actionRow("Randomise", () => {
          randomizeBackground(background());
          selected = 0;
          changed();
          restyle();
          refresh();
        }),
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
      ...section(
        "Layers",
        [
          actionRow(
            "Add layer",
            () => {
              if (background().layers.length >= layerLimit) {
                return;
              }

              background().layers.push({
                sprite: null,
                scene: defaultScenery(),
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
                  label: "Layer " + (index + 1) + "  ·  " + layerName(value),
                })),
              () => selected,
              (value: number) => {
                selected = value;
              },
            ),
            shown: hasLayers,
          },
          {
            ...choice(
              "Layer source",
              () => sourceOptions,
              (): Source => (layer().scene === null ? "image" : "scene"),
              (value: Source) => {
                layer().scene = value === "scene" ? defaultScenery() : null;
                restyle();
              },
            ),
            shown: hasLayers,
          },
          {
            ...spriteRow("Layer sprite", layer),
            shown: () => hasLayers() && layer().scene === null,
          },
          sceneRow(
            choice(
              "Scenery",
              () => sceneKinds,
              () => scene().kind,
              (value: SceneKind) => {
                scene().kind = value;
                restyle();
              },
            ),
          ),
          sceneRow(
            colors(
              "Scenery colour",
              sceneColors,
              () => scene().color,
              (value: string) => {
                scene().color = value;
                restyle();
              },
            ),
          ),
          sceneRow(
            colors(
              "Scenery accent",
              sceneColors,
              () => scene().accent,
              (value: string) => {
                scene().accent = value;
                restyle();
              },
            ),
          ),
          sceneRow(
            slider(
              "Density (%)",
              5,
              100,
              5,
              () => scene().density,
              (value: number) => {
                scene().density = value;
                restyle();
              },
            ),
          ),
          sceneRow(
            slider(
              "Detail size (%)",
              25,
              300,
              5,
              () => scene().size,
              (value: number) => {
                scene().size = value;
                restyle();
              },
            ),
          ),
          sceneRow(
            actionRow("New layout", () => {
              scene().seed = newSeed();
              changed();
              restyle();
              refresh();
            }),
          ),
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
        ],
        () => true,
        false,
      ),
    ],
    () => {
      preview.setBackground(background());
      preview.setPlayerVisible(false);
      preview.setPattern(null);
    },
  );
}

export { addBackgroundTab };
