# UI guidelines

This product is an operations console for the web app, its operations API and its background worker. Operators use it to check health and act on work in flight.

## Navigation and information architecture
- Use a left sidebar plus a slim top bar, because operators jump between a few stable areas all day and the sidebar keeps them one click away.
- Sidebar sections, in order: **Overview** (`overview`), **Operations** (`operations`), **Jobs** (`jobs`), **Settings** (`settings`). The order follows how often each is used.
- The top bar holds the brand, the menu button on phones and the **Account** link (`account`), because account is personal, not a work area.
- Below the 768px breakpoint the sidebar collapses behind the menu button, so the content gets the full width on a phone.
- Every screen marks its own section as the current page, so operators always know where they are.

## Layout and density
- Data-dense, not spacious: use `space-2` and `space-3` inside components and `space-4` between page sections, because operators scan many rows at once.
- Page body is one column capped at `content-max-width`; split into columns with `.grid`, never fixed widths, so it reflows down to a 375px phone.
- Tables sit in `.table-wrap` and scroll sideways on small screens, because wrapping columns hides the data operators compare.
- Page title is an `h1` with its primary action on the right in a `.cluster-between` row, so the main action is always in the same place.

## Component usage
- **Table** (`.table`) for any set of records compared across columns (jobs, services); **card** (`.card`) for one entity or a summary metric; plain `.stack` list for short, single-line items. Cards hold detail, tables hold comparison.
- One `.btn-primary` per view, `.btn-secondary` for other actions, `.btn-ghost` for low-emphasis or toolbar actions, so the main action is unmistakable.
- Destructive actions use `.btn-danger` and always go through a `.modal` that names the thing being affected, because they cannot be undone.
- Job and service state is a `.badge` (success, warning, danger, neutral), never colour-only text, so state reads at a glance in a dense table.
- Use `.drawer` for viewing or editing one record while keeping the list visible; use `.modal` only for confirmations and short blocking decisions.
- Use `.toast` for confirmation of a completed action, `.alert` for problems that stay on screen, and `.empty-state` with a next step when a list has no rows.
- Use `.skeleton` for lists and cards that are loading and `.spinner` only inside a button or a small area, because skeletons keep the layout from jumping.
- Forms use `.field` with a hint, and show errors with `.is-invalid` plus an error line, so each problem is next to its cause.

## Theme
- Light only. Operators work in bright offices and dashboards are shared on screens; one theme halves the design and test surface. Add dark later through new token values, not new classes.

## Voice and tone
- Plain, direct and calm; sentence case everywhere, because an operator under pressure needs facts, not personality.
- Buttons are verb + object ("Retry job", "Add service"); never "OK" or "Submit".
- Errors say what failed and what to do next ("Job failed: worker timed out. Retry or check the worker logs.").
- Use the product's nouns consistently: job, service, operation, worker; do not rename them between screens.
