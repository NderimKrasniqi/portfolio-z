/** Slide both films together at full size inside the fixed portrait frame. */
export function transitionHomeVideo({ hero, src, poster, direction, commit, done }: {
  hero: HTMLButtonElement;
  src: string;
  poster: string;
  direction: number;
  commit: () => void;
  done: () => void;
}) {
  const layer = document.createElement("div");
  layer.className = "home-video-transition";
  layer.setAttribute("aria-hidden", "true");
  const incoming = document.createElement("video");
  incoming.muted = true; incoming.loop = true; incoming.playsInline = true;
  incoming.poster = poster; incoming.preload = "auto";
  layer.append(incoming);
  let stopped = false;
  let started = false;
  let frame = 0;
  let timer = 0;
  const animations: Animation[] = [];
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer); cancelAnimationFrame(frame);
    incoming.removeEventListener("loadeddata", run);
    incoming.removeEventListener("error", run);
    animations.forEach(animation => animation.cancel());
    layer.remove(); incoming.pause(); incoming.removeAttribute("src"); incoming.load();
    done();
  };
  const run = async () => {
    if (stopped || started) return;
    started = true;
    clearTimeout(timer);
    const outgoing = hero.querySelector("video");
    hero.append(layer);
    void incoming.play().catch(() => {});
    const timing: KeyframeAnimationOptions = { duration: 900, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" };
    const slide = layer.animate([
      { transform: `translateY(${direction * 100}%)` }, { transform: "translateY(0)" },
    ], timing);
    animations.push(slide);
    if (outgoing) animations.push(outgoing.animate([
      { transform: "translateY(0)" },
      { transform: `translateY(${-direction * 100}%)` },
    ], timing));
    try { await slide.finished; } catch { return; }
    if (stopped) return;
    commit();
    const deadline = performance.now() + 2500;
    let synced = false;
    const handoff = () => {
      if (stopped) return;
      const destination = hero.querySelector<HTMLVideoElement>(":scope > video");
      if (destination && destination !== outgoing && destination.readyState >= 2) {
        if (!synced) {
          synced = true;
          destination.currentTime = incoming.currentTime;
          void destination.play().catch(() => {});
        } else if (!destination.seeking) { cleanup(); return; }
      }
      if (performance.now() > deadline) { cleanup(); return; }
      frame = requestAnimationFrame(handoff);
    };
    frame = requestAnimationFrame(handoff);
  };
  incoming.addEventListener("loadeddata", run);
  incoming.addEventListener("error", run);
  incoming.src = src;
  timer = window.setTimeout(run, 1600);
  return cleanup;
}
