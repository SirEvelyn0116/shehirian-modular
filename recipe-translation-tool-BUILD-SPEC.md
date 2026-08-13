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
React ──POST /api/recipes/approve──► fn
        ├─ CONFLICT GUARD per edit (current value === old_value?)
        ├─ applies all non-conflicting pending edits to all-recipes.json
        ├─ commits all-recipes.json via GitHub API   (ONE commit)
        ├─ fires Netlify BUILD HOOK
        └─ marks applied edits 'approved' (conflicts stay 'pending', flagged)
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

`GET /api/recipes/preview` → same diff object shape as the ui-strings `fetch-preview`
(`{ rows, totalChanges, changesByLang }`), so the existing `renderDiff` renders it. For recipes,
a row's identity is `recipeSlug + fieldPath`; "old" = current committed value, "new" = pending
value. "proposed" = a copy of `all-recipes.json` with every pending edit applied.

`POST /api/recipes/approve`:
- For each pending edit: if current value at `fieldPath` !== `old_value` → **conflict**; skip it,
  leave it `pending` with a `conflict` flag, include it in the response.
- Apply all non-conflicting edits to `all-recipes.json`, commit once, fire the build hook, mark
  those edits `approved`.
- `200` with `{ applied, skippedConflicts }`. (Batch is all-or-most: non-conflicting ship,
  conflicting are reported for the translator to redo.)

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

## 6. Approval → commit → build hook → confirm

This is where recipes differ from ui-strings by **exactly one step**:

- **ui-strings approve** = fire build hook. No commit — the *Sheet* is the source, re-pulled at
  build time by `sync-google-sheets.js`. (`trigger-sync.js` already does this.)
- **recipes approve** = **commit `all-recipes.json` first, THEN fire the build hook.** Because
  the committed JSON *is* the source of truth; there's no external system to re-pull from.

`approve` function steps:
1. Load current `all-recipes.json` via GitHub Contents API (need its blob SHA to commit).
2. Load all pending edits from Postgres.
3. For each: parse `field_path`, read current value; if !== `old_value` → mark `conflict`, skip.
4. Apply all non-conflicting edits into the parsed object.
5. Re-serialize with the repo's existing 2-space indent (keep diffs clean); `PUT` one commit,
   message e.g. `i18n(ar): batch — 7 fields across 3 recipes`. **Capture the resulting commit SHA**
   — the next step needs it.
6. `UPDATE edits SET status='approved', resolved_at=now(), resolved_by=<approver>` for applied.
7. **Write the audit trail:** for each non-conflicting edit just applied (i.e. everything updated
   in step 6 — conflicts that were skipped do NOT get logged, they weren't shipped), `INSERT INTO
   edit_log` one row: `recipe_slug`, `lang`, `field_path`, `old_value`, `new_value` (carried over
   from the `edits` row), `action='approved'`, `editor_email` (the translator, carried over from
   the `edits` row — **not** the approver), `resolved_by` (the approver, same value written to
   `edits.resolved_by` in step 6), `commit_sha` (from step 5). Same logical unit of work as step 6
   — both are "this batch just shipped," just two different tables recording it.
8. Fire the **Netlify build hook** (reuse `trigger-sync.js`'s POST-to-`NETLIFY_BUILD_HOOK_ID`).
9. Front end polls `metadata.json` until `lastBuild` changes (reuse the existing poll-confirm).

**GitHub auth:** fine-scoped token (`contents:write`, one repo) in Netlify env. Never client-side.

**One commit per batch** (not per edit) — avoids rebuild storms, since batch approval collects
everything into a single push.

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
    ├─ view mode: preview  single-column, no editing chrome — the AR recipe as it reads
    │                      with pending edits applied (reuses the same read-only replica
    │                      render, just fed a recipe clone with pending values merged in)
    └─ back to admin/list  returns to <RecipeList>, guarded if dirty fields exist
└─ <RecipeApprovalView>    Phase 4 — approver: GET /api/recipes/preview → renderDiff → Approve & Deploy
```

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

**Scope boundary (v1):** existing strings only. Array fields (`ingredients`, `instructions`) are
editable per existing item (`ingredients[2]`) — no add/remove/reorder UI, no "+ add ingredient."
Matches the `fieldPath` grammar's existing assumption of stable array shape (§1).

**RTL — functional, not polished.** AR fields (both display and the inline input) render
`dir="rtl"`; EN reference is LTR, kept in a clearly separated column. Mixed Latin/numeral runs
inside Arabic text may render imperfectly for now — deferred, to be tuned against real content
once the translator starts using it.

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
  translator-facing **preview** *view mode* within `<RecipeReplica>` (single-column, edits applied,
  no editing chrome) — **not** the same thing as Phase 4's approver-facing preview below; that one
  diffs the whole pending set against live for the approver, this one just lets the translator read
  her own in-context translation. Functional-only RTL. No array add/remove/reorder (existing items
  only). Full detail in §7.
- **Phase 4 — Preview diff.** `GET /api/recipes/preview` (apply pending → diff vs live); render
  with the existing `renderDiff`. (Approver-facing — distinct from Phase 3's translator preview
  view mode, see above.)
- **Phase 5 — Approve → commit → hook.** `POST /api/recipes/approve`: conflict guard, apply,
  GitHub commit, build hook; reuse the deploy-poll. End-to-end: edit → approve → live.
- **Phase 6 — Polish.** Color-coding vs ui-strings, conflict/empty/error states, translator's
  pending list.

---

## 11. Risks & open items

- **Layout drift** (replica vs `generate-index.js`) — parallel+documented in v1; shared module v2.
- **Concurrency** — batch approve applies the conflict guard per edit; conflicting edits skip and
  are reported, rest ship. With a single approver this is rare.
- **Array structural edits** — out of v1 scope (index `fieldPath` assumes stable arrays).
- **GitHub token** — fine-scoped `contents:write`, one repo, Netlify env only.
- **Identity role assignment** — confirm how `translator`/`approver` get set on Identity users;
  the whole gate depends on it. (`translator` already works today.)
- **`preview` cost** — reads `all-recipes.json` + all pending edits each call; fine at this scale.
- ~~**Structured audit trail**~~ — **closed.** git commits had the content history but not
  structured attribution (who/when per field, queryably). `edit_log` (§5), written at approval time
  (§6), closes this: one append-only row per shipped field, keyed to the commit SHA that shipped it.

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
