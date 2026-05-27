"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

export default function PeoplePage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = trpc.contacts.list.useQuery({ search: search.trim() || undefined });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-6">People</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full sm:w-80 mb-6 border rounded-lg px-3 py-2 text-sm"
      />

      {isLoading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No people yet.
                    </td>
                  </tr>
                )}
                {data?.items.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">{c.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <TagChips tags={c.tags} />
                      {c.doNotContact && (
                        <span className="ml-1 text-xs text-red-600">do-not-contact</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {data?.items.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No people yet.</p>
            )}
            {data?.items.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left rounded-lg border bg-white p-4"
              >
                <div className="font-medium">{c.name || c.email}</div>
                <div className="text-sm text-gray-600">{c.email}</div>
                <div className="mt-2"><TagChips tags={c.tags} /></div>
                {c.doNotContact && <div className="text-xs text-red-600 mt-1">do-not-contact</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedId && (
        <ContactDetail key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} onSaved={() => toast("contact saved", "success")} />
      )}
    </div>
  );
}

function TagChips({ tags }: { tags: string[] }) {
  if (!tags?.length) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="text-xs bg-gray-100 border rounded px-2 py-0.5">{t}</span>
      ))}
    </span>
  );
}

function ContactDetail({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.contacts.get.useQuery({ id });
  const [tags, setTags] = useState<string[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [dnc, setDnc] = useState<boolean | null>(null);
  const [tagInput, setTagInput] = useState("");

  const update = trpc.contacts.update.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      utils.contacts.get.invalidate({ id });
      onSaved();
    },
  });

  if (isLoading || !data) return null;
  const c = data.contact;
  const curTags = tags ?? c.tags;
  const curNotes = notes ?? c.notes ?? "";
  const curDnc = dnc ?? c.doNotContact;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-lg sm:rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-light">{c.name || c.email}</h2>
            <p className="text-sm text-gray-600">{c.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {/* Tags */}
        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Tags</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {curTags.map((t) => (
            <span key={t} className="text-xs bg-gray-100 border rounded px-2 py-0.5 flex items-center gap-1">
              {t}
              <button onClick={() => setTags(curTags.filter((x) => x !== t))} className="text-gray-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tagInput.trim()) {
              e.preventDefault();
              if (!curTags.includes(tagInput.trim())) setTags([...curTags, tagInput.trim()]);
              setTagInput("");
            }
          }}
          placeholder="Add a tag, press Enter"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
        />

        {/* Notes */}
        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Notes</label>
        <textarea
          value={curNotes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
        />

        {/* Do not contact */}
        <label className="flex items-center gap-2 text-sm mb-6">
          <input type="checkbox" checked={curDnc} onChange={(e) => setDnc(e.target.checked)} />
          Do not contact
        </label>

        <button
          onClick={() => update.mutate({ id, tags: curTags, notes: curNotes || null, doNotContact: curDnc })}
          disabled={update.isPending}
          className="w-full bg-black text-white py-2.5 text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 mb-6"
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>

        {/* Timeline */}
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Activity</h3>
        <ul className="space-y-2">
          {data.timeline.length === 0 && <li className="text-sm text-gray-400">No activity.</li>}
          {data.timeline.map((e, i) => (
            <li key={i} className="text-sm flex justify-between gap-3">
              <span>{e.summary}</span>
              <span className="text-gray-400 whitespace-nowrap">
                {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
