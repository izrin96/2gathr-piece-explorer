import { useState } from "react";

import { pickMediaSource } from "@/lib/media";
import type { Design } from "@/lib/types";
import { cn } from "@/lib/utils";

// The ONLY place piece media renders. Animation (mp4) wins; otherwise the
// original image; thumbnailUrl is never used. Video error falls back to the
// image; no media (or image error) falls back to a neutral placeholder.
export function PieceMedia({
  design,
  className,
}: {
  design: Pick<Design, "name" | "imageUrl" | "animationUrl">;
  className?: string;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const media = pickMediaSource(design);
  const showVideo = media.kind === "video" && !videoFailed;
  const imageSrc = media.kind === "image" ? media.src : videoFailed ? design.imageUrl : null;

  return (
    <div className={cn("bg-muted relative aspect-[0.7266] overflow-hidden", className)}>
      {showVideo ? (
        <video
          src={media.src}
          poster={media.poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : imageSrc && !imageFailed ? (
        <img
          src={imageSrc}
          alt={design.name}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-2 text-center text-sm">
          {design.name}
        </div>
      )}
    </div>
  );
}
