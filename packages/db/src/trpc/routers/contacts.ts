import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { contacts, inquiries, bids, orders, variantWaitlist, newsletterSubscribers } from "../../schema";

export type TimelineEvent = {
  type: "inquiry" | "bid" | "order" | "waitlist" | "subscription";
  at: Date;
  summary: string;
};

export const contactsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          tag: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(50),
        })
        .prefault({}),
    )
    .query(async ({ input }) => {
      const conds = [];
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conds.push(or(ilike(contacts.name, q), ilike(contacts.email, q)));
      }
      if (input.tag?.trim()) {
        conds.push(sql`${input.tag} = any(${contacts.tags})`);
      }
      const where = conds.length ? and(...conds) : undefined;

      const [items, totalRow] = await Promise.all([
        db
          .select()
          .from(contacts)
          .where(where)
          .orderBy(desc(contacts.updatedAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(where),
      ]);

      return {
        items,
        total: totalRow[0]?.count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, input.id) });
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      const email = contact.email;
      const [inqs, bds, ords, wl, ns] = await Promise.all([
        db.select().from(inquiries).where(eq(inquiries.email, email)),
        db.select().from(bids).where(eq(bids.bidderEmail, email)),
        db.select().from(orders).where(eq(orders.buyerEmail, email)),
        db.select().from(variantWaitlist).where(eq(variantWaitlist.email, email)),
        db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)),
      ]);

      const timeline: TimelineEvent[] = [
        ...inqs.map((r) => ({
          type: "inquiry" as const,
          at: r.createdAt,
          summary: `Inquired about ${r.pieceInterest}${r.handledAt ? " (handled)" : ""}`,
        })),
        ...bds.map((r) => ({
          type: "bid" as const,
          at: r.createdAt,
          summary: `Bid €${Number(r.amount).toLocaleString()}`,
        })),
        ...ords.map((r) => ({
          type: "order" as const,
          at: r.createdAt,
          summary: `Ordered (€${Number(r.amountPaid).toLocaleString()}, ${r.status})`,
        })),
        ...wl.map((r) => ({
          type: "waitlist" as const,
          at: r.createdAt,
          summary: `Joined a waitlist${r.notifiedAt ? " (notified)" : ""}`,
        })),
        ...ns.map((r) => ({
          type: "subscription" as const,
          at: r.subscribedAt,
          summary: "Subscribed to the newsletter",
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      return { contact, timeline };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tags: z.array(z.string().min(1)).max(20),
        notes: z.string().nullable(),
        doNotContact: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(contacts)
        .set({
          tags: input.tags,
          notes: input.notes,
          doNotContact: input.doNotContact,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return row;
    }),
});
