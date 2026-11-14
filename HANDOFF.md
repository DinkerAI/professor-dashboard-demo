# Demo library and portfolio handoff

## Public links

- Library: `https://demo.forwardcanon.com/`
- Direct demo: `https://demo.forwardcanon.com/court-reserve-instructor-dashboard/`
- GitHub: `https://github.com/DinkerAI/professor-dashboard-demo`
- Cloudflare fallback: `https://professor-dashboard-demo.cordwilson.workers.dev/`

`professor.forwardcanon.com` is retained as a redirect so an existing portfolio
link does not break. New links should use the direct demo route above.

## Portfolio integration

Link directly to the demo, or embed it with:

```html
<iframe
  src="https://demo.forwardcanon.com/court-reserve-instructor-dashboard/?embed=1"
  title="Interactive Court Reserve Instructor Dashboard concept"
  loading="lazy"
  style="width:100%;min-height:1000px;border:0"
></iframe>
```

Keep an “Open full demo” link for mobile visitors and users who prefer a
separate page.

## Suggested portfolio copy

**Explore the Court Reserve Instructor Dashboard concept**

An alternative instructor route for facilities that reward participation with
Court Reserve discounts, credits, and member benefits rather than payroll.
Instructors manage eligible classes and coverage. Administrators first admit a
small program catalog from Court Reserve, then curate that focused set by play
type and any number of facility-defined instructor types. The roster exposes
each instructor’s history, level, and password-reset actions, while Incentives
defines what each point threshold unlocks. Conversions separately maps an
instructor-led starting point to one or more membership types or follow-on
classes, with an hours/days attribution window and configurable point
multiplier.

## Public-safety constraints

- Keep the fictional-data and no-live-connection disclosure.
- Do not use real instructor or class information.
- Do not put Court Reserve credentials or secrets in browser code or Git.
- Court Reserve remains the source of categories, play types, and classes.
- Keep the independent-concept / no-endorsement statement.
- Run `npm run check` before deployment.

