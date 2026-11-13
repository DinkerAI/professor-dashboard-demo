# Professor Dashboard — Portfolio Demo

[![Cloudflare Worker](https://img.shields.io/badge/Cloudflare-Worker-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Data](https://img.shields.io/badge/data-fictional-1b7f55)](#demo-boundary)

An interactive, fictional-data reconstruction of the professor-facing Peak
Pickleball scheduling workflow. The project is structured as a Cloudflare Worker
with static assets so the same repository can begin as a public portfolio demo
and later gain authenticated API routes and persistent storage.

> Live demo URL will be added after the first Cloudflare deployment.

## What the demo shows

- upcoming teaching assignments;
- eligible and available classes;
- class-type filtering;
- locally simulated class claims;
- seven-day coverage-request behavior;
- read-only class status;
- monthly teaching history and progress; and
- responsive standalone and iframe layouts.

## Architecture

```text
Cloudflare Worker
├── public/              static portfolio experience
│   ├── index.html
│   ├── assets/
│   └── data/demo.json   fictional, public demo data
├── src/index.js         API boundary + static asset fallback
├── scripts/validate.mjs repository safety checks
└── wrangler.jsonc       Worker and static asset configuration
```

The Worker currently exposes:

- `GET /api/health` — deployment and integration status;
- `GET /api/meta` — public demo capabilities and limitations; and
- all other non-API requests through Cloudflare static assets.

## Demo boundary

This repository intentionally contains no authentication, real people,
operational databases, CourtReserve credentials, assignment automation, or
production API endpoints. Interactions live only in browser memory. Refreshing
the page or choosing **Reset demo** restores the fictional starting state.

The visible disclosure must remain in any public deployment:

> Portfolio demo · Fictional data · CourtReserve assignment sync disabled

## Local development

Requirements: Node.js 22.12 or later.

```bash
npm install
npm run dev
```

Wrangler prints the local URL. Open it in a browser to use the demo.

Run all static and Worker checks:

```bash
npm run check
```

## Cloudflare deployment

The repository is ready for Cloudflare Workers Builds:

1. In Cloudflare, open **Workers & Pages** and choose **Create application**.
2. Connect GitHub and select `DinkerAI/professor-dashboard-demo`.
3. Keep the Worker name `professor-dashboard-demo` so it matches `wrangler.jsonc`.
4. Leave the build command empty.
5. Use `npx wrangler deploy` as the deploy command if Cloudflare does not select
   it automatically.
6. Save and deploy.

After the first deployment, add its `workers.dev` URL here. A custom domain such
as `professor.forwardcanon.com` can then be attached in the Worker's
**Settings → Domains & Routes** area.

Git pushes to the production branch will deploy automatically after the GitHub
connection is established. Pull requests can use Cloudflare preview deployments.

## Portfolio integration

Standalone route: `/`

Iframe mode: `/?embed=1`

The Content Security Policy allows framing by `forwardcanon.com` and
`www.forwardcanon.com`. See [HANDOFF.md](HANDOFF.md) for integration details.

## Product path

The current boundary is intentional:

1. **Demo:** bundled fictional data and browser-local state.
2. **Pilot:** authenticated Worker API and persistent application data.
3. **Integration:** a separately permissioned CourtReserve API adapter, subject
   to the required endpoint access and CourtReserve approval.

Secrets must remain in Cloudflare secret bindings and must never be committed.
CourtReserve-specific code should live behind the Worker API rather than in the
browser bundle.
