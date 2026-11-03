import { Container, Graphics, Rectangle, type Application } from "pixi.js";
import { createEditor, slotSize, type Editor } from "../../editor/editor";
import {
  createDrawing,
  resizeDrawing,
  type Drawing,
} from "../../editor/drawings";
import { drawVesselDefault } from "../../editor/default";
import { encodePixels, type Pixels } from "../../editor/pixels";
import { chipHeight, createChip, type Chip } from "../../ui/widgets";
import { createGlide, type Glide } from "../../ui/motion";

type Sheet = {
  name: string;
  side: number; // px
  read: (pixels: Pixels) => void;
  write: (code: string) => void;
  drawDefault: (pixels: Pixels) => void;
};

type Painter = {
  view: Container;
  open: (sheet: Sheet) => void;
  close: () => void;
  shown: () => boolean;
  layout: (scale: number) => void;
};

const backdropColor: string = "#01040f";
const backdropAlpha: number = 0.97;
const doneWidth: number = 60; // units

function createPainter(
  app: Application,
  changed: () => void,
  closed: () => void,
): Painter {
  const view: Container = new Container();
  const backdrop: Graphics = new Graphics();
  const drawing: Drawing = createDrawing("vessel", "", drawVesselDefault);
  let target: Sheet | null = null;
  const editor: Editor = createEditor(
    app,
    [drawing],
    (value: Drawing) => {
      if (target !== null) {
        target.write(encodePixels(value.pixels));
        changed();
      }
    },
    false,
    true,
    true,
  );
  const done: Chip = createChip("Done", doneWidth, close);
  const amount: Glide = createGlide(0, (value: number) => {
    view.alpha = value;
    view.visible = value > 0;
  });

  function open(sheet: Sheet): void {
    target = sheet;
    drawing.name = sheet.name;
    drawing.drawDefault = sheet.drawDefault;
    resizeDrawing(drawing, sheet.side);
    sheet.read(drawing.pixels);

    drawing.undo.length = 0;
    drawing.redo.length = 0;
    drawing.source.update();
    editor.enter?.();
    editor.setActive(true);
    view.eventMode = "passive";
    amount.set(1);
  }

  function close(): void {
    if (target === null) {
      return;
    }

    target = null;
    editor.setActive(false);
    view.eventMode = "none";
    amount.set(0);
    closed();
  }

  function layout(scale: number): void {
    backdrop
      .clear()
      .rect(0, 0, app.screen.width, app.screen.height)
      .fill({ color: backdropColor, alpha: backdropAlpha });
    const bounds: Rectangle = editor.bounds?.() ?? new Rectangle();

    done.view.scale.set(scale);
    done.view.position.set(
      Math.round(bounds.right - doneWidth * scale),
      Math.round(bounds.y + (slotSize - chipHeight * scale) / 2),
    );
  }

  backdrop.eventMode = "static";
  view.addChild(backdrop, editor.view, done.view);
  view.eventMode = "none";
  amount.snap(0);

  return {
    view: view,
    open: open,
    close: close,
    shown: () => target !== null,
    layout: layout,
  };
}

export { createPainter };
export type { Painter, Sheet };
