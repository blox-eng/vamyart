import { db } from "../client";

export async function createContext() {
  return { db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
