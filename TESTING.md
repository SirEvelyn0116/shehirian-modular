# Quick Start Guide: E2E Testing

## Installation

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install browser binaries
npx playwright install
```

## Running Tests

### Against GitHub Pages (Deployed Site)

```bash
# All tests, all browsers
npm test

# Single browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# Headed mode (see browser)
npm run test:headed

# Debug mode (step through)
npm run test:debug
```

### Against Local Build

```bash
# Build the site
npm run build

# Serve locally in one terminal
npm run preview

# Run tests in another terminal
BASE_URL=http://localhost:8080 npm test
```

## View Test Reports

```bash
# Open HTML report
npm run test:report
```

## What Gets Tested

✅ **All 3 Languages** (EN, FR, AR)
- Page loads successfully
- Correct HTML `lang` and `dir` attributes
- Localized titles
- JSON-LD structured data
- Language switcher functionality
- localStorage language preference

✅ **All 6 Sections**
- Hero
- About Us
- Our Companies
- Recipes
- Certifications
- Contact Us

✅ **Navigation**
- Cross-language switching
- URL updates
- Content changes

✅ **SEO**
- hreflang tags
- x-default language
- JSON-LD validation

✅ **Accessibility**
- RTL support for Arabic
- Keyboard navigation
- Mobile responsiveness

✅ **Performance**
- Load time < 5 seconds
- No console errors
- All sections render

## CI/CD

Tests run automatically on:
- Every push to main
- Every pull request
- Weekly (Sundays at midnight)
- Manual trigger via Actions tab

View test reports in GitHub Actions artifacts.

## Debugging Failed Tests

```bash
# See what's happening
npm run test:headed

# Step through test
npm run test:debug

