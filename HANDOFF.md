# Portfolio and Cloudflare handoff

## Repository

```text
https://github.com/DinkerAI/professor-dashboard-demo
```

This is a Cloudflare Worker project with static assets in `public/`. It is
technically self-contained and contains no credentials or live operational data.
Final publication of Peak branding and workflow descriptions remains the
portfolio owner's decision.

## Preferred public setup

Connect this repository to **Cloudflare Workers Builds** and deploy the `main`
branch. The project name must remain `professor-dashboard-demo` unless the
`name` field in `wrangler.jsonc` is updated to match.

Cloudflare fallback URL:

```text
https://professor-dashboard-demo.cordwilson.workers.dev
```

Production custom domain:

```text
https://professor.forwardcanon.com
```

Use the production custom domain as the portfolio link.

## Optional iframe integration

Use the live URL with `?embed=1`:

```html
<iframe
  src="https://professor.forwardcanon.com/?embed=1"
  title="Interactive Professor Dashboard portfolio demo"
  loading="lazy"
  style="width:100%;min-height:900px;border:0"
></iframe>
```

The deployed `_headers` policy permits framing from `forwardcanon.com` and
`www.forwardcanon.com`. Keep an “Open full demo” link for mobile visitors and
users who prefer a separate page.

## Required public files

Cloudflare serves the entire `public/` directory. Do not move individual assets
out of it without updating their relative paths and `wrangler.jsonc`.

## Integration constraints

- Keep the visible “Portfolio demo” disclosure.
- Do not replace fictional data with real instructor or class information.
- Do not add credentials or CourtReserve secrets to browser code or Git.
- Keep external integrations behind server-side Worker routes.
- The demo stores no data; reload and **Reset demo** return the initial state.
- Run `npm run check` before merging a deployment change.

## Suggested portfolio copy

**Explore the Professor Dashboard demo**

Instructor-side scheduling reconstructed with fictional data. Test the class
selection and urgent coverage workflow directly in your browser; external
assignment sync is intentionally disabled.
