import { requireSiteAccess } from "@/lib/site-access";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSiteAccess();
  return children;
}
