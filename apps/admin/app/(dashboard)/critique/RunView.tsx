"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { drawChromaMap, drawValueStudy, loadPixels, withWhiteBalance, type Pixels } from "@/lib/image/pixels";
import { PaletteEditor } from "./PaletteEditor";

const POLL_MS = 2000;

export function RunView({ id }: { id: string }) {
  const { data: run, error } = trpc.critique.get.useQuery(
    { id },
    { refetchInterval: (q) => (["queued", "running"].includes(q.state.data?.status ?? "queued") ? POLL_MS : false) }
  );

  if (error) return <p className="text-sm text-neg">{error.message}</p>;
  if (!run) return <p className="text-sm text-faint">Loading…</p>;

  const names = run.result?.swatchNames ?? [];
  const swatches = run.palette.swatches.map((s, i) => ({ ...s, name: s.name || names[i] || "" }));

  return (
    <div className="space-y-8">
      {run.prompt && <p className="text-sm italic text-muted">“{run.prompt}”</p>}

      {run.status === "failed" && <p className="text-sm text-neg">The critique failed: {run.error}</p>}
      {(run.status === "queued" || run.status === "running") && (
        <p className="text-sm text-muted" role="status">Looking at the painting…</p>
      )}
      {run.result && (
        <section className="space-y-4">
          <p className="text-base">{run.result.answer}</p>
          <dl className="space-y-3 text-sm">
            {(["colour", "value", "composition"] as const).map((k) => (
              <div key={k}>
                <dt className="text-xs uppercase tracking-widest text-faint">{k}</dt>
                <dd className="mt-1">{run.result![k]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-faint">
            {run.model}
            {run.costUsd && ` · $${Number(run.costUsd).toFixed(4)}`}
          </p>
        </section>
      )}

      {run.imageUrl && <Studies imageUrl={run.imageUrl} gains={run.whiteBalance} />}

      {run.status !== "queued" && run.status !== "running" && (
        <PaletteEditor key={`${run.id}-${run.status}`} initial={swatches} artworkId={run.artworkId} />
      )}
    </div>
  );
}

const STUDIES: { label: string; draw: (c: HTMLCanvasElement, px: Pixels) => void }[] = [
  { label: "Values", draw: (c, px) => drawValueStudy(c, px, null) },
  { label: "3-value notan", draw: (c, px) => drawValueStudy(c, px, 3) },
  { label: "5-value notan", draw: (c, px) => drawValueStudy(c, px, 5) },
  { label: "Chroma", draw: drawChromaMap },
];

function Studies({ imageUrl, gains }: { imageUrl: string; gains: [number, number, number] | null }) {
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPixels(imageUrl)
      .then((raw) => {
        if (cancelled) return;
        const px = withWhiteBalance(raw, gains);
        STUDIES.forEach((s, i) => canvases.current[i] && s.draw(canvases.current[i]!, px));
      })
      .catch(() => setFailed(true));
    return () => { cancelled = true; };
    // The signed URL changes on every refetch; the image behind it doesn't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl.split("?")[0], gains]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-light">Studies</h2>
      {failed && <p className="text-sm text-neg">Could not load the photo for the studies.</p>}
      <img src={imageUrl} alt="The painting" className="max-h-[60vh] w-auto" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STUDIES.map((s, i) => (
          <figure key={s.label}>
            <canvas ref={(el) => { canvases.current[i] = el; }} className="w-full h-auto" />
            <figcaption className="mt-1 text-xs text-muted">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
