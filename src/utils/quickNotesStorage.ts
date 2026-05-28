import AsyncStorage from "@react-native-async-storage/async-storage";
import { notifyNotesLocalChange } from "./syncLocalChangeNotify";

const STORAGE_KEY = "@saycart/quick_notes_v1";

export type QuickNote = {
  id: string;
  body: string;
  updatedAt: string;
  deletedAt?: string;
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
    const deletedAt = typeof o.deletedAt === "string" ? o.deletedAt : undefined;
    out.push({ id: o.id, body: o.body, updatedAt, deletedAt });
  }
  return out;
}

export function sortNotesByUpdatedDesc(notes: QuickNote[]): QuickNote[] {
  return [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function loadQuickNotesAll(): Promise<QuickNote[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sortNotesByUpdatedDesc(parseNotes(JSON.parse(raw) as unknown));
  } catch {
    return [];
  }
}

export async function loadQuickNotes(): Promise<QuickNote[]> {
  return (await loadQuickNotesAll()).filter((n) => !n.deletedAt);
}

export async function saveQuickNotes(notes: QuickNote[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  notifyNotesLocalChange();
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
  const all = await loadQuickNotesAll();
  const at = new Date().toISOString();
  const next = all.map((n) =>
    n.id === id ? { ...n, body: "", deletedAt: at, updatedAt: at } : n
  );
  await saveQuickNotes(next);
  return next.filter((n) => !n.deletedAt);
}

/** Persist note, or remove from storage if body is empty. */
export async function upsertOrDeleteIfEmpty(note: QuickNote): Promise<QuickNote[]> {
  if (!note.body.trim()) {
    return deleteQuickNote(note.id);
  }
  return upsertQuickNote(note);
}
