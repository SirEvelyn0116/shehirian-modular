# Local dev — running the Recipes admin tool with real auth exercised

There are two local dev modes for this project. Pick based on what you're checking.

| Mode | Command | What it's for |
|---|---|---|
| Static/routing | `netlify dev` | Redirect rules, static page serving, "does this URL resolve." Functions return 401 for everything — no real Netlify Identity backend to validate a JWT against locally. |
| **Full authenticated flow** | `npm run dev:auth-stub` | Editing recipes, saving, watching clean→dirty→pending, anything that needs to get *past* the role gate. This doc is about this mode. |

## 1. Running it

```bash
npm run build
npm run dev:auth-stub
```

Then open **http://localhost:8888/admin/** — the Recipes tab is already active, no login step, no browser console commands. Pick a recipe, edit an Arabic field, hit Save. It's really saving to the real Neon database.

If you change anything in `recipes-app/src/`, re-run `npm run build` (or `npm run build:recipes` alone, faster) and refresh the browser — there's no hot-reload in this mode.

`npm run dev:auth-stub` is `netlify dev:exec node scripts/dev-server.js` — `dev:exec` is what injects `DATABASE_URL` and the other Netlify-managed env vars into the process; running `node scripts/dev-server.js` directly will fail fast with a clear error instead of silently missing the database connection.

> ⚠️ **The interactive Approve & Deploy button in this mode is real, not inert — but it's now
> production-safe by default.** Editing and saving fields only ever writes to the `edits` table —
> always safe, unaffected by any of this. `/api/recipes/approve` is wired into `dev-server.js` too,
> and clicking through the real confirm gate here, with real pending edits, makes a real GitHub
> commit (and a real build hook call, if that commit lands somewhere Netlify builds) — this was
> never inert. What changed is *where* it commits by default: `dev-server.js` now defaults
> `GITHUB_BRANCH` to `test/phase5-scratch` whenever it isn't already set, so clicking approve with
> a plain `npm run dev:auth-stub` targets the scratch branch, not production. Netlify only builds
> `translation-pipeline`, so a scratch-branch commit triggers no deploy regardless.
>
> **Reaching production from here requires setting `GITHUB_BRANCH` explicitly** — the safe path is
> the default now, touching production is the deliberate opt-in:
> ```bash
> GITHUB_BRANCH=translation-pipeline npm run dev:auth-stub
> ```
> The startup banner always prints which branch is actually in effect, so there's no need to
> remember or guess:
> ```
> Approve action commit target: test/phase5-scratch  (scratch — safe default)
> Approve action commit target: translation-pipeline  ⚠️  PRODUCTION — set explicitly, not the default
> ```
> This default lives entirely in `dev-server.js` — a file that, per its own header comment, is
> never referenced by `[build].command` and can't reach a real deploy. `recipes-approve.js`'s own
> fallback (`process.env.GITHUB_BRANCH || 'translation-pipeline'`) is untouched and still runs
> unmodified in production, still defaulting to the real branch there — the scratch default is
> injected into `process.env` by `dev-server.js` *before* that module is `require`'d, in this
> process only, so production can't inherit it under any circumstance.
>
> For scripted, repeatable verification of the approve flow that can't be pointed at production
> even by mistake, prefer §7's `npm run test:phase5:integration` below. Reach for the interactive
> route when you specifically need to see the confirm panel / poll UI render in a real browser.

## 2. Testing as translator, approver, or both

The default `npm run dev:auth-stub` stub has **both** roles, which is fine for most work but hides
a real distinction: a genuine approver-only Identity account has no `translator` role, and
`GET /api/recipes` / `GET /api/recipes/:slug` both require `translator` — so a real approver
landing on the translate flow would just get a 403. `RecipesApp.jsx` handles this (an approver-only
user goes straight to Review, no dead end), but you can only actually see that behavior, or the
Phase 4 approval view in general, by running the stub as one role at a time:

