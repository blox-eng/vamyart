import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@vamy/db/trpc";

export const trpc = createTRPCReact<AppRouter>();
