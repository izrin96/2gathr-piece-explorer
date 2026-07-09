// The media rule (spec §4): animation first, else the ORIGINAL image.
// thumbnailUrl is never used anywhere in the website.
export type MediaSource =
  | { kind: "video"; src: string; poster: string | null }
  | { kind: "image"; src: string }
  | { kind: "none" };

export function pickMediaSource(d: {
  animationUrl: string | null;
  imageUrl: string | null;
}): MediaSource {
  if (d.animationUrl) return { kind: "video", src: d.animationUrl, poster: d.imageUrl };
  if (d.imageUrl) return { kind: "image", src: d.imageUrl };
  return { kind: "none" };
}

export function mediaFilename(name: string, media: MediaSource): string | null {
  if (media.kind === "none") return null;
  const urlExt = media.src.replace(/\?.*$/, "").split(".").pop();
  const ext = urlExt && urlExt.length <= 4 ? urlExt : media.kind === "video" ? "mp4" : "jpg";
  const safeName = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "piece";
  return `${safeName}.${ext}`;
}
