import type { Application, Container } from "pixi.js";
import type {
  Background,
  Bar,
  Character,
  Creations,
  Cutscene,
  Emotion,
  Enemy,
  Keyframe,
  Palette,
  Pattern,
  Ring,
  Sigil,
  Sound,
  Spawn,
  Spell,
  Stage,
  Wallpaper,
} from "../types";
import type { Attack, Cosmetic } from "../rarity";
import type { Kind } from "../gallery/kinds";
import type { Preview } from "../preview/preview";
import type { Scene } from "../cutscene";
import type { Control } from "../../ui/widgets";
import type { Kit } from "./kit";

type Item = {
  id: string;
  name: string;
  sprite?: string | null;
};

type Tab = {
  name: string;
  items: () => Array<Item>;
  selected: number;
  panel: Container;
  controls: Array<Control>;
  show: () => void;
};

type Cursor = {
  spawn: number;
  keyframe: number;
  ring: number;
  bar: number;
  emotion: number;
};

type Selection = {
  current: () => Item;
  stage: () => Stage;
  pattern: () => Pattern;
  enemy: () => Enemy;
  background: () => Background;
  wallpaper: () => Wallpaper;
  palette: () => Palette;
  sound: () => Sound;
  sigil: () => Sigil;
  spell: () => Spell;
  cutscene: () => Cutscene;
  character: () => Character;
  emotion: () => Emotion;
  bar: () => Bar;
  ring: () => Ring;
  keyframe: () => Keyframe;
  spawn: () => Spawn;
  patternById: (id: string | null) => Pattern | null;
  enemyById: (id: string | null) => Enemy | null;
  backgroundById: (id: string | null) => Background | null;
  wallpaperById: (id: string | null) => Wallpaper | null;
  spellById: (id: string | null) => Spell | null;
  sigilById: (id: string | null) => Sigil | null;
  soundById: (id: string | null) => Sound | null;
  resolve: (spawn: Spawn) => Enemy | null;
};

type Studio = {
  app: Application;
  creations: Creations;
  preview: Preview;
  scene: Scene;
  cursor: Cursor;
  kit: Kit;
  pick: Selection;
  tab: () => Tab;
  addTab: (
    name: string,
    items: () => Array<Item>,
    list: Array<Control>,
    show: () => void,
  ) => void;
  changed: () => void;
  refresh: () => void;
  cleanup: () => void;
  refreshControls: () => void;
  spriteRow: () => Control;
  pickImage: () => void;
  cosmeticSection: (kind: Cosmetic) => Array<Control>;
  keyed: (kind: Kind, list: Array<Control>) => Array<Control>;
  convertAttack: (to: Attack) => void;
  renameDefault: (kind: Kind, item: Item) => void;
  playScene: () => void;
  showPalette: () => void;
  pause: () => void;
  buildMarkers: () => void;
  placeMarkers: () => void;
};

export type { Item, Tab, Cursor, Selection, Studio };
