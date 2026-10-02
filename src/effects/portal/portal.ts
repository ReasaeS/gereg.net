import {
  Graphics,
  UPDATE_PRIORITY,
  type Application,
  type Container,
} from "pixi.js";
import type { Circle } from "../reveal/reveal";

type PortalView = {
  target: Container;
  mask: Graphics;
  inverse: boolean;
};

const portalPriority: number = UPDATE_PRIORITY.LOW + 1;

const portal: Circle = { x: 0, y: 0, radius: 0 };
const views: Array<PortalView> = new Array();

function setPortal(circle: Circle): void {
  portal.x = circle.x;
  portal.y = circle.y;
  portal.radius = circle.radius;
}

function addPortalView(target: Container, inverse: boolean): void {
  const mask: Graphics = new Graphics();
  target.addChild(mask);
  target.setMask({ mask: mask, inverse: inverse });
  views.push({ target: target, mask: mask, inverse: inverse });
}

function drawPortal(width: number, height: number): void {
  const cover: number =
    Math.hypot(
      Math.max(portal.x, width - portal.x),
      Math.max(portal.y, height - portal.y),
    ) + 1;
  const radius: number = Math.min(portal.radius, cover);

  for (let index = 0; index < views.length; index++) {
    const view: PortalView = views[index]!;
    view.target.visible = view.inverse ? radius < cover : radius > 0;
    view.mask.clear();

    if (radius > 0) {
      view.mask.circle(portal.x, portal.y, radius).fill(0xffffff);
    }
  }
}

function startPortal(app: Application): void {
  app.ticker.add(
    () => drawPortal(app.screen.width, app.screen.height),
    undefined,
    portalPriority,
  );
}

export { setPortal, addPortalView, startPortal };
