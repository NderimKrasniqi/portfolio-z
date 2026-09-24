"use client";
import { useState } from "react";
export function Upload({ onComplete }: { onComplete: () => Promise<void> }) {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="admin-card">
      <label>
        Upload image (JPEG, PNG or WebP; maximum 20 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            let bitmap: ImageBitmap | undefined;
            try {
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 20 * 1024 * 1024
              )
                throw Error("Choose a JPEG, PNG or WebP under 20 MB");
              setStatus("Preparing image…");
              bitmap = await createImageBitmap(file);
              if (bitmap.width * bitmap.height > 40000000)
                throw Error("Image exceeds 40 megapixels");
              const form = new FormData();
              form.set("original", file, file.name);
              form.set("title", file.name.replace(/\.[^.]+$/, ""));
              for (const [i, width] of [320, 960, 1600].entries()) {
                const canvas = document.createElement("canvas");
                canvas.width = Math.min(width, bitmap.width);
                canvas.height = Math.round(
                  (bitmap.height * canvas.width) / bitmap.width,
                );
                const context = canvas.getContext("2d");
                if (!context) throw Error("Image processing unavailable");
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise<Blob>((resolve, reject) =>
                  canvas.toBlob(
                    (b) =>
                      b ? resolve(b) : reject(Error("Cannot prepare image")),
                    "image/webp",
                    0.84,
                  ),
                );
                form.set(
                  ["small", "medium", "large"][i],
                  blob,
                  `${width}.webp`,
                );
              }
              setStatus("Uploading…");
              const response = await fetch("/api/uploads", {
                method: "POST",
                body: form,
              });
              const result = await response.json();
              if (!response.ok) throw Error(result.error || "Upload failed");
              await onComplete();
              setStatus(
                "Uploaded. Add the image from the media library and write alternative text before publishing.",
              );
            } catch (error) {
              setStatus(
                error instanceof Error ? error.message : "Upload failed",
              );
            } finally {
              bitmap?.close();
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      <p role="status">{status}</p>
    </div>
  );
}
