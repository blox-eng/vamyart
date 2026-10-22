"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { NewCritique } from "./NewCritique";
import { PaintsPanel } from "./PaintsPanel";
import { RunView } from "./RunView";

export default function CritiquePage() {
  const utils = trpc.useUtils();
  const { data: runs } = trpc.critique.list.useQuery();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="p-4 sm:p-8 max-w-4xl space-y-8">
      <h1 className="text-2xl font-light">Critique</h1>

      <NewCritique
        onCreated={(id) => {
          utils.critique.list.invalidate();
          setSelected(id);
        }}
      />

      <PaintsPanel />

      {selected && <RunView id={selected} />}

      {runs && runs.length > 0 && (
        <section>
          <h2 className="text-lg font-light mb-3">Earlier critiques</h2>
          <ul className="divide-y border rounded-lg">
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r.id)}
                  aria-current={selected === r.id}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-hover"
                >
                  <span className="flex h-5 w-24 shrink-0 overflow-hidden rounded" aria-hidden>
                    {r.palette.swatches.map((s, i) => (
                      <span key={i} style={{ background: s.hex, flexGrow: s.area || 1 }} />
                    ))}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm">{r.prompt || "No question"}</span>
                  <span className="text-xs text-faint">
                    {r.status === "done" ? new Date(r.createdAt).toLocaleDateString() : r.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
