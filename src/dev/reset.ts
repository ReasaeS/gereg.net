import { eraseFiles } from "../create/images";

const storagePrefix: string = "geregnet.";

async function resetApp(): Promise<void> {
  const keys: Array<string> = new Array();

  for (let index = 0; index < localStorage.length; index++) {
    const key: string | null = localStorage.key(index);

    if (key !== null && key.startsWith(storagePrefix)) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    localStorage.removeItem(key);
  }

  await eraseFiles();
  window.location.reload();
}

export { resetApp };
