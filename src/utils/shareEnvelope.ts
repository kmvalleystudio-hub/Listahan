import type { GroceryShareFileV1 } from "./grocerySharePayload";
import { GROCERY_SHARE_KIND, parseGrocerySharePayload } from "./grocerySharePayload";
import type { ReminderShareFileV1 } from "./reminderSharePayload";
import { REMINDER_SHARE_KIND, parseReminderSharePayload } from "./reminderSharePayload";
import type { TodoShareFileV1 } from "./todoSharePayload";
import { TODO_SHARE_KIND, parseTodoSharePayload } from "./todoSharePayload";

export type ParsedShareEnvelope =
  | { tool: "grocery"; payload: GroceryShareFileV1 }
  | { tool: "todo"; payload: TodoShareFileV1 }
  | { tool: "reminder"; payload: ReminderShareFileV1 };

export function parseShareEnvelope(raw: unknown): ParsedShareEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = (raw as Record<string, unknown>).kind;
  if (kind === GROCERY_SHARE_KIND) {
    const p = parseGrocerySharePayload(raw);
    return p ? { tool: "grocery", payload: p } : null;
  }
  if (kind === TODO_SHARE_KIND) {
    const p = parseTodoSharePayload(raw);
    return p ? { tool: "todo", payload: p } : null;
  }
  if (kind === REMINDER_SHARE_KIND) {
    const p = parseReminderSharePayload(raw);
    return p ? { tool: "reminder", payload: p } : null;
  }
  return null;
}
