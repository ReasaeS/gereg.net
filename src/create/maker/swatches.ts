import type { Curve } from "../types";
import type { Option } from "../../ui/widgets";

const brightColors: Array<string> = [
  "#ffffff",
  "#ff3b3b",
  "#ff8a80",
  "#ffb347",
  "#fff27a",
  "#7ae38f",
  "#2fa84f",
  "#7ad8ff",
  "#3b82ff",
  "#b48aff",
  "#ff6fd8",
  "#1d1d2b",
];
const skyColors: Array<string> = [
  "#000000",
  "#01030a",
  "#031448",
  "#0b3f9e",
  "#1a5fc4",
  "#8fd0ff",
  "#1e0a2e",
  "#4a1a5c",
  "#5c1a1a",
  "#a32a2a",
  "#1e5c2a",
  "#e6c229",
];
const wallColors: Array<string> = [
  "#000000",
  "#01040f",
  "#030c2a",
  "#0a2160",
  "#0b3f9e",
  "#1e0a2e",
  "#4a1a5c",
  "#2a0a14",
  "#5c1a1a",
  "#0a2a1a",
  "#1e5c2a",
  "#2a2a2a",
];
const menuColors: Array<string> = [
  "#ffffff",
  "#9fd8ff",
  "#7ad8ff",
  "#3b82ff",
  "#061a52",
  "#ff2a4d",
  "#ff6fd8",
  "#b48aff",
  "#ffb347",
  "#fff27a",
  "#7ae38f",
  "#01040f",
];
const curveOptions: Array<Option<Curve>> = [
  { value: "polynomial", label: "Polynomial" },
  { value: "sinusoidal", label: "Sinusoidal" },
];

export { brightColors, skyColors, wallColors, menuColors, curveOptions };
