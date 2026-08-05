CREATE TABLE IF NOT EXISTS documents (
    id TEXT NOT NULL PRIMARY KEY,
    path TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);

CREATE TABLE IF NOT EXISTS nodes (
    id TEXT NOT NULL PRIMARY KEY,
    position TEXT NOT NULL,
    content TEXT NOT NULL,
    full_text TEXT,
    checksum TEXT,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_document_id ON nodes(document_id);
CREATE INDEX IF NOT EXISTS idx_nodes_node_type ON nodes(node_type);

CREATE TABLE IF NOT EXISTS assets (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    mime_type TEXT,
    file_path TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_asset_deletions (
    asset_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (asset_id, document_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pending_asset_deletions_document_id ON pending_asset_deletions(document_id);
CREATE INDEX IF NOT EXISTS idx_pending_asset_deletions_created_at ON pending_asset_deletions(created_at);

CREATE TABLE IF NOT EXISTS recent_documents (
    id TEXT NOT NULL PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    opened_at INTEGER NOT NULL,
    last_focused_node_id TEXT NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    id UNINDEXED,
    full_text
);

CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts(id, full_text) VALUES (new.id, new.full_text);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
    UPDATE nodes_fts SET full_text = new.full_text WHERE id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
    DELETE FROM nodes_fts WHERE id = old.id;
END;
