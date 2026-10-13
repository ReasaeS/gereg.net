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
  outside: string;
  rain: string;
  bullets: string;
};

type ThemeListener = (theme: Theme) => void;

const dailyEdge: Array<number> = [0x06, 0x1a, 0x52];
const dailyMiddle: Array<number> = [0xff, 0x2a, 0x4d];

function dayOfYear(date: Date): number {
  const today: number = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const start: number = Date.UTC(date.getFullYear(), 0, 1);

  return Math.round((today - start) / 86400000);
}

function daysInYear(date: Date): number {
  return Math.round(
    (Date.UTC(date.getFullYear() + 1, 0, 1) -
      Date.UTC(date.getFullYear(), 0, 1)) /
      86400000,
  );
}

function channel(value: number): string {
  return Math.round(value).toString(16).padStart(2, "0");
}

function dailyColor(date: Date): string {
  const position: number = dayOfYear(date) / daysInYear(date);
  const amount: number = 1 - Math.abs(position * 2 - 1);

  return (
    "#" +
    dailyEdge
      .map((edge: number, index: number) =>
        channel(edge + (dailyMiddle[index]! - edge) * amount),
      )
      .join("")
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
  outside: "#0b1026",
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
