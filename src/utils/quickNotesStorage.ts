import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@saycart/quick_notes_v1";

export type QuickNote = {
  id: string;
  body: string;
  updatedAt: string;
};

function newId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export { newId as newQuickNoteId };

function parseNotes(raw: unknown): QuickNote[] {
  if (!Array.isArray(raw)) return [];
  const out: QuickNote[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.body !== "string") continue;
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString();
    out.push({ id: o.id, body: o.body, updatedAt });
  }
  return out;
}

export function sortNotesByUpdatedDesc(notes: QuickNote[]): QuickNote[] {
  return [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function loadQuickNotes(): Promise<QuickNote[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sortNotesByUpdatedDesc(parseNotes(JSON.parse(raw) as unknown));
  } catch {
    return [];
  }
}

export async function saveQuickNotes(notes: QuickNote[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

/** Replace one note by id, or append if missing. */
export async function upsertQuickNote(note: QuickNote): Promise<QuickNote[]> {
  const all = await loadQuickNotes();
  const i = all.findIndex((n) => n.id === note.id);
  if (i >= 0) {
    const next = [...all];
    next[i] = note;
    await saveQuickNotes(sortNotesByUpdatedDesc(next));
    return sortNotesByUpdatedDesc(next);
  }
  await saveQuickNotes(sortNotesByUpdatedDesc([note, ...all]));
  return sortNotesByUpdatedDesc([note, ...all]);
}

export async function deleteQuickNote(id: string): Promise<QuickNote[]> {
  const all = await loadQuickNotes();
  const next = all.filter((n) => n.id !== id);
  await saveQuickNotes(next);
  return next;
}

/** Persist note, or remove from storage if body is empty. */
export async function upsertOrDeleteIfEmpty(note: QuickNote): Promise<QuickNote[]> {
  if (!note.body.trim()) {
    return deleteQuickNote(note.id);
  }
  return upsertQuickNote(note);
}