```bash
npm run dev:auth-stub:translator   # roles: [translator] — no Review tab, exactly pre-Phase-4 behavior
npm run dev:auth-stub:approver     # roles: [approver] — lands directly on Review, no Translate flow at all
npm run dev:auth-stub              # roles: [translator, approver] — both, with a mode toggle between them
```

Same server, same port, same everything else — only `STUB_ROLE` differs (`scripts/stub-identity.js`
reads it, defaulting to `'both'`). The terminal banner on startup prints the active identity and
roles so you always know which mode you're in:

```
⚠️  LOCAL AUTH STUB DEV SERVER — not netlify dev, not deployable.
   Stub identity: local-dev@example.com  roles: [approver]
   Open: http://localhost:8888/admin/
```

To actually generate something for the approver stub to review: run `dev:auth-stub:translator`
(or the default), save a couple of edits, stop it, then start `dev:auth-stub:approver` and reload
— the pending edits are in the real database regardless of which role wrote or is viewing them.

## 3. Cleaning up your test edits

There's no separate test database — `dev:auth-stub` writes real rows into the real Neon `edits`
table. Clean them up when you're done so they don't clutter the pending queue Phase 4's approval
view will eventually read:

```bash
npm run db:clean-test-edits
```

This deletes rows from `edits` **only** where `editor_email` matches the stub's fake identity
(`local-dev@example.com`, defined once in `scripts/stub-identity.js` and imported by both the
stub server and this script — so they can never drift apart). It prints every matching row —
recipe, field, status, id — before deleting anything, and if nothing matches it says so and stops.

**Why it's safe to run without thinking twice:**
- The email filter is imported, not retyped, and is checked non-empty before the query is even
  built (`db/clean-test-edits.js`) — there's no code path here that degrades into an unscoped
  `DELETE FROM edits`.
- `local-dev@example.com` is a fake domain that will never match a real translator's account.
- Verified directly: seeded a decoy row under a different `editor_email`, ran a real
  `dev:auth-stub` session to create two genuine stub rows, ran the cleanup — it found and deleted
  exactly the two stub rows, printed them by name first, and left the decoy row untouched. Confirmed
  with a direct query afterward that the decoy was still there, then removed it by hand (deliberately
  *not* via this script, since it isn't the stub's row to touch).

**Why it never touches `edit_log`:** that table is append-only by design (build spec §5) — a
cleanup script deleting from it would undercut the one thing it's for, even for test data. Phase 5
does now write `edit_log` rows at approval time, but not through this script or this identity: the
interactive approve flow uses whatever identity the running stub presents (still
`local-dev@example.com` if you approve edits authored under that identity), while the scripted
Phase 5 tests (§7) use their own separate identity and clean up their own `edit_log` rows directly
in their own `finally` block, scoped to that identity only. If you do interactively approve edits
under the stub identity and want their `edit_log` rows gone too, that's a manual, deliberate
decision (e.g. a direct scoped `DELETE ... WHERE editor_email = 'local-dev@example.com'` against
`edit_log`) — intentionally not something this script does silently, for the same append-only
reasoning as above.

## 4. What this does and doesn't test

`scripts/dev-server.js` is a small plain Node HTTP server — **not** `netlify dev`, not a fork of the real functions. It does two things:

- Serves `dist/` statically (build it first).
- For `/api/*`, calls the **real, unmodified** function handlers from `netlify/functions/` directly — `require('../netlify/functions/edit-create.js').handler(event, fakeCtx)` — with a hardcoded `fakeCtx.clientContext.user` standing in for what Netlify's edge would normally populate from a validated Identity JWT.

That `fakeCtx` is the entire shortcut. Spelled out precisely:

