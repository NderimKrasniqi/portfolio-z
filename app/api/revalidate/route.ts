import { revalidateTag, revalidatePath } from "next/cache";
export async function POST(req: Request) {
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  revalidateTag("portfolio", { expire: 0 });
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
