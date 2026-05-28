/** Lets SyncDataBridge push notes/reminders after local storage writes. */

type Listener = () => void;
type AsyncListener = () => void | Promise<void>;

const notesListeners = new Set<Listener>();
const remindersListeners = new Set<Listener>();
const notesUiRefreshListeners = new Set<AsyncListener>();
const remindersUiRefreshListeners = new Set<AsyncListener>();

function subscribe(set: Set<Listener>, fn: Listener): () => void {
  set.add(fn);
  return () => set.delete(fn);
}

function notify(set: Set<Listener>): void {
  for (const fn of set) fn();
}

export function subscribeNotesLocalChange(fn: Listener): () => void {
  return subscribe(notesListeners, fn);
}

export function notifyNotesLocalChange(): void {
  notify(notesListeners);
}

export function subscribeRemindersLocalChange(fn: Listener): () => void {
  return subscribe(remindersListeners, fn);
}

export function notifyRemindersLocalChange(): void {
  notify(remindersListeners);
}

export function subscribeNotesUiRefresh(fn: AsyncListener): () => void {
  notesUiRefreshListeners.add(fn);
  return () => notesUiRefreshListeners.delete(fn);
}

export async function notifyNotesUiRefresh(): Promise<void> {
  await Promise.all([...notesUiRefreshListeners].map((fn) => fn()));
}

export function subscribeRemindersUiRefresh(fn: AsyncListener): () => void {
  remindersUiRefreshListeners.add(fn);
  return () => remindersUiRefreshListeners.delete(fn);
}

export async function notifyRemindersUiRefresh(): Promise<void> {
  await Promise.all([...remindersUiRefreshListeners].map((fn) => fn()));
}
