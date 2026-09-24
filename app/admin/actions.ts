"use server";
import { fetchAuthQuery, fetchAuthMutation } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
import { requireSiteAccess } from "@/lib/site-access";
import { parseContent, type Locale } from "@/lib/model";
import type { Id } from "@/convex/_generated/dataModel";
export async function loadEditor(locale: Locale) {
  await requireSiteAccess();
  const [page, settings, history, assets] = await Promise.all([
    fetchAuthQuery(api.cms.read, { locale }),
    fetchAuthQuery(api.cms.settings, {}),
    fetchAuthQuery(api.cms.history, { locale }),
    fetchAuthQuery(api.assets.list, {}),
  ]);
  return { page, settings, history, assets };
}
export async function saveDraft(
  locale: Locale,
  content: unknown,
  version: number,
) {
  await requireSiteAccess();
  return fetchAuthMutation(api.cms.save, {
    locale,
    content: parseContent(content),
    version,
  });
}
export async function saveShop(shopVisible: boolean, version: number) {
  await requireSiteAccess();
  return fetchAuthMutation(api.cms.saveSettings, { shopVisible, version });
}
export async function publishDraft(
  locale: Locale,
  version: number,
  settingsVersion: number,
  enabled: boolean,
) {
  await requireSiteAccess();
  return fetchAuthMutation(api.cms.publish, {
    locale,
    version,
    settingsVersion,
    enabled,
  });
}
export async function restoreDraft(id: Id<"revisions">, version: number) {
  await requireSiteAccess();
  return fetchAuthMutation(api.cms.restore, { id, version });
}
export async function retryRefresh() {
  await requireSiteAccess();
  return fetchAuthMutation(api.cms.retryPublish, {});
}
export async function inviteAdministrator(email: string, name: string) {
  await requireSiteAccess();
  return fetchAuthMutation(api.setup.invite, { email, name });
}
