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
import { artworkImagesRouter } from "./routers/artworkImages";
import { waitlistRouter } from "./routers/waitlist";
import { contactsRouter } from "./routers/contacts";
import { certificatesRouter } from "./routers/certificates";
import { collectionsRouter } from "./routers/collections";
import { galleryRouter } from "./routers/gallery";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
  auctions: auctionsRouter,
  bids: bidsRouter,
  products: productsRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  artworks: artworksRouter,
  collections: collectionsRouter,
  gallery: galleryRouter,
  shippingMethods: shippingMethodsRouter,
  banners: bannersRouter,
  artworkImages: artworkImagesRouter,
  waitlist: waitlistRouter,
  contacts: contactsRouter,
  certificates: certificatesRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
