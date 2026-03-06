import { router } from "./index";
import { inquiriesRouter } from "./routers/inquiries";
import { newsletterRouter } from "./routers/newsletter";
import { auctionsRouter } from "./routers/auctions";
import { bidsRouter } from "./routers/bids";
import { productsRouter } from "./routers/products";
import { checkoutRouter } from "./routers/checkout";
import { ordersRouter } from "./routers/orders";
import { artworksRouter } from "./routers/artworks";
import { shippingMethodsRouter } from "./routers/shippingMethods";
import { bannersRouter } from "./routers/banners";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
  auctions: auctionsRouter,
  bids: bidsRouter,
  products: productsRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  artworks: artworksRouter,
  shippingMethods: shippingMethodsRouter,
  banners: bannersRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
