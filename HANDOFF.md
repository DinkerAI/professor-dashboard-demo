# Portfolio and Cloudflare handoff

## Links

- Live concept: `https://professor.forwardcanon.com/`
- GitHub: `https://github.com/DinkerAI/professor-dashboard-demo`
- Cloudflare fallback: `https://professor-dashboard-demo.cordwilson.workers.dev/`

The repository is a self-contained Cloudflare Worker with static assets in
`public/`. It contains no credentials or live operational data. GitHub `main`
is connected to Cloudflare Workers Builds and deploys automatically.

The public title is **Court Reserve Instructor Dashboard**. The historical
repository and Worker slug stay `professor-dashboard-demo` so the current build
connection, URLs, and deployment history remain stable.

## Portfolio integration

Use the custom domain for a normal link. To embed the experience, use:

```html
<iframe
  src="https://professor.forwardcanon.com/?embed=1"
  title="Interactive Court Reserve Instructor Dashboard concept"
  loading="lazy"
  style="width:100%;min-height:1000px;border:0"
></iframe>
```

The deployed `_headers` policy permits framing from `forwardcanon.com` and
`www.forwardcanon.com`. Keep an “Open full concept” link for mobile visitors.

## What to feature

- **Instructor workspace:** class selection, urgent coverage, monthly progress,
  history, policy filtering, instructor-name reveal, and scroll collection.
- **Curation Studio:** level selection, searchable play types, allow/restrict
  controls, points, targets, draft publishing, and instructor preview.

## Public-safety constraints

- Keep the visible fictional-data and no-live-connection disclosure.
- Do not replace fictional data with real instructor or class information.
- Do not put Court Reserve credentials or secrets in browser code or Git.
- Keep external integrations behind server-side Worker routes.
- Preserve the independent-concept / no-endorsement statement.
- Run `npm run check` before merging a deployment change.

## Suggested portfolio copy

**Explore the Court Reserve Instructor Dashboard concept**

See the instructor and program-operations sides of one workflow: select classes,
manage coverage, curate play-type access by instructor level, and preview the
result. Everything uses fictional data and runs safely in the browser.

