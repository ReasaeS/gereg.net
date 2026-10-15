const ratioStep: number = 1080; // px

const nativeRatio: number = Math.max(
  1,
  Math.round((window.innerHeight * (window.devicePixelRatio || 1)) / ratioStep),
);
const ratioListeners: Array<(ratio: number) => void> = new Array();
let ratio: number = nativeRatio;

function viewScale(): number {
  return (window.devicePixelRatio || 1) / nativeRatio;
}

function renderRatio(): number {
  return ratio;
}

function setRenderRatio(value: number): void {
  if (value === ratio) {
    return;
  }

  ratio = value;

  for (const listener of ratioListeners) {
    listener(value);
  }
}

function onRatio(listener: (ratio: number) => void): void {
  ratioListeners.push(listener);
}

export { nativeRatio, viewScale, renderRatio, setRenderRatio, onRatio };
