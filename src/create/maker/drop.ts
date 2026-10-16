import { Container, Graphics, Text, type Application } from "pixi.js";
import { approach } from "../../effects/tween/tween";
import { createText } from "../../ui/text";

type Drop = {
  view: Container;
  layout: () => void;
  update: (delta: number) => void;
  fade: () => void;
  hide: () => void;
};

const dropColor: string = "#01040f";
const dropAlpha: number = 0.75;
const dropBorder: number = 6; // px
const dropInset: number = 24; // px
const dropSize: number = 56; // px
const dropFade: number = 0.15; // s
const frameColor: string = "#ffffff";

function createDrop(
  app: Application,
  label: () => string | null,
  receive: (file: File | undefined) => void,
): Drop {
  const view: Container = new Container();
  const back: Graphics = new Graphics();
  const text: Text = createText(dropSize, "#ffffff");
  let shown: boolean = false;

  function hasFiles(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes("Files") ?? false;
  }

  function show(value: boolean): void {
    const wanted: string | null = value ? label() : null;

    shown = wanted !== null;

    if (wanted !== null) {
      text.text = wanted;
    }
  }

  window.addEventListener("dragover", (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    show(true);
  });

  window.addEventListener("dragleave", (event: DragEvent) => {
    if (event.relatedTarget === null) {
      show(false);
    }
  });

  window.addEventListener("drop", (event: DragEvent) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    show(false);
    receive(event.dataTransfer?.files[0]);
  });

  function layout(): void {
    const width: number = app.screen.width;
    const height: number = app.screen.height;

    back
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: dropColor, alpha: dropAlpha })
      .rect(dropInset, dropInset, width - dropInset * 2, height - dropInset * 2)
      .stroke({ color: frameColor, width: dropBorder, alignment: 1 });
    text.position.set(width / 2, height / 2);
  }

  function update(delta: number): void {
    view.alpha = approach(view.alpha, shown ? 1 : 0, delta / dropFade);
    view.visible = view.alpha > 0;
  }

  function hide(): void {
    shown = false;
    view.visible = false;
    view.alpha = 0;
  }

  text.anchor.set(0.5);
  view.addChild(back, text);
  view.visible = false;

  return {
    view: view,
    layout: layout,
    update: update,
    fade: () => {
      shown = false;
    },
    hide: hide,
  };
}

export { createDrop };
export type { Drop };
