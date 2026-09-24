import { PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { fetchAuthQuery, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { requireSiteAccess, requireSameOrigin } from "@/lib/site-access";
import { r2, bucket } from "@/lib/r2";
import { originalFormat, webpDimensions } from "@/lib/image-validation";
export async function POST(request: Request) {
  let keys: string[] = [];
  try {
    await requireSiteAccess();
    await requireSameOrigin();
    if (!(await fetchAuthQuery(api.cms.session, {})))
      return new Response("Unauthorized", { status: 401 });
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > 26000000)
      return new Response("Upload too large", { status: 413 });
    const form = await request.formData();
    const original = form.get("original");
    if (!(original instanceof File) || original.size > 20 * 1024 * 1024)
      return new Response("A private original under 20 MB is required", {
        status: 400,
      });
    const originalBytes = new Uint8Array(await original.arrayBuffer());
    if (originalFormat(originalBytes) !== original.type)
      return new Response("Original image type does not match its contents", {
        status: 400,
      });
    const files = [form.get("small"), form.get("medium"), form.get("large")];
    if (files.some((f) => !(f instanceof File) || f.size > 8 * 1024 * 1024))
      return new Response("Three WebP variants are required", { status: 400 });
    const buffers = await Promise.all(
      (files as File[]).map(async (f) => new Uint8Array(await f.arrayBuffer())),
    );
    const dims = buffers.map(webpDimensions);
    const limits = [320, 960, 1600];
    if (dims.some((d, i) => d.width > limits[i] || d.height > limits[i] * 6))
      throw Error("Image variant is too large");
    const id = crypto.randomUUID();
    const originalKey = `original/${id}`;
    keys = [...limits.map((size) => `media/${id}-${size}.webp`), originalKey];
    const client = r2();
    await Promise.all([
      ...buffers.map((Body, i) =>
        client.send(
          new PutObjectCommand({
            Bucket: bucket(),
            Key: keys[i],
            Body,
            ContentType: "image/webp",
            CacheControl: "private, no-store",
          }),
        ),
      ),
      client.send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: originalKey,
          Body: originalBytes,
          ContentType: original.type,
          CacheControl: "private, no-store",
        }),
      ),
    ]);
    const title = String(form.get("title") || "Untitled").slice(0, 300);
    const metadata = {
      id,
      title,
      alt: "",
      caption: "",
      category: "Editorial",
      kind: "image" as const,
      key: keys[2],
      mediumKey: keys[1],
      thumbKey: keys[0],
      width: dims[2].width,
      height: dims[2].height,
      featured: false,
    };
    await fetchAuthMutation(api.assets.register, {
      metadata,
      originalKey,
      secret: process.env.CONTENT_READ_SECRET || "",
    });
    return Response.json(metadata, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (keys.length) {
      try {
        await r2().send(
          new DeleteObjectsCommand({
            Bucket: bucket(),
            Delete: { Objects: keys.map((Key) => ({ Key })) },
          }),
        );
      } catch {}
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
