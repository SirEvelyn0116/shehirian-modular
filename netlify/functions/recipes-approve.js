const { requireRole } = require('./_shared/requireRole');
const { getSql } = require('./_shared/db');
const { getFile, putFile, getBranchHeadSha } = require('./_shared/github');
const { classifyEdits, applyEditsToJson, filterAlreadyLogged } = require('./_shared/approveLogic');
const { fireBuildHook } = require('./_shared/buildHook');

// Config-driven — HARD requirement, not a convenience default. Every one of
// these is read from env, same pattern the read-only recipe functions
// already use (recipes-list.js, recipe-detail.js, recipes-preview.js).
// GITHUB_BRANCH in particular MUST stay overridable: testing this action
// safely means pointing it at a scratch branch instead of production (see
// LOCAL_DEV.md and build spec §6) — hardcoding it to 'translation-pipeline'
// would make that impossible without committing to production for real.
const GITHUB_REPO = process.env.GITHUB_REPO || 'SirEvelyn0116/shehirian-modular';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'translation-pipeline';
const GITHUB_RECIPES_PATH = process.env.GITHUB_RECIPES_PATH || 'sections/recipes/all-recipes.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const NETLIFY_BUILD_HOOK_ID = process.env.NETLIFY_BUILD_HOOK_ID;

// -----------------------------------------------------------------------
// Ordering — this is the only action in the whole tool that writes to the
// repo and deploys to production, so the sequence below is deliberate, not
// incidental. Each step is numbered to match build spec §6.
//
//   1. Conflict check     — read-only comparison. Safe to abort: nothing
//      written anywhere yet.
//   2. Idempotency check  — read-only comparison against edit_log. Also
//      safe to abort.
//   3. Commit all-recipes.json — THE POINT OF NO RETURN. The only
//      irreversible, externally-visible side effect in this function.
//   4. Flip `edits` rows to 'approved' — done FIRST among the after-commit
//      steps (bundled transactionally with 5, see below) because it's the
//      double-apply guard: if these rows stayed 'pending', the next
//      approve call would try to re-apply already-shipped changes. Not
//      "just bookkeeping" — load-bearing.
//   5. Write edit_log rows — the audit trail, keyed by commit_sha.
//   6. Fire the Netlify build hook — LAST, because it's the most harmless
//      step to retry (worst case: one extra rebuild of content that's
//      already safely committed).
//
// Why steps 1-2 can freely abort and step 3 can't: everything before the
// commit is a read plus an in-memory comparison — crash or error there and
// nothing has changed, so simply retrying the whole call is always safe.
// The commit is the only step with an irreversible external effect.
//
// Why steps 4-6 are safe to retry even after a partial failure: if this
// function crashes after step 3 succeeds but before steps 4-5 finish, the
// retry's own step 1 will find, for the affected fields, that the live
// value now equals the edit's new_value rather than its old_value —
// classifyEdits() calls this `alreadyAppliedInFile`, and it is explicitly
// NOT a conflict. The retry then completes the bookkeeping instead of
// re-committing: status still flips to 'approved', and if step 2 doesn't
// find a matching edit_log row either (meaning step 5 never ran for it),
// a row is written using the branch's CURRENT HEAD commit as commit_sha —
// the honest answer, since this retry didn't make the commit that carries
// that content, an earlier one did. Steps 4 and 5 are bundled into a
// single database transaction (see the `sql.transaction([...])` below) so
// that within any one call, "status flipped but log missing" cannot happen
// on its own — the remaining, much narrower gap is a crash between step 3
// and that transaction, which is exactly the scenario this paragraph
// describes and the next call recovers from.
// -----------------------------------------------------------------------

