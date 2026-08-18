LAUNCH BLOCKER — RTL styling dead on live Arabic pages

The deployed recipe pages set `dir` on <html>, not <body>. All
`body[dir="rtl"]` rules in style.css therefore never fire, so Arabic
(the priority market) renders with broken RTL styling on the live site.

Fix approach (decide before implementing):
  A) add dir="rtl" to <body> in generate-index.js  → turns on the existing
     rules, but they've never run, so verify none introduce new layout issues.
  B) rewrite the selectors (html[dir="rtl"] / [dir="rtl"])  → CSS-only,
     leaves the template alone.

Do FIRST: report the blast radius — how many body[dir="rtl"] rules exist,
what each controls, and what's actually broken on a real Arabic page —
then choose A vs B. Verify against a real deployed Arabic recipe page after.

This branch is off translation-pipeline (the deploy branch), NOT main
(fossil) and NOT the admin-tool branch. Merge here → next build ships the fix.

---

Notes added since the branch was parked — context for whoever picks this
back up, not new work done on this branch. Nothing below has been
implemented here.

1. Concrete symptom, for verification after the fix:

   Arabic body text renders left-aligned instead of right-aligned. Barely
   visible on a single short line — easy to miss in a quick look. Clearly
   wrong on multiline/wrapped text: e.g. recipe steps, where the text flows
   from the step number rightward and then wraps to the next line sitting
   *below* the number, instead of staying flush with the text column — a
   visually broken layout, not just a subtle alignment nit.
   `text-align: right` is among the dead `body[dir="rtl"]` rules (see the
   blast-radius report called for above). Verification target once A or B
   ships: open a real Arabic recipe page with multi-line steps and confirm
   the wrapped text sits flush-right, not just the first line.

2. Proposed enhancement (separate from the fix above) — direction-aware
   2-column step layout:

   Render numbered recipe steps as a 2-column table (number | text) rather
   than inline number-then-wrapping-text, so wrapped text stays in its own
   column and never wraps underneath the number — the layout half of
   symptom #1 above, on top of the alignment half. Must be direction-aware:
   for RTL/Arabic the number column sits on the right with text on the
   left, mirrored from the LTR layout. Lives here rather than as its own
   ticket because it's a `generate-index.js` recipe-template change, which
   means it also has to be mirrored in the admin tool's preview template
   (`recipes-app/src/recipePageHtml.js`) — the "layout maintained twice"
   tax that preview file already carries for everything else in the
   template.

   Status: proposed, likely-go, but decide *during* the RTL fix work, not
   before — evaluate whether it's actually still needed once the basic
   alignment bug (#1) is fixed. Alignment alone may resolve most of the
   visual breakage; the 2-column layout may turn out to be a nice-to-have
   rather than a requirement. Don't build it speculatively ahead of that
   read.

3. Open localization question — numerals (needs a human answer; do NOT
   implement anything for this without one):

   Arabic traditionally uses Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) rather
   than Western (0123456789). Generated step numbers are currently Western
   digits injected into every language's template unconditionally;
   hand-typed ingredient quantities are whatever the translator entered,
   which may or may not match.

   Questions for the Arabic-reading translator, unanswered:
     a) Should Arabic content use Eastern or Western numerals — for both
        generated step numbers and hand-typed quantities?
     b) Is the answer fixed for the market, or does it depend on the
        individual reader?
     c) Which does she naturally type, so we know whether generated
        (Western) and hand-entered numerals will match or visibly clash
        on the same page?

   Armenian likely uses Western numerals (unconfirmed — check with a
   native Armenian speaker) and probably needs nothing here, so this is
   likely an Arabic-only concern. If it does need fixing, it's probably
   automatic correct-localization based on `lang`, not a user-facing
   toggle — but that's a guess pending the actual answer above. Capturing
   this as a flagged question to route to a human, not a task to pick up.

---

