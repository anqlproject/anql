CREATE TABLE IF NOT EXISTS "references" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    ref_type TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'number' | 'image'
    value TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_references_name ON "references"(name);
