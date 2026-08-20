-- Recipe translation tool — pending edits store (build spec §5).
-- Idempotent: safe to re-run against a fresh or existing database.

create table if not exists edits (
  id           uuid primary key default gen_random_uuid(),
  recipe_slug  text        not null,
  lang         text        not null,          -- target language: 'fr' | 'ar' | 'hy'
  field_path   text        not null,          -- 'title' | 'ingredients[2]' | 'instructions[0]'
  ref_value    text,                          -- EN reference at edit time
  old_value    text,                          -- target value at edit time (conflict guard)
  new_value    text        not null,
  editor_email text        not null,
  status       text        not null default 'pending',  -- pending|approved|conflict
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  text,
  unique (recipe_slug, lang, field_path)       -- upsert target — one pending edit per field
);

create index if not exists edits_status_idx on edits (status);
create index if not exists edits_editor_idx on edits (editor_email);

-- Append-only audit log — approval-scoped, not per-keystroke. `edits` stays
-- the mutable current-pending-state table (upserted per save, unchanged
-- above); edit_log is written only at approval time, one row per field
-- actually shipped in an approved batch. Insert-only — never update or
-- delete a row here. A translator's many "oops, fix the comma" re-edits of
-- the same field collapse to a single edits row and, once approved, a
-- single edit_log row — the durable history is per approved change, not
-- per save.
create table if not exists edit_log (
  id           uuid primary key default gen_random_uuid(),
  recipe_slug  text        not null,
  lang         text        not null,
  field_path   text        not null,
  old_value    text,
  new_value    text        not null,
  action       text        not null default 'approved',  -- room for future action types
  editor_email text        not null,          -- translator who authored the edit
  resolved_by  text        not null,          -- approver who shipped it
  commit_sha   text        not null,          -- git commit this batch produced
  created_at   timestamptz not null default now()
);

create index if not exists edit_log_recipe_idx on edit_log (recipe_slug);
create index if not exists edit_log_commit_idx on edit_log (commit_sha);
