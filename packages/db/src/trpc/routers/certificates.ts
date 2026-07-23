import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { certificates, certificateSettings } from "../../schema";
import {
  assertEditionAvailable,
  buildCertificateSnapshot,
  formatCertNumber,
  DEFAULT_CERTIFICATE_SETTINGS,
  type CertificateSettings,
} from "../../certificates/model";

export function nextCertNumberFromSeq(seq: number, issuedAt: Date): string {
  return formatCertNumber(seq, issuedAt.getUTCFullYear());
}

async function loadSettings(): Promise<CertificateSettings> {
  const rows = await db.select().from(certificateSettings).limit(1);
  const s = rows[0];
  if (!s) return DEFAULT_CERTIFICATE_SETTINGS;
  return {
    headerText: s.headerText,
    studioName: s.studioName,
    statementTemplate: s.statementTemplate,
    copyrightLine: s.copyrightLine,
    careLine: s.careLine,
    signatureLabel: s.signatureLabel,
  };
}

const issueInput = z.object({
  artworkId: z.string().uuid(),
  kind: z.enum(["original", "print"]),
  productVariantId: z.string().uuid().optional(),
  editionNumber: z.number().int().positive().optional(),
  editionSize: z.number().int().positive().optional(),
  buyerName: z.string().trim().min(1).optional(),
  imagePath: z.string().optional(),
  // pre-filled but editable in the dialog:
  title: z.string().min(1),
  year: z.number().int().nullable().optional(),
  medium: z.string().nullable().optional(),
  dimensions: z.string().nullable().optional(),
  statementOverride: z.string().trim().min(1).optional(),
});

export const certificatesRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.certificates.findMany({
      where: (c, { isNull }) => isNull(c.deletedAt),
      orderBy: (c, { desc }) => [desc(c.issuedAt)],
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const row = await db.query.certificates.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  editionsFor: protectedProcedure
    .input(z.object({ productVariantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({ editionNumber: certificates.editionNumber })
        .from(certificates)
        .where(
          and(
            eq(certificates.productVariantId, input.productVariantId),
            isNull(certificates.deletedAt),
          ),
        );
      const taken = rows
        .map((r) => r.editionNumber)
        .filter((n): n is number => n != null)
        .sort((a, b) => a - b);
      return { taken };
    }),

  issue: protectedProcedure.input(issueInput).mutation(async ({ input }) => {
    if (input.kind === "print") {
      if (!input.productVariantId || input.editionNumber == null || input.editionSize == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Prints require a variant, edition number, and edition size.",
        });
      }
      const takenRows = await db
        .select({ editionNumber: certificates.editionNumber })
        .from(certificates)
        .where(
          and(
            eq(certificates.productVariantId, input.productVariantId),
            isNull(certificates.deletedAt),
          ),
        );
      const taken = takenRows
        .map((r) => r.editionNumber)
        .filter((n): n is number => n != null);
      try {
        assertEditionAvailable(taken, input.editionNumber, input.editionSize);
      } catch (e) {
        throw new TRPCError({ code: "CONFLICT", message: (e as Error).message });
      }
    }

    const settings = await loadSettings();
    const issuedAt = new Date();
    const seqRow = await db.execute(sql`select nextval('certificate_seq') as v`);
    const seq = Number((seqRow as unknown as Array<{ v: string | number }>)[0].v);
    const certNumber = nextCertNumberFromSeq(seq, issuedAt);

    const snapshot = buildCertificateSnapshot(
      {
        certNumber,
        title: input.title,
        year: input.year ?? null,
        medium: input.medium ?? null,
        dimensions: input.dimensions ?? null,
        editionNumber: input.kind === "print" ? input.editionNumber! : null,
        editionSize: input.kind === "print" ? input.editionSize! : null,
        buyerName: input.buyerName ?? null,
        issuedAt,
        statementOverride: input.statementOverride,
      },
      settings,
    );

    try {
      const [row] = await db
        .insert(certificates)
        .values({
          certNumber,
          kind: input.kind,
          artworkId: input.artworkId,
          productVariantId: input.productVariantId ?? null,
          editionNumber: input.kind === "print" ? input.editionNumber! : null,
          editionSize: input.kind === "print" ? input.editionSize! : null,
          buyerName: input.buyerName ?? null,
          imagePath: input.imagePath ?? null,
          fieldsSnapshot: snapshot,
          issuedAt,
        })
        .returning();
      return row;
    } catch (e) {
      // Partial unique index backstop against a race on the same edition number.
      if (String((e as Error).message).includes("certificates_variant_edition_unique")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Edition number ${input.editionNumber} was just issued by another certificate.`,
        });
      }
      throw e;
    }
  }),

  settings: router({
    get: protectedProcedure.query(async () => {
      const rows = await db.select().from(certificateSettings).limit(1);
      return rows[0] ?? null;
    }),
    update: protectedProcedure
      .input(
        z.object({
          headerText: z.string().min(1),
          studioName: z.string().min(1),
          statementTemplate: z.string().min(1),
          copyrightLine: z.string(),
          careLine: z.string(),
          signatureLabel: z.string().min(1),
          logoPath: z.string().nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const existing = await db.select({ id: certificateSettings.id }).from(certificateSettings).limit(1);
        if (existing[0]) {
          const [row] = await db
            .update(certificateSettings)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(certificateSettings.id, existing[0].id))
            .returning();
          return row;
        }
        const [row] = await db.insert(certificateSettings).values(input).returning();
        return row;
      }),
  }),
});
