import type {
  CanvasKit,
  Canvas,
  Image,
  Paint,
  Surface,
  GrDirectContext,
  WebGLContextHandle,
} from "canvaskit-wasm";
import type { WardrobePiece } from "./shop-catalog";
import { createWardrobeMotion, garmentFaces } from "./wardrobe-motion";

export type SkiaSlot = {
  x: number;
  width: number;
  height: number;
  turn: number;
  sway: number;
};
// Distort only the fabric: the hook remains anchored, the hem follows with a small lag.
const FABRIC = `
uniform shader photo;
uniform float2 sourceSize;
uniform float2 size;
uniform float bend;
uniform float facing;
uniform float opacity;
uniform float collar;
half4 main(float2 p) {
  float t = p.y / size.y;
  float2 uv = float2((p.x - bend * t * t) / size.x, t);
  if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) return half4(0);
  half4 c = photo.eval(uv * sourceSize);
  float neck = length((uv - float2(.5,.04)) / float2(.075,.04));
  c *= mix(1., smoothstep(.86,1.,neck), collar);
  float light = 1. - .10 * sin(uv.x * 3.14159) * (1. - facing);
  return c * half4(light,light,light,1) * opacity;
}`;
const TEE =
  "M .045 .15 L .22 .11 .29 .08 .38 .06 .40 .035 .43 .05 .50 .05 .55 .035 .58 .02 .60 .06 .70 .08 .75 .11 .93 .155 .87 .40 .76 .36 .75 .365 .83 .92 .73 .94 .50 .94 .165 .92 .19 .37 .085 .39 Z";
const JEANS =
  "M .37 .06 L .50 .08 .71 .09 .73 .30 .76 .43 .84 .88 .66 .91 .51 .45 .46 .38 .38 .62 .38 .86 .18 .85 .19 .63 .20 .47 .25 .28 .30 .17 Z";

