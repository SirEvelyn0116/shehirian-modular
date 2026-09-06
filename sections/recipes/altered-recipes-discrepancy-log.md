# ALTERED-recipe discrepancy log

Standing record of the scan-vs-JSON discrepancy review conducted on the 5 recipes classified
ALTERED (not REWRITTEN) in the original fidelity triage, the user's rulings on each discrepancy,
and the fixes applied as a result. Source scans: `sections/recipes/scans/` — p.5 and p.6
(`ShehirianBulgorRecipes-3-6.pdf`), p.7 and p.8 (`recipesPGs7-18.pdf`).

**Governing ruling:** err on the scan side — Gemini's fabrications/additions/alterations are
reverted to match the scan, except where explicitly noted below as a documented keep.

---

## 1. `bulgur-carrot-pineapple-salad` (scan p.5) — fully reconstructed

Nearly every field differed from the scan; reconstructed fresh rather than patched.

| Field | Scan | Old JSON (Gemini) | Resolution |
|---|---|---|---|
| Yield | "4 to 6 servings" | "8-10 servings" | Fixed to scan |
| Bulgor | "1-1/2 cups cooked Bulgor" | "2 cups cooked and cooled bulgur wheat" | Fixed to scan |
| Carrots | "1-1/2 cups shredded carrots" | "2 cups shredded carrots" | Fixed to scan |
| Pineapple | TWO items — "2 tablespoons pineapple juice" (blended with Bulgor first) + "1/2 cup drained crushed pineapple" (added later) | ONE item — "1 cup pineapple chunks" | Restored as two distinct scan items |
| Mayonnaise | "1/2 cup mayonnaise" | "1/4 cup mayonnaise" | Fixed to scan |
| Lemon juice | Not in scan | "1 tbsp lemon juice" | Removed (fabrication) |
| Sugar | Not in scan | "1 tbsp sugar (optional)" | Removed (fabrication) |
| Salt/pepper | "1/2 teaspoon salt" only, no pepper | "Salt and pepper to taste" | Fixed to scan (salt only, exact quantity) |
| Serving | "Serve in lettuce cups" | Dropped | Restored |
| Times | Not stated anywhere in scan | prepTime/cookTime/totalTime fabricated (PT10M/PT15M/PT25M) | Cleared to empty |

**Preserved intact, not touched by this reconstruction:** the `bulgur-carrot-raisin-salad` variation
note added in a prior session (`variations[0]`) — verified present after the edit.

---

## 2. `bulgur-dutch-cucumber-salad` (scan p.6) — fully reconstructed

| Field | Scan | Old JSON (Gemini) | Resolution |
|---|---|---|---|
| Yield | "6 to 8 servings" | "6-8 servings" (right value, scan wording) | Normalized to scan's exact wording |
| Bulgor | "2 cups chilled cooked Bulgor wheat" | "1 cup cooked bulgur, cooled" | Fixed to scan |
| Cucumber | "1-1/2 cups diced cucumbers" | "2 cups sliced cucumber" | Fixed to scan (qty + cut) |
| Green onions | "1/4 cup sliced green onions" | Not present | Restored |
| Radishes | "2/3 cup thinly sliced radishes" | "1/2 cup sliced radishes" | Fixed to scan |
| Sour cream | "1 cup sour cream" | "1/2 cup sour cream" | Fixed to scan |
| Mayonnaise | Not in scan | "2 tbsp mayonnaise" | Removed (fabrication) |
| Vinegar | "1 tablespoon tarragon vinegar, **or lemon juice**" (explicit either/or) | "1 tbsp white vinegar" | Fixed to scan's actual wording and alternative |
| Salt | "1 teaspoon salt" | "Salt and pepper to taste" | Fixed to scan |
| White pepper | "1/8 teaspoon white pepper" | genericized into "...to taste" | Fixed to scan |
| Sugar | "1 teaspoon sugar" | Not present | Restored |
| Garnish | "top with a dash of **paprika**" | "Fresh **dill or chives**" | Fixed to scan |
| Times | Not stated anywhere in scan | fabricated (PT15M/PT15M/PT30M) | Cleared to empty |

**Flag, not fixed:** the scan's own closing instruction ("Toss with the bulgor mixture...") reads a
little oddly given the Bulgor was already combined in the first step — transcribed verbatim as
written rather than smoothed over. Also note: this recipe's own scan text is internally
inconsistent on capitalization — "Bulgor" (capital) in the ingredient list, "bulgor" (lowercase) in
the closing instruction sentence — both preserved exactly as printed in their own spot.

---

## 3. `cole-slaw-bulgur` (scan p.5) — surgical fix

