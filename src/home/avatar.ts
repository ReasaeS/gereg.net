import { Container, Graphics, Point, Sprite } from "pixi.js";
import { menuTexture } from "../editor/drawings";
import { springStep, type Spring } from "../effects/tween/tween";
import { createWalker, type Clamp, type Walker } from "./walker";
import { depthScale } from "./room";

type Avatar = {
  view: Container;
  walker: Walker;
  update: (delta: number) => void;
  top: () => Point;
  face: (direction: number) => void;
};

const avatarSpeed: number = 420; // units/s
const avatarSize: number = 110; // units
const hoverHeight: number = 46; // units
const bobHeight: number = 6; // units
const bobSpeed: number = 0.8; // Hz
const tiltAngle: number = 0.16; // rad
const turnFrequency: number = 4; // Hz
const turnDamping: number = 0.7;
const turnSpeed: number = 30; // units/s
const shadowWidth: number = 46; // units
const shadowHeight: number = 12; // units
const headRoom: number = 18; // units

function createAvatar(clamp: Clamp): Avatar {
  const view: Container = new Container();
  const shadow: Graphics = new Graphics();
  const sprite: Sprite = new Sprite(menuTexture());
  const walker: Walker = createWalker(avatarSpeed, clamp);
  const turn: Spring = { value: 1, velocity: 0 };
  let facing: number = 1;
  let time: number = 0;

  sprite.anchor.set(0.5);
  shadow
    .ellipse(0, 0, shadowWidth, shadowHeight)
    .fill({ color: "#000000", alpha: 0.35 });
  view.addChild(shadow, sprite);

  function update(delta: number): void {
    const size: number = avatarSize / sprite.texture.height;
    const velocity: number = walker.velocityX();
    const bob: number = Math.sin(time * bobSpeed * Math.PI * 2);

    time += delta;
    walker.update(delta);

    if (Math.abs(velocity) > turnSpeed) {
      facing = Math.sign(velocity);
    }

    springStep(turn, facing, turnFrequency, turnDamping, delta);
    view.position.set(walker.x(), walker.y());
    view.zIndex = walker.y();
    view.scale.set(depthScale(walker.y()));
    sprite.scale.set(size * turn.value, size);
    sprite.y = -hoverHeight - avatarSize / 2 - bob * bobHeight;
    sprite.rotation = (velocity / avatarSpeed) * tiltAngle;
    shadow.scale.set(1 - bob * 0.06);
  }

  return {
    view: view,
    walker: walker,
    update: update,
    top: () =>
      new Point(
        walker.x(),
        walker.y() -
          (hoverHeight + avatarSize + headRoom) * depthScale(walker.y()),
      ),
    face: (direction: number) => {
      facing = Math.sign(direction) || facing;
    },
  };
}

export { createAvatar };
export type { Avatar };
