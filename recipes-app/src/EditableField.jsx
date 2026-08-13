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
export default function EditableField({ value, status, dir, onCommit }) {
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

  if (editing) {
    return (
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
    );
  }

  return (
    <span
      className={`editable-field ${STATUS_CLASS[status] || STATUS_CLASS.clean}`}
      dir={dir}
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={e => { if (e.key === 'Enter') setEditing(true); }}
    >
      {value ? value : <span className="editable-field-empty">(empty)</span>}
    </span>
  );
}
