import { db } from "../client";

// `origin` is set by the studio's route handler; it locates sibling Netlify functions.
export type Context = { db: typeof db; userId: string | null; origin?: string };

export async function createContext(): Promise<Context> {
  return { db, userId: null };
}
