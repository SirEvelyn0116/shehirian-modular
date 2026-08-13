import { useEffect, useState } from 'react';
import { apiGet } from './api.js';

const LANGS = [
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hy', label: 'Armenian' },
];

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
  // selection state for a batch that Phase 5 doesn't exist to submit yet.
  const [excluded, setExcluded] = useState(() => new Set());

  useEffect(() => {
    apiGet('/api/recipes/preview').then(setPreview).catch(err => setError(err.message));
  }, []);

  function toggle(editId) {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(editId)) next.delete(editId); else next.add(editId);
      return next;
    });
  }

  if (error) return <div className="recipes-error">Couldn't load pending edits: {error}</div>;
  if (!preview) return <div className="recipes-loading">Loading pending edits…</div>;

  const includedCount = preview.totalChanges - excluded.size;

  return (
    <div className="recipe-approval-view">
      <div className="diff-summary">
        {preview.totalChanges === 0 ? (
          <span className="chip chip-none">✅ No pending edits</span>
        ) : (
          <>
            <span className="chip chip-total">⚠️ {preview.totalChanges} change{preview.totalChanges === 1 ? '' : 's'}</span>
            {LANGS.filter(l => preview.changesByLang[l.code] > 0).map(l => (
              <span key={l.code} className="chip chip-lang">{l.label}: {preview.changesByLang[l.code]}</span>
            ))}
          </>
        )}
      </div>

      {preview.recipes.map(group => (
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
                {group.edits.map(edit => (
                  <tr key={edit.id} className="row-changed">
                    <td>
                      <input
                        type="checkbox"
                        checked={!excluded.has(edit.id)}
                        onChange={() => toggle(edit.id)}
                        aria-label={`Include ${group.slug} ${edit.lang} ${edit.fieldPath} in this batch`}
                      />
                    </td>
                    <td className="lang-cell">{edit.lang}</td>
                    <td className="key-cell" title={edit.fieldPath}>{edit.fieldPath}</td>
                    <td>{edit.oldValue ? <span className="val-old">{edit.oldValue}</span> : <span className="val-empty">(empty)</span>}</td>
                    <td>{edit.newValue ? <span className="val-new">{edit.newValue}</span> : <span className="val-empty">(empty)</span>}</td>
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
            disabled
            title="Approve & Deploy ships in Phase 5 — not implemented yet"
          >
            🚀 Approve &amp; Deploy ({includedCount} selected)
          </button>
          <span className="recipe-approval-conflict-note">
            Conflict detection (has the live value changed since an edit was staged?) is deferred to
            the Phase 5 approve action — this preview does not check for it.
          </span>
        </div>
      )}
    </div>
  );
}
