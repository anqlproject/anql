ALTER TABLE "references"
ADD COLUMN path TEXT NOT NULL DEFAULT 'home/';

CREATE INDEX IF NOT EXISTS idx_references_path ON "references"(path);
