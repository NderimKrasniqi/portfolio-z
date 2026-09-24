import "server-only";
import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
export async function requireSiteAccess() {
  if (process.env.SITE_MODE === "production") return;
  const h = await headers();
  const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(
    (h.get("host") || "").replace(/:\d+$/, ""),
  );
  if (
    localHost &&
    (process.env.SITE_MODE === "local" ||
      process.env.LOCAL_ACCESS_PREVIEW === "true")
  )
    return;
  const token = h.get("cf-access-jwt-assertion"),
    issuer = process.env.CF_ACCESS_ISSUER,
    audience = process.env.CF_ACCESS_AUD;
  if (!token || !issuer || !audience)
    throw Error("Private staging access is required.");
  await jwtVerify(
    token,
    createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer)),
    { issuer, audience },
  );
}
export async function requireSameOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (
    !origin ||
    origin !==
      new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
        .origin
  )
    throw Error("Invalid request origin");
}
