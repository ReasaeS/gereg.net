import type { Difficulty, Frame, Rank } from "./data";

type Cosmetic = "background" | "spell" | "sound" | "character" | "cutscene";

type Rarity<T> = {
  value: T;
  label: string;
  color: string;
  tier: number;
};

const difficulties: Array<Rarity<Difficulty>> = [
  { value: "easy", label: "Easy", color: "#7ae38f", tier: 1 },
  { value: "normal", label: "Normal", color: "#7ad8ff", tier: 2 },
  { value: "hard", label: "Hard", color: "#ffb347", tier: 3 },
  { value: "lunatic", label: "Lunatic", color: "#ff6fd8", tier: 4 },
];

const cosmetics: Array<Rarity<Cosmetic>> = [
  { value: "background", label: "Background", color: "#7ad8ff", tier: 1 },
  { value: "spell", label: "Spell", color: "#ff3b3b", tier: 2 },
  { value: "sound", label: "SFX", color: "#b48cff", tier: 3 },
  { value: "cutscene", label: "Cutscene", color: "#7ae38f", tier: 4 },
  { value: "character", label: "Character", color: "#ffb347", tier: 5 },
];

const ranks: Array<Rarity<Rank>> = [
  { value: "regular", label: "Regular", color: "#7ae38f", tier: 1 },
  { value: "subboss", label: "Sub-boss", color: "#7ad8ff", tier: 2 },
  { value: "boss", label: "Boss", color: "#ffb347", tier: 3 },
];

const frames: Array<Rarity<Frame>> = [
  { value: "objective", label: "Objective", color: "#7ae38f", tier: 1 },
  { value: "subjective", label: "Subjective", color: "#ffb347", tier: 2 },
];

const defaultName: RegExp =
  /^(Stage|Pattern|Enemy|Background|Spell|Sound|Character|Cutscene) (\d+)$/;

function rarityOf<T>(list: Array<Rarity<T>>, value: T): Rarity<T> {
  return list.find((entry: Rarity<T>) => entry.value === value) ?? list[0]!;
}

export { difficulties, cosmetics, ranks, frames, defaultName, rarityOf };
export type { Cosmetic, Rarity };
