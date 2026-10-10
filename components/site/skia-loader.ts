import type { CanvasKit, CanvasKitInitOptions } from "canvaskit-wasm";

declare global {
  interface Window {
    CanvasKitInit?: (options?: CanvasKitInitOptions) => Promise<CanvasKit>;
  }
}

let loading: Promise<CanvasKit> | undefined;
/** Keep CanvasKit out of the Next.js bundle; load the pinned, same-origin runtime on demand. */
export function loadSkia() {
  if (loading) return loading;
  loading = new Promise<CanvasKit>((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(
      () => fail(new Error("Skia took too long to load.")),
      30000,
    );
    const fail = (error: unknown) => {
      clearTimeout(timeout);
      script.remove();
      loading = undefined;
      reject(error);
    };
    const initialize = () => {
      if (!window.CanvasKitInit) return fail(new Error("Skia is unavailable."));
      window
        .CanvasKitInit({ locateFile: (file) => `/skia/0.42.0/${file}` })
        .then((kit) => {
          clearTimeout(timeout);
          resolve(kit);
        })
        .catch(fail);
    };
    if (window.CanvasKitInit) initialize();
    else {
      script.src = "/skia/0.42.0/canvaskit.js";
      script.async = true;
      script.onload = initialize;
      script.onerror = () => fail(new Error("Skia could not load."));
      document.head.appendChild(script);
    }
  });
  return loading;
}
