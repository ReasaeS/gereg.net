import { Container, Sprite, type Texture } from "pixi.js";
import { archetype, type Archetype } from "./archetype";
import {
  droneShotDrawing,
  shotDrawing,
  type Drawing,
} from "../editor/drawings";

type Offset = {
  x: number; // units
  y: number; // units
};

type Formation = {
  normal: Array<Offset>;
  focused: Array<Offset>;
};

type DroneSettings = {
  spin: number; // deg/s
  mainColor: string;
  shotColor: string;
};

type Shot = {
  view: Sprite;
  x: number; // units
  y: number; // units
  vx: number; // units/s
  vy: number; // units/s
  damage: number;
  homing: boolean;
  spent: boolean;
};

type Target = {
  x: number; // units
  y: number; // units
};

type Drone = {
  view: Sprite;
  x: number; // units
  y: number; // units
};

type Squad = {
  view: Container;
  shotLayer: Container;
  shots: Array<Shot>;
  setPower: (value: number) => void;
  setDrones: (shown: boolean) => void;
  update: (
    delta: number,
    x: number,
    y: number,
    focused: boolean,
    shooting: boolean,
    targets?: Array<Target>,
  ) => void;
  clear: () => void;
};

const storageKey: string = "geregnet.drones";
const minPower: number = 1;
const maxPower: number = 4;
const mainRate: number = 20; // Hz
const mainGap: number = 6; // units
const mainDamage: number = 1;
const shotScale: number = 0.5; // units/px
const shotAlpha: number = 0.85;
const shotMargin: number = 24; // units
const muzzle: number = 10; // units
const follow: number = 14; // 1/s
const spreadReach: number = 40; // units
const shotSpeed: number = 840; // units/s
const up: number = -Math.PI / 2; // rad
const droneSize: number = 14; // units
const formations: Array<Formation> = [
  {
    normal: [{ x: 0, y: -30 }],
    focused: [{ x: 0, y: -24 }],
  },
  {
    normal: [
      { x: -28, y: -4 },
      { x: 28, y: -4 },
    ],
    focused: [
      { x: -12, y: -24 },
      { x: 12, y: -24 },
    ],
  },
  {
    normal: [
      { x: -32, y: 4 },
      { x: 0, y: -30 },
      { x: 32, y: 4 },
    ],
    focused: [
      { x: -16, y: -22 },
      { x: 0, y: -30 },
      { x: 16, y: -22 },
    ],
  },
  {
    normal: [
      { x: -36, y: 6 },
      { x: -18, y: -24 },
      { x: 18, y: -24 },
      { x: 36, y: 6 },
    ],
    focused: [
      { x: -20, y: -18 },
      { x: -8, y: -28 },
      { x: 8, y: -28 },
      { x: 20, y: -18 },
    ],
  },
];
let settings: DroneSettings = defaultDrones();

function defaultDrones(): DroneSettings {
  return {
    spin: 180,
    mainColor: "#ff8a80",
    shotColor: "#7ad8ff",
  };
}

function loadDrones(): void {
  const fallback: DroneSettings = defaultDrones();

  try {
    const saved: string | null = localStorage.getItem(storageKey);

    if (saved === null) {
      return;
    }

    const parsed: Partial<DroneSettings> = JSON.parse(
      saved,
    ) as Partial<DroneSettings>;

    settings = {
      spin: parsed.spin ?? fallback.spin,
      mainColor: parsed.mainColor ?? fallback.mainColor,
      shotColor: parsed.shotColor ?? fallback.shotColor,
    };
  } catch {
    settings = fallback;
  }
}

function saveDrones(): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    console.warn("Could not save the drones");
  }
}

function resetDrones(): void {
  settings = defaultDrones();
  saveDrones();
}

function droneSettings(): DroneSettings {
  return settings;
}

function clampPower(power: number): number {
  return Math.max(Math.min(power, maxPower), minPower);
}

function droneCount(power: number): number {
  return Math.floor(clampPower(power));
}

