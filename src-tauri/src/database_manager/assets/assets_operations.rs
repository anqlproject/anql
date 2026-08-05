use crate::database_manager::database::AssetJson;
use anyhow::{Context, Result};
use sqlx::{Pool, Row, Sqlite};
use std::path::PathBuf;

pub struct AssetsOperations {
    pool: Pool<Sqlite>,
    /// Absolute path to the assets directory on disk (sibling of the .db file).
    assets_dir: PathBuf,
}

impl AssetsOperations {
    pub fn new(pool: Pool<Sqlite>, assets_dir: PathBuf) -> Self {
        Self { pool, assets_dir }
    }

    /// Returns the assets directory path (for use in Tauri commands that need to write files).
    pub fn assets_dir(&self) -> &PathBuf {
        &self.assets_dir
    }

    /// Insert a new asset record.
    /// The file must already be written to disk before calling this.
    pub async fn create_asset(&self, asset: &AssetJson) -> Result<String> {
        let id = sqlx::query(
            "INSERT INTO assets (id, name, mime_type, file_path, created_at)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id",
        )
        .bind(&asset.id)
        .bind(&asset.name)
        .bind(&asset.mime_type)
        .bind(&asset.file_path)
        .bind(&asset.created_at)
        .fetch_one(&self.pool)
        .await
        .context("inserting asset record")?
        .get(0);

        Ok(id)
    }

    /// Retrieve an asset record (metadata + file_path, no binary data).
    pub async fn get_asset(&self, id: String) -> Result<AssetJson> {
        let asset = sqlx::query_as::<_, AssetJson>(
            "SELECT id, name, mime_type, file_path, created_at FROM assets WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .context("fetching asset record")?;

        Ok(asset)
    }

    pub async fn delete_asset(&self, id: String) -> Result<bool> {
        // Fetch file_path BEFORE deleting the record
        let maybe_path: Option<String> =
            sqlx::query_scalar("SELECT file_path FROM assets WHERE id = ?")
                .bind(&id)
                .fetch_optional(&self.pool)
                .await
                .context("fetching asset file_path before deletion")?;

        // Delete the record from DB
        let rows_affected = sqlx::query("DELETE FROM assets WHERE id = ?")
            .bind(&id)
            .execute(&self.pool)
            .await
            .context("deleting asset record")?
            .rows_affected();

        // Also clean up any pending deletions for this asset just in case
        let _ = sqlx::query("DELETE FROM pending_asset_deletions WHERE asset_id = ?")
            .bind(&id)
            .execute(&self.pool)
            .await;

        // Remove the file from disk
        let removed = if let Some(path) = maybe_path {
            if !path.is_empty() {
                if let Err(e) = std::fs::remove_file(&path) {
                    eprintln!("Warning: could not delete asset file '{}': {}", path, e);
                    false
                } else {
                    true
                }
            } else {
                true
            }
        } else {
            true
        };

        Ok(rows_affected > 0 && removed)
    }

    /// Add an asset to pending deletion for a specific document.
    pub async fn add_pending_deletion(&self, asset_id: String, document_id: String) -> Result<()> {
        sqlx::query(
            "INSERT OR IGNORE INTO pending_asset_deletions (asset_id, document_id, created_at)
            VALUES (?, ?, ?)",
        )
        .bind(&asset_id)
        .bind(&document_id)
        .bind(
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs() as i64,
        )
        .execute(&self.pool)
        .await
        .context("adding pending asset deletion")?;

        Ok(())
    }

    /// Remove an asset from pending deletion for a specific document.
    pub async fn remove_pending_deletion(
        &self,
        asset_id: String,
        document_id: String,
    ) -> Result<()> {
        sqlx::query("DELETE FROM pending_asset_deletions WHERE asset_id = ? AND document_id = ?")
            .bind(&asset_id)
            .bind(&document_id)
            .execute(&self.pool)
            .await
            .context("removing pending asset deletion")?;

        Ok(())
    }

    /// Get all pending deletions for a specific document.
    pub async fn get_pending_deletions_by_document(
        &self,
        document_id: String,
    ) -> Result<Vec<String>> {
        let asset_ids = sqlx::query_scalar(
            "SELECT asset_id FROM pending_asset_deletions WHERE document_id = ?",
        )
        .bind(&document_id)
        .fetch_all(&self.pool)
        .await
        .context("fetching pending deletions by document")?;

        Ok(asset_ids)
    }

    /// Clear all pending deletions for a specific document.
    pub async fn clear_pending_deletions_by_document(&self, document_id: String) -> Result<()> {
        sqlx::query("DELETE FROM pending_asset_deletions WHERE document_id = ?")
            .bind(&document_id)
            .execute(&self.pool)
            .await
            .context("clearing pending deletions by document")?;

        Ok(())
    }

    /// Delete all pending deletions older than a given timestamp.
    pub async fn cleanup_old_pending_deletions(&self, older_than_secs: i64) -> Result<u64> {
        let cutoff = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
            - older_than_secs;

        let result = sqlx::query("DELETE FROM pending_asset_deletions WHERE created_at < ?")
            .bind(cutoff)
            .execute(&self.pool)
            .await
            .context("cleaning up old pending deletions")?;

        Ok(result.rows_affected())
    }

    /// Get a list of all unused assets
    /// Uses SQLite JSON functions to strictly find asset references in a single SQL query
    pub async fn get_unused_assets(&self) -> Result<Vec<AssetJson>> {
        let unused_assets = sqlx::query_as::<_, AssetJson>(
            r#"
            SELECT id, name, mime_type, file_path, created_at FROM assets 
            WHERE NOT EXISTS (
                SELECT 1 FROM nodes, json_tree(nodes.content) 
                WHERE json_tree.value = 'asset://' || assets.id
            )
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .context("fetching unused assets")?;

        Ok(unused_assets)
    }

    /// Clean up assets that are no longer referenced in any node's content.
    pub async fn cleanup_unused_assets(&self) -> Result<u64> {
        let unused_assets = self.get_unused_assets().await?;

        let mut deleted_count = 0;
        for asset in unused_assets {
            if let Err(e) = self.delete_asset(asset.id.clone()).await {
                eprintln!("Warning: failed to delete unused asset: {}", e);
            } else {
                deleted_count += 1;
            }
        }

        Ok(deleted_count)
    }
}
