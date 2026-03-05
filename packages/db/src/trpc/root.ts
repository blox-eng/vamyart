import { router } from "./index";
import { inquiriesRouter } from "./routers/inquiries";
import { newsletterRouter } from "./routers/newsletter";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
