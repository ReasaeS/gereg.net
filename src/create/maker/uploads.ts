import { getTexture, loadTexture, storeImage } from "../images";
import { createSpriteRow, type Control } from "../../ui/widgets";
import type { Studio } from "./studio";

type Holder = {
  sprite?: string | null;
};

type Uploads = {
  spriteRow: (name?: string, target?: () => Holder) => Control;
  pickImage: () => void;
  useImage: (file: File | undefined) => Promise<void>;
};

function createUploads(studio: Studio): Uploads {
  const { preview, tab, changed, refresh, cleanup } = studio;
  const { current, emotion } = studio.pick;
  const picker: HTMLInputElement = document.createElement("input");
  let pending: (() => Holder) | null = null;

  async function useImage(file: File | undefined): Promise<void> {
    if (file === undefined || !file.type.startsWith("image/")) {
      return;
    }

    const item: Holder =
      pending?.() ?? (tab().name === "character" ? emotion() : current());

    pending = null;

    if (item.sprite === undefined) {
      return;
    }

    try {
      const id: string = await storeImage(file);
      await loadTexture(id);
      item.sprite = id;
      preview.clear();
      changed();
      refresh();
      cleanup();
    } catch {
      console.warn("Could not use the image " + file.name);
    }
  }

  function spriteRow(
    name: string = "Sprite",
    target: () => Holder = current,
  ): Control {
    return createSpriteRow(
      name,
      () => getTexture(target().sprite ?? null),
      () => {
        pending = target;
        picker.click();
      },
      () => {
        target().sprite = null;
        preview.clear();
        changed();
        refresh();
        cleanup();
      },
    );
  }

  picker.type = "file";
  picker.accept = "image/*";
  picker.addEventListener("cancel", () => {
    pending = null;
  });
  picker.addEventListener("change", () => {
    useImage(picker.files?.[0]);
    picker.value = "";
  });

  return {
    spriteRow: spriteRow,
    pickImage: () => {
      pending = null;
      picker.click();
    },
    useImage: useImage,
  };
}

export { createUploads };
export type { Uploads };
