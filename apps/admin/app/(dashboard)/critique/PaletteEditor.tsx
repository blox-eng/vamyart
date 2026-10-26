"use client";

import { useEffect, useMemo, useState } from "react";
import { deltaE, mixParts, recipeText, solveRecipe, type Paint, type Recipe, type Swatch } from "@vamy/palette";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { revalidatePaths } from "@/lib/revalidate";
import { pieceRevalidatePaths } from "@/lib/revalidate-paths";
import { matchesPaint, type PaintRow } from "./PaintsPanel";

const MAX_SWATCHES = 12;

function toPaint(p: PaintRow): Paint {
  return { id: p.id, brand: p.brand, name: p.name, hex: p.hex, pigments: p.pigments };
}

function recipeFrom(target: string, parts: [Paint, number][]): Recipe {
  const hex = mixParts(parts);
  return {
    hex,
    deltaE: Math.round(deltaE(target, hex) * 10) / 10,
    parts: parts.map(([p, n]) => ({ paintId: p.id, name: p.name, pigments: p.pigments, parts: n })),
  };
}

export function PaletteEditor({ initial, artworkId: initialArtworkId }: { initial: Swatch[]; artworkId: string | null }) {
  const toast = useToast();
  const { data: paints } = trpc.paints.list.useQuery();
  const { data: pieces } = trpc.artworks.list.useQuery();
  const save = trpc.critique.savePalette.useMutation();

  const [swatches, setSwatches] = useState<Swatch[]>(initial);
  const [artworkId, setArtworkId] = useState(initialArtworkId ?? "");
  const [show, setShow] = useState(true);
  const [open, setOpen] = useState<number | null>(null);

  const owned = useMemo(() => (paints ?? []).filter((p) => p.owned).map(toPaint), [paints]);

  // Solve missing recipes one swatch per tick so the page stays responsive.
  useEffect(() => {
    if (owned.length === 0) return;
    const i = swatches.findIndex((s) => !s.recipe);
    if (i === -1) return;
    const t = setTimeout(() => {
      const recipe = solveRecipe(swatches[i].hex, owned);
      setSwatches((prev) => prev.map((s, j) => (j === i ? { ...s, recipe } : s)));
    }, 0);
    return () => clearTimeout(t);
  }, [swatches, owned]);

  const update = (i: number, patch: Partial<Swatch>) =>
    setSwatches((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  async function handleSave() {
    if (!artworkId) return;
    try {
      const { slug } = await save.mutateAsync({ artworkId, palette: { swatches }, showPalette: show });
      await revalidatePaths(pieceRevalidatePaths(slug, []));
      toast(show ? "Palette saved and shown on the piece page" : "Palette saved (hidden on the website)", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the palette", "error");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-light">Palette</h2>
      {owned.length === 0 && (
        <p className="text-sm text-warn">Mark the tubes you own under “My paints” to get mixing recipes.</p>
      )}
      <ul className="space-y-2">
        {swatches.map((s, i) => (
          <li key={i} className="border rounded-lg p-3">
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={`Colour of swatch ${i + 1}`}
                value={s.hex}
                onChange={(e) => update(i, { hex: e.target.value, recipe: null })}
                className="h-11 w-11 shrink-0 rounded border"
              />
              <div className="flex-1 min-w-0">
                <input
                  value={s.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Name this colour"
                  maxLength={80}
                  className="w-full border-0 border-b px-0 py-1 text-sm bg-transparent"
                />
                <p className="mt-1 text-xs text-muted truncate">
                  {s.recipe ? `${recipeText(s.recipe)} · ΔE ${s.recipe.deltaE}` : owned.length ? "Mixing…" : "—"}
                  <span className="text-faint"> · {Math.round(s.area * 100)}%</span>
                </p>
              </div>
              {s.recipe && (
                <span className="h-11 w-6 shrink-0 rounded" style={{ background: s.recipe.hex }} title="Predicted mix" aria-hidden />
              )}
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="border px-3 min-h-11 rounded text-xs">
                {open === i ? "Done" : "Adjust"}
              </button>
              <button
                type="button"
                onClick={() => setSwatches((prev) => prev.filter((_, j) => j !== i))}
                className="border px-3 min-h-11 rounded text-xs text-neg"
                aria-label={`Remove swatch ${i + 1}`}
              >
                ×
              </button>
            </div>
            {open === i && (
              <SwatchAdjust
                swatch={s}
                owned={owned}
                catalogue={paints ?? []}
                onChange={(patch) => update(i, patch)}
              />
            )}
          </li>
        ))}
      </ul>
      {swatches.length < MAX_SWATCHES && (
        <button
          type="button"
          onClick={() => setSwatches((prev) => [...prev, { hex: "#888888", name: "", area: 0, recipe: null }])}
          className="border px-3 min-h-11 rounded text-xs"
        >
          Add a colour
        </button>
      )}

      <div className="border-t pt-4 flex flex-wrap items-center gap-3">
        <select value={artworkId} onChange={(e) => setArtworkId(e.target.value)} className="border px-3 min-h-11 rounded text-sm bg-paper">
          <option value="">Choose a piece…</option>
          {pieces?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          Show the palette on vamy.art
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={!artworkId || save.isPending || swatches.length === 0}
          className="bg-ink text-paper px-4 min-h-11 rounded text-sm disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save palette to piece"}
        </button>
      </div>
      <p className="text-xs text-muted">
        {show
          ? "Visitors see a small “Palette” line under the painting and open it if they want."
          : "Hidden: nothing about the palette appears on the piece page."}
      </p>
    </section>
  );
}

function SwatchAdjust({
  swatch,
  owned,
  catalogue,
  onChange,
}: {
  swatch: Swatch;
  owned: Paint[];
  catalogue: PaintRow[];
  onChange: (patch: Partial<Swatch>) => void;
}) {
  const [query, setQuery] = useState("");
  const byId = new Map(catalogue.map((p) => [p.id, toPaint(p)]));
  const parts: [Paint, number][] = (swatch.recipe?.parts ?? [])
    .map((p) => [byId.get(p.paintId), p.parts] as [Paint | undefined, number])
    .filter((p): p is [Paint, number] => !!p[0]);

  const setParts = (next: [Paint, number][]) =>
    onChange({ recipe: next.length ? recipeFrom(swatch.hex, next) : null });

  const matches = query.trim() ? catalogue.filter((p) => matchesPaint(p, query)).slice(0, 8) : [];

  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-xs text-muted">Recipe from your tubes</p>
        {parts.map(([paint, n], k) => (
          <div key={k} className="flex items-center gap-2">
            <select
              value={paint.id}
              onChange={(e) => setParts(parts.map((p, j) => (j === k ? [byId.get(e.target.value)!, p[1]] : p)))}
              className="flex-1 min-w-0 border px-2 min-h-10 rounded text-sm bg-paper"
            >
              {(owned.some((p) => p.id === paint.id) ? owned : [paint, ...owned]).map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={20}
              value={n}
              aria-label="Parts"
              onChange={(e) => setParts(parts.map((p, j) => (j === k ? [p[0], Math.max(1, Math.min(20, Number(e.target.value) || 1))] : p)))}
              className="w-16 border px-2 min-h-10 rounded text-sm"
            />
            <button type="button" onClick={() => setParts(parts.filter((_, j) => j !== k))} className="border px-2 min-h-10 rounded text-xs" aria-label="Remove tube">×</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {parts.length < 3 && owned.length > 0 && (
            <button type="button" onClick={() => setParts([...parts, [owned[0], 1]])} className="border px-3 min-h-10 rounded text-xs">Add a tube</button>
          )}
          <button type="button" onClick={() => onChange({ recipe: solveRecipe(swatch.hex, owned) })} className="border px-3 min-h-10 rounded text-xs">
            Re-solve
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted">Or set this colour to a catalogue tube</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tubes (name, brand, PB29…)"
          className="w-full border px-3 py-2 rounded text-sm"
        />
        <ul className="divide-y">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  const paint = toPaint(p);
                  onChange({ hex: p.hex, name: swatch.name || p.name, recipe: recipeFrom(p.hex, [[paint, 1]]) });
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 py-2 text-left text-sm hover:bg-hover"
              >
                <span className="h-5 w-5 shrink-0 rounded-full border" style={{ background: p.hex }} aria-hidden />
                {p.name} <span className="text-xs text-faint">{p.brand} · {p.pigments.join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
