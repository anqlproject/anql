ALTER TABLE "references" ADD COLUMN source_repo_id TEXT;
ALTER TABLE "references" ADD COLUMN source_resource_id TEXT;
ALTER TABLE "references" ADD COLUMN source_version TEXT;
ALTER TABLE "references" ADD COLUMN source_url TEXT;
ALTER TABLE "references" ADD COLUMN license TEXT;

CREATE INDEX IF NOT EXISTS idx_references_source
ON "references"(source_repo_id, source_resource_id);