export async function createSkiaWardrobe(
  kit: CanvasKit,
  node: HTMLCanvasElement,
  pieces: WardrobePiece[],
  signal: AbortSignal,
) {
  const urls = [
    ...new Set(
      pieces.flatMap((piece) =>
        [piece.front, piece.side].filter((url): url is string => Boolean(url)),
      ),
    ),
  ];
  const buffers = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("A garment image could not load.");
      return response.arrayBuffer();
    }),
  );
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const images = new Map<string, Image>();
  const resources: { delete(): void }[] = [];
  let surface: Surface | null = null;
  let graphics: GrDirectContext | null = null;
  let context: WebGLContextHandle | undefined;
  let software = false;
  try {
    urls.forEach((url, i) => {
      const image = kit.MakeImageFromEncoded(buffers[i]);
      if (!image) throw new Error("A garment image could not be decoded.");
      images.set(url, image);
      resources.push(image);
    });
    const effect = kit.RuntimeEffect.Make(FABRIC);
    if (!effect) throw new Error("The fabric shader could not start.");
    resources.push(effect);
    const paint = new kit.Paint();
    paint.setAntiAlias(true);
    resources.push(paint);
    const fabricPaint = new kit.Paint();
    fabricPaint.setAntiAlias(true);
    resources.push(fabricPaint);
    const shadow = kit.ImageFilter.MakeDropShadow(
      3,
      6,
      3,
      3,
      kit.Color(40, 32, 25, 0.13),
      null,
    );
    if (shadow) {
      resources.push(shadow);
      fabricPaint.setImageFilter(shadow);
    }
    const photoShaders = new Map(
      [...images].map(([url, image]) => {
        const shader = image.makeShaderOptions(
          kit.TileMode.Decal,
          kit.TileMode.Decal,
          kit.FilterMode.Linear,
          kit.MipmapMode.None,
        );
        resources.push(shader);
        return [url, shader];
      }),
    );
    const path = (svg: string) => {
      const result = kit.Path.MakeFromSVGString(svg);
      if (!result) throw new Error("Invalid hanger path.");
      resources.push(result);
      return result;
    };
    const hook = path("M150 70V24c0-7 11-7 11-15 0-13-23-13-23 0v4");
    const clipHook = path("M150 41V24c0-7 11-7 11-15 0-13-23-13-23 0v4");
    const wood = path(
      "M145 34q5-3 10 0l5 13 82 34q9 6 2 12l-17-2-73-33q-4-2-8 0L73 91l-17 2q-7-6 2-12l82-34Z",
    );
    const bar = path("M62 87q85 18 176 0");
    const grain = path("M65 81l80-30q5-2 10 0l80 30M70 84l74-29M163 58l66 29");
    const tee = path(TEE),
      jeans = path(JEANS);
    const woodShader = kit.Shader.MakeLinearGradient(
      [0, 34],
      [0, 94],
      [kit.Color(187, 145, 99), kit.Color(141, 92, 54), kit.Color(104, 64, 40)],
      [0, 0.45, 1],
      kit.TileMode.Clamp,
    );
    resources.push(woodShader);
    const metalShader = kit.Shader.MakeLinearGradient(
      [137, 0],
      [164, 0],
      [
        kit.Color(98, 99, 94),
        kit.Color(245, 245, 239),
        kit.Color(104, 108, 102),
      ],
      [0, 0.45, 1],
      kit.TileMode.Clamp,
    );
    resources.push(metalShader);
    const railShader = kit.Shader.MakeLinearGradient(
      [0, 39],
      [0, 49],
      [
        kit.Color(101, 104, 98),
        kit.Color(234, 235, 228),
        kit.Color(255, 255, 250),
        kit.Color(117, 121, 113),
        kit.Color(178, 180, 171),
      ],
      [0, 0.22, 0.4, 0.77, 1],
      kit.TileMode.Clamp,
    );
    resources.push(railShader);
    const physics = createWardrobeMotion(pieces.length);
    const states = physics.states;
    let width = 1000,
      height = 390,
      ratio = 1;

    function solid(color: string, stroke = 0) {
      paint.setShader(null);
      paint.setColor(kit.parseColorString(color));
      paint.setStyle(stroke ? kit.PaintStyle.Stroke : kit.PaintStyle.Fill);
      paint.setStrokeWidth(stroke);
      paint.setStrokeCap(kit.StrokeCap.Round);
      return paint;
    }
    function round(
      canvas: Canvas,
      x: number,
      y: number,
      w: number,
      h: number,
      radius: number,
      brush: Paint,
    ) {
      canvas.drawRRect(
        kit.RRectXY(kit.XYWHRect(x, y, w, h), radius, radius),
        brush,
      );
    }
    function hanger(
      canvas: Canvas,
      garment: number,
      p: number,
      pants: boolean,
    ) {
      canvas.save();
      canvas.scale(garment / 300, garment / 300);
      canvas.scale(garmentFaces(p).width, 1);
      canvas.translate(-150, 0);
      paint.setStyle(kit.PaintStyle.Stroke);
      paint.setStrokeWidth(2.4);
      paint.setColor(kit.WHITE);
      paint.setShader(metalShader);
      paint.setStrokeCap(kit.StrokeCap.Round);
      canvas.drawPath(pants ? clipHook : hook, paint);
      paint.setStyle(kit.PaintStyle.Fill);
      paint.setShader(woodShader);
      if (pants) {
        round(canvas, 67, 42, 166, 9, 4, paint);
        for (const x of [78, 210]) {
          round(canvas, x, 43, 13, 23, 3, solid("#a4a59e"));
          canvas.drawLine(x + 3, 47, x + 3, 61, solid("#e5e5dd", 1.5));
        }
      } else {
        // The wooden shoulders sit inside the garment; only its neck can be seen
        // through the collar. Do not let the full silhouette float above the photo.
        canvas.clipRect(
          kit.XYWHRect(126, 48, 48, 58),
          kit.ClipOp.Intersect,
          true,
        );
        canvas.translate(0, 18);
        canvas.drawPath(wood, paint);
        canvas.drawPath(bar, solid("#805535", 3));
        canvas.drawPath(grain, solid("#caa073", 0.6));
      }
      canvas.restore();
    }
    function fabric(
      canvas: Canvas,
      piece: WardrobePiece,
      url: string,
      w: number,
      h: number,
      alpha: number,
      p: number,
      bend: number,
      front: boolean,
    ) {
      if (alpha < 0.002) return;
      const image = images.get(url)!;
      const shader = effect!.makeShaderWithChildren(
        [
          image.width(),
          image.height(),
          w,
          h,
          bend,
          p,
          alpha,
          front && !piece.treatment ? 1 : 0,
        ],
        [photoShaders.get(url)!],
      );
      fabricPaint.setShader(shader);
      canvas.save();
      canvas.translate(-w / 2, piece.rail === "Pants" ? 25 : 30);
      if (piece.treatment) {
        canvas.scale(w, h);
        canvas.clipPath(
          piece.treatment === "tee" ? tee : jeans,
          kit.ClipOp.Intersect,
          true,
        );
        canvas.scale(1 / w, 1 / h);
      }
      canvas.drawRect(
        kit.XYWHRect(-Math.abs(bend) - 2, 0, w + 2 * Math.abs(bend) + 4, h),
        fabricPaint,
      );
      canvas.restore();
      fabricPaint.setShader(null);
      shader.delete();
    }
    return {
      resize(nextWidth: number, nextHeight: number) {
        width = nextWidth;
        height = nextHeight;
        ratio = Math.min(window.devicePixelRatio || 1, 2);
        surface?.dispose();
        surface = null;
        node.width = Math.round(width * ratio);
        node.height = Math.round(height * ratio);
        if (!graphics && !software) {
          const handle = kit.GetWebGLContext(node, {
            alpha: 1,
            antialias: 1,
          });
          if (handle > 0) {
            context = handle;
            graphics = kit.MakeWebGLContext(handle);
            if (!graphics)
              throw new Error("Skia could not initialize the GPU.");
          } else software = true;
        }
        surface = graphics
          ? kit.MakeOnScreenGLSurface(
              graphics,
              node.width,
              node.height,
              kit.ColorSpace.SRGB,
            )
          : kit.MakeSWCanvasSurface(node);
        if (!surface)
          throw new Error("Skia could not create a drawing surface.");
      },
      draw(active: number | null, dt: number, reduced: boolean) {
        if (!surface) return { moving: false, slots: [] as SkiaSlot[] };
        const canvas = surface.getCanvas();
        canvas.clear(kit.TRANSPARENT);
        canvas.save();
        canvas.scale(ratio, ratio);
        const garment = Math.min(240, width * 0.56),
          step = Math.min(76, width * 0.115);
        paint.setStyle(kit.PaintStyle.Fill);
        paint.setColor(kit.WHITE);
        paint.setShader(railShader);
        round(canvas, 12, 39, width - 24, 9, 4, paint);
        for (const x of [8, width - 20]) {
          round(canvas, x, 32, 12, 24, 3, solid("#c0c2b8"));
          canvas.drawLine(x + 3, 35, x + 3, 53, solid("#f8f8ed", 1.6));
          canvas.drawCircle(x + 6, 35, 1, solid("#7d8076"));
          canvas.drawCircle(x + 6, 53, 1, solid("#7d8076"));
        }
        const moving = physics.advance(dt, active, garment, step, reduced);
        const slots = states.map((state, index) => {
          return {
            x: width / 2 + state.x,
            width: active === index ? garment : step,
            height: garment * 1.13 + 40,
            turn: state.turn,
            sway: state.sway,
          };
        });
        const order = states
          .map((_, i) => i)
          .sort((a, b) => (a === active ? 1 : b === active ? -1 : b - a));
        for (const index of order) {
          const state = states[index],
            piece = pieces[index],
            p = Math.max(0, Math.min(1, state.turn));
          canvas.save();
          canvas.translate(width / 2 + state.x, 39);
          canvas.rotate(state.sway, 0, 4);
          hanger(canvas, garment, p, piece.rail === "Pants");
          const h = garment * (piece.treatment === "tee" ? 0.83 : 1.13);
          const bend = reduced
            ? 0
            : Math.max(-10, Math.min(10, state.vs * 0.3 + state.sway * 0.6));
          const faces = garmentFaces(p);
          fabric(
            canvas,
            piece,
            piece.side || piece.front!,
            garment * 0.43 * (1 - 0.55 * p),
            h,
            faces.side,
            p,
            bend,
            false,
          );
          fabric(
            canvas,
            piece,
            piece.front!,
            garment * faces.width,
            h,
            faces.front,
            p,
            bend,
            true,
          );
          canvas.restore();
        }
        canvas.restore();
        surface.flush();
        return { moving, slots };
      },
      dispose() {
        surface?.dispose();
        surface = null;
        resources.reverse().forEach((resource) => resource.delete());
        graphics?.releaseResourcesAndAbandonContext();
        graphics?.delete();
        graphics = null;
        if (context !== undefined) kit.deleteContext(context);
        context = undefined;
      },
    };
  } catch (error) {
    resources.reverse().forEach((resource) => resource.delete());
    throw error;
  }
}
