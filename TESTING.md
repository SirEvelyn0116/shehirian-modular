# Testing

Four automated suites, all run by `.github/workflows/ci.yml` on every pull request into
`translation-pipeline`. None of them need Netlify, Neon, Google or GitHub credentials, and none of
them can reach those services: outbound network from the API and browser tests is blocked except
to the local test server.

| Suite | Command | Runner | Needs |
|---|---|---|---|
| Unit | `npm run test:unit` | `node:test` | nothing |
| API | `npm run test:api` | `node:test` | `TEST_DATABASE_URL` |
| Build output | `npm run test:build` | `node:test` | `npm run build` first |
| Browser | `npm run test:ui` | Playwright (Chromium) | `npm run build` first, `TEST_DATABASE_URL` |

`npm test` runs all four in that order.

## Running locally

The API and browser tests need a throwaway Postgres. They truncate the `edits` and `edit_log`
tables, so `tests/support/db.js` refuses any `TEST_DATABASE_URL` whose host is not local.

```bash
docker run -d --name shehirian-test-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shehirian_test postgres:16
export TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/shehirian_test

npm ci
npx playwright install chromium   # once
npm run build
npm test
```

(PowerShell: `$env:TEST_DATABASE_URL = "postgres://..."`.)

## What runs for real and what is faked

API and browser tests go through `tests/support/server.js`:

- **Real:** every handler in `netlify/functions/`, unmodified, including the role checks inside them;
  the SQL they run, against Postgres 16 with `db/schema.sql` applied by the same splitter
  `db/migrate.js` uses; the GitHub and build-hook client code in `netlify/functions/_shared/`; the
  route table, read from `netlify.toml`'s `[[redirects]]` and applied in file order.
- **Faked:** `raw.githubusercontent.com`, the GitHub Contents API and the Netlify build hook are
  answered by an in-memory fake (`tests/support/fake-github.js`, using `nock`). The fake enforces
  the same "PUT must name the current blob SHA" rule GitHub does and records every commit and build
  hook call, which the tests inspect.
- **Not covered:** Netlify Identity. In production Netlify validates the JWT and puts the user on
  `context.clientContext.user`; here a fixed bearer token is mapped to a test user. In the browser
  tests the Identity widget script is replaced by `tests/support/fake-identity-widget.js`. JWT
  validation, and roles arriving correctly from a real Identity account, can only be checked on a
  real deploy.
- The route table is matched by `tests/support/routes.js`, a re-implementation of the subset of
  Netlify's redirect rules this site uses, not Netlify's own engine.

Recipe data in these tests is `tests/fixtures/all-recipes.json`: two invented recipes, not client
content. The build-output tests read the real build of the committed content.

## What each suite checks

**Unit** (`tests/unit/`): the approve action's conflict guard, apply-to-JSON transform and
idempotency filter (`approveLogic.js`); the Clover sales summary (`cloverSales.js`).

**API** (`tests/api/`):
- Role checks: every admin endpoint refuses anonymous callers (401), signed-in users without a role
  (403) and the wrong role (403), and each refusal is followed by a check that the database, the
  fake GitHub and the build hook are unchanged. A translator cannot approve, reject, publish or
  read the review queue; an approver-only account cannot submit, delete or open translations.
- Translator writes: edits are attributed to the signed-in user (not to anything in the request
  body), re-saving a field updates one row, re-saving a rejected field makes it pending again,
  invalid input is refused, translators can only withdraw their own pending edits.
- Review and approve: the review payload shows the live value, not the stored snapshot; approving
  makes exactly one commit with the selected values applied and nothing else changed, marks the
  edits approved, writes the audit log and fires one deploy; dry runs and unconfirmed calls write
  nothing; stale edits are marked conflict and not committed; repeating an approval does not commit
  twice; if the commit fails nothing is marked approved; the crash-recovery path logs against the
  branch head without a new commit or deploy.
- Publish requests are queued, never committed directly, and a second click withdraws them;
  approving one sets a real boolean in the committed JSON. Rejections keep the row with the reason
  (trimmed, capped at 500 characters), log it with no commit, and show it to translators.
- `netlify.toml`: every redirect points at an existing function, exact paths are matched before the
  wildcards that would swallow them, and old certification URLs 301 to the language home page.
- `db/schema.sql` splits into complete statements.

**Build output** (`tests/build/`):
- Every language has its home, recipe index and product pages, with the right `lang` and `dir`.
- Every internal link and asset reference on every public page resolves to a file in `dist/`.
- Every JSON-LD block and generated data file parses.
- Publish gate: an unpublished language version is `noindex`, absent from the sitemap and from
  every hreflang list, has no structured data and does not contain that language's unreviewed
  ingredients or steps; a published one is indexable, in the sitemap and has `Recipe` structured
  data in its language.
- Client content rules: no certification claims on any page or in the generated data (unless
  `SHOW_CERTIFICATIONS=true`); English visible text says "Bulgor", never "bulgur"; Arabic and
  Armenian pages use Western digits; every UI string has all four languages.

**Browser** (`tests/ui/`), against the built `dist/` including the React admin bundle:
- What translator, approver and dual-role accounts see.
- Translator: edit a field, save, and the row lands in the database as pending; Escape cancels;
  Preview shows unsaved changes in the recipe-page layout; an approver's rejection appears under
  the field with its reason.
- Approver: Review shows live vs. proposed values; Approve commits the ticked edits in one commit
  and triggers one deploy; unticked edits stay pending; Cancel commits nothing; conflicts are
  reported before confirming; Reject stores the reason without committing; publish pills queue a
  request instead of publishing.
- Public site: each language's home page renders its five client-side sections with no console
  errors, the language switcher works, recipe cards open recipe pages.

Any browser console error or uncaught exception fails a browser test. Playwright retries are off.

## Known gaps

- `tests/build/site.test.js` has one test marked `todo` (reported, not failing): the build copies
  the whole `sections/` source folder into `dist/`, so files no page uses are publicly downloadable,
  including the old certification data (one JSON-LD file there claims "Organic"), unparseable
  scan-extraction files and internal notes. Fixing it changes what production publishes.
- French pages still use "bulgur" in visible text; the spelling rule is only enforced for English.
- Browser tests run in Chromium only. Arabic right-to-left layout is checked by attributes, not by
  looking at it.

## Manual integration tests (not in CI)

`npm run test:phase5:integration` and `npm run test:publish:integration` call the real approve and
publish handlers against the real database and make real commits to the `test/phase5-scratch`
branch (never `translation-pipeline`). They need `DATABASE_URL` and `GITHUB_TOKEN` via
`netlify dev:exec`. See `LOCAL_DEV.md` §7.

## CI and deploys

`ci.yml` has five jobs: `Lint and format`, `Unit and API tests`, `Build and build-output tests`,
`Browser tests`, `Dependency audit`. It only reports. Netlify's build does not run any tests, so CI
results never block a deploy, and the admin tool's approve commits (pushed straight to
`translation-pipeline` by the GitHub API) are deployed whatever CI says.

Lint: ESLint `recommended` plus `react-hooks/recommended` for `recipes-app/src` (`eslint.config.js`).
Formatting: Prettier, for the files listed in the `format:check` script only.
Dependencies: `npm audit --omit=dev --audit-level=high` in CI, and `.github/dependabot.yml`.
