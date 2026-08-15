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
