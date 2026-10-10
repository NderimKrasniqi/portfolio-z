/** Enlarge a decoded video from its filmstrip preview, retaining the original thumbnail. */
export function flyFilmToHero({ thumbnail, hero, src, poster, commit }: {
  thumbnail: HTMLImageElement;
  hero: HTMLButtonElement;
  src: string;
  poster: string;
  commit: () => void;
}) {
  let cancelled = false;
  let animation: Animation | undefined;
  let timer = 0;
  let frame = 0;
  const flight = document.createElement("div");
  flight.className = "home-film-flight";
  flight.setAttribute("aria-hidden", "true");
  const video = document.createElement("video");
  video.src = src; video.poster = poster;
  video.muted = true; video.playsInline = true; video.loop = true; video.preload = "auto";
  flight.append(video);
  const host = hero.closest("#stage")!;
  const cleanup = () => {
    cancelled = true;
    clearTimeout(timer); cancelAnimationFrame(frame);
    animation?.cancel();
    video.pause(); video.removeAttribute("src"); video.load();
    flight.remove();
  };
  const run = async () => {
    if (cancelled) return;
    video.removeEventListener("loadeddata", run);
    video.removeEventListener("error", run);
    clearTimeout(timer);
    const from = thumbnail.getBoundingClientRect();
    const to = hero.getBoundingClientRect();
    if (!from.width || !to.width) { commit(); cleanup(); return; }
    const rect = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    Object.assign(flight.style, rect(from));
    host.append(flight);
    void video.play().catch(() => {});
    animation = flight.animate([rect(from), rect(to)], {
      duration: 800, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards",
    });
    try { await animation.finished; } catch { return; }
    if (cancelled) return;
    commit();
    // Keep the decoded flight over the destination until React installs the new video.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        const destination = hero.querySelector("video");
        if (destination && destination.readyState >= 1) {
          destination.currentTime = video.currentTime;
          void destination.play().catch(() => {});
        }
        animation = flight.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
        void animation.finished.then(cleanup).catch(() => {});
      });
    });
  };
  video.addEventListener("loadeddata", run, { once: true });
  video.addEventListener("error", run, { once: true });
  timer = window.setTimeout(run, 1400);
  return () => {
    video.removeEventListener("loadeddata", run);
    video.removeEventListener("error", run);
    cleanup();
  };
}
