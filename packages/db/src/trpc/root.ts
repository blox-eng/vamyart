import { router } from "./index";
import { inquiriesRouter } from "./routers/inquiries";
import { newsletterRouter } from "./routers/newsletter";
import { auctionsRouter } from "./routers/auctions";
import { bidsRouter } from "./routers/bids";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
  auctions: auctionsRouter,
  bids: bidsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
