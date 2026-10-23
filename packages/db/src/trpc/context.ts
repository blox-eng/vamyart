import { db } from "../client";

export async function createContext() {
  return { db, userId: null as string | null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
