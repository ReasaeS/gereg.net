import { Graphics, Sprite, type Container, type Texture } from "pixi.js";
import type { Vector } from "../create/types";
import { createSquad, type Squad, type Target } from "./drones";
import { createBomb, type Bomb } from "./bomb";
import { drawHitbox, movePlayer, sizePlayer } from "./player";

type Pilot = {
  player: Sprite;
  hitbox: Graphics;
  squad: Squad;
  bomb: Bomb;
  layers: () => Array<Container>;
  update: (
    delta: number,
    input: Vector,
    focused: boolean,
    shooting: boolean,
    bombing: boolean,
    targets?: Array<Target>,
  ) => boolean;
  reset: (x: number, y: number) => void;
  redraw: () => void;
};

function createPilot(
  playerTexture: Texture,
  droneTexture: Texture,
  width: number,
  height: number,
): Pilot {
  const player: Sprite = new Sprite(playerTexture);
  const hitbox: Graphics = new Graphics();
  const squad: Squad = createSquad(droneTexture, width, height);
  const bomb: Bomb = createBomb(width, height);
  let bombHeld: boolean = false;

  function update(
    delta: number,
    input: Vector,
    focused: boolean,
    shooting: boolean,
    bombing: boolean,
    targets: Array<Target> = new Array(),
  ): boolean {
    const bombed: boolean =
      bombing && !bombHeld && bomb.trigger(player.x, player.y);

    movePlayer(player, input, focused, delta, width, height);
    hitbox.position.copyFrom(player.position);
    hitbox.visible = focused;
    squad.update(delta, player.x, player.y, focused, shooting, targets);
    bombHeld = bombing;
    bomb.update(delta, player.x, player.y);

    return bombed;
  }

  function reset(x: number, y: number): void {
    player.position.set(x, y);
    hitbox.position.set(x, y);
    hitbox.visible = false;
    squad.clear();
    bomb.clear();
    bombHeld = false;
  }

  sizePlayer(player);
  drawHitbox(hitbox);
  hitbox.visible = false;

  return {
    player: player,
    hitbox: hitbox,
    squad: squad,
    bomb: bomb,
    layers: () => [squad.shotLayer, player, squad.view, bomb.view, hitbox],
    update: update,
    reset: reset,
    redraw: () => drawHitbox(hitbox),
  };
}

export { createPilot };
export type { Pilot };
