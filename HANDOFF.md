# Portfolio-agent handoff

## What this is

`professor-dashboard-demo` is a buildless static web experience that reconstructs
the professor-facing scheduling workflow with fictional data. It is technically
self-contained and contains no credentials or live operational data. It does not
contact CourtReserve, DinkerAI services, or any other external endpoint. Final
publication of Peak branding and workflow descriptions remains the portfolio
owner's decision.

## Preferred integration

Copy this entire directory into the portfolio site's public/static assets and
serve it at a stable route such as:

```text
/demos/professor/
```

Link to that route from the Peak Pickleball portfolio section. The standalone
page includes its own context and disclosure.

If the host does not automatically serve directory index files, link directly to:

```text
/demos/professor/index.html
```

## Optional iframe integration

For an embedded presentation, load:

```text
/demos/professor/index.html?embed=1
```

Suggested minimum iframe size:

```html
<iframe
  src="/demos/professor/index.html?embed=1"
  title="Interactive Professor Dashboard portfolio demo"
  loading="lazy"
  style="width:100%;min-height:900px;border:0"
></iframe>
```

The host page should add an “Open full demo” link for mobile visitors and users
who prefer a separate page.

## Files that must stay together

```text
index.html
assets/demo.css
assets/demo.js
assets/peak-mark.svg
data/demo.json
```

`README.md` and this file are documentation and do not need to be publicly served.

## Integration constraints

- Preserve the relative directory structure.
- Serve the files over HTTP(S); `fetch()` will not load the JSON reliably from a
  local `file://` URL.
- Do not replace the fictional data with real instructor or class information.
- Do not add credentials, API URLs, analytics identifiers, or CourtReserve calls.
- Keep the visible “Portfolio demo” disclosure.
- The demo stores no data. Reloading the page resets it.

## Suggested link copy

**Explore the Professor Dashboard demo**

Instructor-side scheduling reconstructed with fictional data. External assignment
sync is intentionally disabled.

