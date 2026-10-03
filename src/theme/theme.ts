type Theme = {
  skyTop: string;
  skyMiddle: string;
  horizon: string;
  seaSurface: string;
  seaMiddle: string;
  seaDeep: string;
  light: string;
  menuText: string;
  menuSelected: string;
  highlight: string;
  accent: string;
  ring: string;
  nightSea: string;
  rain: string;
  bullets: string;
};

type ThemeListener = (theme: Theme) => void;

const theme: Theme = {
  skyTop: "#06205e",
  skyMiddle: "#1a5fc4",
  horizon: "#8fd0ff",
  seaSurface: "#2a86e0",
  seaMiddle: "#0b3f9e",
  seaDeep: "#031448",
  light: "#bff4ff",
  menuText: "#ffffff",
  menuSelected: "#061a52",
  highlight: "#ffffff",
  accent: "#ff2a4d",
  ring: "#3232ff",
  nightSea: "#1a2a52",
  rain: "#aabedc",
  bullets: "#1a2a7a",
};

function getTheme(): Theme {
  return theme;
}

function onTheme(listener: ThemeListener): void {
  listener(theme);
}

export { getTheme, onTheme };
export type { Theme };
