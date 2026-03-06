import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@vamy/db/trpc";
import { createContext } from "@vamy/db/trpc/context";

// Public-only endpoint: userId is always null here (no session cookie forwarding).
// Admin mutations are protected via protectedProcedure and will always throw
// UNAUTHORIZED when called through this route — use the admin app's own tRPC
// route for any authenticated operations.
const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
