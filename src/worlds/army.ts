import { Container, Sprite, type Application, type Texture } from "pixi.js";
import { hudHeight } from "../game/field";
import { defaultPlayerTexture } from "../editor/drawings";

type Ship = {
  sprite: Sprite;
  x: number; // units
  y: number; // units
  phase: number; // rad
};

type Army = {
  view: Container;
  layout: () => void;
  update: (delta: number) => void;
};

const armyAngle: number = Math.PI / 6; // rad
const armyAlpha: number = 0.55;
const shipScale: number = 1.25;
const columnGap: number = 64; // units
const rowGap: number = 72; // units
const flySpeed: number = 40; // units/s
const bobAmount: number = 4; // units
const bobSpeed: number = 1.2; // rad/s

function createArmy(app: Application): Army {
  const view: Container = new Container();
  const field: Container = new Container();
  const texture: Texture = defaultPlayerTexture();
  let ships: Array<Ship> = new Array();
  let span: number = 0;
  let offset: number = 0;
  let time: number = 0;

  function layout(): void {
    const scale: number = app.screen.height / hudHeight;
    const reach: number = Math.hypot(app.screen.width, app.screen.height);
    const columns: number = Math.ceil(reach / scale / columnGap) + 2;
    const rows: number = Math.ceil(reach / scale / rowGap) + 2;

    for (const ship of ships) {
      ship.sprite.destroy();
    }

    ships = new Array();
    span = rows * rowGap;

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const sprite: Sprite = new Sprite(texture);

        sprite.anchor.set(0.5);
        sprite.scale.set(shipScale);
        field.addChild(sprite);
        ships.push({
          sprite: sprite,
          x:
            (column - columns / 2) * columnGap +
            (row % 2 === 0 ? 0 : columnGap / 2),
          y: row * rowGap,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    field.scale.set(scale);
    field.position.set(app.screen.width / 2, app.screen.height / 2);
    update(0);
  }

  function update(delta: number): void {
    time += delta;
    offset = (offset + flySpeed * delta) % span;

    for (const ship of ships) {
      ship.sprite.position.set(
        ship.x,
        ((((ship.y - offset) % span) + span) % span) -
          span / 2 +
          Math.sin(time * bobSpeed + ship.phase) * bobAmount,
      );
    }
  }

  field.rotation = armyAngle;
  view.addChild(field);
  view.alpha = armyAlpha;
  view.eventMode = "none";
  layout();

  return { view: view, layout: layout, update: update };
}

export { createArmy };
export type { Army };
