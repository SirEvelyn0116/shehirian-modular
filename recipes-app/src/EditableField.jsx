import { useEffect, useRef, useState } from 'react';

const STATUS_CLASS = {
  clean: 'editable-field-clean',
  dirty: 'editable-field-dirty',
  pending: 'editable-field-pending',
};

// Click a field -> inline input, rename-style: pre-populated, selected, and
// ready to type over. Click out / Enter commits to the caller's dirty state
// (this component never calls the API itself). Escape reverts without
// committing — not explicitly speced, but standard for this interaction and
// cheap to include as a safety net; drop it if unwanted.
// `rejection` (optional): an earlier submission for this field that an
// approver turned down — { value, reason, by }. Shown under the field so the
// translator doesn't resubmit the same wording. It stays visible while they
// rework the field and disappears once a new version is saved.
function RejectionNote({ rejection, dir }) {
  return (
    // The note's labels are English (the admin UI is English-only), so the
    // note itself is always LTR; only the rejected wording keeps the
    // field's direction, isolated in <bdi> so it can't reorder the labels.
    <span className="editable-field-rejection" dir="ltr">
      <span className="editable-field-rejection-head">
        ✖ Rejected{rejection.by ? ` by ${rejection.by}` : ''}{rejection.reason ? ':' : ''}
      </span>
      {rejection.reason && <span className="editable-field-rejection-reason"> <bdi>{rejection.reason}</bdi></span>}
      <span className="editable-field-rejection-value">
        Rejected wording: {rejection.value ? <q><bdi dir={dir}>{rejection.value}</bdi></q> : <em>(empty)</em>}
      </span>
    </span>
  );
}

export default function EditableField({ value, status, dir, onCommit, rejection }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  const note = rejection && status !== 'pending' ? <RejectionNote rejection={rejection} dir={dir} /> : null;

  if (editing) {
    return (
      <>
      <input
        ref={inputRef}
        className="editable-field-input"
        dir={dir}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        }}
      />
      {note}
      </>
    );
  }

  return (
    <>
    <span
      className={`editable-field ${STATUS_CLASS[status] || STATUS_CLASS.clean}${note && status === 'clean' ? ' editable-field-rejected' : ''}`}
      dir={dir}
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter') setEditing(true); }}
    >
      {value ? value : <span className="editable-field-empty">(empty)</span>}
    </span>
    {note}
    </>
  );
}