**Exercised for real:**
- All business logic in every function — upsert semantics, validation (`lang='en'` rejection, missing fields), the conflict-guard fields, ownership scoping on delete, everything.
- The **role-check logic itself** (`requireRole` in `netlify/functions/_shared/requireRole.js`) — it runs unmodified and really does read `roles` off the `user` object and really does reject if `'translator'` isn't in the list. You can prove this by editing `scripts/stub-identity.js`'s `STUB_USER.app_metadata.roles` to `[]` and confirming every call starts 401ing again.
- The real Neon database, over the real `@neondatabase/serverless` driver, same as production.
- All of the React state machine — clean/dirty/pending transitions, Save, the reload-reconciliation against `GET /api/edits/mine`, the unsaved-changes guard, Preview mode.

**NOT exercised — this is the trusted-not-tested part:**
- **JWT validation itself.** In production, Netlify's edge verifies a real signed token from Netlify Identity before it ever populates `context.clientContext.user`. Locally, that object is just handed to the function directly, no signature, no expiry, no verification of any kind. A function can't tell the difference between this stub and a real validated token — that's the whole point of the shortcut — but it also means **this never proves the JWT verification step works**. That can only be checked against a real deploy with a real logged-in session (which is exactly what you did on the deploy preview for Phases 1–3).
- **Where the roles/email actually come from on a real account** — whether `app_metadata.authorization.roles` vs `app_metadata.roles` is populated correctly for a given Identity user, whether the invite/role-assignment flow actually sets what you expect. The stub just declares the roles it wants; it doesn't touch that pipeline at all.
- **Redirect routing** (`netlify.toml`'s `[[redirects]]`) — this server has its own hand-written route table matching the current redirects, not the real redirect engine. If you add a new `/api/*` endpoint, you must update both `netlify.toml` and `scripts/dev-server.js`'s routes, and only testing through `netlify.toml`'s real engine (or a real deploy) proves the redirect itself is correct — recall the `/admin/*` loop and the `/api/recipes` vs `/api/recipes/*` shadowing bugs from earlier this project, both of which were redirect-engine-specific and invisible to direct handler calls like this.

**Bottom line:** this mode proves the code is correct. It does not prove Netlify's auth plumbing is wired correctly around that code. Both matter; only a real deploy test covers the second one.

## 5. Why this can't leak into production

This is the part that actually matters, so here's the reasoning, not just the assertion:

- `netlify.toml` has `[functions]  directory = "netlify/functions"` — that is the **only** directory Netlify's build bundles as deployable functions. `scripts/dev-server.js` lives outside it. There is no configuration anywhere that would make Netlify look at `scripts/` for anything.
- `netlify.toml`'s `[build].command` is `npm run build:recipes && node sync-google-sheets.js && node generate-index.js`. It does not invoke `dev:auth-stub`, `dev-server.js`, or anything under `scripts/`, directly or indirectly.
- The actual function files under `netlify/functions/` — the ones that *do* deploy — contain **zero** stub-related code. No env var check, no dev-mode flag, no conditional branch. `requireRole.js` has exactly one code path, and it's the real one. I deliberately did not add an `if (process.env.NODE_ENV !== 'production')`-style bypass *inside* the deployed functions, even gated — a flag like that is one misconfigured environment variable away from being live in production, and there'd be no way to see that from reading the function in isolation. Keeping the stub entirely in a file Netlify never touches removes that risk category outright: there is no flag to misconfigure, because there is no code path in the deployed files that behaves differently based on anything.
- Confirmed directly: `grep -rn "scripts/" netlify.toml package.json generate-index.js` finds exactly one match — the `dev:auth-stub` line in `package.json`'s `scripts` block, which is a command a person runs by hand, not something any deploy or build step executes.

If you ever want to double check this yourself after future changes: `grep -rn "scripts/" netlify.toml` should keep returning nothing.

## 6. Automated tests

Phase 4's approver-review behavior (checkbox non-destructiveness, role routing, the empty state)
has a Playwright suite in `tests/phase4/`, run via `npm run test:phase4` against a `dev:auth-stub*`
server you start separately. See [`TESTING.md`](TESTING.md) for the full behavioral matrix and
which rows are automated vs. manual-only.

Phase 5's approve action (the real commit) has its own, separate two-tier test setup — see §7.

## 7. Testing Phase 5's approve action safely

`POST /api/recipes/approve` is the one endpoint in this whole tool that writes to the repo and
deploys to production, so it gets tested in two tiers: pure logic offline, and the real commit path
against a scratch branch that can never trigger a real deploy.

### Unit tests (no DB, no GitHub, no server)

```bash
npm run test:phase5:unit
```

Runs `tests/phase5/approveLogic.test.js` (Node's built-in test runner — no extra dependency) against
`netlify/functions/_shared/approveLogic.js`'s pure functions: the conflict-guard comparison, the
apply-edits-to-JSON transform, and the idempotency filter. Fixture `all-recipes.json` + fixture edit
rows in, plain data out — this is where most of the approve action's correctness risk actually
lives, and none of it needs real infrastructure to verify.

### Integration test (real commit, real DB — but never production)

```bash
npm run test:phase5:integration
```

Runs `tests/phase5/scratch-branch-integration.js`, which calls the **real** `recipes-approve.js`
handler — same file that deploys — with `GITHUB_BRANCH` overridden to `test/phase5-scratch` instead
of `translation-pipeline`. This is exactly the config-driven design build spec §6 requires: the
commit target branch is read from env everywhere in `recipes-approve.js`, never hardcoded, so
pointing it at a scratch branch for testing is a one-line env override, not a code change.

**Why this is safe to run for real, repeatedly:** `netlify.toml`'s `[build]` only builds
`translation-pipeline` — a commit to any other branch triggers **no deploy at all**, independent of
whether the build hook also fires (it doesn't fire here regardless: the build hook only fires when
`toCommit.length > 0` *and* the batch actually needed a fresh commit, and even then it's just an
unnecessary rebuild of already-correct content, not a leak of test data — see §6 point 6 of the
build spec's approve sequence). The script also asserts this directly rather than just assuming it:
it captures `translation-pipeline`'s blob SHA before running, and asserts it's byte-for-byte
unchanged afterward.

What the script does, in order:
1. Creates `test/phase5-scratch` off `translation-pipeline` if it doesn't already exist (via the
   GitHub API — `git/refs`, not a local `git push`).
2. Seeds one real pending edit in Postgres, scoped to its own test identity
   (`phase5-integration-test@example.com`, distinct from every other test email in this repo —
   `local-dev@example.com` for the auth-stub, `playwright-test@example.com` for Phase 4's suite —
   so none of their cleanup scripts can ever touch each other's data).
3. Runs a `dryRun` call first and asserts it wrote nothing (blob SHA unchanged).
4. Runs the real `confirmed: true` call and asserts: a commit actually landed on
   `test/phase5-scratch` with the right content, `translation-pipeline` did **not** move, the
   `edits` row flipped to `approved`, and an `edit_log` row was written with `commit_sha` matching
   exactly what the approve call reported.
5. Re-submits the same (now-approved) id and asserts no second commit — the simple "already
   resolved" case.
6. Manually resets that same row back to `pending` (simulating the exact crash the build spec's
   ordering rationale describes: the commit succeeded, but the status flip didn't) and re-submits
   it — asserts this also produces no second commit and no duplicate `edit_log` row, proving the
   *deeper* idempotency guard (matched via `edit_log.commit_sha`, not just `edits.status`) is what's
   actually doing the work, not just the simpler status check.
7. Cleans up its own `edits`/`edit_log` rows in a `finally` block, scoped to its own test email —
   never touches `edit_log` rows belonging to anything else, consistent with `edit_log` being
   append-only everywhere else in this project.

Needs `DATABASE_URL` and `GITHUB_TOKEN`, hence `netlify dev:exec` — don't run the script with plain
`node`, same reasoning as every other DB-touching script in this repo.

**What this does NOT test:** the real Netlify build hook actually triggering a real deploy (by
design — this never fires it for real against test data) and real Netlify Identity JWT validation
(same boundary as everywhere else in this repo, see §4). Both stay manual/post-deploy checks.

## 8. Gotchas

- **`netlify link` is required once per clone.** `dev:exec` needs the project linked to pull `DATABASE_URL` and friends — `.netlify/state.json` holds that (gitignored, machine-specific). If you're on a fresh checkout and get "not linked" errors, run `netlify link` and select `ornate-biscuit-625466`.
- **`DATABASE_URL` isn't in `.env`.** It's a Netlify-managed env var (Site configuration → Environment variables, scoped to include the `dev` context), only reachable locally through `netlify dev:exec` / `netlify dev`. That's why `dev-server.js` refuses to start without it rather than silently limping along.
- **Port 8888.** Same port `netlify dev` itself uses, chosen for muscle-memory, but this is a different, unrelated server — don't run `netlify dev` and `npm run dev:auth-stub` at the same time, they'll fight over the port. `netstat -ano | grep 8888` (or `Get-CimInstance Win32_Process -Filter "name = 'node.exe'"` in PowerShell, since `pkill -f netlify` has proven unreliable against these Windows-spawned node children) if you need to find and kill a stuck one.
- **No hot-reload.** Rebuild (`npm run build` or `npm run build:recipes`) and refresh the browser after any `recipes-app/src/` change.
- **No CORS to worry about.** Static files and `/api/*` are served from the same origin/port, matching production's shape — this was a deliberate reason to write a same-process server rather than pointing the React app at a separately-hosted API during dev.
- **Route table drift.** As noted in §4 — new `/api/*` endpoints need a matching route added to `scripts/dev-server.js` by hand.
- **`STUB_ROLE` only affects `dev-server.js`.** `db:clean-test-edits` always targets `local-dev@example.com` regardless of which role variant wrote the row — the role doesn't change the stub's email.
- **Cleanup script needs `netlify dev:exec` too** (via `npm run db:clean-test-edits`) for the same `DATABASE_URL` reason as the stub server itself — don't run `node db/clean-test-edits.js` directly.
- **Stub visibly announces itself.** Both a `console.warn` banner (styled, hard to miss) on every page load and a startup banner in the terminal say this is the auth-stub server — if you ever see recipe data in a screenshot or log without that warning nearby, it's not this mode.
- **`GITHUB_BRANCH` defaults differently in `dev-server.js` than everywhere else, on purpose.**
  `recipes-approve.js` itself still defaults to `translation-pipeline` when unset — that's the
  production code path, unchanged. `dev-server.js` pre-sets `GITHUB_BRANCH` to
  `test/phase5-scratch` in its own process, before requiring that module, whenever you haven't set
  one yourself — see the warning in §1. An explicit `GITHUB_BRANCH` (yours) always wins over this
  default, in either direction.
- **The scratch branch must already exist for the interactive Approve button to work.**
  `dev-server.js` sets the *env var* default; it does not create the branch. If
  `test/phase5-scratch` doesn't exist yet (fresh clone, never run the integration test), the
  approve call's first GitHub read 404s and the whole action fails with a clear error — not
  silently, and nothing is written anywhere when this happens. Run `npm run test:phase5:integration`
  once first (§7 — it creates the branch itself if missing), or create it by hand, before relying
  on the interactive button.
- **`test/phase5-scratch` is a real, permanent branch on the real repo**, created automatically by
  the first `npm run test:phase5:integration` run. It accumulates one commit per test run by
  design (each run reads the branch's *current* content rather than assuming a fixed baseline, so
  repeated runs never conflict with themselves) — that's expected, not a leak to clean up. It is
  never merged anywhere and Netlify never builds it.
