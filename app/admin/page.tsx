import { redirect } from "next/navigation";
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { requireSiteAccess } from "@/lib/site-access";
import { Editor } from "./editor";
export const dynamic = "force-dynamic";
export default async function Admin() {
  await requireSiteAccess();
  let session = null;
  try {
    session = await fetchAuthQuery(api.cms.session, {});
  } catch {}
  if (!session) redirect("/admin/login");
  return <Editor email={session.email} owner={session.owner} />;
}