| Field | Scan | Old JSON (Gemini) | Resolution |
|---|---|---|---|
| Yield | "4 to 6 servings" | "8-10 servings" | Fixed to scan |
| Cabbage | "2 cups finely shredded cabbage" | "4 cups shredded cabbage" | Fixed to scan |
| Carrots | Not in scan at all | "1 cup shredded carrots" | Removed (fabrication) |
| Bulgor | "1/2 cup Bulgor wheat" | "1 cup cooked and cooled bulgur wheat" | Fixed to scan |
| Vinegar | "2 tablespoons vinegar" — no type given | "2 tbsp **apple cider** vinegar" | **Documented decision:** genericized to match the scan exactly. The scan doesn't specify a type, so "apple cider" wasn't a scan error to correct so much as an unsupported specific the user chose not to keep — different in kind from the other fixes here (which correct a scan-clear contradiction), but resolved the same way at the user's direction. |
| Grated onion | "1-1/2 tablespoons grated onion" | Not present | Restored |
| Celery seed | "3/4 teaspoon celery seed" | Not present | Restored |
| Sugar | "2-1/2 teaspoons sugar" | "1 tbsp sugar" (=3 tsp) | Fixed to scan |
| Salt | "3/4 teaspoon salt" | genericized | Restored |
| White pepper | "1/8 teaspoon white pepper" | genericized | Restored |
| Method | Specific Bulgor-cooking step (1 cup water, boil/cover/reduce/simmer) + "serve in lettuce cups and garnish with tomato wedges" | Vague ("cook according to package"), no lettuce cups / tomato garnish | Restored |

`prepTime`/`cookTime`/`totalTime` were **not** in scope for this surgical fix (not scan-derivable,
not flagged by the user for this recipe) — left as they were.

---

## 4. `raw-meat-platter` (scan p.7) — surgical fix

| Field | Scan | Old JSON (Gemini) | Resolution |
|---|---|---|---|
| Bulgor | "1½ cups Bulgor wheat (fine)" | "1 cup bulgur wheat (fine)" | Fixed to scan (also corrected spelling on this line since it was already being rewritten) |
| Instructions | "...a tablespoon of each green pepper, parsley, green onions and cayenne pepper if desired... knead all together like dough... forming a smooth mixture **(knead about 10 minutes)**" | Vague ("knead with a little water until mixture holds together"), no per-vegetable measure, no timing | Restored |
| Instructions | "...serve at once, garnished with **the rest of** chopped vegetables, **after salting them to your taste**" | "...serve immediately, garnished with chopped vegetables" | Restored |

Everything else in this recipe already matched the scan and was left untouched.

**Note for the Shehirian brothers (not acted on, flagged for their list):** this dish — raw
seasoned lamb and fine Bulgor, kneaded and shaped into patties, served the same day — reads as an
anglicized version of çiğ köfte / "chee kufta," a well-known raw-kibbeh dish. Worth asking the
brothers whether they'd like that lineage named on the recipe page; not changed here.

---

## 5. `bulgur-stuffed-peppers` (scan p.8) — surgical fix

| Field | Scan | Old JSON (Gemini) | Resolution |
|---|---|---|---|
| Seasoned salt | "1 teaspoon seasoned salt" | "1/4 teaspoon seasoned salt" | Fixed — this and Worcestershire had been transposed |
| Worcestershire sauce | "1/4 teaspoon Worcestershire sauce" | "1 teaspoon Worcestershire sauce" | Fixed (see above) |
| Stock/bouillon | "1-3/4 cup meat or chicken stock or canned bouillon" (splits as 1 cup into the initial blend + 3/4 cup mixed with the tomato purée later — confirmed by the instructions, which sum correctly) | "1 cup meat or chicken stock" | Fixed — the 3/4 cup portion had been silently dropped; this discrepancy was missed by the original triage pass, caught in this review |
| Bell peppers | "**3** green or red bell peppers" | "Green or red bell peppers" (no count) | Restored |
| Meat/sausage | "ground **fresh or left-over** meat or sausage" | "ground meat or sausage" | Restored |
| Instructions | "remove all seeds **and white portions**" | "remove seeds" | Restored |

**Documented keep:** the scan's ingredient list literally reads "3/4 tomato purée" with no unit —
almost certainly a booklet typo, since the instructions elsewhere refer to "3/4 **cup** meat stock"
in the exact same parallel construction. Gemini's "3/4 cup tomato purée" is judged a sensible fill
of an obvious scan omission, not an alteration — **kept as-is, not changed.**

Left untouched (not in the fix list, out of surgical scope for this pass): the ingredient line
"2-1/2 cups cooked **bulgur**" still uses the common spelling rather than "Bulgor" — already
flagged as a category-C item in the earlier spelling audit; not touched here since it wasn't part
of this recipe's listed discrepancies.

---

## Summary of documented decisions (not "fixes to the scan," recorded for the record)

1. **`bulgur-stuffed-peppers` tomato purée unit ("3/4 cup")** — kept as Gemini wrote it. The scan
   omits the unit; "cup" is the obviously-intended fill, confirmed by parallel wording elsewhere in
   the same recipe's instructions.
2. **`cole-slaw-bulgur` vinegar type** — genericized to plain "vinegar," removing Gemini's
   unsupported "apple cider" specificity, per user ruling. The scan doesn't state a type either
   way; this isn't a scan contradiction so much as a decision not to keep an invented specific.

All other changes in this pass correct clear scan contradictions: wrong/swapped quantities,
dropped ingredients, and fabricated ingredients not present in the scan at all.
