import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@vamy/db/trpc";
import { createContext } from "@vamy/db/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
