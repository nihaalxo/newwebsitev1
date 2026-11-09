-- Content for the Cloudflare CMS adapter (lib/cms/cloudflare.ts), in D1 (SQLite).
-- Mirrors supabase/migrations/0001_init.sql and 0002_shown.sql. Differences, because SQLite has no such types:
--   jsonb columns are TEXT holding JSON, checked with json_valid() and json_type();
--   booleans are INTEGER 0 or 1;
--   timestamps are ISO 8601 TEXT written by the adapter (there are no triggers);
--   there is no Row Level Security: the Worker is the only client, and every admin call checks the session first.
-- Apply with `npm run db:migrate:local` (the preview) or `npm run db:migrate:remote` (the live database).

CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE
                CHECK (slug <> '' AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-' AND slug NOT GLOB '*--*'),
  title         TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'brand'
                CHECK (category IN ('brand', 'spatial', 'interface', 'print')),
  year          INTEGER NOT NULL,
  discipline    TEXT NOT NULL DEFAULT '',
  summary       TEXT NOT NULL DEFAULT '',
  shown         TEXT NOT NULL DEFAULT '',
  still_only    INTEGER NOT NULL DEFAULT 0 CHECK (still_only IN (0, 1)),
  cover         TEXT CHECK (cover IS NULL OR (json_valid(cover) AND json_type(cover) = 'object')),
  accent        TEXT NOT NULL DEFAULT '#6FF3FF',
  role          TEXT NOT NULL DEFAULT '',
  project_type  TEXT NOT NULL DEFAULT ''
                CHECK (project_type IN ('client', 'uni', 'self', '')),
  tools         TEXT NOT NULL DEFAULT '',
  deliverables  TEXT NOT NULL DEFAULT '',
  link          TEXT NOT NULL DEFAULT '',
  featured      INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  position      INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  blocks        TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(blocks) AND json_type(blocks) = 'array'),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  published_at  TEXT
);

CREATE INDEX IF NOT EXISTS projects_status_position_idx ON projects (status, position);

-- One row: the site settings as a JSON object (Settings without updatedAt).
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  data        TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data) AND json_type(data) = 'object'),
  updated_at  TEXT NOT NULL
);
