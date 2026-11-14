# Forward Canon Demo Library

[![Cloudflare Worker](https://img.shields.io/badge/Cloudflare-Worker-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Data](https://img.shields.io/badge/data-fictional-1b7f55)](#concept-boundary)

A growing, public library of interactive product concepts. The root domain is
an index; each concept has a stable direct route that can be linked or embedded.

- **Demo library:** `https://demo.forwardcanon.com/`
- **Court Reserve Instructor Dashboard:**
  `https://demo.forwardcanon.com/court-reserve-instructor-dashboard/`
- **Source:** `https://github.com/DinkerAI/professor-dashboard-demo`

## Court Reserve Instructor Dashboard

An independent concept for a self-managed instructor participation program.
Facilities curate which Court Reserve categories and play types each instructor
level can claim. Instructors earn points toward discounts, credits, and member
benefits—not payroll compensation.

### Instructor workspace

- eligible assignments, class claims, coverage, progress, and history;
- full-name reveal from instructor initials;
- a sticky scroll-collector interaction; and
- a visible reward ladder showing what each point threshold unlocks.

### Program administration

- a separate catalog-setup dialog for admitting only selected Court Reserve categories or play types;
- a focused policy workspace that only shows the admitted program catalog;
- individual play-type allow/restrict controls inside that catalog;
- unlimited facility-defined instructor types with selectable policies;
- per-level point values, monthly targets, and rollover caps;
- an expandable participation roster with per-instructor history, level-change,
  password-reset, and remove controls;
- editable incentive thresholds and benefit descriptions; and
- conversion mappings from an instructor-led play type to a membership or
  follow-on class, with configurable attribution windows and point multipliers;
- draft, discard, publish, and instructor-preview interactions.

Court Reserve remains the source of categories, play types, and scheduled
classes. This concept cannot create, rename, or delete those records.

## Architecture

```text
Cloudflare Worker
├── public/
│   ├── index.html                              demo library
│   ├── court-reserve-instructor-dashboard/    direct demo route
│   ├── assets/
│   └── data/demo.json                         fictional concept data
├── src/index.js                               routes + API boundary
├── scripts/validate.mjs                       repository safety checks
└── wrangler.jsonc                             domains + Worker assets
```

The historical `professor.forwardcanon.com` hostname redirects to the new demo
route. GitHub `main` is connected to Cloudflare Workers Builds and deploys
automatically.

## Concept boundary

The project contains no authentication, real people, operational databases,
Court Reserve credentials, payroll tools, or production endpoints. All roster,
policy, and incentive interactions live in browser memory and reset on refresh.

The concept is independently produced for presentation purposes and is not
affiliated with or endorsed by Court Reserve.

## Local development

Requirements: Node.js 22.12 or later.

```bash
npm install
npm run dev
npm run check
```

## Portfolio integration

- Direct link: `/court-reserve-instructor-dashboard/`
- Iframe: `/court-reserve-instructor-dashboard/?embed=1`

See [HANDOFF.md](HANDOFF.md) for portfolio copy and embed details.

## Product path

1. **Concept:** fictional data and browser-local state.
2. **Pilot:** authentication, facility roles, and persistent configuration.
3. **Integration:** a permissioned Court Reserve adapter, subject to Court
   Reserve API access and approval.

Secrets belong in Cloudflare secret bindings and must never be committed.

