import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPost } from './api.js';

const LANGS = [
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hy', label: 'Armenian' },
];

// Same interval/attempt-count admin.js's ui-strings deploy-poll already
// uses (10s x 24 = 4 minutes) — reused here rather than re-derived so the
// two tools' "how long do we wait before giving up" behavior stays
// identical without either one hardcoding a different answer.
const POLL_INTERVAL_MS = 10000;
const POLL_MAX_ATTEMPTS = 24;

async function fetchLastBuild() {
  const res = await fetch('/metadata.json?t=' + Date.now());
  if (!res.ok) return null;
  const data = await res.json();
  return data.lastBuild ?? null;
}

// Reuses the ui-strings diff table's CSS classes as-is (chip/chip-total/
// chip-lang/chip-none, diff-table-wrap, table/row-changed, key-cell,
// lang-cell, val-old/val-new/val-empty) — build spec §7 asks for the same
// renderDiff styling/colors; this is a React render of the recipe-grouped
// shape, not a fork of the visual language.
export default function RecipeApprovalView() {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  // Edit ids UNCHECKED — i.e. excluded from "this round." Default: nothing
  // excluded, so every edit starts checked (build spec: "Default: all
  // checked"). Unchecking never touches the database — it's purely local
  // selection state for the batch.
  const [excluded, setExcluded] = useState(() => new Set());

  // phase: 'idle' | 'confirming' | 'submitting' | 'polling' | 'done' | 'timeout' | 'error'
  const [phase, setPhase] = useState('idle');
  const [confirmInfo, setConfirmInfo] = useState(null);   // dry-run result, shown in the confirm panel
  const [result, setResult] = useState(null);              // real approve response
  const [actionError, setActionError] = useState(null);
  const pollRef = useRef(null);

  function loadPreview() {
    return apiGet('/api/recipes/preview').then(setPreview).catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadPreview();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function toggle(editId) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(editId)) next.delete(editId); else next.add(editId);
      return next;
    });
  }

  if (error) return <div className="recipes-error">Couldn't load pending edits: {error}</div>;
  if (!preview) return <div className="recipes-loading">Loading pending edits…</div>;

  const allEdits = preview.recipes.flatMap((g) => g.edits);
  const includedIds = allEdits.filter((e) => !excluded.has(e.id)).map((e) => e.id);

  // Step 1 of the confirm gate: a dry run does only the read-only conflict
  // + idempotency checks server-side (recipes-approve.js) and writes
  // nothing — its response is what makes the confirm panel's count real
  // instead of a guess (the true conflict count can't be known client-side;
  // it depends on the live file state at approval time).
  async function startApprove() {
    setActionError(null);
    setPhase('confirming');
    try {
      const dryRunResult = await apiPost('/api/recipes/approve', { editIds: includedIds, dryRun: true });
      setConfirmInfo(dryRunResult);
    } catch (err) {
      setActionError(err.message);
      setPhase('error');
    }
  }

  function cancelApprove() {
    setPhase('idle');
    setConfirmInfo(null);
  }

  // Step 2: the real, irreversible-ish call — only reachable after the
  // approver has seen the actual counts and explicitly confirmed. Captures
  // the pre-commit build timestamp FIRST, before the network call that
  // might trigger a new one, so the poll below has an honest baseline to
  // compare against.
  async function confirmApprove() {
    setPhase('submitting');
    setActionError(null);
    try {
      const baseline = await fetchLastBuild();
      const approveResult = await apiPost('/api/recipes/approve', { editIds: includedIds, confirmed: true });
      setResult(approveResult);
      setExcluded(new Set());
      await loadPreview();

      if (approveResult.committed) {
        pollForDeploy(baseline);
      } else {
        // Nothing new was actually committed (e.g. the whole batch turned
        // out to be conflicts, or was already shipped by an earlier,
        // interrupted call) — no build hook fired, so there's nothing to
        // poll for.
        setPhase('done');
      }
    } catch (err) {
      setActionError(err.message);
      setPhase('error');
    }
  }

  function pollForDeploy(baseline) {
    setPhase('polling');
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      const current = await fetchLastBuild();
      if (current !== null && current !== baseline) {
        clearInterval(pollRef.current);
        setPhase('done');
        return;
      }
      attempts++;
      if (attempts >= POLL_MAX_ATTEMPTS) {
        clearInterval(pollRef.current);
        setPhase('timeout');
      }
    }, POLL_INTERVAL_MS);
  }

  function dismissResult() {
    setPhase('idle');
    setConfirmInfo(null);
    setResult(null);
    setActionError(null);
  }

  return (
    <div className="recipe-approval-view">
      <div className="diff-summary">
        {preview.totalChanges === 0 ? (
          <span className="chip chip-none">✅ Nothing to approve right now — no pending translations awaiting review.</span>
        ) : (
          <>
            <span className="chip chip-total">⚠️ {preview.totalChanges} change{preview.totalChanges === 1 ? '' : 's'}</span>
            {LANGS.filter((l) => preview.changesByLang[l.code] > 0).map((l) => (
              <span key={l.code} className="chip chip-lang">{l.label}: {preview.changesByLang[l.code]}</span>
            ))}
          </>
        )}
      </div>

      {preview.recipes.map((group) => (
        <details key={group.slug} className="recipe-approval-group" open>
          <summary className="recipe-approval-group-summary">
            {group.title} <span className="recipe-approval-group-count">({group.edits.length})</span>
          </summary>
          <div className="diff-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Include</th>
                  <th>Lang</th>
                  <th>Field</th>
                  <th>Old</th>
                  <th>New</th>
                  <th>Editor</th>
                </tr>
              </thead>
              <tbody>
                {group.edits.map((edit) => (
                  <tr key={edit.id} className="row-changed">
                    <td>
                      <input
                        type="checkbox"
                        checked={!excluded.has(edit.id)}
                        onChange={() => toggle(edit.id)}
                        disabled={phase !== 'idle'}
                        aria-label={`Include ${group.slug} ${edit.lang} ${edit.fieldPath} in this batch`}
                      />
                    </td>
                    <td className="lang-cell">{edit.lang}</td>
                    <td className="key-cell" title={edit.fieldPath}>{edit.fieldPath}</td>
                    <td dir={edit.lang === 'ar' ? 'rtl' : 'ltr'} className={edit.lang === 'ar' ? 'val-cell-rtl' : undefined}>
                      {edit.oldValue ? <span className="val-old">{edit.oldValue}</span> : <span className="val-empty">(empty)</span>}
                    </td>
                    <td dir={edit.lang === 'ar' ? 'rtl' : 'ltr'} className={edit.lang === 'ar' ? 'val-cell-rtl' : undefined}>
                      {edit.newValue ? <span className="val-new">{edit.newValue}</span> : <span className="val-empty">(empty)</span>}
                    </td>
                    <td className="recipe-approval-editor">{edit.editorEmail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}

      {preview.totalChanges > 0 && (
        <div className="btn-row recipe-approval-actions">
          <button
            className="recipe-approval-approve-btn"
            disabled={includedIds.length === 0 || phase !== 'idle'}
            onClick={startApprove}
          >
            🚀 Approve &amp; Deploy ({includedIds.length} selected)
          </button>
        </div>
      )}

      {phase === 'confirming' && confirmInfo && (
        <div className="recipe-approve-confirm-panel" role="alertdialog" aria-label="Confirm publish">
          <p>
            You're about to publish <strong>{confirmInfo.totalApplied}</strong> change{confirmInfo.totalApplied === 1 ? '' : 's'} to the live site.
            {confirmInfo.totalConflicts > 0 && (
              <> <strong>{confirmInfo.totalConflicts}</strong> conflicting edit{confirmInfo.totalConflicts === 1 ? '' : 's'} will be skipped (the live value changed since staging).</>
            )}
          </p>
          <p className="recipe-approve-confirm-warning">This commits to the repo and deploys the live site. It cannot be undone from here.</p>
          <div className="btn-row">
            <button className="recipe-approve-confirm-yes" onClick={confirmApprove} disabled={confirmInfo.totalApplied === 0}>
              Yes, publish
            </button>
            <button className="recipe-approve-confirm-cancel" onClick={cancelApprove}>Cancel</button>
          </div>
        </div>
      )}

      {phase === 'confirming' && !confirmInfo && !actionError && (
        <div className="recipe-approve-status">Checking for conflicts…</div>
      )}

      {phase === 'submitting' && (
        <div className="recipe-approve-status">Publishing…</div>
      )}

      {phase === 'polling' && (
        <div className="recipe-approve-status">
          ✅ Committed{result?.commitSha ? ` (${result.commitSha.slice(0, 7)})` : ''}. Waiting for the site to rebuild…
        </div>
      )}

      {phase === 'done' && result && (
        <div className="recipe-approve-result">
          <p>
            {result.committed
              ? `✅ Published and deployed — ${result.totalApplied} change${result.totalApplied === 1 ? '' : 's'} live.`
              : `Nothing new was published (${result.totalApplied} already-shipped, ${result.totalConflicts} conflicting).`}
          </p>
          {result.conflicts.length > 0 && (
            <p>{result.conflicts.length} edit{result.conflicts.length === 1 ? '' : 's'} skipped due to conflicts — the translator will need to redo {result.conflicts.length === 1 ? 'it' : 'them'} against the current live value.</p>
          )}
          <button className="recipe-approve-dismiss" onClick={dismissResult}>OK</button>
        </div>
      )}

      {phase === 'timeout' && (
        <div className="recipe-approve-result recipe-approve-timeout">
          <p>✅ Committed, but the deploy is taking longer than expected — check back in a few minutes.</p>
          <button className="recipe-approve-dismiss" onClick={dismissResult}>OK</button>
        </div>
      )}

      {phase === 'error' && (
        <div className="recipe-approve-result recipe-approve-error">
          <p>Something went wrong: {actionError}</p>
          <button className="recipe-approve-dismiss" onClick={dismissResult}>OK</button>
        </div>
      )}
    </div>
  );
}
