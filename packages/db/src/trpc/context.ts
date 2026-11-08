import { db } from "../client";

export interface Context {
  db: typeof db;
  userId: string | null;
  clientIp?: string | null;
}

// Netlify sets x-nf-client-connection-ip itself, so a visitor cannot forge it.
// x-forwarded-for is the fallback for local dev and other hosts.
export function clientIpFrom(headers: Headers): string | null {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export async function createContext(opts?: { req: Request }): Promise<Context> {
  return { db, userId: null, clientIp: opts ? clientIpFrom(opts.req.headers) : null };
}
