type ArchetypeId = "seeker" | "striker" | "scatter";

type Archetype = {
  id: ArchetypeId;
  name: string;
  summary: string;
  speed: number; // units/s
  focusSpeed: number; // units/s
  droneDamage: number;
  droneRate: number; // Hz
  spread: number; // deg
  homing: boolean;
};

const storageKey: string = "geregnet.archetype";
const archetypes: Array<Archetype> = [
  {
    id: "seeker",
    name: "Seeker",
    summary: "Homing shots · slower · weaker",
    speed: 280,
    focusSpeed: 120,
    droneDamage: 0.45,
    droneRate: 12,
    spread: 12,
    homing: true,
  },
  {
    id: "striker",
    name: "Striker",
    summary: "Straight shots · fast · strong",
    speed: 340,
    focusSpeed: 150,
    droneDamage: 0.8,
    droneRate: 12,
    spread: 4,
    homing: false,
  },
  {
    id: "scatter",
    name: "Scatter",
    summary: "Wide spread · focus to narrow",
    speed: 300,
    focusSpeed: 130,
    droneDamage: 0.6,
    droneRate: 12,
    spread: 30,
    homing: false,
  },
];
let current: Archetype = loadArchetype();

function findArchetype(id: string | null): Archetype {
  return (
    archetypes.find((archetype: Archetype) => archetype.id === id) ??
    archetypes[0]!
  );
}

function loadArchetype(): Archetype {
  try {
    return findArchetype(localStorage.getItem(storageKey));
  } catch {
    return archetypes[0]!;
  }
}

function archetype(): Archetype {
  return current;
}

function setArchetype(id: ArchetypeId): void {
  current = findArchetype(id);

  try {
    localStorage.setItem(storageKey, id);
  } catch {
    console.warn("Could not save the archetype");
  }
}

export { archetypes, archetype, setArchetype };
export type { Archetype, ArchetypeId };
