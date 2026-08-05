use crate::database_manager::assets::assets_operations::AssetsOperations;
use crate::database_manager::documents::documents_operations::DocumentsOperations;
use crate::database_manager::migrations;
use crate::database_manager::nodes::nodes_operations::NodesOperations;
use crate::database_manager::recent_documents::recent_documents_operations::RecentDocumentsOperations;
use crate::database_manager::search::search_operations::SearchOperations;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::path::Path;
use std::str::FromStr;

#[derive(sqlx::FromRow, serde::Deserialize, serde::Serialize)]
pub struct DocumentsJson {
    pub id: Option<String>,
    pub path: String,
    pub workspace_id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(sqlx::FromRow, serde::Deserialize, serde::Serialize)]
pub struct NodeJson {
    pub id: Option<String>,
    pub position: String,
    pub content: String,
    pub full_text: String,
    pub document_id: String,
    pub node_type: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub checksum: Option<String>,
}

#[derive(sqlx::FromRow, serde::Deserialize, serde::Serialize)]
pub struct NodeHash {
    pub id: String,
    pub checksum: Option<String>,
}

#[derive(sqlx::FromRow, serde::Deserialize, serde::Serialize)]
pub struct AssetJson {
    pub id: String,
    pub name: String,
    pub mime_type: Option<String>,
    /// Absolute path to the asset file on disk (e.g. /Users/.../anql/assets/<uuid>.png)
    pub file_path: String,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub node_id: String,
    pub document_id: String,
}

pub struct Database {
    pool: SqlitePool,
    pub nodes_operations: NodesOperations,
    pub documents_operations: DocumentsOperations,
    pub search_operations: SearchOperations,
    pub recent_documents_operations: RecentDocumentsOperations,
    pub assets_operations: AssetsOperations,
    /// Absolute path to the assets directory on disk (sibling of the .db file)
    pub assets_dir: std::path::PathBuf,
}

pub const SUCCESS: i8 = 1;
pub const ERROR: i8 = -1;
pub const NO_CHANGE: i8 = 0;

impl Database {
    pub async fn new(db_path: &str) -> Result<Self> {
        let db_path = Path::new(db_path);

        if let Some(parent) = db_path.parent() {
            if !parent.exists() {
                std::fs::create_dir_all(parent)?;
            }
        }

        if !db_path.exists() {
            std::fs::File::create(db_path)?;
        }

        // Derive the assets directory: <db_dir>/assets/
        let assets_dir = db_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .join("assets");
        if !assets_dir.exists() {
            std::fs::create_dir_all(&assets_dir)?;
        }

        let connect_options =
            SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))?
                .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .after_connect(|conn, _| {
                Box::pin(async move {
                    sqlx::query("PRAGMA foreign_keys = ON")
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query("PRAGMA journal_mode = WAL")
                        .execute(conn)
                        .await?;
                    Ok(())
                })
            })
            .connect_with(connect_options)
            .await?;

        migrations::run_migrations(&pool).await?;

        let nodes_operations = NodesOperations::new(pool.clone(), assets_dir.clone());

        let documents_operations = DocumentsOperations::new(pool.clone());
        let search_operations = SearchOperations::new(pool.clone());
        let recent_documents_operations = RecentDocumentsOperations::new(pool.clone());
        let assets_operations = AssetsOperations::new(pool.clone(), assets_dir.clone());

        Ok(Database {
            pool,
            nodes_operations,
            documents_operations,
            search_operations,
            recent_documents_operations,
            assets_operations,
            assets_dir,
        })
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn check_unauthorized_tables(&self) -> Result<Vec<String>> {
        let allowed_tables = [
            "documents",
            "nodes",
            "recent_documents",
            "assets",
            "nodes_fts",
            "nodes_fts_data",
            "nodes_fts_idx",
            "nodes_fts_docsize",
            "nodes_fts_config",
            "nodes_fts_content",
            "_sqlx_migrations",
            "pending_asset_deletions",
        ];

        let tables: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .fetch_all(&self.pool)
        .await?;

        let unauthorized: Vec<String> = tables
            .into_iter()
            .filter(|table| !allowed_tables.contains(&table.as_str()))
            .collect();

        Ok(unauthorized)
    }

    pub async fn cleanup_database(&self, unauthorized_tables: Vec<String>) -> Result<()> {
        for table in unauthorized_tables {
            if !is_safe_identifier(&table) {
                continue;
            }
            let sql = format!("DROP TABLE IF EXISTS \"{table}\"");
            sqlx::query(&sql).execute(&self.pool).await?;
        }

        Ok(())
    }

    /// Scan the assets directory on disk and find files whose ID
    /// does not exist in the `assets` table (orphans left by crashes).
    /// Returns the list of orphan file paths (absolute).
    pub async fn check_orphan_assets(&self, assets_path: &str) -> Result<Vec<String>> {
        let mut orphans = Vec::new();
        let target_dir = std::path::Path::new(assets_path);

        if !target_dir.exists() {
            return Ok(orphans);
        }

        let entries = std::fs::read_dir(target_dir)
            .map_err(|e| anyhow::anyhow!("Failed to read assets dir: {}", e))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let file_name_str = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or_default();
            if file_name_str.starts_with('.') {
                continue;
            }

            // Extract ID from filename: <uuid>.<ext> → <uuid>
            let file_stem = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or_default()
                .to_string();

            if file_stem.is_empty() {
                continue;
            }

            // Check if this ID exists in the assets table
            let exists: bool = sqlx::query_scalar("SELECT COUNT(*) > 0 FROM assets WHERE id = ?")
                .bind(&file_stem)
                .fetch_one(&self.pool)
                .await
                .unwrap_or(false);

            if !exists {
                orphans.push(path.to_string_lossy().to_string());
            }
        }

        Ok(orphans)
    }

    /// Delete orphan asset files from disk.
    pub fn cleanup_orphan_assets(&self, orphan_paths: &[String]) -> Result<usize> {
        let mut deleted = 0;
        for path in orphan_paths {
            if let Err(e) = std::fs::remove_file(path) {
                eprintln!("Warning: could not delete orphan asset '{}': {}", path, e);
            } else {
                deleted += 1;
            }
        }
        Ok(deleted)
    }

    /// Perform a quick integrity check on the SQLite database.
    pub async fn quick_check(&self) -> Result<()> {
        let result: String = sqlx::query_scalar("PRAGMA quick_check")
            .fetch_one(&self.pool)
            .await?;
        if result.to_lowercase() != "ok" {
            return Err(anyhow::anyhow!("Database integrity check failed: {}", result));
        }
        Ok(())
    }
}

fn is_safe_identifier(name: &str) -> bool {
    !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn extract_asset_ids(content: &str) -> Vec<String> {
    let mut ids = Vec::new();
    let mut remaining = content;
    while let Some(pos) = remaining.find("asset://") {
        let start = pos + "asset://".len();
        let id_len = remaining[start..]
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .count();
        if id_len > 0 {
            let id = remaining[start..start + id_len].to_string();
            // Validate that the ID matches a standard 36-character UUID structure (with 4 hyphens)
            // to avoid false positives from user-typed text.
            if id.len() == 36 && id.chars().filter(|&c| c == '-').count() == 4 {
                if !ids.contains(&id) {
                    ids.push(id);
                }
            }
        }
        remaining = &remaining[start + id_len..];
    }
    ids
}

#[cfg(test)]
mod database_tests;