DIAGNOSIS FINDINGS (2026-08-18) — no code changed, report only.
Verified against `dist/` output served locally (`npx http-server dist`),
not the file:// DOM (file:// silently drops the linked stylesheet, which
would have produced false readings).

1. Blast radius — the premise was wrong in a key way: the bug is NOT
   site-wide. `template.html` (the homepage) already does
   `<body dir="{{dir}}">` correctly — `dist/ar/index.html` has
   `<body dir="rtl">` and every dead-rule-guarded style on that page works
   (`.contact-info` right-aligns, `.back-home-button` moves to the left
   corner, flags move to top-left). The bug only hits pages built by
   `generate-index.js`'s recipe/cert code paths, which hardcode `<body>`
   with no dir: individual recipe pages (line ~1093), the all-recipes
   index page (line ~922/1146), and certification pages (source templates
   in `certifications/*.html`, also plain `<body>`). 11 dead
   `body[dir="rtl"]` rules total:
     - `.title` (×3, incl. 2 media-query variants), `.nav h2` — only used
       in `certifications-home-index.html`, an English-only root page
       with no `/ar/` build output. Zero blast radius.
     - `.cert-item` — not referenced by any HTML template at all (only in
       style.css and a test fixture). Fully inert, unrelated to the dir
       bug.
     - top-level `body[dir="rtl"] { text-align: right }`,
       `.breadcrumb-nav` text-align — REDUNDANT. `direction` inherits
       correctly from `html[dir=rtl]` regardless of body, and the default
       `text-align: start` resolves to right on its own. Confirmed via
       computed styles (`direction: rtl`, `text-align: start` →
       right) on real Arabic recipe pages.
     - `.contact-info` — real, but only reachable via the homepage's
       injected contact section, which already has body dir set. No
       actual breakage found (checked `dist/ar/index.html` at runtime:
       `.contact-info` computed `text-align: right`, correct).
     - `.lang-switcher-nav` (×2, incl. mobile variant) — REAL, VISIBLE
       BUG on recipe/index/cert pages. Base rule pins the flags
       `top-right`; the dead override that should move them `top-left`
       for RTL never fires. Confirmed on a live recipe page: flags stay
       at `right: 10px`/`right: 20px` and visually overlap the
       right-flowing Arabic breadcrumb text (screenshot: the second flag
       icon sits on top of "الرئيسـية"). This is the one dead-rule bug
       with real visual impact, and it's structurally confirmable without
       reading Arabic — it's a layout collision, visible in any language.
     - `.back-home-button` — same pattern as lang-switcher (pinned to the
       wrong corner) but only used on the homepage, which already has
       body dir set. No live breakage.

