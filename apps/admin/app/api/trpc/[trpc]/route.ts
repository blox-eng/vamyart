import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createServerClient } from "@supabase/ssr";
import { appRouter } from "@vamy/db/trpc";
import { db } from "@vamy/db";

async function createAdminContext({ req }: { req: Request }) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = req.headers.get("cookie") ?? "";
          return cookieHeader.split(";").flatMap((part) => {
            const [name, ...rest] = part.trim().split("=");
            if (!name) return [];
            return [{ name: name.trim(), value: rest.join("=").trim() }];
          });
        },
        setAll() {
          // Route handler — cookie setting handled by middleware
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  return { db, userId: user?.id ?? null };
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createAdminContext({ req }),
  });

export { handler as GET, handler as POST };
