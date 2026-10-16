import type { Ring } from "../../types";
import { defaultRing } from "../../defaults";
import { brightColors } from "../swatches";
import type { Studio } from "../studio";

const ringMin: number = 10; // units
const ringMax: number = 220; // units
const ringShrink: number = 40; // units
const spinLimit: number = 180; // deg/s

function addSigilTab(studio: Studio): void {
  const { creations, preview, cursor, addTab, changed, refresh } = studio;
  const { slider, choice, colors, section, actionRow } = studio.kit;
  const { sigil, ring } = studio.pick;

  function selectRing(index: number): void {
    cursor.ring = index;
    refresh();
  }

  addTab(
    "sigil",
    () => creations.sigils,
    [
      ...section("Look", [
        colors(
          "Colour",
          brightColors,
          () => sigil().color,
          (value: string) => {
            sigil().color = value;
          },
        ),
        slider(
          "Opacity",
          0.1,
          1,
          0.05,
          () => sigil().opacity,
          (value: number) => {
            sigil().opacity = value;
          },
        ),
      ]),
      ...section("Rings", [
        actionRow(
          "Add ring",
          () => {
            const source: Ring | undefined = sigil().rings[cursor.ring];

            sigil().rings.push(
              source === undefined
                ? defaultRing()
                : {
                    ...source,
                    radius: Math.max(source.radius - ringShrink, ringMin),
                    spin: -source.spin,
                  },
            );
            changed();
            selectRing(sigil().rings.length - 1);
          },
          "Remove ring",
          () => {
            if (sigil().rings.length <= 1) {
              return;
            }

            sigil().rings.splice(cursor.ring, 1);
            changed();
            selectRing(Math.max(cursor.ring - 1, 0));
          },
        ),
        choice(
          "Ring",
          () =>
            sigil().rings.map((value: Ring, index: number) => ({
              value: index,
              label: "Ring " + (index + 1) + "  ·  " + value.radius,
            })),
          () => cursor.ring,
          (value: number) => selectRing(value),
        ),
      ]),
      ...section("Shape", [
        slider(
          "Radius",
          ringMin,
          ringMax,
          5,
          () => ring().radius,
          (value: number) => {
            ring().radius = value;
          },
        ),
        slider(
          "Points",
          0,
          12,
          1,
          () => ring().points,
          (value: number) => {
            ring().points = value;
          },
        ),
        slider(
          "Step",
          1,
          5,
          1,
          () => ring().step,
          (value: number) => {
            ring().step = value;
          },
        ),
        slider(
          "Ticks",
          0,
          72,
          2,
          () => ring().ticks,
          (value: number) => {
            ring().ticks = value;
          },
        ),
        slider(
          "Orbs",
          0,
          0.2,
          0.01,
          () => ring().orb,
          (value: number) => {
            ring().orb = value;
          },
        ),
      ]),
      ...section("Motion", [
        slider(
          "Spin",
          -spinLimit,
          spinLimit,
          5,
          () => ring().spin,
          (value: number) => {
            ring().spin = value;
          },
        ),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(false);
      preview.setSigil(sigil());
    },
  );
}

export { addSigilTab };
