import { getTexture, loadTexture, storeImage } from "../images";
import { createSpriteRow, type Control } from "../../ui/widgets";
import type { Item, Studio } from "./studio";

type Uploads = {
  spriteRow: () => Control;
  pickImage: () => void;
  useImage: (file: File | undefined) => Promise<void>;
};

function createUploads(studio: Studio): Uploads {
  const { preview, tab, changed, refresh, cleanup } = studio;
  const { current, emotion } = studio.pick;
  const picker: HTMLInputElement = document.createElement("input");

  async function useImage(file: File | undefined): Promise<void> {
    if (file === undefined || !file.type.startsWith("image/")) {
      return;
    }

    const item: Item = tab().name === "character" ? emotion() : current();

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

  function spriteRow(): Control {
    return createSpriteRow(
      "Sprite",
      () => getTexture(current().sprite ?? null),
      () => picker.click(),
      () => {
        current().sprite = null;
        preview.clear();
        changed();
        refresh();
        cleanup();
      },
    );
  }

  picker.type = "file";
  picker.accept = "image/*";
  picker.addEventListener("change", () => {
    useImage(picker.files?.[0]);
    picker.value = "";
  });

  return {
    spriteRow: spriteRow,
    pickImage: () => picker.click(),
    useImage: useImage,
  };
}

export { createUploads };
export type { Uploads };
