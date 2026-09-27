"use client";

/**
 * Downsizes a camera photo to a JPEG data URL in the browser (respecting EXIF
 * rotation), stepping the quality down until it fits `maxBytes`. Ported from Bite.
 */
export async function preparePhoto(file: File, maxEdge: number, maxBytes: number): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not-an-image");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(async () => {
    // Fallback for browsers without createImageBitmap options
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  const w = "naturalWidth" in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = "naturalHeight" in bitmap ? bitmap.naturalHeight : bitmap.height;
  let edge = maxEdge;
  for (let attempt = 0; attempt < 6; attempt++) {
    const scale = Math.min(1, edge / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.7, 0.6]) {
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length <= maxBytes) {
        if ("close" in bitmap) bitmap.close();
        return url;
      }
    }
    edge = Math.round(edge * 0.8);
  }
  if ("close" in bitmap) bitmap.close();
  throw new Error("too-large");
}
