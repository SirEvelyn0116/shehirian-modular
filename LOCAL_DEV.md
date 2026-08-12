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

## 2. What this does and doesn't test

`scripts/dev-server.js` is a small plain Node HTTP server — **not** `netlify dev`, not a fork of the real functions. It does two things:

- Serves `dist/` statically (build it first).
- For `/api/*`, calls the **real, unmodified** function handlers from `netlify/functions/` directly — `require('../netlify/functions/edit-create.js').handler(event, fakeCtx)` — with a hardcoded `fakeCtx.clientContext.user` standing in for what Netlify's edge would normally populate from a validated Identity JWT.

That `fakeCtx` is the entire shortcut. Spelled out precisely:

**Exercised for real:**
- All business logic in every function — upsert semantics, validation (`lang='en'` rejection, missing fields), the conflict-guard fields, ownership scoping on delete, everything.
- The **role-check logic itself** (`requireRole` in `netlify/functions/_shared/requireRole.js`) — it runs unmodified and really does read `roles` off the `user` object and really does reject if `'translator'` isn't in the list. You can prove this by editing `scripts/dev-server.js`'s `STUB_USER.app_metadata.roles` to `[]` and confirming every call starts 401ing again.
- The real Neon database, over the real `@neondatabase/serverless` driver, same as production.
- All of the React state machine — clean/dirty/pending transitions, Save, the reload-reconciliation against `GET /api/edits/mine`, the unsaved-changes guard, Preview mode.

**NOT exercised — this is the trusted-not-tested part:**
- **JWT validation itself.** In production, Netlify's edge verifies a real signed token from Netlify Identity before it ever populates `context.clientContext.user`. Locally, that object is just handed to the function directly, no signature, no expiry, no verification of any kind. A function can't tell the difference between this stub and a real validated token — that's the whole point of the shortcut — but it also means **this never proves the JWT verification step works**. That can only be checked against a real deploy with a real logged-in session (which is exactly what you did on the deploy preview for Phases 1–3).
- **Where the roles/email actually come from on a real account** — whether `app_metadata.authorization.roles` vs `app_metadata.roles` is populated correctly for a given Identity user, whether the invite/role-assignment flow actually sets what you expect. The stub just declares the roles it wants; it doesn't touch that pipeline at all.
- **Redirect routing** (`netlify.toml`'s `[[redirects]]`) — this server has its own hand-written route table matching the current redirects, not the real redirect engine. If you add a new `/api/*` endpoint, you must update both `netlify.toml` and `scripts/dev-server.js`'s routes, and only testing through `netlify.toml`'s real engine (or a real deploy) proves the redirect itself is correct — recall the `/admin/*` loop and the `/api/recipes` vs `/api/recipes/*` shadowing bugs from earlier this project, both of which were redirect-engine-specific and invisible to direct handler calls like this.

**Bottom line:** this mode proves the code is correct. It does not prove Netlify's auth plumbing is wired correctly around that code. Both matter; only a real deploy test covers the second one.

## 3. Why this can't leak into production

This is the part that actually matters, so here's the reasoning, not just the assertion:

- `netlify.toml` has `[functions]  directory = "netlify/functions"` — that is the **only** directory Netlify's build bundles as deployable functions. `scripts/dev-server.js` lives outside it. There is no configuration anywhere that would make Netlify look at `scripts/` for anything.
- `netlify.toml`'s `[build].command` is `npm run build:recipes && node sync-google-sheets.js && node generate-index.js`. It does not invoke `dev:auth-stub`, `dev-server.js`, or anything under `scripts/`, directly or indirectly.
- The actual function files under `netlify/functions/` — the ones that *do* deploy — contain **zero** stub-related code. No env var check, no dev-mode flag, no conditional branch. `requireRole.js` has exactly one code path, and it's the real one. I deliberately did not add an `if (process.env.NODE_ENV !== 'production')`-style bypass *inside* the deployed functions, even gated — a flag like that is one misconfigured environment variable away from being live in production, and there'd be no way to see that from reading the function in isolation. Keeping the stub entirely in a file Netlify never touches removes that risk category outright: there is no flag to misconfigure, because there is no code path in the deployed files that behaves differently based on anything.
- Confirmed directly: `grep -rn "scripts/" netlify.toml package.json generate-index.js` finds exactly one match — the `dev:auth-stub` line in `package.json`'s `scripts` block, which is a command a person runs by hand, not something any deploy or build step executes.

If you ever want to double check this yourself after future changes: `grep -rn "scripts/" netlify.toml` should keep returning nothing.

## 4. Gotchas

- **`netlify link` is required once per clone.** `dev:exec` needs the project linked to pull `DATABASE_URL` and friends — `.netlify/state.json` holds that (gitignored, machine-specific). If you're on a fresh checkout and get "not linked" errors, run `netlify link` and select `ornate-biscuit-625466`.
- **`DATABASE_URL` isn't in `.env`.** It's a Netlify-managed env var (Site configuration → Environment variables, scoped to include the `dev` context), only reachable locally through `netlify dev:exec` / `netlify dev`. That's why `dev-server.js` refuses to start without it rather than silently limping along.
- **Port 8888.** Same port `netlify dev` itself uses, chosen for muscle-memory, but this is a different, unrelated server — don't run `netlify dev` and `npm run dev:auth-stub` at the same time, they'll fight over the port. `netstat -ano | grep 8888` (or `Get-CimInstance Win32_Process -Filter "name = 'node.exe'"` in PowerShell, since `pkill -f netlify` has proven unreliable against these Windows-spawned node children) if you need to find and kill a stuck one.
- **No hot-reload.** Rebuild (`npm run build` or `npm run build:recipes`) and refresh the browser after any `recipes-app/src/` change.
- **No CORS to worry about.** Static files and `/api/*` are served from the same origin/port, matching production's shape — this was a deliberate reason to write a same-process server rather than pointing the React app at a separately-hosted API during dev.
- **Route table drift.** As noted in §2 — new `/api/*` endpoints need a matching route added to `scripts/dev-server.js` by hand.
- **Stub visibly announces itself.** Both a `console.warn` banner (styled, hard to miss) on every page load and a startup banner in the terminal say this is the auth-stub server — if you ever see recipe data in a screenshot or log without that warning nearby, it's not this mode.
