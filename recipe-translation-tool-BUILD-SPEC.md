# ▶ HANDOFF TO CLAUDE CODE — READ THIS FIRST

You are picking up a project that was architected in a separate conversation. This document is
the complete source of truth for it. Read it fully before writing code. This preamble orients you
and hands you **Phase 0** with a specific definition of done.

## The project in one paragraph
Add a **recipe-translation view** to an *existing* Netlify governance dashboard. Translators edit
recipe fields on a rendered replica of the recipe, stage edits into a Postgres pending store; an
approver reviews the whole pending set as a diff and ships it in one action, which commits the
source JSON to git and fires a Netlify build hook. It is deliberately a hand-written REST API over
Postgres (résumé goal — see §13). It is NOT a separate app: it's a new view in the dashboard that
already exists in this repo.

## Git baseline — verify BEFORE creating files
- **Netlify deploys the live site from the `translation-pipeline` branch.** Not `main`.
- **`main` is a fossil** (the old GitHub Pages build), ~22 commits behind. Do not branch from it,
  do not merge to it. Treat `translation-pipeline` as the real default branch.
- There is a one-commit divergence on `main` only (`HANDOFF.md`); ignore it for this work.
- This session's CSS/cleanup lives on `mobile-and-design-fixes`, which should be merged into
  `translation-pipeline` first. Confirm that merge happened (`git log translation-pipeline`) before
  starting. **Branch all new work off `translation-pipeline`.**

## Environment facts you need
- Static site. `generate-index.js` builds everything into `dist/`; Netlify rebuilds on push to
  `translation-pipeline`. `npm run build` runs it locally. Build wipes and re-copies `dist` each run.
- **Edit target: `sections/recipes/all-recipes.json`** — the single source of truth (§1). All other
  recipe files (`.jsonld`, page HTML, cards) are generated from it; never edit those.
- **Reuse the existing dashboard, do not reinvent it** (§2, §7, §12). Already built and working:
  - `admin.js` / `index.html` — the dashboard shell, Netlify Identity auth, the `renderDiff` diff
    table, the "poll `metadata.json` until `lastBuild` changes" deploy-confirm.
  - `netlify/functions/fetch-preview.js` — the live-vs-source diff pattern to mirror.
  - `netlify/functions/trigger-sync.js` — the role gate to extract into a shared helper (§2), and
    the Netlify-build-hook trigger to reuse (§6).
- The UI-strings pipeline (Google Sheets → `sync-google-sheets.js`) stays **untouched**. Recipes
  are a parallel view, not a rewrite of it (§0, §9).

## ▶ PHASE 0 — your task now
**Goal:** stand up the Recipes view skeleton inside the existing dashboard, role-gated, with an
empty React island mounted — no recipe data, no DB, no editing yet. This is scaffolding whose only
job is to prove the new view slots into the existing shell cleanly.

**Do:**
1. Confirm the git baseline above; branch `phase/recipe-admin` (or similar) off `translation-pipeline`.
2. Add a way to reach a "Recipes" view alongside the existing UI-strings dashboard (tab/route
   toggle in `index.html` / `admin.js`) — gate it on Netlify Identity role.
3. Introduce React + Vite for this view *only* (mount a React island; leave the vanilla-JS shell and
   UI-strings view as-is). A placeholder component that renders "Recipes view — Phase 0" is enough.
4. Wire the build so the React island is produced and served alongside the static site without
   breaking `generate-index.js` or the existing dashboard.

**Definition of done:** logged in with the right role, you can switch to a Recipes view that renders
a React placeholder; the existing UI-strings dashboard and `npm run build` still work unchanged;
committed to the phase branch. No API, no DB, no recipe rendering yet.

**Then Phase 1 is the real risk-retirement step** (§10): render a read-only replica of a *real*
recipe from `all-recipes.json` and eyeball it against the live recipe page. The whole architecture
("render from JSON, don't touch built pages") lives or dies there — so get to a rendered replica
against real data as fast as the phases allow. Everything after Phase 1 is comparatively routine.

## When to stop and go back to conversation, not code
Build the phases here. But **decisions** — a backend approach fighting you (e.g. serverless
Postgres pooling), the client's pending "About page" requirements changing the data model, or any
"should we" fork — are better resolved in a planning conversation than solved in code. Use the spec
as the shared artifact across both modes: implement here, decide there.

---

# Recipe Translation Tool — Build Spec (v2)

A recipe-translation view added to the **existing Translation Governance Dashboard**.
Translators edit recipe fields on a faithful rendered replica of the recipe;
they stage edits into a pending store; an approver reviews the whole pending set as a diff and
ships it in one action, which commits the source JSON and triggers a Netlify rebuild.

Built as a portfolio piece. The one deliberate "slower but stronger for the résumé" choice is a
**hand-written REST API over hosted Postgres** (rather than a generated BaaS layer), because API
design is a recurring ask in target job postings, and Postgres ladders onto the existing
Oracle/PL-SQL background as a "modernization" story.

> **v2 note.** This revises v1 after reviewing the *already-built* ui-strings governance
> dashboard (`admin.js` / `index.html`) and its functions (`fetch-preview.js`,
> `trigger-sync.js`). Much of what v1 treated as new work is already solved there and is reused
> here. The recipe tool is **that dashboard's pattern + a replica editor + a pending store**.

---

## 0. Why recipes need a store when ui-strings doesn't (the core insight)

The ui-strings flow has **no pending store and no per-edit state** — and that's not an oversight,
it's the architecture. Translators edit the **Google Sheet directly**; `fetch-preview` diffs
*live-site JSON vs. current-Sheet* on demand; approval fires a build hook, and
`sync-google-sheets.js` re-pulls the whole Sheet *during* the build. **The Sheet is the staging
area.**

Recipes have **no external editing surface** — editing happens inside the React replica — so
there is nowhere for a pending edit to live except a store we build. *That* is the only reason
recipes need Postgres and ui-strings doesn't: ui-strings outsourced its staging to Sheets;
recipes can't. Everything else (auth, diff UI, build trigger, deploy-poll) is shared.

---

## 0.5 Language roles (what "Arabic priority" does and doesn't mean)

- **English is the source / reference language.** The `.en` values are the authored originals;
  they are read-only in the editor and shown as the reference the translator works against.
- **French, Arabic, and Armenian are targets.** The translator reads EN and writes the
  translation into `.fr` / `.ar` / `.hy`.
- **All target languages are treated identically** in the schema, API, and `fieldPath` grammar —
  there is nothing structurally special about `ar`.
