import { TRPCError } from "@trpc/server";
import { verifyHuman } from "../services/turnstile";

// Every public form that makes us email an address the visitor typed must pass
// this first: bots used the newsletter form to subscription-bomb strangers (#61).
export async function assertHuman(token: string, ip: string | null | undefined): Promise<void> {
  if (!(await verifyHuman(token, ip))) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "We couldn't confirm you're not a bot. Reload the page and try again.",
    });
  }
}
