const ratioStep: number = 1080; // px

const pixelRatio: number = Math.max(
  1,
  Math.round((window.innerHeight * (window.devicePixelRatio || 1)) / ratioStep),
);

function viewScale(): number {
  return (window.devicePixelRatio || 1) / pixelRatio;
}

export { pixelRatio, viewScale };