- **Arabic is the *priority target*** only in the business sense (the bulgur/falafel market is the
  reason the tool exists). Its one real technical consequence is that **RTL is a first-class UI
  concern from the start** (FR/HY are LTR; if Arabic were an edge case, RTL could be deferred —
  it can't). "Priority" = where the UI and RTL effort centers, not a data-model role.

---

## 1. Source of truth & edit target

Recipe content lives in one file: **`sections/recipes/all-recipes.json`** — `{ recipes: [ … ] }`,
44 recipes. Every translatable field is an object keyed by language; times are language-neutral.

```
recipe = {
  slug:            "royal-soup",          // stable id
  featuredRecipe:  true,
  categoryId:      "soup",
  title:           { en, fr, ar, hy },
  description:     { en, fr, ar, hy },
  recipeCategory:  { en, fr, ar, hy },
  recipeCuisine:   { en, fr, ar, hy },
  recipeYield:     { en, fr, ar, hy },
  ingredients:     { en:[…], fr:[…], ar:[…], hy:[…] },
  instructions:    { en:[…], fr:[…], ar:[…], hy:[…] },
  prepTime, cookTime, totalTime,          // language-neutral (ISO 8601, e.g. "PT15M")
  keywords
}
```

Everything else in the build (per-language `.jsonld`, recipe page HTML, cards) is **generated
from this file** by `generate-index.js` and must never be edited directly.

**A translation edit is:** set `recipes[slug].<field>.<lang>` (scalar) or
`recipes[slug].<field>.<lang>[<index>]` (array item) to a new value.

`fieldPath` grammar (v1):
- scalar: `title`, `description`, `recipeCategory`, `recipeCuisine`, `recipeYield`
- array item: `ingredients[2]`, `instructions[0]`

### v1 scope boundary

v1 edits **existing strings in place**. No structural changes: no add/remove/reorder of
ingredients or steps, no create/delete recipes, no editing `slug`/`categoryId`/times. Those are
v2 (index-based `fieldPath` assumes stable array shape).

---

## 2. Roles & auth  — REUSED, already solved

**Netlify Identity**, two roles: `translator`, `approver`. The role check already exists in
`trigger-sync.js` and is the robust version (Identity has historically nested roles under
`app_metadata.authorization.roles`). **Extract it into one shared helper** and use it in every
function, old and new:

```js
// _shared/requireRole.js
function getRoles(user) {
  return (user && (
    (user.app_metadata && user.app_metadata.authorization && user.app_metadata.authorization.roles) ||
    (user.app_metadata && user.app_metadata.roles)
  )) || [];
}
function requireRole(role, context) {
  const user = context.clientContext && context.clientContext.user;
  const roles = getRoles(user);
  if (!user) return { ok: false, status: 401, error: 'Not authenticated.' };
  if (!roles.includes(role)) return { ok: false, status: 403, error: 'Unauthorized.' };
  return { ok: true, user, roles };
}
module.exports = { requireRole, getRoles };
```

> Note: `fetch-preview.js` currently checks only `app_metadata.roles` — the shared helper fixes
> that inconsistency for both tools.

Role is always read from the verified token, never from the request body.

---

## 3. Architecture (data flow)

```
Translator (Identity: translator)
  │  Dashboard → "Recipes" view → recipe picker → select recipe
  ▼
React ──GET /api/recipes/:slug──► fn ──► reads all-recipes.json (GitHub raw)
  │  renders EDITABLE REPLICA  (EN reference | AR editable)
  │  edits fields, clicks Save
  ▼
React ──POST /api/edits (one per staged field)──► fn ──► UPSERT pending edit ──► Neon Postgres
  │
  │  translator sees their pending edits (GET /api/edits/mine)
  ▼
Approver (Identity: approver)
  │  Dashboard → "Recipes" view → Preview
  ▼
React ──GET /api/recipes/preview──► fn
        ├─ reads current all-recipes.json (live)
        ├─ reads ALL pending edits from Postgres
        ├─ applies them to a copy  ==>  "proposed"
        └─ returns live-vs-proposed DIFF   (same shape as ui-strings fetch-preview)
  │  approver reviews colored diff (reuses renderDiff UI)
  │  clicks "Approve & Deploy"  (BATCH — ships the whole pending set)
  ▼
React ──POST /api/recipes/approve──► fn   (dryRun first for an accurate confirm-panel count)
        ├─ CONFLICT GUARD per edit (current value === old_value?)
        ├─ IDEMPOTENCY GUARD (edit_log.commit_sha — safe to retry after a partial failure)
        ├─ applies all non-conflicting, not-already-shipped edits to all-recipes.json
        ├─ commits all-recipes.json via GitHub API   (ONE commit — the point of no return)
        ├─ marks applied edits 'approved', writes edit_log (one DB transaction)
        └─ fires Netlify BUILD HOOK  (last — the most harmless step to retry)
     conflicts are marked 'conflict' (not left 'pending') and reported in the response
  │  React polls metadata.json until lastBuild changes  (reused deploy-poll)
  ▼
Netlify build-on-hook → generate-index.js → deploy
```

**Key architectural move (unchanged from v1):** the React app renders a *replica* of the recipe
from `all-recipes.json`, using the same field logic `generate-index.js` uses. Because the replica
renders *from* the JSON, every on-screen field already knows its `fieldPath` — no `data-*`
instrumentation, no reverse-mapping clicked words.

**Batch approval (changed from v1):** edits are *stored* per-field (that's how staging works),
but *approved in bulk* — the approver reviews the whole pending diff and ships it in one commit,
mirroring the ui-strings "approve the diff" flow. No per-field approve/reject in v1.

**Accepted tax:** recipe layout exists in two places (`generate-index.js` + React replica); keep
parallel and documented in v1, shared render module in v2.

---

## 4. The API (first-class — the résumé surface)

Hand-written REST over Netlify Functions (Node), same-origin with the dashboard. All handlers
wrapped in `requireRole`.

### Endpoints

| Method | Path                        | Role       | Purpose                                             |
|--------|-----------------------------|------------|-----------------------------------------------------|
| GET    | `/api/recipes`              | translator | List `{slug, title.en, categoryId}` for the picker  |
| GET    | `/api/recipes/:slug`        | translator | Full recipe object (all langs) for the replica      |
| POST   | `/api/edits`                | translator | Stage/update one pending field edit (upsert)        |
| GET    | `/api/edits/mine`           | translator | Caller's own pending edits                          |
| DELETE | `/api/edits/:id`            | translator | Discard one of caller's own pending edits           |
| GET    | `/api/recipes/preview`      | approver   | Live-vs-proposed diff of ALL pending edits          |
| POST   | `/api/recipes/approve`      | approver   | Apply all pending → commit → build hook (BATCH)     |

> No per-id approve/reject endpoint in v1 — approval is the single batch action. `DELETE
> /api/edits/:id` covers "translator retracts a mistake before approval."

### Contracts

`POST /api/edits` (upsert — re-editing the same field replaces the pending value):
```json
{
  "recipeSlug": "royal-soup",
  "lang": "ar",
  "fieldPath": "ingredients[2]",
  "refValue": "1/4 cup raw rice",              // EN reference at edit time (for the diff)
  "oldValue": "<current ar value at edit time>",// conflict guard baseline
  "newValue": "<translator's new ar value>"
}
```
Unique key `(recipe_slug, lang, field_path)` → editing the same field again updates the row
rather than creating duplicates. Returns `200` with the stored edit.

`GET /api/recipes/preview` (✅ Phase 4) → **not** the ui-strings `fetch-preview` flat-rows shape
(`{ rows, ... }`) — recipes are grouped by recipe, not a flat key/value list, per the build spec's
own instruction for this view (§7). Actual shape:
```json
{
  "totalChanges": 2,
  "changesByLang": { "fr": 0, "ar": 2, "hy": 0 },
  "recipes": [
    {
      "slug": "royal-soup",
      "title": "Royal Soup",
      "edits": [
        { "id": "uuid", "lang": "ar", "fieldPath": "title",
          "oldValue": "<current live value>", "newValue": "<pending edit's value>",
          "editorEmail": "translator@example.com", "updatedAt": "..." }
      ]
    }
  ]
}
```
Reads **all** `status = 'pending'` rows (every translator's, not just the caller's — this is the
approver's view of the whole queue), applied against a fresh read of `all-recipes.json`. "old" is
the *current live value*, read fresh at request time — not the edit's stored `old_value` column,
which is the Phase 5 conflict-guard baseline, a different thing. `renderDiff`'s **CSS classes**
are reused (chip/diff-table-wrap/row-changed/val-old/val-new) for visual consistency; the vanilla-
JS `renderDiff` *function* itself is not, since the recipe-grouped shape needs its own render logic
(`<RecipeApprovalView>`, §7).

**No conflict detection in this endpoint.** Conflict surfacing (comparing `old_value` at stage-time
against the current live value to flag a stale edit) is deferred entirely to the Phase 5 approve
action, per that phase's design (§6) — this is a plain live-vs-proposed read, nothing more.

`POST /api/recipes/approve` (✅ Phase 5) — full ordering rationale, idempotency mechanism, and
config-driven requirement in §6. Request:
```json
{
  "editIds": ["uuid", "uuid"],
  "confirmed": true,     // required on the real call — refused without it, see §6
  "dryRun": false        // true = read-only conflict/idempotency check, no writes, powers the confirm gate
}
```
Response (same shape for both `dryRun: true` and the real call — `dryRun: true` just guarantees
nothing was written):
```json
{
  "dryRun": false,
  "committed": true,             // false if nothing needed a fresh commit (all-conflict, or
                                  // fully already-shipped — see the idempotency case in §6)
  "commitSha": "abc123...",      // null when committed is false
  "applied": [
    { "id": "uuid", "recipeSlug": "royal-soup", "lang": "ar", "fieldPath": "title" }
  ],
  "conflicts": [
    { "id": "uuid", "recipeSlug": "royal-soup", "lang": "ar", "fieldPath": "ingredients[2]",
      "reason": "stale", "currentValue": "<the live value that moved>" }
  ],
  "totalRequested": 2, "totalApplied": 1, "totalConflicts": 1
}
```
Any requested id no longer `pending` (approved by a concurrent call, or otherwise resolved) is
silently dropped from the batch — not an error, and exactly the situation a client retry after a
partial failure produces (§6).

---

## 5. Database (Neon Postgres)

**Neon**, for managed Postgres *and* because it solves the serverless connection problem (below).
Edits are stored per-field even though approval is batch.

**Two tables, two different jobs.** `edits` is the mutable *current pending state* — upserted per
save, drives the editing UI, unchanged in semantics from v1. `edit_log` is a second, **append-only**
audit trail — written only at approval time, one row per field actually shipped in an approved
batch. This split exists because `edits`' upsert-on-save behavior (by design — the pending set is
"latest value per field," never a pile of superseded edits) means a translator's re-edits overwrite
the row, leaving no durable, queryable history of who changed what and when beyond the git commit
itself — which has the content but not the structured attribution. `edit_log` is that missing
history, scoped to *approved* changes so it grows once per shipped field, not once per keystroke.

```sql
create table edits (
  id           uuid primary key default gen_random_uuid(),
  recipe_slug  text        not null,
  lang         text        not null,          -- 'ar' (target), etc.
  field_path   text        not null,          -- 'title' | 'ingredients[2]' | 'instructions[0]'
  ref_value    text,                          -- EN reference at edit time
  old_value    text,                          -- target value at edit time (conflict guard)
  new_value    text        not null,
  editor_email text        not null,
  status       text        not null default 'pending',  -- pending|approved|conflict
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  text,
  unique (recipe_slug, lang, field_path)       -- upsert target; one pending edit per field
);

create index edits_status_idx on edits (status);
create index edits_editor_idx on edits (editor_email);

-- Append-only audit log. Insert-only — never update or delete a row here.
-- No unique constraint: unlike `edits`, this table is meant to accumulate
-- one row per approved change over time, not upsert to a single latest row.
create table edit_log (
  id           uuid primary key default gen_random_uuid(),
  recipe_slug  text        not null,
  lang         text        not null,
  field_path   text        not null,
  old_value    text,
  new_value    text        not null,
  action       text        not null default 'approved',  -- room for future action types
  editor_email text        not null,          -- translator who authored the edit
  resolved_by  text        not null,          -- approver who shipped it
  commit_sha   text        not null,          -- git commit this batch produced
  created_at   timestamptz not null default now()
);

create index edit_log_recipe_idx on edit_log (recipe_slug);
create index edit_log_commit_idx on edit_log (commit_sha);
```

> `unique (recipe_slug, lang, field_path)` on `edits` makes re-editing a field an UPSERT, so the
> pending set is always "latest value per field," never a pile of superseded edits. `edit_log` has
> deliberately no such constraint — it's meant to grow.

### Connection pooling (budget an evening → then it's a résumé line)

Netlify Functions are ephemeral; classic Postgres drivers exhaust the connection limit. Use the
**`@neondatabase/serverless` driver** — it talks over HTTP/WebSocket, so there's no long-lived
connection to pool. (Fallback: Neon's PgBouncer pooled connection string with `pg`.) Go with the
serverless driver.

---

## 6. Approval → commit → build hook → confirm (✅ Phase 5)

This is where recipes differ from ui-strings by **exactly one step**:

- **ui-strings approve** = fire build hook. No commit — the *Sheet* is the source, re-pulled at
  build time by `sync-google-sheets.js`. (`trigger-sync.js` already does this.)
- **recipes approve** = **commit `all-recipes.json` first, THEN fire the build hook.** Because
  the committed JSON *is* the source of truth; there's no external system to re-pull from.

This is the one action in the whole tool that writes to production, so its ordering is a hard
requirement, not an implementation detail — reproduced here from the code comment in
`netlify/functions/recipes-approve.js` that carries it (the actual source of truth if the two
ever drift):

1. **Conflict check** — read-only. For each pending edit, read the *current* value at its
   `fieldPath` in `all-recipes.json` and compare to the edit's own `old_value` (the value it
   recorded as current when it was staged):
   - current `===` the edit's `new_value` → **not a conflict** — the field is already correct in
     the file. Either a genuine no-op re-edit, or (see step 2) the retry side of a partial
     failure. Excluded from the commit, but not blocked from finishing its bookkeeping.
   - current `===` the edit's `old_value` → clean, nothing else has touched it since staging.
   - anything else → **conflict**: the live value moved to a *third* value since staging (someone
     else's approved change landed). Marked `status='conflict'` in Postgres right away — a safe,
     recoverable write (not the irreversible one) that also drops it from the approver's pending
     queue. A translator recovers a conflicted field by simply re-editing it: `POST /api/edits`'s
     upsert unconditionally resets status back to `pending` on save, regardless of what it was.
   - Nothing has been written to the repo at this point — a failure or abort here is always safe
     to just retry.
2. **Idempotency check** — also read-only, also safe to abort. Compares the batch against
   `edit_log`: an edit whose exact content (`recipe_slug`, `lang`, `field_path`, `new_value`)
   already has a logged row was already shipped in a past call and must not be recommitted or
   relogged — `commit_sha` is the idempotency key. This is what makes step 3 below safe to retry:
   see the ordering rationale below for the failure mode this specifically closes.
3. **Commit `all-recipes.json`** — **THE POINT OF NO RETURN**, the only irreversible,
   externally-visible effect in this whole action. Apply every non-conflicting, not-already-shipped
   edit to a copy of the parsed object; re-serialize with the repo's existing 2-space indent, no
   trailing newline (matches the file's actual committed bytes — keeps the diff to the fields that
   actually changed); `PUT` **one commit for the whole batch**, message e.g. `i18n: approve batch —
   7 field(s) across 3 recipe(s)`. Capture the resulting commit SHA — steps 4–5 need it. Skipped
   entirely if nothing in the batch actually needs a fresh write (e.g. everything was a conflict).
4. **Flip `edits` rows to `approved`** — done FIRST among the after-commit steps because it's the
   *double-apply guard*: if these rows stayed `pending`, the next approve call would try to
   re-apply changes that already shipped. Not "just bookkeeping" — load-bearing. Bundled into one
   database transaction with step 5 (`sql.transaction([...])`) so that, within any single call,
   "status flipped but not logged" can't happen on its own.
5. **Write the audit trail** — one `edit_log` row per field actually shipped this call (or newly
   confirmed as shipped, in the retry case): `recipe_slug`, `lang`, `field_path`, `old_value`,
   `new_value` (carried from the `edits` row), `action='approved'`, `editor_email` (the
   translator, carried from the `edits` row — **not** the approver), `resolved_by` (the approver),
   `commit_sha`. A field whose commit didn't happen *this* call (the retry/idempotency case) is
   attributed to the branch's current HEAD commit at read time — the honest answer, since this
   call didn't make the commit that carries that content, an earlier one did.
6. **Fire the Netlify build hook** — **LAST**, reusing `trigger-sync.js`'s
   POST-to-`NETLIFY_BUILD_HOOK_ID` pattern exactly. Last because it's the most harmless step to
   retry (worst case: one extra rebuild of content that's already safely committed). Only fires if
   step 3 actually produced a fresh commit.
7. Front end polls `metadata.json` until `lastBuild` changes (reuse the existing poll-confirm —
   same 10s-interval/24-attempt shape as `admin.js`'s ui-strings deploy poll), with a graceful
   timeout message rather than polling forever if the deploy is slow or fails.

**Ordering rationale, in full:** steps 1–2 are read-only comparisons — a crash or error there
means nothing has changed anywhere, so simply retrying the whole call is always safe. Step 3 is
the only step with an irreversible external effect. Steps 4–7 are designed to be safely
re-runnable: if the function crashes after step 3 succeeds but before steps 4–5 finish, a retry's
own step 1 finds the affected fields' live values already equal to `new_value` rather than
`old_value` — not a conflict, the "already applied in file" case — and step 2 either finds a
matching `edit_log` row already (nothing left to log, just re-flip status) or doesn't (log it now,
attributed to current HEAD as described above). Either way, the retry completes the bookkeeping
instead of re-committing. Verified directly against a real GitHub commit (§ testing below): after
a successful approve, manually resetting the same row back to `pending` (simulating exactly this
crash — commit succeeded, status flip didn't) and re-submitting produces no second commit, no
duplicate `edit_log` row, and correctly re-flips status to `approved`.

**Confirm gate.** Because this action commits to the repo *and* deploys to production, the
approver gets an explicit confirmation step before it fires — `dryRun: true` runs steps 1–2 only
(genuinely nothing written) and returns the real `totalApplied`/`totalConflicts` counts, which the
confirm panel displays ("You're about to publish N changes to the live site" plus the conflict
count, if any) before the real call. The real call additionally requires `confirmed: true` in the
body — defense-in-depth alongside the UI's own confirm panel, refused otherwise, so this can't
fire from a stray retry or a button wired up without the gate.

**Config-driven — hard requirement, not a convenience default.** Commit target repo (`GITHUB_REPO`),
branch (`GITHUB_BRANCH`), file path (`GITHUB_RECIPES_PATH`), `DATABASE_URL`, `GITHUB_TOKEN`, and
`NETLIFY_BUILD_HOOK_ID` are all read from env — same `process.env.X || 'default'` pattern the
read-only recipe functions already use, never hardcoded. `GITHUB_BRANCH` matters most: it's what
lets testing point this action at a scratch branch (`test/phase5-scratch`) instead of
`translation-pipeline`. Netlify only builds `translation-pipeline` (`netlify.toml`'s `[build]`), so
a commit to any other branch triggers no deploy, independent of whether the build hook also fires
— that's what makes the real-commit integration test (below) safe to run for real, repeatedly,
without touching production.

**GitHub auth:** fine-scoped token (`contents:write`, one repo) in Netlify env and local `.env`.
Never client-side. Reads use the Contents API (not the `raw.githubusercontent.com` CDN the
read-only recipe functions use) — the approve flow needs the file's blob SHA to commit, and a
CDN-cached read would risk the conflict check comparing against a stale value.

**One commit per batch** (not per edit) — avoids rebuild storms, since batch approval collects
everything into a single push.

### Testing this safely

- **Pure logic, unit-tested, no I/O:** the conflict-guard comparison, the apply-edits-to-JSON
  transform, and the idempotency filter all live in `netlify/functions/_shared/approveLogic.js` as
  plain functions with no DB/GitHub/env access — fixture data in, plain data out. Covered by
  `tests/phase5/approveLogic.test.js` (`node --test`, no extra dependency). This is where most of
  the correctness risk in this action actually lives, and it's fully testable offline.
- **Real-commit integration test:** `tests/phase5/scratch-branch-integration.js` runs the real
  `recipes-approve.js` handler against a real database and a real GitHub commit, with
  `GITHUB_BRANCH` overridden to `test/phase5-scratch` (created off `translation-pipeline` on first
  run if it doesn't exist yet). Seeds a real pending edit, exercises the dry run, the real approve
  call, a simple resubmit-of-a-resolved-id check, and the deeper crash-recovery replay described
  above — then asserts, among other things, that `translation-pipeline`'s blob SHA is provably
  unchanged before vs. after. Never commits to `translation-pipeline`. Full procedure in
  `LOCAL_DEV.md`.

**Rollback / audit trail — two layers now.** Because approval commits `all-recipes.json`, every
approved batch is also a git commit — a versioned, reversible history of *content*: to roll back,
revert the commit; the next build restores the prior state. This is a genuine advantage over the
ui-strings side, whose approval fires a build hook but does **not** commit (its history lives in
Google Sheets' revision log instead) — recipes get git-native backup for free; ui-strings relies on
Sheets versioning. `edit_log` (§5) is the second layer: git has the content diff, but not "who
authored this translation, who approved it, when" as structured, queryable data — `edit_log` is
exactly that, one row per shipped field, keyed to the commit SHA that shipped it. The two are
complementary: `commit_sha` on each `edit_log` row is the join key back to git history if you need
the actual diff behind a logged change.

---

## 7. Front end — a new VIEW in the existing dashboard

Not a separate app. The dashboard (`index.html` / `admin.js`) gets a **"Recipes" view** beside
the current UI-strings view (a tab/route toggle). Shared, reused as-is:

- Netlify Identity auth + `getToken()`.
- The **diff renderer** (`renderDiff`, the colored old/new table, chips, show-unchanged toggle).
- The **deploy-poll** (approve → poll `metadata.json` → refresh).
- Build status panel.

New for recipes (needs React — the vanilla-JS diff table can't do a stateful inline editor):

```
Recipes view
├─ <RecipeList>            picker (GET /api/recipes)
└─ <RecipeReplica>         one recipe's whole edit session — fetches the recipe AND
    │                      the translator's own pending edits (GET /api/edits/mine),
    │                      reconciling per field on load (§ three-state model)
    ├─ view mode: edit     the default working view — EN reference (read-only, LTR) |
    │                      AR editable (RTL), side by side. Every editable AR field is
    │                      an <EditableField> — click-to-edit, rename-style, colour-
    │                      coded by state.
    ├─ view mode: preview  <RecipePagePreview> — a faithful reproduction of the real,
    │                      deployed recipe page (see below), with the translator's
    │                      *current* edits applied: dirty (unsaved) as well as pending
    │                      (saved) — a live working aid, not a DB-only snapshot
    └─ back to admin/list  returns to <RecipeList>, guarded if dirty fields exist
└─ <RecipeApprovalView>    ✅ Phase 4+5 — approver: GET /api/recipes/preview → recipe-grouped diff
                           with per-edit include checkboxes → Approve & Deploy → confirm gate
                           (dry-run count) → POST /api/recipes/approve → deploy poll
```

**Role-based routing (`<RecipesApp>`).** Reads the caller's roles client-side (same
`app_metadata.authorization.roles` / `app_metadata.roles` shape `requireRole` reads server-side).
Translator-only: unchanged from Phase 0–3, no mode toggle, no Review tab — exactly the pre-Phase-4
experience. Approver-only: skips the translate flow entirely and lands directly on
`<RecipeApprovalView>` — `GET /api/recipes` and `GET /api/recipes/:slug` both require `translator`,
so a real approver-only account hitting the translate flow would just 403; routing around that
dead end is the point, not a nicety. Both roles: a small mode toggle (Translate | Review) appears.

**The three-state field (Phase 3).** Every editable AR field is in exactly one of:
- **clean** — matches the saved (live or previously-approved) value. Default look, a hover
  affordance hints it's editable.
- **dirty** — edited locally, not yet saved. In-memory only: no localStorage, no per-keystroke
  API calls, no cross-session persistence. Lost on navigate-away/reload — see the unsaved-changes
  guard below. Distinct colour (amber) from pending.
- **pending** — saved via `POST /api/edits`, awaiting approval. Distinct colour (blue). This state
  survives reloads: on load, `<RecipeReplica>` reconciles each field against the translator's own
  `GET /api/edits/mine` results (filtered client-side to this recipe) and initializes any field
  with a matching pending edit straight into `pending` (showing the saved value, not the live one)
  rather than `clean` — otherwise "pending" would only ever be true within a single browser session,
  which defeats the point of it being a real, durable state backed by the DB.

**Editing interaction:** click an AR field → inline input, pre-populated and selected (rename-
style) → click out / **Enter** commits to local `dirty` state only — not the API, not per-keystroke.
**Escape** reverts to the pre-edit value without committing (not explicitly speced, cheap standard
affordance for this interaction — flag if unwanted).

**Saving:** an explicit **Save** action `POST`s one request per `dirty` field (the endpoint upserts
on `(recipe_slug, lang, field_path)`, so re-saving a field just updates its pending row). Deliberate,
not automatic — the translator can edit several fields, including re-correcting her own mistakes,
before committing anything. Dirty fields that fail to save stay `dirty` (nothing is lost;
Save again to retry) and a message reports the failure count. Successful ones flip to `pending`.
**Stays on the recipe after Save** — no navigation. A persistent pending-count badge ("N pending
edits") is always visible while editing, alongside the field colour states.

**Unsaved-changes guard:** if the translator tries to leave with `dirty` fields present — closing
the tab, reloading (`beforeunload`), or clicking the in-app Back button — she's warned ("You have
unsaved changes. Leave anyway?"). `pending`/`clean` fields need no warning; they're safe in the DB
or unchanged.

**Preview view mode.** Originally (first Phase 3 pass) this reused the edit view's own read-only
column layout minus the editing chrome — which made it feel near-redundant with the editor, since
it was just the same stripped-down field list restyled. Revised: Preview now reproduces the *real*
deployed recipe page — `<main class="recipe-page">`, `<header class="recipe-header">`,
`<section class="recipe-section recipe-ingredients">` etc. — the same structure and class names
`generate-index.js`'s `writeAllRecipesPages()` emits for one recipe (not the card), rendered from
JSON via `recipePageHtml.js` (kept deliberately parallel to that function, the same "layout
maintained twice" tax §3 already accepts) into an `<iframe srcDoc>` that loads the real
`/assets/css/style.css` — so it's styled by the actual stylesheet the live page uses, not bespoke
preview CSS, and stays in sync automatically when that CSS changes. An iframe with its own
independent `<html>`/`<body>` was necessary, not just convenient: the real template puts `dir` on
`<html>` (never `<body>` — confirmed against both the generator and the live page; style.css's
`body[dir="rtl"] …` rules are consequently dead on the real site too, faithfully reproduced rather
than "fixed"), and inlining the markup into the admin dashboard's shared body would mean fighting
that body for CSS scope. Section labels ("Ingredients," "Category," …) come from `ui-strings.json`
(fetched client-side, same source the real page's `t()` labels use at build time) so they're
correctly localized, not hardcoded English. No recipe photo: the real template has none (no image
field anywhere in `all-recipes.json`), so none was invented here either. The top breadcrumb/language-
switcher nav is deliberately excluded — shared site chrome, not part of "the recipe," and its links
have no sensible target inside an admin preview pane.

Preview shows the recipe with **all current field states applied — dirty (unsaved) as well as
pending (saved)**, not just what's in the database. The translator can type a field, switch to
Preview without saving, and see her in-progress translation in context immediately — Preview is a
live working aid keyed to the same `fieldStates` the editor uses, not a separate DB-backed view.
(This is distinct from Phase 4's approver-facing preview, `GET /api/recipes/preview` — see §10.)

Verified by direct comparison against the live deployed page (`royal-soup`, Arabic): identical
computed styles (font, size, color, layout), identical DOM class structure, identical localized
labels, `dir` placement matching exactly.

**Scope boundary (v1):** existing strings only. Array fields (`ingredients`, `instructions`) are
editable per existing item (`ingredients[2]`) — no add/remove/reorder UI, no "+ add ingredient."
Matches the `fieldPath` grammar's existing assumption of stable array shape (§1).

**RTL — functional, not polished.** AR fields (both display and the inline input) render
`dir="rtl"`; EN reference is LTR, kept in a clearly separated column. Mixed Latin/numeral runs
inside Arabic text may render imperfectly for now — deferred, to be tuned against real content
once the translator starts using it.

**`<RecipeApprovalView>` (Phase 4) — review only, no approve action.** Fetches
`GET /api/recipes/preview` (§4) and renders it grouped by recipe — each recipe a collapsible
`<details>` section (native, no extra open/close state to manage) containing its changed fields:
language, `fieldPath`, old value → new value, and which translator authored it. Deliberately
recipe→field hierarchy, not the ui-strings tool's flat key/value rows — reuses that tool's diff
**CSS classes** (chip, diff-table-wrap, row-changed, val-old/val-new/val-empty) for a consistent
look, not its flat-row assumptions.

*Per-edit include checkbox — the key interaction, and the one with a hard constraint:* every
pending edit has a checkbox, **checked by default**. Unchecking means "not this round" — the edit
is simply left out of the batch and stays `pending` in the database, appearing again next time the
view loads. Purely local component state; nothing is written anywhere when a box is (un)checked.
**There is no approver-side delete, reject, or discard control anywhere on this screen, by design.**
Approvers only ever promote work forward; only a translator can remove their own edit, via the
`DELETE /api/edits/:id` that already exists for exactly that (§4) — that endpoint has no route by
which an approver's checkbox state could reach it. Verified directly: created real pending edits,
unchecked one in the approval view, reloaded the page — both edits were still there, `pending`,
untouched; the deselection was never anything but local UI state.

The "Approve & Deploy (N selected)" button (✅ Phase 5) is disabled only while `N === 0` or a
publish is already in flight — otherwise it starts the real flow: a `dryRun` call reports the
actual applyable/conflict counts, a confirm panel shows them ("You're about to publish N changes…
M conflicting will be skipped") and requires an explicit "Yes, publish," then the real
`confirmed: true` call commits, and the view polls `metadata.json` for deploy confirmation with a
graceful timeout message rather than hanging. Full mechanics, ordering, and safety guarantees in
§6.

> **React integration:** introduce React/Vite for the Recipes *editor view* only. The existing
> dashboard shell and the UI-strings view stay as-is (vanilla JS). Don't uproot what works;
> mount React where the interactivity actually needs it.

---

## 8. Tech stack summary

- **Shell + UI-strings view:** existing vanilla-JS dashboard (unchanged).
- **Recipes editor view:** React + Vite, mounted into the dashboard.
- **Auth:** Netlify Identity (`translator` / `approver`), shared `requireRole` helper.
- **Backend:** Netlify Functions (Node), same-origin.
- **DB:** Neon Postgres via `@neondatabase/serverless`.
- **Source write:** GitHub Contents API (fine-scoped token in Netlify env) — recipes only.
- **Rebuild trigger:** Netlify build hook (reused from `trigger-sync.js`).
- **Source of truth:** `sections/recipes/all-recipes.json` in the **site repo** (dashboard lives
  here too — same-origin functions + relative paths, as the existing code already relies on).

---

## 9. Housing decision — site repo, one dashboard

Confirmed by the existing code: the dashboard and its functions use same-origin relative paths
(`/.netlify/functions/…`, `/metadata.json`, `/ui-strings.json`) and live in the site repo.
Moving to a separate repo would break those paths or force cross-origin calls, for less coherence.

**Build the recipe tool as a second view in this dashboard, in the site repo.** UI-strings stays
exactly as-is (Sheets pipeline untouched — right tool for flat key/value data). The two views
share auth, diff-render, and deploy-poll; recipes add the replica editor and the Postgres pending
store. Résumé framing: *one* translation governance dashboard handling two data types with the
right backend for each.

---

## 10. Build order (phased — each phase demoable)

- **Phase 0 — Scaffold the Recipes view.** Add the view/route to the dashboard; role-gate it;
  mount an empty React island. Reuse existing auth. No data yet.
- **Phase 1 — Read-only replica.** `GET /api/recipes` + `GET /api/recipes/:slug` (read
  `all-recipes.json` from GitHub raw). `<RecipeReplica>` renders EN + AR side by side, no editing.
  *Riskiest visual piece — proves render-from-JSON — so it goes first.*
- **Phase 2 — API + DB.** Neon schema + `@neondatabase/serverless`; `POST /api/edits` (upsert),
  `GET /api/edits/mine`, `DELETE /api/edits/:id`; shared `requireRole`.
- **Phase 3 — Inline editing.** ✅ `<EditableField>` — click-to-edit, rename-style, three-state
  (clean/dirty/pending, colour-coded). Dirty is in-memory only, committed on click-out/Enter, never
  auto-saved. Explicit **Save** flushes dirty fields via `POST /api/edits` (upsert), stays on the
  recipe, shows a persistent pending count. Unsaved-changes guard on nav-away/reload. Added a
  translator-facing **preview** *view mode* within `<RecipeReplica>` — a faithful reproduction of
  the real deployed recipe page (`generate-index.js`'s structure/classes, the real
  `/assets/css/style.css`, via `<iframe srcDoc>`), with *all current edits* applied — dirty
  (unsaved) as well as pending (saved), a live working aid, not a DB-only snapshot — **not** the
  same thing as Phase 4's approver-facing preview below; that one diffs the whole pending set
  against live for the approver, this one just lets the translator read her own in-context
  translation as she types. Functional-only RTL. No array add/remove/reorder (existing items
  only). Full detail in §7.
- **Phase 4 — Approval review.** ✅ `GET /api/recipes/preview` (approver-gated; reads *all*
  translators' pending edits, applies them to a fresh copy of `all-recipes.json`, diffs live vs.
  proposed — full contract in §4). `<RecipeApprovalView>` renders it recipe-grouped (not flat
  key/value), reusing the ui-strings diff table's CSS classes. Per-edit include checkbox,
  checked by default, purely local selection state — unchecking is non-destructive, the edit stays
  `pending` and reappears next load; no approver-side delete/reject exists anywhere. "Approve &
  Deploy" is present but permanently disabled — stubbed for Phase 5, not wired. Conflict detection
  explicitly deferred to Phase 5, noted in the UI rather than attempted here. Distinct from Phase
  3's translator-facing preview *view mode* (§7) — that one is a single recipe's in-progress
  translation in context; this one is the approver's queue across every recipe. Auth-stub extended
  with a `STUB_ROLE` toggle (`dev:auth-stub:translator` / `:approver`) so both roles — including
  approver *without* translator, which the real role gate makes a materially different experience
  — are testable locally without a real Identity account (`LOCAL_DEV.md` §2). Full detail in §7.
- **Phase 5 — Approve → commit → hook.** ✅ `POST /api/recipes/approve`: conflict guard,
  idempotency guard (safe to retry after a partial failure — `commit_sha` in `edit_log` is the
  idempotency key), GitHub commit (the one irreversible step — everything before it is safe to
  abort, everything after it is safely re-runnable), status flip + audit log in one transaction,
  build hook fired last, front end polls `metadata.json` for deploy confirmation. Config-driven
  commit target (repo/branch/path all env-driven — testing points `GITHUB_BRANCH` at a scratch
  branch instead of production) and an explicit confirm gate (`dryRun` for a real pre-commit
  count, `confirmed: true` required on the real call) since this is the one action that touches
  production. End-to-end: edit → approve (with confirm) → commit → deploy. Full detail in §6.
- **Phase 6 — Polish.** Color-coding vs ui-strings, conflict/empty/error states, translator's
  pending list.
- **Phase 7 (capstone, post-core) — Unify the recipe + ui-strings review into one decision
  surface.** Planned, not built, no branch yet — recorded here so the reasoning survives until it's
  reached. Present both approval flows in a single screen: collapsible groups, recipes grouped by
  recipe (as Phase 4 already does) alongside ui-strings as its own collapsible group, so the
  approver has one place to make every decision instead of switching tabs. Deliberately sequenced
  **after** both flows work independently, not before — the two backends stay fundamentally
  different under the hood even once visually unified: recipes are a Postgres pending store where
  approval commits `all-recipes.json` and fires the build hook (§6), ui-strings is an on-demand
  Sheet-vs-live diff where approval fires the build hook only, no commit and no store (§0). They
  cannot share a single approve action — each group keeps its own backend fetch and its own approve
  call; the unification is presentational, not architectural. Building this after Phase 6 means
  unifying two *proven, understood* flows rather than inventing the recipe flow and the merge at
  the same time — lower risk, and the stronger portfolio story: "unified two working heterogeneous
  systems behind one decision surface" beats "built one screen over two mismatched backends before
  either was proven." It also can't be designed well any earlier — Phase 4 is what teaches what
  recipe approval actually needs before attempting to fold it in alongside ui-strings'.
  **Also folds in instruction unification:** the Recipes view's workflow-steps (added as a
  deliberately light "Pick a recipe → click a field → Save to submit" in the Phase 4 polish pass,
  §7) and the ui-strings tab's own workflow-steps currently exist as two separate, slightly-
  duplicated guidance blocks. Reconciling them into one shared instruction set — the same way the
  two approval flows get reconciled into one screen — is part of this capstone, not a separate
  effort; doing it now would mean guessing at a unified voice before the two flows are even done
  diverging.

---

## 11. Risks & open items

- **Layout drift** (replica vs `generate-index.js`) — parallel+documented in v1; shared module v2.
- ~~**Concurrency**~~ — **closed.** Batch approve applies the conflict guard per edit (§6); conflicting
  edits are marked `conflict` and reported, the rest ship in one commit. With a single approver
  this is rare in practice, but the guard — and the separate idempotency guard for partial-failure
  retries — is real, not aspirational; both are covered by the scratch-branch integration test.
- ~~**No conflict detection in Phase 4's preview**~~ — **closed by design, not by building it into
  the preview.** `GET /api/recipes/preview` (§4) stays a plain live-vs-proposed read, no conflict
  check — that check lives entirely in the approve action's step 1 (§6), which is where it
  actually needs to gate a write. Listed here only as a pointer now that Phase 5 exists; nothing
  left to do.
- **Array structural edits** — out of v1 scope (index `fieldPath` assumes stable arrays).
- **GitHub token** — fine-scoped `contents:write`, one repo, Netlify env only.
- **Identity role assignment** — confirm how `translator`/`approver` get set on Identity users;
  the whole gate depends on it. (`translator` already works today.)
- **`preview` cost** — reads `all-recipes.json` + all pending edits each call; fine at this scale.
- ~~**Structured audit trail**~~ — **closed.** git commits had the content history but not
  structured attribution (who/when per field, queryably). `edit_log` (§5), written at approval time
  (§6), closes this: one append-only row per shipped field, keyed to the commit SHA that shipped it.
- **LAUNCH BLOCKER — RTL dead on live Arabic pages** (site bug, not the admin tool): `dir` is set on
  `<html>`, never `<body>`, on deployed recipe pages, so every `body[dir="rtl"]` rule in `style.css`
  is dead — found while verifying the Preview view mode against a real page (§7). Tracked and parked
  on `fix/rtl-dir-attribute` (off `translation-pipeline`); not fixed yet. Must resolve before launch.
- ~~**LAUNCH GATE — developer-facing scaffolding in the approver UI**~~ — **closed by Phase 5.**
  The inert Approve button's blunt "ships in Phase 5 — not implemented yet" `title` and the static
  conflict-deferral note are both gone — replaced by the real confirm gate and the real,
  server-reported conflict count (§6, §7). Nothing developer-facing left on this screen to strip.
- **DEFERRED — Retire fossils + make `main` the real production branch (rescue unique work
  first).** Repo-hygiene task, not started; parked here so it doesn't get interleaved with content
  work. Current confusing state: `translation-pipeline` **is** production (Netlify Production
  Branch setting = `translation-pipeline`, confirmed; the `GITHUB_BRANCH` Production-context env
  var is also set to `translation-pipeline`). `main` is a dead GitHub-Pages-era fossil — confirmed
  a strict git ancestor of `translation-pipeline` (0 commits ahead, 66 behind), zero unique
  content. `shehirian-site` is a fossil repo still connected to Netlify. The branch names mislead:
  `main` looks like production but is dead; `translation-pipeline` looks like a working branch but
  is the actual trunk. A read-only branch inventory has already been completed and established
  exactly what's safe to delete vs. what holds unique, irrecoverable work.
  - **Step 1 — rescue unique work BEFORE any deletion.** Two branches hold work that exists
    nowhere else and would be permanently lost if deleted:
    - `unstyled-payment-integration` — the Clover POS integration prototype (commit `1b7da97`): a
      Next.js app under `payment-integration-prototype/` with `lib/clover.ts`, Clover
      order/inventory API routes, plus Shopify Shipping and Amazon FBA fulfillment code. 14 unique
      commits. High value — genuinely reusable integration work. Preserve it (recommended:
      annotated git tag e.g. `archive-clover-poc`, or rename to `archive/clover-poc`) before
      deleting.
    - `styled-v1-recipe-click-tracking` — a custom self-hosted recipe click-tracker (commit
      `78c4132`): `assets/js/recipe-click-tracker.js` + `netlify/functions/track-recipe.js` +
      docs (`TRACKING_README.md`, `TRACKING_IMPLEMENTATION_SUMMARY.md`). **Not** StatCounter —
      custom-built. 4 unique commits. Preserve (tag/archive-rename) before deleting.
    - (Note: no StatCounter exists anywhere in the repo — that memory was likely this custom
      click-tracker, or something pasted directly into a hosting panel that was never
      version-controlled. Nothing to rescue there.)
  - **Step 2 — glance at, then decide on:** four `origin/copilot/*` remote branches carry a few
    unique commits each (GitHub Pages deploy-workflow fixes + a recipe JSON-LD fix). Low value, but
    check the JSON-LD fix in case it's still relevant to current recipe JSON-LD before deleting.
    Keep or delete after a look.
  - **Step 3 — safe to delete** (inventory-confirmed zero unique content, each proven via
    `merge-base --is-ancestor` plus tree diffs): `main`, `client-visual-tweaks` (identical SHA to
    `main`), `mobile-and-design-fixes`, `styled-v1` (strict ancestor of production, fully
    absorbed), `gh-pages` (generated build output, not source). `modular-v1-unstyled`'s commits
    are all also reachable via `unstyled-payment-integration`, so it's safe to delete once that one
    is rescued.
  - **Step 4 — rename `translation-pipeline` → `main`** to fix the naming, after the fossil `main`
    is deleted: `git branch -m translation-pipeline main`, push, delete the old remote branch, and
    set Netlify's Production Branch **and** the `GITHUB_BRANCH` Production env var to `main`.
    Disconnect the fossil `shehirian-site` repo from Netlify.
  - **CRITICAL FOOTGUN — reference sweep.** Step 4 is **not** just a branch rename. Every reference
    to the string `translation-pipeline` in code/config/docs must be updated or things break —
    notably the `GITHUB_BRANCH` fallback default (likely `|| 'translation-pipeline'`) in the
    approve function, `scripts/dev-server.js`, `LOCAL_DEV.md`, this spec, and any tests. Do a full
    `translation-pipeline` search as the first action of Step 4 and work through every hit.
  - **Preserve:** `test/phase5-scratch` is load-bearing for local dev — do **not** delete it as
    part of this cleanup.
  - **Why deferred:** this is production-pipeline-affecting. Do it as its own focused task with
    post-rename production-deploy verification (confirm the live site builds green from the
    renamed `main`), not interleaved with content work.
- **DEFERRED — Post-launch: anonymous per-recipe-per-language "want this translated" demand
  counter on coming-soon pages**, to prioritize Arabic/Armenian translation order by actual
  demand. Count-only — **no email/PII/notifications** (avoids consent/obligation surface — a
  demand signal doesn't need to know who asked, and adding a "notify me" surface would create an
  obligation this tool has no mechanism to fulfill). Adapt from the rescued
  `styled-v1-recipe-click-tracking` click-tracker (§11 Step 1 above — the custom self-hosted
  recipe click-tracker, not StatCounter): same pattern, public button → Netlify function → Neon
  counter, keyed by `recipe_slug` + `lang` instead of the tracker's original key. Build once
  there's real traffic to feed it — collects nothing useful until the published-flag feature is
  actually launched and coming-soon pages are getting real visits. Tied to the click-tracker
  rescue in the fossil-cleanup task above, since it's the reason that branch is worth preserving
  rather than just archiving as reference.

---

## 12. What's reused vs. new (at a glance)

| Concern              | ui-strings (exists)                    | recipes (build)                          |
|----------------------|----------------------------------------|------------------------------------------|
| Auth / role gate     | `trigger-sync` check                   | **same helper, extracted**               |
| Staging area         | Google Sheet                           | **Postgres pending store** (new)         |
| Editing surface      | the Sheet                              | **React replica editor** (new)           |
| Diff                 | `fetch-preview` (live vs Sheet)        | live vs (committed + pending) — same shape|
| Diff UI              | `renderDiff` table                     | **reused**                               |
| Approve              | fire build hook                        | **commit JSON, then** build hook         |
| Deploy confirm       | poll `metadata.json`                   | **reused**                               |
| Source of truth      | Google Sheet                           | `all-recipes.json` (repo)                |

---

## 13. Résumé framing

- "Designed and built a **REST API** with **role-based auth** and a batch **review/approval**
  workflow" — the hand-written functions over Postgres.
- "**Postgres** data layer" — modernization arc onto existing Oracle/PL-SQL depth.
- "Handled **connection pooling for serverless** functions against Postgres" — Neon HTTP driver.
- "**Git-triggered rebuild** pipeline — approvals commit to the source repo and drive a static
  redeploy" — clever reuse of existing infra as the review + deploy layer.
- "**RTL-aware translation UX** rendering an editable replica from the same source the static
  build consumes" — the architectural insight (data is truth, page is a view).
- "Extended a **governance dashboard** to handle a second content type, choosing the right
  backend per data shape (Sheets for flat strings, Postgres for structured recipes)" — judgment.
