const storageKey: string = "geregnet.records";

function loadRecords(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      number
    >;
  } catch {
    return {};
  }
}

function bestScore(id: string): number {
  return loadRecords()[id] ?? 0;
}

function recordScore(id: string, score: number): boolean {
  const records: Record<string, number> = loadRecords();

  if (score <= (records[id] ?? 0)) {
    return false;
  }

  records[id] = score;

  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
  } catch {
    console.warn("Could not save the score");
  }

  return true;
}

export { bestScore, recordScore };
