import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { requireSameOrigin, requireSiteAccess } from "@/lib/site-access";
import { r2, bucket } from "@/lib/r2";
export async function POST(request: Request) {
  try {
    await requireSiteAccess();
    await requireSameOrigin();
    const { assetId } = await request.json();
    if (typeof assetId !== "string")
      return new Response("Invalid asset", { status: 400 });
    const metadata = await fetchAuthMutation(api.assets.beginDelete, {
      assetId,
    });
    let success = false;
    try {
      const result = await r2().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: {
            Objects: [
              metadata.metadata.key,
              metadata.metadata.mediumKey,
              metadata.metadata.thumbKey,
              ...(metadata.originalKey ? [metadata.originalKey] : []),
            ].map((Key) => ({ Key })),
          },
        }),
      );
      if (result.Errors?.length) throw Error("Storage deletion failed");
      success = true;
    } finally {
      await fetchAuthMutation(api.assets.finishDelete, {
        assetId,
        success,
        secret: process.env.CONTENT_READ_SECRET || "",
      });
    }
    return Response.json({ success });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Removal failed" },
      { status: 400 },
    );
  }
}