2. Root cause of ".4" / wrap-under-number — confirmed, and it is NOT
   caused by the dead body[dir=rtl] rules at all (no dead rule touches
   `.recipe-steps`, `ol`, or markers). It's the native `<ol><li>` marker
   ("4.") being laid out inside an inherited `direction: rtl` context
   with no strong-direction character in the marker text itself. Per the
   Unicode Bidi Algorithm, a neutral digit+punctuation run with no strong
   char takes the embedding direction of its context; in RTL, that
   reverses the visual order of "4" and "." → ".4". Reproduced two ways:
     - Real Arabic recipe pages (e.g. bulgor-wheat-biscuits, 4 steps):
       ".4" confirmed on step 4, independent of body dir (recipe pages
       never had it fixed in the first place, so this reproduces
       regardless of the body-dir bug/fix).
     - A minimal test harness (plain `<ol dir="rtl"><li>` with English
       text) reproduces ".4" identically — proves it's pure bidi
       mechanics, not Arabic-script-specific and not CSS-specific.
   The wrap-under-number half is separate: `list-style-position: inside`
   puts the marker in the inline flow, so wrapped lines have no reserved
   indent and sit flush left under the marker instead of under the text
   column. Confirmed visually on real multi-line steps.

   Tested the proposed 2-column layout fix in isolation (grid,
   number-column | text-column, `direction: rtl` on the grid so the
   number column sits on the right): it DOES fix the wrap-under-number
   problem (text column now reserves its own space). It does NOT fix the
   ".4" reordering by itself — empirically verified side-by-side: a
   plain 2-column cell with an inherited `direction: rtl` still renders
   ".4"; only adding `unicode-bidi: isolate; direction: ltr` (or
   equivalently `<bdi>`/`dir="ltr"` with an explicit direction, since
   dir="auto" isn't reliable for a string with no strong character) on
   the number cell fixes the digit/period order. So: 2-column layout and
   bidi isolation are two independent fixes for two independent problems
   — the TODO's proposal solves the layout half but was not sufficient
   for the ".4" half on its own.

   Recommendation: fix the ".4" bug with bidi isolation on the step
   number specifically (`unicode-bidi: isolate` + `direction: ltr` on a
   `<span>`/`<bdi>` wrapping just the marker text, or apply the same to
   the number column if the 2-column layout is adopted). This is a small,
   targeted, low-risk change. The 2-column layout is a separate decision
   — per the TODO's own note, revisit whether it's still needed once
   alignment/bidi-isolation ships; it may be a nice-to-have rather than a
   requirement, since the only remaining visual defect after the bidi fix
   would be wrap-under-number, which is milder than the ".4" glitch.

3. Is there a genuine broader RTL problem? No — narrower than the
   original "LAUNCH BLOCKER" framing suggested. Two real bugs, not a
   systemic one:
     a) `.lang-switcher-nav` (and by extension any future dead rule that
        follows the same "only fires on pages with body dir set" gap) is
        broken on recipe/recipe-index/certification pages specifically —
        flags overlap the breadcrumb, top-right instead of top-left.
     b) The step-number bidi glitch (independent bug, unrelated to the
        body/html dir attribute placement).
   Everything else in the dead-rule list is either unreachable
   (`.cert-item`, `.title`, `.nav h2` — no `/ar/` page uses them) or
   redundant (native `text-align: start` already does the right thing).

   Fix approach recommendation: given the bug is now known to be
   localized to specific templates (not systemic), (B) — rewriting the 2
   real-impact selectors to `html[dir="rtl"]` / `[dir="rtl"]` (just
   `.lang-switcher-nav`, both variants) — is lower-risk than (A). It's a
   2-selector CSS change with a known, already-verified-correct rendering
   to test against (the homepage, where body dir is already set and this
   exact selector already fires safely). Option (A) — adding
   `dir="rtl"` to `<body>` in the 3 affected template code paths — would
   also turn on `.contact-info`'s dead rule and the 3 dead `.title`/`.nav
   h2`/`.cert-item` rules on those page types for the first time ever;
   since `.title`/`.nav h2`/`.cert-item` are confirmed unreachable there,
   that's inert, but it's a wider surface than necessary for what is, in
   practice, a 2-selector fix. Recommend (B), scoped to
   `.lang-switcher-nav` only.

4. Structurally confirmable (no Arabic reader needed) vs. needs a native
   reader:
   Confirmable now (done above, verified via localhost-served dist/,
   computed styles, and DOM inspection — language-independent):
     - Which body[dir=rtl] rules are dead and which selectors/pages they
       target (CSS + grep across dist/).
     - Which of those selectors' classes actually appear on `/ar/` pages
       (DOM presence, independent of reading the text).
     - Computed `direction`/`text-align` values on real elements (proves
       the redundant ones are genuinely redundant).
     - The lang-switcher/breadcrumb visual collision (pure layout,
       visible in any language — see screenshot).
     - The ".4" reordering and its cause (reproduced with non-Arabic
       text in an isolated test harness — pure bidi mechanics).
     - Whether the 2-column layout and/or bidi isolation fix the above
       (reproduced and compared side-by-side, non-Arabic test content).

   Needs the Arabic-reading translator — put these in front of her once
   a fix is drafted:
     - Whether Arabic body copy (recipe descriptions, ingredient lines,
       step text) actually *reads* correctly line-by-line — right
       alignment being correct doesn't guarantee word order/line-break
       points feel natural to a reader.
     - The numerals question already flagged in item 3 above (Eastern
       vs. Western digits) — still open, still needs her answer before
       anyone touches numeral rendering.
     - A final visual sign-off on a real recipe page (ideally
       bulgor-wheat-biscuits.html or similar, once retranslated — note:
       while checking steps for this diagnosis, `bulgor-wheat-biscuits`
       and possibly other recipes were found to have English text on the
       `/ar/` page instead of Arabic — a content/translation-pipeline
       issue, not styling, out of scope here but worth flagging
       separately) after the lang-switcher and bidi fixes ship, to catch
       anything a non-reader can't judge.

---

IMPLEMENTED (2026-08-18) — the two confirmed bugs from the diagnosis
above, and only those two. Not done: the 2-column step layout (deferred
per item 2 above), option A / `dir` on `<body>` (rejected per item 3),
and no other dead rule was activated.

1. Step-number bidi fix: `.recipe-steps li::marker { unicode-bidi:
   isolate; direction: ltr; }` in `assets/css/style.css`. `::marker` is
   one of the handful of pseudo-elements the CSS Lists spec explicitly
   allows `direction`/`unicode-bidi` on, precisely for this class of bug.
   Applied unconditionally (not gated on `[dir="rtl"]`) since it's a
   no-op on already-LTR pages and required on RTL ones.

   Numeral-independence: this fixes ordering only, not glyph choice — it
   forces the marker's internal digit/period sequence to resolve
   left-to-right, which is the correct internal ordering for both
   Western (0-9) and Eastern Arabic-Indic (٠-٩) numerals (multi-digit
   Eastern Arabic-Indic numbers are also read left-to-right). So if the
   open numerals question elsewhere in this file is later answered
   "use Eastern digits," this rule should not need to change — but that's
   inference, not something verified against real Eastern-Arabic-Indic
   rendering, since the numeral switch itself hasn't been built. Spot
   check this rule once that switch happens.

2. Lang-switcher fix: reworded the two dead `body[dir="rtl"]
   .lang-switcher-nav` selectors (base + the `max-width: 768px` mobile
   variant) to `html[dir="rtl"] .lang-switcher-nav`, since `dir` lives on
   `<html>`, never on `<body>`, for the affected page templates. No other
   selector touched.

Verified against a full `npm run build` output (`dist/`, served via
`http-server`, not `file://` — `file://` silently drops the linked
stylesheet and gives false readings):
   - `dist/ar/recipes/armenian-style-lentil-soup.html`: steps now read
     "1.اغلي..." / "2.أضف..." etc. (digit-then-period, was
     period-then-digit before the fix); flags moved to top-left, no
     longer overlapping the breadcrumb.
   - `dist/ar/recipes/bulgor-wheat-biscuits.html` (has non-Arabic step
     text, useful for isolating the bidi mechanics from the script):
     same result, "1." "2." "3." "4." all correctly ordered.
   - `dist/ar/certifications/brc.html`, `dist/ar/recipes/index.html`:
     flags correctly at top-left.
   - `dist/ar/index.html` (homepage — already had body dir set, the
     pre-existing correct reference): still correct after the selector
     rewrite (`html[dir="rtl"]` matches here too, since html dir is also
     rtl on this page).
   - `dist/en/recipes/armenian-style-lentil-soup.html`,
     `dist/fr/recipes/armenian-style-lentil-soup.html`: unaffected —
     steps render normally ("1. Boil lentils...", "1. Faire bouillir...
     "), flags stay at their default top-right corner.

Not fixed, deliberately out of scope: the English-text-on-`/ar/`-pages
content issue noted above (translation-pipeline problem, not styling),
and the pre-existing LTR breadcrumb/flag overlap on long titles (exists
independently of RTL, on `en` pages with long breadcrumb text — was not
introduced by this change, not touched).
