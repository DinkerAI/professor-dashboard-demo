# Court Reserve Instructor Dashboard — Product Concept

[![Cloudflare Worker](https://img.shields.io/badge/Cloudflare-Worker-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Data](https://img.shields.io/badge/data-fictional-1b7f55)](#concept-boundary)

An independent, interactive product concept for instructor scheduling and
program curation around Court Reserve play types. The project is a Cloudflare
Worker with static assets, fictional data, and browser-local interactions.

> **[Open the live Court Reserve Instructor Dashboard](https://professor.forwardcanon.com/)**

## What the concept shows

### Instructor workspace

- upcoming assignments, eligible classes, and teaching history;
- policy-aware play-type and level filtering;
- locally simulated class claims and coverage requests;
- monthly teaching points and rollover progress;
- full instructor names revealed from initials; and
- the scroll-collector interaction, where content compresses into the sticky
  progress header while the page moves.

### Curation Studio

- three fictional instructor levels with separate policies;
- a searchable Court Reserve-style play-type catalog;
- allow/restrict controls for every play type;
- per-level point mapping, monthly targets, rollover caps, and achievements;
- draft, discard, publish, and instructor-preview interactions; and
- a simulated catalog extension for new play types.

## Architecture

```text
Cloudflare Worker
├── public/              static product concept
│   ├── index.html
│   ├── assets/
│   └── data/demo.json   fictional, public concept data
├── src/index.js         API boundary + static asset fallback
├── scripts/validate.mjs repository safety checks
└── wrangler.jsonc       Worker and static asset configuration
```

The Worker exposes `GET /api/health`, `GET /api/meta`, and all other non-API
requests through Cloudflare static assets.

## Concept boundary

This repository contains no authentication, real people, operational databases,
Court Reserve credentials, assignment automation, or production API endpoints.
Interactions and policy publishing live only in browser memory. Refreshing the
page or choosing **Reset demo** restores the fictional starting state.

The concept is independently produced for presentation purposes and is not
affiliated with or endorsed by Court Reserve.

## Local development

Requirements: Node.js 22.12 or later.

```bash
npm install
npm run dev
```

Run all static and Worker checks:

```bash
npm run check
```

## Deployment

Cloudflare Workers Builds is connected to the repository's `main` branch.
Every push deploys automatically.

- Production: `https://professor.forwardcanon.com/`
- Worker fallback: `https://professor-dashboard-demo.cordwilson.workers.dev/`
- Source: `https://github.com/DinkerAI/professor-dashboard-demo`

The infrastructure slug remains `professor-dashboard-demo` to preserve the
existing GitHub/Cloudflare build connection. The public product title is Court
Reserve Instructor Dashboard.

## Portfolio integration

- Standalone route: `/`
- Iframe mode: `/?embed=1`

The Content Security Policy allows framing by `forwardcanon.com` and
`www.forwardcanon.com`. See [HANDOFF.md](HANDOFF.md) for integration details.

## Product path

1. **Concept:** bundled fictional data and browser-local state.
2. **Pilot:** authentication, persistent policy, and facility-scoped roles.
3. **Integration:** a separately permissioned Court Reserve adapter, subject to
   Court Reserve API access and approval.

Secrets must remain in Cloudflare secret bindings and must never be committed.
Integration-specific code belongs behind the Worker API, not in the browser.

