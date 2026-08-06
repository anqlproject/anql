use crate::database_manager::database::{extract_asset_ids, DocumentsJson};
use anyhow::{Ok, Result};
use sqlx::Row;

pub struct DocumentsOperations {
    pool: sqlx::SqlitePool,
}

impl DocumentsOperations {
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn new_document(&self, document: &DocumentsJson) -> Result<String> {
        let id = sqlx::query(
            "INSERT INTO documents (id, path, workspace_id, title, metadata, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?) 
            RETURNING id",
        )
        .bind(&document.id)
        .bind(&document.path)
        .bind(&document.workspace_id)
        .bind(&document.title)
        .bind(&document.metadata)
        .bind(&document.created_at)
        .bind(&document.updated_at)
        .fetch_one(&self.pool)
        .await?
        .get(0);

        Ok(id)
    }

    pub async fn update_document(&self, document: &DocumentsJson) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET path = ?, workspace_id = ?, title = ?, updated_at = ? 
            WHERE id = ?",
        )
        .bind(&document.path)
        .bind(&document.workspace_id)
        .bind(&document.title)
        .bind(&document.updated_at)
        .bind(&document.id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    // use when document was moved
    pub async fn update_document_path(&self, id: String, path: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET path = ? 
            WHERE id = ?",
        )
        .bind(&path)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn update_document_title(&self, id: String, title: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET title = ? 
            WHERE id = ?",
        )
        .bind(&title)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }


    // use when document was moved to another workspace
    pub async fn update_document_workspace_id(
        &self,
        document_id: String,
        workspace_id: String,
    ) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET workspace_id = ?
            WHERE id = ?",
        )
        .bind(&workspace_id)
        .bind(&document_id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    // Update only the updated_at timestamp of a document
    pub async fn update_document_timestamp(&self, id: String, updated_at: i64) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET updated_at = ?
            WHERE id = ?",
        )
        .bind(&updated_at)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }


    pub async fn delete_document(&self, id: String) -> Result<bool> {
        let mut tx = self.pool.begin().await?;

        // 1. Get all node contents for this document (before cascade removes them)
        let contents: Vec<String> =
            sqlx::query_scalar("SELECT content FROM nodes WHERE document_id = ?")
                .bind(&id)
                .fetch_all(&mut *tx)
                .await?;

        // 2. Extract and delete all associated assets
        // (assets are NOT covered by the FK cascade, so we handle them manually)
        for content in contents {
            for asset_id in extract_asset_ids(&content) {
                // Get file_path before deleting the record
                let maybe_path: Option<String> =
                    sqlx::query_scalar("SELECT file_path FROM assets WHERE id = ?")
                        .bind(&asset_id)
                        .fetch_optional(&mut *tx)
                        .await?;

                // Delete the physical file from disk
                if let Some(path) = maybe_path {
                    if !path.is_empty() {
                        if let Err(e) = std::fs::remove_file(&path) {
                            eprintln!("Warning: could not delete asset file '{}': {}", path, e);
                        }
                    }
                }

                // Delete the asset record from DB
                sqlx::query("DELETE FROM assets WHERE id = ?")
                    .bind(&asset_id)
                    .execute(&mut *tx)
                    .await?;
            }
        }

        // 3. Explicitly delete the recent_documents entry.
        // Note: recent_documents has a FK `ON DELETE CASCADE` referencing documents,
        // so this step is technically redundant — the DELETE on documents (step 4)
        // would cascade here automatically. We keep it explicit for clarity.
        sqlx::query("DELETE FROM recent_documents WHERE id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await?;

        // 4. Delete the document.
        // The FK cascade will automatically delete associated nodes.
        let rows_affected = sqlx::query("DELETE FROM documents WHERE id = ?")
            .bind(&id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

        tx.commit().await?;
        Ok(rows_affected > 0)
    }

    // use to get all documents in a specific path
    pub async fn get_documents_by_path(&self, path: String) -> Result<Vec<DocumentsJson>> {
        let documents = sqlx::query_as::<_, DocumentsJson>(
            "SELECT id, path, workspace_id, title, metadata, created_at, updated_at 
            FROM documents 
            WHERE path = ? ",
        )
        .bind(&path)
        .fetch_all(&self.pool)
        .await?;

        Ok(documents)
    }

    pub async fn get_documents_by_workspace_id(
        &self,
        workspace_id: String,
    ) -> Result<Vec<DocumentsJson>> {
        let documents = sqlx::query_as::<_, DocumentsJson>(
            "SELECT id, path, workspace_id, title, metadata, created_at, updated_at 
            FROM documents 
            WHERE workspace_id = ? ",
        )
        .bind(&workspace_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(documents)
    }

    pub async fn get_document_by_id(&self, document_id: String) -> Result<DocumentsJson> {
        let documents = sqlx::query_as::<_, DocumentsJson>(
            "SELECT id, path, workspace_id, title, metadata, created_at, updated_at 
            FROM documents 
            WHERE id = ? ",
        )
        .bind(&document_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(documents)
    }

    /// Get the raw metadata JSON string for a document.
    pub async fn get_document_metadata(&self, id: String) -> Result<Option<String>> {
        let metadata = sqlx::query_scalar(
            "SELECT metadata FROM documents WHERE id = ?",
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await?;

        Ok(metadata)
    }

    /// Set (overwrite) the metadata JSON string for a document.
    pub async fn set_document_metadata(&self, id: String, metadata: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET metadata = ? WHERE id = ?",
        )
        .bind(&metadata)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    /// Remove (set to NULL) the metadata for a document.
    pub async fn remove_document_metadata(&self, id: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE documents SET metadata = NULL WHERE id = ?",
        )
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }
}
