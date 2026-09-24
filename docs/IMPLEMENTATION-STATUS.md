# Portfolio CMS delivery tracking

Updated 24 September 2026. Advisory consultations used: 1 (prior architecture discussion); root is sole executor.

## Implemented
- Next.js, TypeScript, Tailwind, pnpm lockfile; Convex Europe development project.
- EN/IT/PT reference extraction, 12 private optimized image sets.
- Localized public routes, home, gallery/grid/lazy Three.js sphere, biography, contact, gated demo shop.
- Better Auth email/password backend, disabled public signup, explicit admin allowlist, owner provisioning and invitation function.
- Structured CMS editors, draft preview, optimistic version checks, publish history/restore, shop setting, cache refresh retries.
- Authenticated image upload, private originals and R2 variants, bounded image validation, referenced-media deletion protection.
- Private staging Access verification, disabled workers.dev and preview URLs.
- Owner invitation UI and a guarded first-owner development setup.
- EN/IT/PT source copy and FR/ES editorial drafts imported into Convex as unpublished content.
- 11 Convex/model regression tests for anonymous access, hidden shop, conflicting edits, publication history and stale cache status.
- Next.js production build and OpenNext Cloudflare Worker build pass.
- Local smoke checks: home 200, admin sign-in 200, hidden shop 404, reference image 200 in Next.js local preview; Worker HTML routes also respond correctly.

## Still required before acceptance
- Review against original HTML at desktop/mobile; exact design and gallery interaction fidelity.
- Bring FR/ES drafts and product text/localized editor labels to final editorial review.
- Import original reference images into R2 when bucket credentials are available; the local preview uses ignored private files.
- Complete browser tests for login/recovery, uploads and the deployed worker runtime.
- Staging Worker preview with an actual Cloudflare Access policy and R2 credentials; the local Worker check used local-only Access/reference overrides.
- Cloudflare R2 resources, Access-protected domain, Resend sender; separate staging Convex deployment.
- End-to-end private staging checks, measured mobile performance and export/restore rehearsal.

No production release has been made. External setup and delivery are not complete.
