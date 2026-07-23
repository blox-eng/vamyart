"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "../../../../lib/trpc";
import { useToast } from "@/components/ui/toast";

export default function CertificateSettingsPage() {
  const toast = useToast();
  const { data, isLoading } = trpc.certificates.settings.get.useQuery();
  const update = trpc.certificates.settings.update.useMutation({
    onSuccess: () => toast("Template saved", "success"),
    onError: (e) => toast(e.message || "Could not save", "error"),
  });

  const [form, setForm] = useState({
    headerText: "",
    studioName: "",
    statementTemplate: "",
    copyrightLine: "",
    careLine: "",
    signatureLabel: "",
  });

  useEffect(() => {
    if (data) {
      setForm({
        headerText: data.headerText,
        studioName: data.studioName,
        statementTemplate: data.statementTemplate,
        copyrightLine: data.copyrightLine,
        careLine: data.careLine,
        signatureLabel: data.signatureLabel,
      });
    }
  }, [data]);

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="p-6 max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-light tracking-wide">Certificate template</h1>
        <Link href="/certificates" className="text-sm underline">Back</Link>
      </div>

      <label className="block text-sm">Header
        <input className="mt-1 w-full border rounded px-2 py-1" {...field("headerText")} />
      </label>
      <label className="block text-sm">Studio name
        <input className="mt-1 w-full border rounded px-2 py-1" {...field("studioName")} />
      </label>
      <label className="block text-sm">Authenticity statement
        <textarea className="mt-1 w-full border rounded px-2 py-1" rows={4} {...field("statementTemplate")} />
        <span className="text-xs text-gray-500">Tokens: {"{title}"}, {"{edition}"}, {"{year}"}, {"{medium}"}.</span>
      </label>
      <label className="block text-sm">Copyright line
        <input className="mt-1 w-full border rounded px-2 py-1" {...field("copyrightLine")} />
      </label>
      <label className="block text-sm">Care line
        <input className="mt-1 w-full border rounded px-2 py-1" {...field("careLine")} />
      </label>
      <label className="block text-sm">Signature label
        <input className="mt-1 w-full border rounded px-2 py-1" {...field("signatureLabel")} />
      </label>

      <div className="sticky bottom-0 -mx-6 border-t bg-white px-6 py-3">
        <button
          className="w-full rounded bg-black px-5 py-3 text-sm text-white disabled:opacity-50 sm:w-auto"
          disabled={update.isPending}
          onClick={() => update.mutate(form)}
        >
          {update.isPending ? "Saving…" : "Save template"}
        </button>
      </div>
    </div>
  );
}
