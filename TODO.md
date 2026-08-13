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
