import type { Enemy } from "../../types";
import { defaultEnemy, vesselScales } from "../../defaults";
import { rescaleVessel } from "../../vessel";
import { spriteSize } from "../../../editor/drawings";
import type { Option } from "../../../ui/widgets";
import type { Studio } from "../studio";

const demoSize: number = 72; // units
const scaleOptions: Array<Option<number>> = vesselScales.map(
  (value: number) => ({
    value: value,
    label:
      value +
      "×  ·  " +
      spriteSize * value +
      " × " +
      spriteSize * value +
      " px",
  }),
);

function vesselDemo(vessel: string | null): Enemy {
  return { ...defaultEnemy(null), vessel: vessel, size: demoSize };
}

function addVesselTab(studio: Studio): void {
  const { creations, preview, addTab, paintVessel } = studio;
  const { section, choice, buttonRow } = studio.kit;
  const { vessel } = studio.pick;
  const demo: Enemy = vesselDemo(null);

  addTab(
    "vessel",
    () => creations.vessels,
    [
      ...section("Sprite", [
        choice(
          "Scale",
          () => scaleOptions,
          () => vessel().scale,
          (value: number) => {
            if (value !== vessel().scale) {
              rescaleVessel(vessel(), value);
            }
          },
        ),
        buttonRow("Draw sprite", paintVessel),
      ]),
    ],
    () => {
      preview.setBackground(null);
      preview.setPlayerVisible(true);
      demo.vessel = vessel().id;
      preview.setEnemy(demo, null);
    },
  );
}

export { addVesselTab, vesselDemo };
