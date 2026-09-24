# Zeudi Di Palma portfolio and CMS

Next.js 16, React 19 and Tailwind build the public portfolio and private editor. Convex stores content, draft and publication revisions, and administrator records. Better Auth manages email/password sessions. R2 stores private images. Cloudflare Workers hosting is wired through OpenNext.

The public routes cover home, gallery, biography, contact, and a demo shop. Supported locales are English, Italian, French, Spanish, and Portuguese. The imported copy remains a draft; French and Spanish are editorial drafts. The shop begins hidden and does not have checkout.

## Local development

Requirements: Node.js 22.16–24 and pnpm 10.30.3.

```sh
pnpm install --frozen-lockfile
pnpm dev:backend
```

In a second terminal, run `pnpm dev`. `pnpm dev:backend` uses the linked Convex development project and never deploys to production. The seeded locales start as private drafts. To inspect the public design before publishing, run the Next development server with `LOCAL_REFERENCE_PREVIEW=true`; this mode serves the sanitized local English, Italian, and Portuguese reference copy and private optimized image files. It does not authenticate the CMS or publish content.

To create the first owner account, set `INITIAL_ADMIN_PASSWORD` in your shell to a unique password with at least 12 characters, then run `pnpm admin:create owner@example.com`. The command only runs after you type `dev`. It provisions the first account in the linked development deployment. The owner can then invite the second administrator from the editor once email is configured.

## Content import

The source HTML is deliberately kept outside the application under the ignored `reference/` directory. Run `pnpm import:reference` to re-extract content and responsive images. `pnpm seed:content` imports English, Italian, Portuguese, French, and Spanish into Convex as unpublished drafts; it refuses to overwrite existing locales. Imported files are never made public by this command.

For a Worker preview without a Cloudflare Access JWT, use the local-only overrides after `pnpm build:worker`:

```sh
pnpm preview:worker --var LOCAL_ACCESS_PREVIEW:true --var LOCAL_REFERENCE_PREVIEW:true
```

Those flags bypass Access only for localhost preview requests and read the local reference content. They are not in the staging Worker configuration.

## Environment

`.env.example` lists the local and staging variables. `pnpm configure:dev` creates development-only Better Auth, content-read, and cache-refresh secrets, then stores the secret values in Convex and `.env.local`. Never commit `.env.local` or `.dev.vars`.

Cloudflare, R2, Cloudflare Access and Resend credentials are intentionally absent. Before staging, create a separate staging Convex deployment and R2 buckets, use an owned HTTPS domain, configure a Cloudflare Access policy for the staging hostname, and verify a Resend sender domain. Provide the deployment variables only through local secret storage. The Worker disables `workers.dev` and preview URLs; configure its protected custom-domain route before deploying. The private media bucket stores originals and their responsive variants. The OpenNext cache uses a separate R2 bucket.

Staging deployment is gated: `pnpm deploy:staging` checks credentials, HTTPS, and disabled alternate entry points. It stops until a protected Cloudflare route is added. It does not provision Cloudflare services, enable paid plans, or deploy production.

## Checks

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm build:worker`
- `pnpm preview:worker`

The app has not been deployed publicly. Recovery email, R2 uploads, Cloudflare Access and hosted staging require the external account/domain setup described above.
