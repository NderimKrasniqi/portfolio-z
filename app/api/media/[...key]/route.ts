import { GetObjectCommand } from "@aws-sdk/client-s3";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery } from "@/lib/auth-server";
import { requireSiteAccess } from "@/lib/site-access";
import { localReference } from "@/lib/content";
import { r2, bucket } from "@/lib/r2";
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
      return new Response(file, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "private, max-age=300",
        },
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
    return new Response(
      new Uint8Array(await result.Body.transformToByteArray()).buffer,
      {
        headers: {
          "Content-Type": result.ContentType || "image/webp",
          "Cache-Control":
            draft || process.env.SITE_MODE !== "production"
              ? "private, no-store"
              : "public, max-age=300",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
