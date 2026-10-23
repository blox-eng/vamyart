"use client";

import { useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vamy/db/trpc";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";

export type PaintRow = inferRouterOutputs<AppRouter>["paints"]["list"][number];

export function matchesPaint(p: PaintRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${p.brand} ${p.name} ${p.pigments.join(" ")}`.toLowerCase().includes(q);
}

export function PaintsPanel() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const { data: paints } = trpc.paints.list.useQuery();
  const setOwned = trpc.paints.setOwned.useMutation({ onSuccess: () => utils.paints.list.invalidate() });
  const create = trpc.paints.create.useMutation({
    onSuccess: () => {
      utils.paints.list.invalidate();
      setDraft({ brand: "", name: "", pigments: "", hex: "#888888" });
      toast("Paint added to your tubes", "success");
    },
    onError: (e) => toast(e.message, "error"),
  });
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ brand: "", name: "", pigments: "", hex: "#888888" });

  const owned = paints?.filter((p) => p.owned).length ?? 0;
  const shown = (paints ?? []).filter((p) => matchesPaint(p, query));

  return (
    <details className="border rounded-lg p-4">
      <summary className="cursor-pointer text-sm">
        My paints <span className="text-muted">· {owned} tubes</span>
      </summary>
      <p className="mt-3 text-xs text-muted">
        Recipes only mix from tubes you own. Catalogue colours are approximations of each pigment;
        for an exact match, add your own tube with the colour picked from a photo of a swatch.
      </p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, brand or pigment (PB29)"
        className="mt-3 w-full border px-3 py-2 rounded text-sm"
      />
      <ul className="mt-3 max-h-80 overflow-y-auto divide-y">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className="h-6 w-6 shrink-0 rounded-full border" style={{ background: p.hex }} aria-hidden />
            <span className="flex-1 min-w-0 text-sm">
              {p.name} <span className="text-xs text-faint">{p.brand} · {p.pigments.join(", ")}</span>
            </span>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={p.owned}
                onChange={(e) => setOwned.mutate({ id: p.id, owned: e.target.checked })}
              />
              I own it
            </label>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_8rem_3rem_auto] items-end"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({
            brand: draft.brand,
            name: draft.name,
            pigments: draft.pigments.split(/[\s,]+/).filter(Boolean).map((p) => p.toUpperCase()),
            hex: draft.hex,
          });
        }}
      >
        <input required placeholder="Brand" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} className="border px-3 py-2 rounded text-sm" />
        <input required placeholder="Colour name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="border px-3 py-2 rounded text-sm" />
        <input placeholder="Pigments" value={draft.pigments} onChange={(e) => setDraft({ ...draft, pigments: e.target.value })} className="border px-3 py-2 rounded text-sm" />
        <input type="color" aria-label="Tube colour" value={draft.hex} onChange={(e) => setDraft({ ...draft, hex: e.target.value })} className="h-10 w-full rounded border" />
        <button type="submit" disabled={create.isPending} className="border px-3 min-h-10 rounded text-sm disabled:opacity-50">Add tube</button>
      </form>
    </details>
  );
}
