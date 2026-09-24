import { handler } from "@/lib/auth-server";
import { requireSiteAccess } from "@/lib/site-access";
export async function GET(req: Request) {
  await requireSiteAccess();
  return handler.GET(req);
}
export async function POST(req: Request) {
  await requireSiteAccess();
  return handler.POST(req);
}
