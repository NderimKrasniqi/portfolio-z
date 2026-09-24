import type { Media } from "@/lib/model";
export const mediaUrl = (key: string, draft = false) =>
  `/api/media/${key.split("/").map(encodeURIComponent).join("/")}${draft ? "?draft=1" : ""}`;
export function MediaView({
  media,
  priority = false,
  draft = false,
}: {
  media: Media;
  priority?: boolean;
  draft?: boolean;
}) {
  if (media.kind === "video")
    return (
      <video
        controls
        playsInline
        preload="none"
        poster={mediaUrl(media.thumbKey, draft)}
        width={media.width}
        height={media.height}
      >
        <source src={mediaUrl(media.key, draft)} />
      </video>
    );
  // Pre-generated variants keep image transformation costs out of visitor requests.
  return (
    <img
      src={mediaUrl(media.mediumKey, draft)}
      srcSet={`${mediaUrl(media.thumbKey, draft)} 320w, ${mediaUrl(media.mediumKey, draft)} 960w, ${mediaUrl(media.key, draft)} 1600w`}
      sizes="(max-width: 700px) 90vw, 50vw"
      width={media.width}
      height={media.height}
      alt={media.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
    />
  );
}