function createSquad(
  droneTexture: Texture,
  width: number,
  height: number,
): Squad {
  const view: Container = new Container();
  const shotLayer: Container = new Container();
  const shots: Array<Shot> = new Array();
  const drones: Array<Drone> = new Array();
  let mainTimer: number = 0;
  let droneTimer: number = 0;
  let spin: number = 0;
  let power: number = maxPower;
  let dronesShown: boolean = true;

  function addShot(
    x: number,
    y: number,
    angle: number,
    color: string,
    damage: number,
    drawing: Drawing,
    homing: boolean,
  ): void {
    const sprite: Sprite = new Sprite(drawing.texture);

    sprite.anchor.set(0.5);
    sprite.scale.set(shotScale);
    sprite.tint = drawing.custom ? "#ffffff" : color;
    sprite.alpha = shotAlpha;
    sprite.rotation = angle - up;
    shotLayer.addChild(sprite);
    shots.push({
      view: sprite,
      x: x,
      y: y,
      vx: Math.cos(angle) * shotSpeed,
      vy: Math.sin(angle) * shotSpeed,
      damage: damage,
      homing: homing,
      spent: false,
    });
  }

  function arrange(count: number, x: number, y: number): void {
    while (drones.length > count) {
      drones.pop()!.view.destroy();
    }

    while (drones.length < count) {
      const sprite: Sprite = new Sprite(droneTexture);

      sprite.anchor.set(0.5);
      view.addChild(sprite);
      drones.push({ view: sprite, x: 0, y: 0 });
    }

    for (const drone of drones) {
      drone.view.position.set(x + drone.x, y + drone.y);
    }
  }

  function moveDrones(
    delta: number,
    x: number,
    y: number,
    focused: boolean,
  ): void {
    const count: number = dronesShown ? droneCount(power) : 0;
    const formation: Formation | undefined = formations[count - 1];
    const pull: number = 1 - Math.exp(-follow * delta);
    const scale: number =
      droneSize / Math.max(droneTexture.width, droneTexture.height, 1);

    spin += ((settings.spin * Math.PI) / 180) * delta;

    for (let index = 0; index < count; index++) {
      const drone: Drone | undefined = drones[index];
      const target: Offset = (focused
        ? formation?.focused[index]
        : formation?.normal[index]) ?? { x: 0, y: 0 };

      if (drone === undefined) {
        break;
      }

      drone.x += (target.x - drone.x) * pull;
      drone.y += (target.y - drone.y) * pull;
      drone.view.scale.set(scale);
      drone.view.rotation = spin;
    }

    arrange(count, x, y);
  }

  function fire(
    delta: number,
    x: number,
    y: number,
    focused: boolean,
    shooting: boolean,
  ): void {
    const style: Archetype = archetype();
    const mainInterval: number = 1 / mainRate;
    const droneInterval: number = 1 / style.droneRate;

    if (!shooting) {
      mainTimer = mainInterval;
      droneTimer = droneInterval;
      return;
    }

    mainTimer += delta;
    droneTimer += delta;

    while (mainTimer >= mainInterval) {
      mainTimer -= mainInterval;

      for (const side of [-1, 1]) {
        addShot(
          x + side * mainGap,
          y - muzzle,
          up,
          settings.mainColor,
          mainDamage,
          shotDrawing(),
          false,
        );
      }
    }

    while (droneTimer >= droneInterval) {
      droneTimer -= droneInterval;

      for (const drone of drones) {
        const tilt: number = focused
          ? 0
          : Math.max(Math.min(drone.x / spreadReach, 1), -1) *
            ((style.spread * Math.PI) / 180);

        addShot(
          x + drone.x,
          y + drone.y,
          up + tilt,
          settings.shotColor,
          style.droneDamage,
          droneShotDrawing(),
          style.homing && !focused,
        );
      }
    }
  }

  function steer(shot: Shot, targets: Array<Target>): void {
    let nearest: Target | null = null;
    let best: number = Infinity;

    for (const target of targets) {
      const distance: number =
        (target.x - shot.x) ** 2 + (target.y - shot.y) ** 2;

      if (distance < best) {
        best = distance;
        nearest = target;
      }
    }

    if (nearest === null) {
      return;
    }

    const speed: number = Math.hypot(shot.vx, shot.vy);
    const heading: number = Math.atan2(nearest.y - shot.y, nearest.x - shot.x);

    shot.vx = Math.cos(heading) * speed;
    shot.vy = Math.sin(heading) * speed;
    shot.view.rotation = heading - up;
  }

  function moveShots(delta: number, targets: Array<Target>): void {
    let write: number = 0;

    for (let index = 0; index < shots.length; index++) {
      const shot: Shot = shots[index]!;

      if (shot.homing) {
        steer(shot, targets);
      }

      shot.x += shot.vx * delta;
      shot.y += shot.vy * delta;
      shot.view.position.set(shot.x, shot.y);

      if (
        shot.x < -shotMargin ||
        shot.y < -shotMargin ||
        shot.x > width + shotMargin ||
        shot.y > height + shotMargin
      ) {
        shot.spent = true;
      }

      if (shot.spent) {
        shot.view.destroy();
        continue;
      }

      shots[write++] = shot;
    }

    shots.length = write;
  }

  function update(
    delta: number,
    x: number,
    y: number,
    focused: boolean,
    shooting: boolean,
    targets: Array<Target> = new Array(),
  ): void {
    moveDrones(delta, x, y, focused);
    fire(delta, x, y, focused, shooting);
    moveShots(delta, targets);
  }

  function setPower(value: number): void {
    power = clampPower(value);
  }

  function clear(): void {
    for (const shot of shots) {
      shot.view.destroy();
    }

    shots.length = 0;
    arrange(0, 0, 0);
  }

  return {
    view: view,
    shotLayer: shotLayer,
    shots: shots,
    setPower: setPower,
    setDrones: (shown: boolean) => {
      dronesShown = shown;
    },
    update: update,
    clear: clear,
  };
}

loadDrones();

export {
  minPower,
  maxPower,
  clampPower,
  defaultDrones,
  saveDrones,
  resetDrones,
  droneSettings,
  droneCount,
  createSquad,
};
export type { Offset, Formation, DroneSettings, Shot, Target, Squad };
