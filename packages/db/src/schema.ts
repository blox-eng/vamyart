import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  inet,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const shippingMethodType = pgEnum("shipping_method_type", ["free", "paid", "custom"]);
export const bannerScope = pgEnum("banner_scope", ["global", "page"]);

// ─── Artworks ────────────────────────────────────────────────────────────────
export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  year: integer("year"),
  medium: text("medium"),
  dimensions: text("dimensions"),
  status: text("status").notNull().default("available"), // available | bidding | sold
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Artwork Images ──────────────────────────────────────────────────────────
export const artworkImages = pgTable("artwork_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  artworkId: uuid("artwork_id")
    .notNull()
    .references(() => artworks.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  altText: text("alt_text"),
  isPrimary: boolean("is_primary").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").references(() => artworks.id),
  productType: text("product_type").notNull(), // print | tote | sticker | ...
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Product Variants ─────────────────────────────────────────────────────────
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  available: boolean("available").notNull().default(true),
  attributes: jsonb("attributes"), // { size, paper } | { colour, material } etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  productVariantId: uuid("product_variant_id").notNull().references(() => productVariants.id),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  status: text("status").notNull().default("paid"), // paid | shipped | cancelled
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Auctions ─────────────────────────────────────────────────────────────────
export const auctions = pgTable("auctions", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id).unique(),
  minBid: numeric("min_bid", { precision: 10, scale: 2 }).notNull(),
  minIncrement: numeric("min_increment", { precision: 10, scale: 2 }).notNull().default("100"),
  currentBid: numeric("current_bid", { precision: 10, scale: 2 }),
  bidCount: integer("bid_count").notNull().default(0),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"), // active | closed | cancelled
  productVariantId: uuid("product_variant_id").references(() => productVariants.id),
  winnerBidId: uuid("winner_bid_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Bids ─────────────────────────────────────────────────────────────────────
export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  auctionId: uuid("auction_id").notNull().references(() => auctions.id),
  bidderName: text("bidder_name").notNull(),
  bidderEmail: text("bidder_email").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  ipAddress: inet("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Inquiries ────────────────────────────────────────────────────────────────
export const inquiries = pgTable("inquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  pieceInterest: text("piece_interest").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
});

// ─── Newsletter Subscribers ───────────────────────────────────────────────────
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).defaultNow().notNull(),
});


// ─── Shipping Methods ─────────────────────────────────────────────────────────
export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  displayText: text("display_text").notNull(),
  type: shippingMethodType("type").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Banners ──────────────────────────────────────────────────────────────────
export const banners = pgTable("banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  scope: bannerScope("scope").notNull().default("global"),
  pageSlug: text("page_slug"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const artworksRelations = relations(artworks, ({ one, many }) => ({
  product: many(products),
  auction: one(auctions, { fields: [artworks.id], references: [auctions.artworkId] }),
  images: many(artworkImages),
}));

export const artworkImagesRelations = relations(artworkImages, ({ one }) => ({
  artwork: one(artworks, {
    fields: [artworkImages.artworkId],
    references: [artworks.id],
  }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  artwork: one(artworks, { fields: [products.artworkId], references: [artworks.id] }),
  variants: many(productVariants),
  shippingMethod: one(shippingMethods, { fields: [products.shippingMethodId], references: [shippingMethods.id] }),
}));

export const shippingMethodsRelations = relations(shippingMethods, ({ many }) => ({
  products: many(products),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  productVariant: one(productVariants, {
    fields: [orders.productVariantId],
    references: [productVariants.id],
  }),
}));

export const auctionsRelations = relations(auctions, ({ one, many }) => ({
  artwork: one(artworks, { fields: [auctions.artworkId], references: [artworks.id] }),
  productVariant: one(productVariants, { fields: [auctions.productVariantId], references: [productVariants.id] }),
  bids: many(bids),
}));

export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, { fields: [bids.auctionId], references: [auctions.id] }),
}));
