import { ImageSource, Texture } from "pixi.js";
import { createId } from "./data";

const databaseName: string = "geregnet";
const storeName: string = "images";
const maxImageSize: number = 1024; // px
const pixelArtSize: number = 64; // px
const textures: Map<string, Texture> = new Map();
const loading: Map<string, Promise<Texture | null>> = new Map();
let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (database !== null) {
    return database;
  }

  database = new Promise<IDBDatabase>((resolve, reject) => {
    const request: IDBOpenDBRequest = indexedDB.open(databaseName, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return database;
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const store: IDBObjectStore = (await openDatabase())
    .transaction(storeName, mode)
    .objectStore(storeName);

  return new Promise<T>((resolve, reject) => {
    const request: IDBRequest<T> = action(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function shrink(file: Blob): Promise<Blob> {
  const bitmap: ImageBitmap = await createImageBitmap(file);
  const largest: number = Math.max(bitmap.width, bitmap.height);

  if (largest <= maxImageSize) {
    bitmap.close();
    return file;
  }

  const scale: number = maxImageSize / largest;
  const canvas: OffscreenCanvas = new OffscreenCanvas(
    Math.round(bitmap.width * scale),
    Math.round(bitmap.height * scale),
  );

  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return canvas.convertToBlob({ type: "image/png" });
}

async function storeBlob(blob: Blob): Promise<string> {
  const id: string = createId();

  await run("readwrite", (store: IDBObjectStore) => store.put(blob, id));

  return id;
}

function readBlob(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>("readonly", (store: IDBObjectStore) =>
    store.get(id),
  );
}

async function storeImage(file: Blob): Promise<string> {
  return storeBlob(await shrink(file));
}

async function readTexture(id: string): Promise<Texture | null> {
  try {
    const blob: Blob | undefined = await readBlob(id);

    if (blob === undefined) {
      return null;
    }

    const bitmap: ImageBitmap = await createImageBitmap(blob);
    const pixelArt: boolean =
      bitmap.width <= pixelArtSize && bitmap.height <= pixelArtSize;
    const texture: Texture = new Texture({
      source: new ImageSource({
        resource: bitmap,
        scaleMode: pixelArt ? "nearest" : "linear",
      }),
    });

    textures.set(id, texture);
    return texture;
  } catch {
    console.warn("Could not load the image " + id);
    return null;
  }
}

function getTexture(id: string | null): Texture | null {
  return id === null ? null : (textures.get(id) ?? null);
}

function loadTexture(id: string | null): Promise<Texture | null> {
  if (id === null) {
    return Promise.resolve(null);
  }

  const cached: Texture | undefined = textures.get(id);

  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  let pending: Promise<Texture | null> | undefined = loading.get(id);

  if (pending === undefined) {
    pending = readTexture(id);
    loading.set(id, pending);
  }

  return pending;
}

async function removeUnused(used: Set<string>): Promise<void> {
  try {
    const keys: Array<IDBValidKey> = await run<Array<IDBValidKey>>(
      "readonly",
      (store: IDBObjectStore) => store.getAllKeys(),
    );

    for (let index = 0; index < keys.length; index++) {
      const id: string = String(keys[index]);

      if (used.has(id)) {
        continue;
      }

      await run("readwrite", (store: IDBObjectStore) => store.delete(id));
      textures.get(id)?.destroy(true);
      textures.delete(id);
      loading.delete(id);
    }
  } catch {
    console.warn("Could not clean up unused files");
  }
}

async function eraseFiles(): Promise<void> {
  if (database !== null) {
    (await database.catch(() => null))?.close();
    database = null;
  }

  await new Promise<void>((resolve) => {
    const request: IDBOpenDBRequest = indexedDB.deleteDatabase(databaseName);

    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

export {
  eraseFiles,
  storeBlob,
  readBlob,
  storeImage,
  getTexture,
  loadTexture,
  removeUnused,
};
