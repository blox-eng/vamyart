"use client";

import { useEffect, useMemo, useState } from "react";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "@vamy/db/trpc";
import { extractPalette, whiteBalanceGains } from "@vamy/palette";
import { trpc } from "@/lib/trpc";
import { createClient } from "@/lib/supabase/client";
import { resizeImageForUpload } from "@/lib/image/resize";
import { loadPixels, withWhiteBalance, type Pixels } from "@/lib/image/pixels";
import { useToast } from "@/components/ui/toast";

type CreateInput = inferRouterInputs<AppRouter>["critique"]["create"];

const SWATCHES = 6;
const SAMPLE_RADIUS = 2;

function averageAround(px: Pixels, x: number, y: number): [number, number, number] {
  const sum = [0, 0, 0];
  let n = 0;
  for (let dy = -SAMPLE_RADIUS; dy <= SAMPLE_RADIUS; dy++)
    for (let dx = -SAMPLE_RADIUS; dx <= SAMPLE_RADIUS; dx++) {
      const sx = Math.min(px.width - 1, Math.max(0, x + dx));
      const sy = Math.min(px.height - 1, Math.max(0, y + dy));
      const p = (sy * px.width + sx) * 4;
      sum[0] += px.data[p]; sum[1] += px.data[p + 1]; sum[2] += px.data[p + 2]; n++;
    }
  return sum.map((v) => Math.round(v / n)) as [number, number, number];
}

export function NewCritique({ onCreated }: { onCreated: (id: string) => void }) {
  const toast = useToast();
  const { data: pieces } = trpc.artworks.list.useQuery();
  const { data: models } = trpc.critique.models.useQuery();
  const createUploadUrl = trpc.critique.createUploadUrl.useMutation();
  const create = trpc.critique.create.useMutation();

  const [upload, setUpload] = useState<{ blob: Blob; url: string } | null>(null);
  const [pixels, setPixels] = useState<Pixels | null>(null);
  const [gains, setGains] = useState<[number, number, number] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [artworkId, setArtworkId] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => () => { if (upload) URL.revokeObjectURL(upload.url); }, [upload]);

  const swatches = useMemo(
    () => (pixels ? extractPalette(withWhiteBalance(pixels, gains).data, { k: SWATCHES }) : []),
    [pixels, gains]
  );

  async function choose(file: File | undefined) {
    if (!file) return;
    setGains(null);
    try {
      const { blob } = await resizeImageForUpload(file);
      setUpload({ blob, url: URL.createObjectURL(blob) });
      setPixels(await loadPixels(blob));
    } catch {
      toast("Could not read that image", "error");
    }
  }

  function tapNeutral(e: React.MouseEvent<HTMLImageElement>) {
    if (!pixels) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * (pixels.width - 1));
    const y = Math.round(((e.clientY - rect.top) / rect.height) * (pixels.height - 1));
    setGains(whiteBalanceGains(averageAround(pixels, x, y)));
  }

  async function run() {
    if (!upload) return;
    setBusy(true);
    try {
      const contentType = upload.blob.type as "image/jpeg" | "image/png" | "image/webp";
      const { path, token } = await createUploadUrl.mutateAsync({ contentType });
      const { error } = await createClient().storage.from("critique-uploads").uploadToSignedUrl(path, token, upload.blob, { contentType });
      if (error) throw error;
      const { id } = await create.mutateAsync({
        storagePath: path,
        prompt: prompt.trim() || null,
        whiteBalance: gains,
        swatches,
        artworkId: artworkId || null,
        model: (model || null) as CreateInput["model"],
      });
      setUpload(null);
      setPixels(null);
      setPrompt("");
      onCreated(id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not start the critique", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border rounded-lg p-4 space-y-4">
      <label className="block">
        <span className="text-sm">Photo of the painting</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => choose(e.target.files?.[0])}
          className="mt-1 block w-full text-sm"
        />
      </label>

      {upload && (
        <div className="space-y-2">
          <img
            src={upload.url}
            alt="The painting to critique"
            onClick={tapNeutral}
            className="max-h-[60vh] w-auto cursor-crosshair"
          />
          <p className="text-xs text-muted">
            {gains
              ? "Colour corrected from the spot you tapped."
              : "Tap something white or neutral grey in the photo to correct its colour cast."}
            {gains && (
              <button type="button" onClick={() => setGains(null)} className="ml-2 underline">
                Use as photographed
              </button>
            )}
          </p>
          <div className="flex h-8 overflow-hidden rounded" aria-label="Measured palette">
            {swatches.map((s) => (
              <div key={s.hex} title={s.hex} style={{ background: s.hex, flexGrow: s.area }} />
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-sm">What do you want to know? (optional)</span>
        <textarea
          rows={2}
          maxLength={2000}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. is the left side too busy?"
          className="mt-1 w-full border px-3 py-2 rounded text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm">Piece (optional)</span>
        <select value={artworkId} onChange={(e) => setArtworkId(e.target.value)} className="mt-1 w-full border px-3 py-2 rounded text-sm bg-paper">
          <option value="">Not linked to a piece</option>
          {pieces?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm">Model</span>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full border px-3 py-2 rounded text-sm bg-paper">
          <option value="">Default ({models?.default ?? "…"})</option>
          {models?.models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      <button
        type="button"
        onClick={run}
        disabled={!upload || busy || swatches.length === 0}
        className="bg-ink text-paper px-4 min-h-11 rounded text-sm disabled:opacity-50"
      >
        {busy ? "Starting…" : "Run critique"}
      </button>
    </section>
  );
}
