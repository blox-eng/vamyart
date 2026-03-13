import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@vamy/db/trpc";
import { createContext } from "@vamy/db/trpc/context";

async function handler(req: Request) {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

  // Only cache GET (query) responses — mutations (POST) must not be cached
  if (req.method !== "GET") return response;

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export { handler as GET, handler as POST };
