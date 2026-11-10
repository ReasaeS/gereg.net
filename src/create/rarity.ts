import type { Difficulty, EffectGroup, Frame, Rank } from "./types";

type Cosmetic =
  | "background"
  | "wallpaper"
  | "bullet"
  | "vessel"
  | "palette"
  | "sigil"
  | "sound"
  | "music"
  | "ambience"
  | "ost"
  | "character"
  | "cutscene";

type Attack = Frame | "spell";

type Form = "stage" | "run" | "game";

type Rarity<T> = {
  value: T;
  label: string;
  color: string;
  tier: number;
};

const difficulties: Array<Rarity<Difficulty>> = [
  { value: "easy", label: "Easy", color: "#7ae38f", tier: 1 },
  { value: "normal", label: "Normal", color: "#7ad8ff", tier: 2 },
  { value: "hard", label: "Hard", color: "#ff5a5a", tier: 3 },
  { value: "lunatic", label: "Lunatic", color: "#ff6fd8", tier: 4 },
];

const effectGroups: Array<Rarity<EffectGroup>> = [
  { value: "lasting", label: "Lasting", color: "#7ae38f", tier: 1 },
  { value: "special", label: "Special", color: "#ff5a5a", tier: 2 },
  { value: "instant", label: "Instant", color: "#b48cff", tier: 3 },
];

const gameRarity: Rarity<"game"> = {
  value: "game",
  label: "Game",
  color: "#fff1b8",
  tier: 5,
};

const forms: Array<Rarity<Form>> = [
  { value: "stage", label: "Stage", color: "#7ad8ff", tier: 1 },
  { value: "run", label: "Run", color: "#b48cff", tier: 2 },
  gameRarity,
];

const visuals: Array<Rarity<Cosmetic>> = [
  { value: "background", label: "Background", color: "#7ad8ff", tier: 1 },
  { value: "wallpaper", label: "Wallpaper", color: "#3b82ff", tier: 2 },
  { value: "palette", label: "Palette", color: "#fff27a", tier: 3 },
  { value: "bullet", label: "Bullet", color: "#5ff0d0", tier: 4 },
  { value: "vessel", label: "Vessel", color: "#c8d2e6", tier: 5 },
  { value: "sigil", label: "Sigil", color: "#ff3b3b", tier: 6 },
];

const audio: Array<Rarity<Cosmetic>> = [
  { value: "sound", label: "SFX", color: "#b48cff", tier: 1 },
  { value: "music", label: "Music", color: "#ffd36f", tier: 2 },
  { value: "ambience", label: "Ambience", color: "#7ae3c8", tier: 3 },
  { value: "ost", label: "OST", color: "#ff8fb1", tier: 4 },
];

const story: Array<Rarity<Cosmetic>> = [
  { value: "cutscene", label: "Cutscene", color: "#7ae38f", tier: 1 },
  { value: "character", label: "Character", color: "#ffb347", tier: 2 },
];

const cosmetics: Array<Rarity<Cosmetic>> = [...visuals, ...audio, ...story];

const ranks: Array<Rarity<Rank>> = [
  { value: "regular", label: "Regular", color: "#7ae38f", tier: 1 },
  { value: "subboss", label: "Sub-boss", color: "#7ad8ff", tier: 2 },
  { value: "boss", label: "Boss", color: "#ffb347", tier: 3 },
];

const attacks: Array<Rarity<Attack>> = [
  { value: "objective", label: "Objective", color: "#7ae38f", tier: 1 },
  { value: "subjective", label: "Subjective", color: "#ffb347", tier: 2 },
  { value: "spell", label: "Spell", color: "#ff6fd8", tier: 3 },
];

const defaultName: RegExp =
  /^(Stage|Run|Game|Pattern|Enemy|Background|Wallpaper|Bullet|Vessel|Palette|Sigil|Spell|Sound|OST|Character|Cutscene) (\d+)$/;

function rarityOf<T>(list: Array<Rarity<T>>, value: T): Rarity<T> {
  return list.find((entry: Rarity<T>) => entry.value === value) ?? list[0]!;
}

export {
  difficulties,
  effectGroups,
  gameRarity,
  forms,
  visuals,
  audio,
  story,
  cosmetics,
  ranks,
  attacks,
  defaultName,
  rarityOf,
};
export type { Attack, Cosmetic, Form, Rarity };
