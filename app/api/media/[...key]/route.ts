import { GetObjectCommand } from "@aws-sdk/client-s3";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireSiteAccess } from "@/lib/site-access";
import { localReference } from "@/lib/content";
import { r2, bucket } from "@/lib/r2";

function send(request: Request, bytes: Uint8Array, headers: Record<string, string>) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  const size = bytes.byteLength;
  const base = { ...headers, "Accept-Ranges": "bytes" };
  if (!range || (!range[1] && !range[2])) return new Response(bytes.slice().buffer, { headers: { ...base, "Content-Length": String(size) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } });
  return new Response(bytes.slice(start, end + 1).buffer, {
    status: 206,
    headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
  });
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  try {
    await requireSiteAccess();
    const key = (await params).key.join("/");
    if (!/^[a-zA-Z0-9/_-]+\.(webp|mp4)$/.test(key))
      return new Response("Not found", { status: 404 });
    const draft = new URL(request.url).searchParams.get("draft") === "1";
    if (localReference) {
      if (draft) return new Response("Not found", { status: 404 });
      const { readFile } = await import("node:fs/promises");
      const { resolve } = await import("node:path");
      if (key.includes("/")) return new Response("Not found", { status: 404 });
      const file = await readFile(resolve(".local/media", key));
      return send(request, new Uint8Array(file), {
        "Content-Type": key.endsWith(".mp4") ? "video/mp4" : "image/webp",
        "Cache-Control": "private, max-age=300",
      });
    }
    const args = { key, draft, secret: process.env.CONTENT_READ_SECRET || "" };
    const allowed = draft
      ? await fetchAuthQuery(api.assets.authorizeRead, args)
      : await fetchQuery(api.assets.authorizeRead, args);
    if (!allowed) return new Response("Not found", { status: 404 });
    const result = await r2().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
    );
    if (!result.Body) return new Response("Not found", { status: 404 });
    return send(request, await result.Body.transformToByteArray(), {
      "Content-Type": result.ContentType || "image/webp",
      "Cache-Control":
        draft || process.env.SITE_MODE !== "production"
          ? "private, no-store"
          : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
