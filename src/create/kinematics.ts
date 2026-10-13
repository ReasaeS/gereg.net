import type { Spawn, Vector, Wave } from "./types";

type Path = Pick<Spawn, "curve" | "derivatives" | "waves">;

function series(derivatives: Array<number>, time: number): number {
  let term: number = 1;
  let total: number = 0;

  for (let order = 0; order < derivatives.length; order++) {
    term *= time / (order + 1);
    total += derivatives[order]! * term;
  }

  return total;
}

function drift(derivatives: Array<Vector>, time: number): [number, number] {
  let term: number = 1;
  let x: number = 0;
  let y: number = 0;

  for (let order = 0; order < derivatives.length; order++) {
    term *= time / (order + 1);
    x += derivatives[order]!.x * term;
    y += derivatives[order]!.y * term;
  }

  return [x, y];
}

function phaseAt(wave: Wave<unknown>, clock: number): number {
  return ((wave.phase + wave.phaseShift * clock) * Math.PI) / 180;
}

function oscillation(wave: Wave<unknown>, time: number, clock: number): number {
  return (
    Math.sin(Math.PI * 2 * wave.frequency * time + phaseAt(wave, clock)) -
    Math.sin(phaseAt(wave, clock - time))
  );
}

function slope(wave: Wave<unknown>, time: number): number {
  return (
    (Math.PI * 2 * wave.frequency + (wave.phaseShift * Math.PI) / 180) *
    Math.cos(Math.PI * 2 * wave.frequency * time + phaseAt(wave, time))
  );
}

function sway(
  waves: Array<Wave<number>>,
  time: number,
  clock: number = time,
): number {
  let total: number = 0;

  for (const wave of waves) {
    total += wave.amplitude * oscillation(wave, time, clock);
  }

  return total;
}

function swayVector(
  waves: Array<Wave<Vector>>,
  time: number,
  clock: number = time,
): [number, number] {
  let x: number = 0;
  let y: number = 0;

  for (const wave of waves) {
    x += wave.amplitude.x * oscillation(wave, time, clock);
    y += wave.amplitude.y * oscillation(wave, time, clock);
  }

  return [x, y];
}

function velocity(path: Path, time: number): [number, number] {
  let term: number = 1;
  let x: number = 0;
  let y: number = 0;

  if (path.curve === "sinusoidal") {
    for (const wave of path.waves) {
      x += wave.amplitude.x * slope(wave, time);
      y += wave.amplitude.y * slope(wave, time);
    }

    return [x, y];
  }

  for (let order = 0; order < path.derivatives.length; order++) {
    x += path.derivatives[order]!.x * term;
    y += path.derivatives[order]!.y * term;
    term *= time / (order + 1);
  }

  return [x, y];
}

function motion(
  x: number,
  y: number,
  path: Path,
  time: number,
): [number, number] {
  let term: number = 1;

  if (path.curve === "sinusoidal") {
    const [swayX, swayY] = swayVector(path.waves, time);

    return [x + swayX, y + swayY];
  }

  for (let order = 0; order < path.derivatives.length; order++) {
    term *= time / (order + 1);
    x += path.derivatives[order]!.x * term;
    y += path.derivatives[order]!.y * term;
  }

  return [x, y];
}

export { series, drift, sway, swayVector, velocity, motion };
export type { Path };
