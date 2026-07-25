"use client";

import { useCallback, useState } from "react";
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

  const onCropComplete = useCallback((_area: Area, pixels: Area) => setAreaPixels(pixels), []);

  function close() {
    URL.revokeObjectURL(imageUrl);
  }

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
      <div className="bg-white rounded-lg w-full max-w-lg p-4 space-y-4">
        <p className="text-sm font-medium">Crop cover (3:2)</p>
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
