const storageKey: string = "geregnet.playtime";
const saveInterval: number = 5000; // ms

let saved: number = 0;
let sessionStart: number = Date.now();
let tracking: boolean = true;

function loadPlaytime(): number {
  try {
    const value: number = Number(localStorage.getItem(storageKey) ?? 0);

    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function playtime(): number {
  return saved + (Date.now() - sessionStart);
}

function savePlaytime(): void {
  if (!tracking) {
    return;
  }

  try {
    localStorage.setItem(storageKey, String(Math.floor(playtime())));
  } catch {
    console.warn("Could not save the playtime");
  }
}

function stopPlaytime(): void {
  tracking = false;
}

function formatPlaytime(milliseconds: number): string {
  const seconds: number = Math.floor(milliseconds / 1000);
  const hours: number = Math.floor(seconds / 3600);
  const minutes: number = Math.floor(seconds / 60) % 60;

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}

saved = loadPlaytime();
sessionStart = Date.now();
window.setInterval(savePlaytime, saveInterval);
window.addEventListener("pagehide", savePlaytime);
document.addEventListener("visibilitychange", savePlaytime);

export { playtime, formatPlaytime, stopPlaytime };
