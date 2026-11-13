# Professor Dashboard — Portfolio Demo

This is a self-contained, fictional-data reconstruction of the professor-facing
Peak Pickleball scheduling workflow.

It demonstrates:

- upcoming teaching assignments;
- eligible and available classes;
- class-type filtering;
- locally simulated class claims;
- seven-day coverage-request behavior;
- read-only class status; and
- monthly teaching history and progress.

It intentionally does **not** include authentication, real people, operational
databases, CourtReserve access, assignment automation, analytics, or network
requests beyond loading its bundled `data/demo.json` file.

## Preview locally

The demo must be served over HTTP so the browser can load `data/demo.json`.
From this folder, use any static file server available to your web project. For
example, a portfolio project's existing development server can expose the
directory directly.

Entry point: `index.html`

Embed mode: `index.html?embed=1`

## Reset behavior

All interactions live only in memory. Refreshing the page or choosing **Reset
demo** returns the fictional starting state.

## Source reference

The interaction language and workflow are derived from the private DinkerAI
Professor Dashboard source. This folder is a clean public-facing reconstruction,
not a copy of the production backend or its data.

