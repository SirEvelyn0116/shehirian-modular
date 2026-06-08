# Shehirian Modular Translation Pipeline — Handoff

## Architecture Overview

Static site generator (`generate-index.js`) builds 211+ pages in 4 languages (en, fr, ar, hy) including RTL Arabic. Deployed on Netlify. Content flows from Google Sheets → `ui-strings.json` → build → `dist/`.

### Key files
| File | Purpose |
|------|---------|
| `generate-index.js` | Master build script — generates all pages |
| `ui-strings.json` | Source of truth for UI strings (repo backup) |
| `sync-google-sheets.js` | Pulls Sheet → `ui-strings.json` before build |
| `sections/recipes/all-recipes.json` | Master recipe data (46 recipes × 4 langs) |
| `admin/index.html` | Translator dashboard shell |
| `admin/admin.js` | Dashboard logic |
| `admin/admin.css` | Dashboard styles |
| `welcome.html` | Invite landing page (must live in `dist/`) |
| `netlify/functions/fetch-preview.js` | Diffs Sheet vs live `ui-strings.json` |
| `netlify/functions/trigger-sync.js` | Fires Netlify build hook |

---

## Build System

### `smartWrite(filePath, content, encoding)`
Skips write if content unchanged. Logs `✓ written` or `unchanged`. Increments `totalFilesDeployed` and `totalPagesGenerated` (HTML only).

### `smartCopy(srcPath, destPath)`
Checks source exists (warns if not), then delegates to `smartWrite`. Use this for all file copies — not `fs.copyFileSync`.

### `copyAssets()`
Copies `admin/`, `assets/`, `sections/`, `preview.js`, `welcome.html`, `ui-strings.json` to `dist/`. Uses `smartCopy` throughout. Binary assets (images, fonts) still use `copyRecursive` → `fs.copyFileSync`.

### Page counts
- `totalPagesGenerated` — HTML files only
- `totalFilesDeployed` — everything `smartWrite` touches
- Diff of 7 is expected: `metadata.json`, `recipes.{4 langs}.json`, `.nojekyll`, `preview.js`

---

## Google Sheets Sync (`sync-google-sheets.js`)

### Decision tree
1. Sheet empty (0 rows) → **seed** from repo `ui-strings.json`, build continues with local file
2. Sheet has data but `< MIN_EXPECTED_KEYS` (20) → **fall back** to repo backup, warn, build continues
3. Sheet healthy → **pull** down and overwrite `ui-strings.json`
4. Any error → fall back to repo backup, don't fail the build

`MIN_EXPECTED_KEYS = 20` is a named constant at the top of the file — update if key count intentionally drops.

---

## Netlify Identity & Admin Workflow

### Welcome page (`welcome.html`)
- Lives in repo root, copied to `dist/` by `copyAssets()`
- Intercepts `#invite_token=` from Netlify invite emails
- After password set → redirects to `/admin/#welcome=1`
- Admin page detects `#welcome=1` hash, shows welcome banner, cleans URL

### Role check — CRITICAL
Netlify Identity stores manually-set roles at:
```
user.app_metadata.roles  ← correct for dashboard-set roles
```
NOT at `user.app_metadata.authorization.roles` (that's for Identity-API-set roles).

Both functions use:
```js
const roles = user?.app_metadata?.authorization?.roles
           || user?.app_metadata?.roles
           || [];
```

### Build hook
- Env var: `NETLIFY_BUILD_HOOK_ID` (ID only, not full URL)
- `trigger-sync.js` POSTs `{}` to `api.netlify.com/build_hooks/{ID}`
- Receives `{ totalChanges, totalKeys }` from admin page and uses them in response message

### Deploy polling
- Polls `metadata.json` every 10s, up to 24 attempts (4 minutes)
- On timestamp change → calls `runPreview()` to confirm sync (zero-diff = success)
- `lastKnownBuild` module-level variable tracks previous timestamp

---

## Environment Variables (Netlify)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_SHEET_ID` | Google Sheet ID (not full URL) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account credentials JSON |
| `NETLIFY_BUILD_HOOK_ID` | Build hook ID (last segment of hook URL) |
| `SITE_URL` | Full site URL e.g. `https://your-site.netlify.app` |

---

## Recipe Architecture

### Current state
- 46 unique recipes × 4 languages = 184 individual pages + 4 all-recipes listing pages
- All recipe data lives in `sections/recipes/all-recipes.json`
- Build generates all pages from this file
- Schema.org jsonld files at `sections/recipes/{slug}.{lang}.jsonld`
- Content is hardcoded in `all-recipes.json` — not yet in the translator workflow

### Planned: Hybrid translation approach
**Google Sheet (translator-facing):**
- UI strings — as now
- About-us text — pending content arrival
- Recipe titles, descriptions, categories — once translator workflow is validated

**`all-recipes.json` (developer-facing):**
- Ingredients, instructions, keywords
- Edited via github.dev
- Source of truth for build

**In-place recipe editor (to be built):**
- Admin page lists all recipes by language
- Each opens `admin/recipe-editor.html` — renders actual recipe template with contenteditable fields
- Save → writes pending edit to **Netlify Blobs** (free, persistent, no GitHub token needed)
- `fetch-preview.js` extended to surface pending recipe edits alongside Sheet diffs
- Approve & deploy → build merges Blobs pending edits into `all-recipes.json`, clears Blob

---

## Known Issues / Parking Lot

- Build notification emails not available on Netlify free plan — plan to add Gmail SMTP via `nodemailer` in `trigger-sync.js` using `GMAIL_APP_PASSWORD` env var
- `admin/index.html` `YOUR_GOOGLE_SHEET_URL` placeholder is intentional — injected at build time by `copyAssets()` from `GOOGLE_SHEET_ID` env var
- WordPress Certifications migration — parked, portfolio proof-of-concept only
- Google Doc → Sheet sync — future idea, not scoped

---

## Next Steps (in order)

1. Onboard translator — invite via `welcome.html` flow, get feedback on Sheet → preview → deploy UX
2. Wait for about-us content — add keys to `ui-strings.json` and Sheet in one pass when it arrives
3. Build in-place recipe editor (see Recipe Architecture above)
4. Based on translator feedback — decide how much recipe content moves to Sheet
5. Add about-us keys to Sheet once content and translator workflow are both validated
