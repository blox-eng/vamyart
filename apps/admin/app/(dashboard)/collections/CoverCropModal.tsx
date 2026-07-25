"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedBlob } from "@/lib/image/crop";

// Modal: pan/zoom crop a chosen file to 3:2, then hand a downscaled JPEG blob
// back to the uploader. The parent owns the upload; this only produces bytes.
export function CoverCropModal({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);

  function close() {
    URL.revokeObjectURL(imageUrl);
  }

  // Move focus into the dialog on open and close on Escape, so keyboard users
  // are placed in the modal and can dismiss it without a mouse.
  useEffect(() => {
    dialogRef.current?.focus();
    // Lock background scroll while the overlay is open (mirrors the dashboard
    // nav drawer) so the page can't scroll behind it on mobile.
    document.body.classList.add("overflow-hidden");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        onCancel();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("overflow-hidden");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCropComplete = useCallback((_area: Area, pixels: Area) => setAreaPixels(pixels), []);

  async function handleSave() {
    if (!areaPixels || busy) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(file, areaPixels);
      close();
      onCropped(blob);
    } catch {
      setBusy(false); // leave the modal open so the artist can retry
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crop-cover-title"
        tabIndex={-1}
        className="bg-white rounded-lg w-full max-w-lg p-4 space-y-4 outline-none max-h-[90vh] overflow-y-auto"
      >
        <p id="crop-cover-title" className="text-sm font-medium">Crop cover (3:2)</p>
        <div className="relative w-full h-72 bg-neutral-100 rounded overflow-hidden">
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={3 / 2}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <label className="block text-xs text-gray-500">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => { close(); onCancel(); }}
            disabled={busy}
            className="border px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || !areaPixels}
            className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            {busy ? "Processing…" : "Crop & upload"}
          </button>
        </div>
      </div>
    </div>
  );
}
