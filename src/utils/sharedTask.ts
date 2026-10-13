import type { Category, Task, UUID } from "../types/user";

/** Task fields a share link may carry. The receiver generates its own id. */
export type SharedTask = Pick<
  Task,
  "done" | "pinned" | "name" | "description" | "emoji" | "color" | "date" | "deadline" | "category"
>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

const isDateString = (value: unknown): value is string =>
  isString(value) && !Number.isNaN(Date.parse(value));

const parseCategory = (value: unknown): Category | null => {
  if (!isRecord(value)) return null;
  const { id, name, emoji, color } = value;
  if (!isString(id) || !isString(name) || !isString(color)) return null;
  if (emoji !== undefined && !isString(emoji)) return null;
  return { id: id as UUID, name, color, ...(emoji !== undefined && { emoji }) };
};

/**
 * Validates a decoded share payload and returns only the known task fields,
 * with dates converted to `Date`. Returns `null` when a required field is missing
 * or any field has the wrong type. Color format is checked separately.
 */
export const parseSharedTask = (value: unknown): SharedTask | null => {
  if (!isRecord(value)) return null;
  const { done, pinned, name, description, emoji, color, date, deadline, category } = value;

  if (typeof done !== "boolean" || typeof pinned !== "boolean") return null;
  if (!isString(name) || !isString(color) || !isDateString(date)) return null;
  if (description !== undefined && !isString(description)) return null;
  if (emoji !== undefined && !isString(emoji)) return null;
  if (deadline !== undefined && !isDateString(deadline)) return null;

  let categories: Category[] | undefined;
  if (category !== undefined) {
    if (!Array.isArray(category)) return null;
    categories = [];
    for (const item of category) {
      const parsed = parseCategory(item);
      if (!parsed) return null;
      categories.push(parsed);
    }
  }

  return {
    done,
    pinned,
    name,
    color,
    date: new Date(date),
    ...(description !== undefined && { description }),
    ...(emoji !== undefined && { emoji }),
    ...(deadline !== undefined && { deadline: new Date(deadline) }),
    ...(categories !== undefined && { category: categories }),
  };
};