# Run single test
npx playwright test -g "should have correct title"
```

## Configuration

- **Test file**: `tests/e2e/multilingual.spec.js`
- **Config**: `playwright.config.js`
- **Update BASE_URL**: Edit config or use environment variable

## Support

See `tests/README.md` for comprehensive documentation.

---

# Recipes admin tool (Phase 4) — behavioral matrix

Separate suite, separate config, separate concern from the multilingual E2E tests above: this one
covers the Phase 4 approver-review feature in the Recipes admin tool, not the public site. Split
into what `tests/phase4/`'s Playwright suite verifies automatically and what stays a manual check.
For how to run the app locally at all (auth-stub modes, cleanup, what the stub does/doesn't prove
about real auth), see [`LOCAL_DEV.md`](LOCAL_DEV.md) — this section assumes you've read that one.

## Running the automated suite

```bash
npm run build
npm run dev:auth-stub            # or :translator / :approver — see below
npm run test:phase4              # in a second terminal, same server still running
```

`test:phase4` wraps `netlify dev:exec` so the DB-seeding/cleanup helpers in `tests/phase4/db-helpers.js`
get `DATABASE_URL` directly, the same way the app server does. It does **not** start the
`dev:auth-stub*` server for you — start that first, in its own terminal, and leave it running.

The suite runs against the real Neon database (same one `dev:auth-stub` writes to), seeding and
cleaning up rows under its own identity, `playwright-test@example.com` — distinct from the stub's
own `local-dev@example.com`, so automated runs and manual dev-testing cleanup (`npm run
db:clean-test-edits`) never collide. Tests run serially (`workers: 1`), not in parallel, because
they share that one external database.

`role-routing.spec.js` self-detects whichever stub role is currently active by reading the
dashboard's role-badge text, so the *same file* covers all three role-routing matrix rows — you
just run it three times, once per server variant:

```bash
# with dev:auth-stub:translator running:
netlify dev:exec -- npx playwright test --config=tests/phase4/playwright.config.js role-routing.spec.js
# repeat with dev:auth-stub:approver, then with plain dev:auth-stub (both roles)
```

The other three spec files (`checkbox-safety`, `approve-button`, `empty-state`) don't depend on
role, so a plain `npm run test:phase4` against any running variant covers them.

**Scope caveat**, repeated from each spec file's header comment: this all runs against
`scripts/stub-identity.js`'s hand-built identity, not a real Netlify Identity JWT. It proves the
app's own role-gating and UI logic are correct; it does not prove JWT signature/expiry validation
or that a real Identity account's roles land where the app expects. That boundary is manual/
post-deploy only — see `LOCAL_DEV.md` §4.

## The matrix

| # | Behavior | Covered by | Notes |
|---|---|---|---|
| 1 | Translator-only account: no Review tab, lands on picker | `role-routing.spec.js` (run against `:translator`) | Automated |
| 2 | Approver-only account: no Translate flow, lands directly on Review, no 403 dead-end | `role-routing.spec.js` (run against `:approver`) | Automated |
| 3 | Dual-role account: mode toggle appears, both flows reachable | `role-routing.spec.js` (run against default `dev:auth-stub`) | Automated |
| 4 | Approver first load renders cleanly, no error state | `role-routing.spec.js` (all three variants — asserts `.recipes-error` absent) | Automated. See Fix 2 below for the underlying bug this guards against. |
| 5 | Review checkbox is checked by default | `checkbox-safety.spec.js` | Automated |
| 6 | Unchecking a row decrements the selected count but the row stays visible in the diff | `checkbox-safety.spec.js` | Automated |
| 7 | Uncheck → reload: edit is still shown and still `pending` in the DB | `checkbox-safety.spec.js` | **Automated — the core non-destructive guarantee.** Proves unchecking never reaches the API at all, not just that the UI looks right. |
| 8 | No delete/reject/discard control exists anywhere in the approval view's DOM | `checkbox-safety.spec.js` | Automated |
| 9 | Approve & Deploy button is disabled | `approve-button.spec.js` | Automated |
| 10 | Forcing a click on the disabled Approve button causes no DB change | `approve-button.spec.js` | Automated |
| 11 | Empty state shows the friendly "Nothing to approve right now" message | `empty-state.spec.js` | Automated |
| 12 | Role indicator text is present and correct per role ("Translator view" / "Approver view" / "Translator & Approver view") | `role-routing.spec.js` (all three variants read this text directly) | Automated |
| 13 | Role indicator is visually distinguishable at a glance (contrast, tint, not relying on color alone) | — | **Manual.** A test can assert the text and CSS class are correct (#12 does); it can't judge whether the result actually reads clearly to a human. |
| 14 | Arabic (RTL) fields render correctly in the approval diff and picker | — | **Manual.** Visual/typographic judgment — layout direction, glyph shaping, mixed-direction text — not something a DOM assertion catches. Also the subject of the existing RTL launch-blocker (see spec §11). |
| 15 | Recipe grouping in the approval view (`<details>` per recipe) is readable — sensible ordering, disclosure affordance is obvious | — | **Manual.** Same category as #14: renders "correctly" by any DOM check while still being confusing to look at. |
| 16 | Pending-edit badge count on the recipe picker matches actual pending rows, per recipe | — | **Manual.** Verified by hand this session against the real DB across all three stub variants (seed edits, confirm badge count, cleanup); not yet in the automated suite — wasn't in the required matrix for this pass. Structurally can only ever reflect durable `edits` rows (see Fix 4 note below), so there's no dirty-state leak to test for even manually. |
| 17 | Recipes-tab usage instructions are present and minimal (Fix 1) | — | **Manual.** Content/copy check, not behavior. |
| 18 | Real Netlify Identity JWT validation; roles actually landing correctly from a real Identity account | — | **Out of scope for this suite by design**, not just unautomated — see the scope caveat above and `LOCAL_DEV.md` §4. Only checkable against a real deploy with a real logged-in session. |

## Notes on two fixes from this pass

**Fix 2 (approver first-load bug):** root-caused via code analysis, not reproduction — the stub
server is synchronous and structurally can't reproduce the race. `RecipesApp.jsx` originally read
`netlifyIdentity.currentUser()` synchronously at render time; real Netlify Identity restores an
existing session *asynchronously*, so a fast mount could see `roles=[]` before the real session
resolved, defaulting to the wrong view and firing an unauthenticated request — which also explains
why a reload "fixed" it (more wall-clock time had passed before the second render). Fixed with a
`useIdentityRoles()` hook that waits for a definitive answer (`'init'`/`'login'` events) before
rendering anything role-dependent. Row 4 above guards the fixed behavior, but can't prove the race
itself is gone, since the stub was never able to exhibit it — real-deploy verification is still
worth doing once this ships.

**Fix 4 (pending-edit badges):** counts come from a direct SQL query against the `edits` table
(`netlify/functions/recipes-list.js`), grouped by `recipe_slug`. Dirty (unsaved, in-memory-only)
edits never reach that table until Save, so there is no code path by which a badge could reflect
anything other than durable, saved, pending work — this is a structural guarantee, not a runtime
check that happens to pass today.
