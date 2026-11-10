import type { Build, Enemy, VesselLook } from "../../types";
import { defaultEnemy, vesselScales } from "../../defaults";
import { rebuildVessel, rescaleVessel } from "../../vessel";
import {
  coreParts,
  engineParts,
  finParts,
  glowColors,
  gunParts,
  hullColors,
  hulls,
  liveries,
  metalColors,
  randomBuild,
  trimColors,
  wingParts,
} from "../../hangar";
import { spriteSize } from "../../../editor/drawings";
import type { Control, Option } from "../../../ui/widgets";
import type { Studio } from "../studio";

type Numbers = {
  [K in keyof Build]: Build[K] extends number ? K : never;
}[keyof Build];

type Colors = {
  [K in keyof Build]: Build[K] extends string
    ? string extends Build[K]
      ? K
      : never
    : never;
}[keyof Build];

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
const lookOptions: Array<Option<VesselLook>> = [
  { value: "built", label: "Customised" },
  { value: "drawn", label: "Drawn" },
];

function vesselDemo(vessel: string | null): Enemy {
  return { ...defaultEnemy(null), vessel: vessel, size: demoSize };
}

function addVesselTab(studio: Studio): void {
  const { creations, preview, addTab, paintVessel, changed, refresh } = studio;
  const { section, choice, slider, colors, actionRow } = studio.kit;
  const { vessel } = studio.pick;
  const demo: Enemy = vesselDemo(null);
  const built: () => boolean = () => vessel().look === "built";

  function part<K extends keyof Build>(
    name: string,
    list: Array<Option<Build[K]>>,
    key: K,
  ): Control {
    return choice(
      name,
      () => list,
      () => vessel().build[key],
      (value: Build[K]) => {
        vessel().build[key] = value;
        rebuildVessel(vessel());
      },
    );
  }

  function amount(
    name: string,
    key: Numbers,
    min: number,
    max: number,
    step: number,
    shown: () => boolean = () => true,
  ): Control {
    return {
      ...slider(
        name,
        min,
        max,
        step,
        () => vessel().build[key],
        (value: number) => {
          vessel().build[key] = value;
          rebuildVessel(vessel());
        },
      ),
      shown: shown,
    };
  }

  function paint(name: string, list: Array<string>, key: Colors): Control {
    return colors(
      name,
      list,
      () => vessel().build[key],
      (value: string) => {
        vessel().build[key] = value;
        rebuildVessel(vessel());
      },
    );
  }

  function randomise(): void {
    vessel().build = randomBuild();
    vessel().look = "built";
    rebuildVessel(vessel());
    changed();
    refresh();
  }

  addTab(
    "vessel",
    () => creations.vessels,
    [
      ...section("Sprite", [
        choice(
          "Look",
          () => lookOptions,
          () => vessel().look,
          (value: VesselLook) => {
            vessel().look = value;
            rebuildVessel(vessel());
          },
        ),
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
        actionRow("Randomise", randomise, "Draw sprite", paintVessel),
      ]),
      ...section(
        "Hull",
        [
          part("Hull", hulls, "hull"),
          amount("Length (%)", "length", 40, 90, 5),
          amount("Width (%)", "width", 15, 60, 5),
        ],
        built,
      ),
      ...section(
        "Wings",
        [
          part("Wings", wingParts, "wings"),
          amount(
            "Span (%)",
            "span",
            30,
            100,
            5,
            () => vessel().build.wings !== "none",
          ),
          amount(
            "Sweep (%)",
            "sweep",
            -100,
            100,
            10,
            () => vessel().build.wings !== "none",
          ),
          amount(
            "Position (%)",
            "wingSpot",
            -50,
            50,
            10,
            () => vessel().build.wings !== "none",
          ),
        ],
        built,
      ),
      ...section(
        "Engines",
        [
          part("Engines", engineParts, "engines"),
          amount(
            "Count",
            "engineCount",
            1,
            3,
            1,
            () =>
              vessel().build.engines === "nozzle" ||
              vessel().build.engines === "nacelle",
          ),
          amount(
            "Engine size (%)",
            "engineSize",
            50,
            150,
            10,
            () => vessel().build.engines !== "none",
          ),
        ],
        built,
      ),
      ...section(
        "Guns",
        [
          part("Guns", gunParts, "guns"),
          amount(
            "Gun length (%)",
            "gunLength",
            50,
            150,
            10,
            () => vessel().build.guns !== "none",
          ),
        ],
        built,
      ),
      ...section(
        "Details",
        [
          part("Fins", finParts, "fins"),
          part("Core", coreParts, "core"),
          amount(
            "Core position (%)",
            "coreSpot",
            -50,
            60,
            10,
            () => vessel().build.core !== "none",
          ),
          part("Livery", liveries, "livery"),
        ],
        built,
      ),
      ...section(
        "Paint",
        [
          paint("Hull colour", hullColors, "hullColor"),
          paint("Trim colour", trimColors, "trimColor"),
          paint("Metal colour", metalColors, "metalColor"),
          paint("Glow colour", glowColors, "glowColor"),
        ],
        built,
      ),
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
