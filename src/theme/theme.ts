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

const daysInYear: number = 366;
const hueStride: number = 139;
const dailySaturation: number = 0.85;
const dailyLightness: number = 0.55;

function dayOfYear(date: Date): number {
  const today: number = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const start: number = Date.UTC(date.getFullYear(), 0, 1);

  return Math.round((today - start) / 86400000);
}

function channel(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
}

function dailyColor(date: Date): string {
  const hue: number = ((dayOfYear(date) * hueStride) % daysInYear) / daysInYear;
  const chroma: number =
    (1 - Math.abs(2 * dailyLightness - 1)) * dailySaturation;
  const sector: number = hue * 6;
  const second: number = chroma * (1 - Math.abs((sector % 2) - 1));
  const base: number = dailyLightness - chroma / 2;
  const [red, green, blue] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.floor(sector) % 6]!;

  return (
    "#" + channel(red! + base) + channel(green! + base) + channel(blue! + base)
  );
}

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
  ring: dailyColor(new Date()),
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
