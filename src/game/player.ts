import type { Graphics, Sprite } from "pixi.js";
import type { Vector } from "../create/types";
import { getTheme } from "../theme/theme";
import { archetype } from "./archetype";

const playerSize: number = 32; // units
const hitboxRadius: number = 3; // units
const hitboxColor: string = "#ff2a4d";

function drawHitbox(hitbox: Graphics): void {
  hitbox
    .clear()
    .circle(0, 0, hitboxRadius + 1)
    .fill(getTheme().highlight)
    .circle(0, 0, hitboxRadius)
    .fill(hitboxColor);
}

function sizePlayer(player: Sprite): void {
  player.anchor.set(0.5);
  player.width = playerSize;
  player.height = playerSize;
}

function movePlayer(
  player: Sprite,
  input: Vector,
  focused: boolean,
  delta: number,
  width: number,
  height: number,
): void {
  const speed: number = focused ? archetype().focusSpeed : archetype().speed;

  player.position.set(
    Math.min(
      Math.max(player.x + input.x * speed * delta, playerSize / 2),
      width - playerSize / 2,
    ),
    Math.min(
      Math.max(player.y + input.y * speed * delta, playerSize / 2),
      height - playerSize / 2,
    ),
  );
}

export {
  playerSize,
  hitboxRadius,
  hitboxColor,
  drawHitbox,
  sizePlayer,
  movePlayer,
};
