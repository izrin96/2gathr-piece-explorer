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
