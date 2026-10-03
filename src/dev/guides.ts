import { Graphics, type Application } from "pixi.js";

const guideColor: string = "#ff00ff";
const guideAlpha: number = 0.8;
const guideWidth: number = 1; // px
const guideFractions: Array<number> = [1 / 3, 2 / 3];

function createGuides(app: Application): Graphics {
  const guides: Graphics = new Graphics();

  function draw(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;

    guides.clear();

    for (let index = 0; index < guideFractions.length; index++) {
      const fraction: number = guideFractions[index]!;

      guides
        .moveTo(0, height * fraction)
        .lineTo(width, height * fraction)
        .moveTo(width * fraction, 0)
        .lineTo(width * fraction, height);
    }

    guides.stroke({ color: guideColor, alpha: guideAlpha, width: guideWidth });
  }

  window.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!event.altKey || event.code !== "KeyD") {
      return;
    }

    event.preventDefault();
    guides.visible = !guides.visible;
  });

  guides.eventMode = "none";
  guides.visible = false;
  draw();
  app.renderer.on("resize", draw);

  return guides;
}

export { createGuides };