exports.handler = async (event, context) => {
  const gate = requireRole('approver', context);
  if (!gate.ok) {
    return { statusCode: gate.status, body: JSON.stringify({ error: gate.error }) };
  }

  if (event.httpMethod && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'POST only.' }) };
  }

  if (!GITHUB_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_TOKEN is not configured.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const { editIds, confirmed, dryRun } = body;
  if (!Array.isArray(editIds) || editIds.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'editIds must be a non-empty array.' }) };
  }
  // Defense-in-depth alongside the front end's own confirm dialog — this
  // action commits to the repo AND deploys to production, so it refuses to
  // run without an explicit, deliberate flag from the caller, not just a
  // click on a button that happens to be wired up. Not required for
  // dryRun, which never writes anything.
  if (!dryRun && confirmed !== true) {
    return { statusCode: 400, body: JSON.stringify({ error: 'confirmed must be true — this action commits to the repo and deploys.' }) };
  }

  const approverEmail = gate.user.email;

  try {
    const sql = getSql();

    // Only still-pending rows for the requested ids. Anything already
    // resolved (approved by a concurrent request, or gone stale some other
    // way) is silently dropped from the batch rather than erroring — the
    // response reports exactly what was actually acted on, and a client
    // resubmitting a stale id list is exactly the retry scenario the
    // ordering comment above is designed to tolerate.
    const selected = await sql`
      select * from edits where id = any(${editIds}) and status = 'pending'
    `;

    if (selected.length === 0) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: !!dryRun, committed: false, commitSha: null,
          applied: [], conflicts: [],
          totalRequested: editIds.length, totalApplied: 0, totalConflicts: 0,
        }),
      };
    }

    // --- Step 1: conflict check (read-only) ---
    const file = await getFile({ repo: GITHUB_REPO, branch: GITHUB_BRANCH, path: GITHUB_RECIPES_PATH, token: GITHUB_TOKEN });
    const { toApply, conflicts, alreadyAppliedInFile } = classifyEdits(file.json, selected);

    // --- Step 2: idempotency check (read-only) ---
    const nonConflicting = [...toApply, ...alreadyAppliedInFile];
    const candidateSlugs = [...new Set(nonConflicting.map((e) => e.recipe_slug))];
    const editLogRows = candidateSlugs.length
      ? await sql`select recipe_slug, lang, field_path, new_value, commit_sha from edit_log where recipe_slug = any(${candidateSlugs})`
      : [];
    const { needsLogging, alreadyLogged } = filterAlreadyLogged(nonConflicting, editLogRows);
    const alreadyLoggedIds = new Set(alreadyLogged.map((e) => e.id));
    // toApply edits that somehow already have a matching edit_log row
    // shouldn't be recommitted either — see filterAlreadyLogged's comment
    // for why this should be empirically rare, kept as a safety net anyway.
    const toCommit = toApply.filter((e) => !alreadyLoggedIds.has(e.id));

    if (dryRun) {
      // Everything above is read-only — dry run stops here, nothing has
      // been written anywhere. This is what powers the confirm gate's
      // accurate "N changes, M conflicts" count before the real call.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: true, committed: false, commitSha: null,
          // nonConflicting, not toCommit — every non-conflicting edit ends
          // up 'approved' if the real call runs, whether or not it needs a
          // fresh commit or a fresh log row (see appliedEdits below).
          applied: nonConflicting.map(toAppliedSummary),
          conflicts: conflicts.map(toConflictSummary),
          totalRequested: editIds.length,
          totalApplied: nonConflicting.length,
          totalConflicts: conflicts.length,
        }),
      };
    }

    // Conflicts are marked now, before the commit — this is a safe,
    // recoverable DB write (not the irreversible one), and it removes
    // stale edits from the pending queue so the approver doesn't see them
    // again next load. A translator can recover one by simply re-editing
    // the same field: edit-create.js's upsert unconditionally resets
    // status back to 'pending' on save, regardless of its current status.
    if (conflicts.length > 0) {
      const conflictIds = conflicts.map((e) => e.id);
      await sql`update edits set status = 'conflict', resolved_at = now(), resolved_by = ${approverEmail} where id = any(${conflictIds})`;
    }

    // Every non-conflicting edit ends up 'approved', regardless of which
    // path it took: toCommit edits via the fresh commit below,
    // alreadyAppliedInFile edits because their content is already correct.
    // (A toApply edit that turned out to already have a matching edit_log
    // row — see the alreadyLoggedIds filter above — is intentionally still
    // included here too: it's excluded from `toCommit` so it isn't
    // recommitted, but it's still `nonConflicting`, so it still gets
    // flipped to approved. Dropping it here instead would silently strand
    // it in 'pending' forever.)
    const appliedEdits = nonConflicting;
    if (appliedEdits.length === 0) {
      // Everything requested was either a conflict or (rare) already fully
      // shipped and logged — nothing left to commit or record.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dryRun: false, committed: false, commitSha: null,
          applied: [], conflicts: conflicts.map(toConflictSummary),
          totalRequested: editIds.length, totalApplied: 0, totalConflicts: conflicts.length,
        }),
      };
    }

    // alreadyAppliedInFile edits that still need logging didn't get their
    // content written by THIS call (it's already correct in the file), so
    // they can't honestly be attributed to a commit this call makes. Only
    // fetch the branch's current HEAD when that case is actually possible.
    let preCommitHeadSha = null;
    if (alreadyAppliedInFile.length > 0) {
      preCommitHeadSha = await getBranchHeadSha({ repo: GITHUB_REPO, branch: GITHUB_BRANCH, token: GITHUB_TOKEN });
    }

    // --- Step 3: commit — THE POINT OF NO RETURN ---
    let newCommitSha = null;
    if (toCommit.length > 0) {
      const updatedJson = applyEditsToJson(file.json, toCommit);
      // 2-space indent, no trailing newline: matches all-recipes.json's
      // actual committed bytes (verified against `git show HEAD:...`) —
      // keeps the diff to the fields that actually changed.
      const newContent = JSON.stringify(updatedJson, null, 2);
      const recipeCount = new Set(toCommit.map((e) => e.recipe_slug)).size;
      const message = `i18n: approve batch — ${toCommit.length} field(s) across ${recipeCount} recipe(s)`;
      const commitResult = await putFile({
        repo: GITHUB_REPO, branch: GITHUB_BRANCH, path: GITHUB_RECIPES_PATH,
        token: GITHUB_TOKEN, content: newContent, sha: file.sha, message,
      });
      newCommitSha = commitResult.commitSha;
    }

    const commitShaFor = (edit) => (toCommit.some((e) => e.id === edit.id) ? newCommitSha : preCommitHeadSha);

    // --- Steps 4 + 5: status flip + audit log, one transaction ---
    // Bundled specifically so "status flipped but log missing" can't
    // happen from a failure inside this call — see the ordering comment
    // above. The UPDATE is listed first in the array, matching the
    // required step order, even though transaction members commit
    // atomically together.
    const appliedIds = appliedEdits.map((e) => e.id);
    const queries = [
      sql`update edits set status = 'approved', resolved_at = now(), resolved_by = ${approverEmail} where id = any(${appliedIds})`,
      ...needsLogging.map((edit) => sql`
        insert into edit_log (recipe_slug, lang, field_path, old_value, new_value, action, editor_email, resolved_by, commit_sha)
        values (${edit.recipe_slug}, ${edit.lang}, ${edit.field_path}, ${edit.old_value}, ${edit.new_value}, 'approved', ${edit.editor_email}, ${approverEmail}, ${commitShaFor(edit)})
      `),
    ];
    await sql.transaction(queries);

    // --- Step 6: build hook, LAST — only if a new commit actually shipped ---
    if (toCommit.length > 0 && NETLIFY_BUILD_HOOK_ID) {
      await fireBuildHook(NETLIFY_BUILD_HOOK_ID);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dryRun: false,
        committed: toCommit.length > 0,
        commitSha: newCommitSha,
        applied: appliedEdits.map(toAppliedSummary),
        conflicts: conflicts.map(toConflictSummary),
        totalRequested: editIds.length,
        totalApplied: appliedEdits.length,
        totalConflicts: conflicts.length,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function toAppliedSummary(edit) {
  return { id: edit.id, recipeSlug: edit.recipe_slug, lang: edit.lang, fieldPath: edit.field_path };
}

function toConflictSummary(edit) {
  return {
    id: edit.id, recipeSlug: edit.recipe_slug, lang: edit.lang, fieldPath: edit.field_path,
    reason: edit.reason, currentValue: edit.currentValue,
  };
}
