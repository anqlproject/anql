use anyhow::{Context, Result};
use sqlx::SqlitePool;

/// Returns true when tables exist but were created without PRIMARY KEY constraints.
pub async fn needs_legacy_upgrade(pool: &SqlitePool) -> Result<bool> {
    let schema: Option<String> = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'",
    )
    .fetch_optional(pool)
    .await?;

    Ok(schema
        .as_deref()
        .is_some_and(|sql| !sql.to_uppercase().contains("PRIMARY KEY")))
}

/// Rebuilds legacy tables to add PRIMARY KEY, FOREIGN KEY, and missing indexes.
pub async fn upgrade_legacy_schema(pool: &SqlitePool) -> Result<()> {
    let mut tx = pool.begin().await?;

    // FTS triggers and virtual table depend on nodes — drop first.
    sqlx::query("DROP TRIGGER IF EXISTS nodes_fts_insert")
        .execute(&mut *tx)
        .await?;
    sqlx::query("DROP TRIGGER IF EXISTS nodes_fts_update")
        .execute(&mut *tx)
        .await?;
    sqlx::query("DROP TRIGGER IF EXISTS nodes_fts_delete")
        .execute(&mut *tx)
        .await?;
    sqlx::query("DROP TABLE IF EXISTS nodes_fts")
        .execute(&mut *tx)
        .await?;

    rebuild_table(
        &mut tx,
        "documents",
        r#"
        CREATE TABLE documents_new (
            id TEXT NOT NULL PRIMARY KEY,
            path TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            title TEXT NOT NULL,
            cache TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
        "INSERT INTO documents_new (id, path, workspace_id, title, cache, created_at, updated_at)
         SELECT id, path, workspace_id, title, cache, created_at, updated_at
         FROM documents",
    )
    .await?;

    rebuild_table(
        &mut tx,
        "nodes",
        r#"
        CREATE TABLE nodes_new (
            id TEXT NOT NULL PRIMARY KEY,
            position TEXT NOT NULL,
            content TEXT NOT NULL,
            full_text TEXT,
            checksum TEXT,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            node_type TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
        "INSERT INTO nodes_new (id, position, content, full_text, checksum, document_id, node_type, created_at, updated_at)
         SELECT id, position, content, full_text, checksum, document_id, node_type, created_at, updated_at
         FROM nodes
         WHERE document_id IN (SELECT id FROM documents)",
    )
    .await?;

    rebuild_table(
        &mut tx,
        "recent_documents",
        r#"
        CREATE TABLE recent_documents_new (
            id TEXT NOT NULL PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
            opened_at INTEGER NOT NULL,
            last_focused_node_id TEXT NOT NULL DEFAULT ''
        )
        "#,
        "INSERT INTO recent_documents_new (id, opened_at, last_focused_node_id)
         SELECT id, opened_at, last_focused_node_id
         FROM recent_documents
         WHERE id IN (SELECT id FROM documents)",
    )
    .await?;

    sqlx::query(
        r#"
        CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
            id UNINDEXED,
            full_text
        )
        "#,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
            INSERT INTO nodes_fts(id, full_text) VALUES (new.id, new.full_text);
        END
        "#,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
            UPDATE nodes_fts SET full_text = new.full_text WHERE id = new.id;
        END
        "#,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
            DELETE FROM nodes_fts WHERE id = old.id;
        END
        "#,
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO nodes_fts(id, full_text)
         SELECT id, full_text FROM nodes WHERE full_text IS NOT NULL",
    )
    .execute(&mut *tx)
    .await?;

    create_indexes(&mut tx).await?;

    tx.commit().await?;
    Ok(())
}

async fn rebuild_table(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    table: &str,
    create_new_sql: &str,
    copy_sql: &str,
) -> Result<()> {
    let table_exists: bool = sqlx::query_scalar::<_, i32>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .bind(table)
    .fetch_one(&mut **tx)
    .await
    .context(format!("checking existence of table {table}"))?
        > 0;

    if !table_exists {
        return Ok(());
    }

    sqlx::query(create_new_sql).execute(&mut **tx).await?;
    sqlx::query(copy_sql).execute(&mut **tx).await?;
    sqlx::query(&format!("DROP TABLE {table}"))
        .execute(&mut **tx)
        .await?;
    sqlx::query(&format!("ALTER TABLE {table}_new RENAME TO {table}"))
        .execute(&mut **tx)
        .await?;

    Ok(())
}

async fn create_indexes(tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>) -> Result<()> {
    let indexes = [
        "CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)",
        "CREATE INDEX IF NOT EXISTS idx_documents_workspace_id ON documents(workspace_id)",
        "CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path)",
        "CREATE INDEX IF NOT EXISTS idx_nodes_document_id ON nodes(document_id)",
        "CREATE INDEX IF NOT EXISTS idx_nodes_node_type ON nodes(node_type)",
    ];

    for index_sql in indexes {
        sqlx::query(index_sql).execute(&mut **tx).await?;
    }

    Ok(())
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    if needs_legacy_upgrade(pool).await? {
        upgrade_legacy_schema(pool).await?;
    }

    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .context("running database migrations")?;

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    async fn create_legacy_db(path: &std::path::Path) -> SqlitePool {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).unwrap();
        }
        if !path.exists() {
            std::fs::File::create(path).unwrap();
        }

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect(&format!("sqlite:{}", path.display()))
            .await
            .unwrap();

        sqlx::query(
            r#"
            CREATE TABLE documents (
                id TEXT NOT NULL,
                path TEXT NOT NULL,
                workspace_id TEXT NOT NULL,
                title TEXT NOT NULL,
                cache TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            r#"
            CREATE TABLE nodes (
                id TEXT NOT NULL,
                position TEXT NOT NULL,
                content TEXT NOT NULL,
                full_text TEXT,
                checksum TEXT,
                document_id TEXT NOT NULL,
                node_type TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();

        pool
    }

    #[tokio::test]
    async fn legacy_upgrade_adds_primary_key() {
        let dir = std::env::temp_dir().join(format!("anql_test_{}", uuid_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("legacy.db");
        let pool = create_legacy_db(&db_path).await;

        assert!(needs_legacy_upgrade(&pool).await.unwrap());

        upgrade_legacy_schema(&pool).await.unwrap();

        let schema: String = sqlx::query_scalar(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(schema.to_uppercase().contains("PRIMARY KEY"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn delete_document_cascades_to_nodes() {
        let dir = std::env::temp_dir().join(format!("anql_test_{}", uuid_id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("cascade.db");

        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .after_connect(|conn, _| {
                Box::pin(async move {
                    sqlx::query("PRAGMA foreign_keys = ON")
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect_with(
                sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(&db_path)
                    .create_if_missing(true),
            )
            .await
            .unwrap();

        run_migrations(&pool).await.unwrap();

        sqlx::query(
            "INSERT INTO documents (id, path, workspace_id, title, cache, created_at, updated_at)
             VALUES ('doc1', '/a', 'ws1', 'Title', '', 1, 1)",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO nodes (id, position, content, full_text, checksum, document_id, node_type, created_at, updated_at)
             VALUES ('node1', 'a', '{}', 'text', '0', 'doc1', 'paragraph', 1, 1)",
        )
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query("DELETE FROM documents WHERE id = 'doc1'")
            .execute(&pool)
            .await
            .unwrap();

        let node_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM nodes WHERE id = 'node1'")
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(node_count, 0);

        let _ = std::fs::remove_dir_all(dir);
    }

    fn uuid_id() -> u128 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    }
}
