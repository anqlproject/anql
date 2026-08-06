use crate::database_manager::database::{extract_asset_ids, NodeHash, NodeJson};
use anyhow::Result;
use sha2::{Digest, Sha256};
use sqlx::{Pool, Row, Sqlite};

pub struct NodesOperations {
    pub pool: Pool<Sqlite>,
}

impl NodesOperations {
    pub fn new(pool: Pool<Sqlite>, _assets_dir: std::path::PathBuf) -> Self {
        Self { pool }
    }

    pub async fn get_content(&self, id: String) -> Result<String> {
        let content = sqlx::query("SELECT content FROM nodes WHERE id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?
            .get(0);
        Ok(content)
    }

    pub async fn new_node(&self, node_json: &NodeJson) -> Result<String> {
        let mut hasher = Sha256::new();
        hasher.update(node_json.content.as_bytes());
        let checksum = format!("{:x}", hasher.finalize());

        let id = sqlx::query(
            "INSERT INTO nodes (id, position, content, full_text, checksum, metadata, document_id, node_type, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
            RETURNING id")
            .bind(&node_json.id)
            .bind(&node_json.position)
            .bind(&node_json.content)
            .bind(&node_json.full_text)
            .bind(checksum)
            .bind(&node_json.metadata)
            .bind(&node_json.document_id)
            .bind(&node_json.node_type)
            .bind(&node_json.created_at)
            .bind(&node_json.updated_at)
            .fetch_one(&self.pool)
            .await?
            .get(0);
        Ok(id)
    }

    pub async fn update_node(&self, node_json: &NodeJson) -> Result<bool> {
        let mut hasher = Sha256::new();
        hasher.update(node_json.content.as_bytes());
        let checksum = format!("{:x}", hasher.finalize());

        let rows_affected = sqlx::query(
            "UPDATE nodes SET position = ?, content = ?, full_text = ?, checksum = ?, node_type = ?, updated_at = ?
            WHERE id = ?",
        )
        .bind(&node_json.position)
        .bind(&node_json.content)
        .bind(&node_json.full_text)
        .bind(&checksum)
        .bind(&node_json.node_type)
        .bind(&node_json.updated_at)
        .bind(&node_json.id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn update_node_content(
        &self,
        id: String,
        new_content: String,
        new_full_text: String,
        updated_at: i64,
    ) -> Result<Option<String>> {
        let current_checksum = self.get_checksum(id.clone()).await?;

        let mut hasher = Sha256::new();
        hasher.update(new_content.as_bytes());
        let new_checksum = format!("{:x}", hasher.finalize());

        if current_checksum == new_checksum {
            return Ok(None);
        }

        let rows_affected = sqlx::query(
            "UPDATE nodes SET content = ?, full_text = ?, checksum = ?, updated_at = ? 
            WHERE id = ?",
        )
        .bind(&new_content)
        .bind(&new_full_text)
        .bind(&new_checksum)
        .bind(updated_at)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected > 0 {
            Ok(Some(new_checksum))
        } else {
            Ok(None)
        }
    }

    // use when node was dragged and change position
    pub async fn update_node_position(
        &self,
        id: String,
        new_position: String,
        new_content: String,
        updated_at: i64,
    ) -> Result<Option<String>> {
        let current_position = self.get_position(id.clone()).await?;
        if current_position == new_position {
            return Ok(None);
        }

        let mut hasher = Sha256::new();
        hasher.update(new_content.as_bytes());
        let new_checksum = format!("{:x}", hasher.finalize());

        let rows_affected = sqlx::query(
            "UPDATE nodes SET position = ?, content = ?, checksum = ?, updated_at = ? 
            WHERE id = ?",
        )
        .bind(&new_position)
        .bind(&new_content)
        .bind(&new_checksum)
        .bind(&updated_at)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected > 0 {
            Ok(Some(new_checksum))
        } else {
            Ok(None)
        }
    }

    // use when a node was moved on an another document
    pub async fn update_node_document_id(
        &self,
        id: String,
        new_document_id: String,
    ) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE nodes SET document_id = ? 
            WHERE id = ?",
        )
        .bind(&new_document_id)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn update_node_type(&self, id: String, node_type: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE nodes SET node_type = ? 
            WHERE id = ?",
        )
        .bind(&node_type)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn delete_node(&self, id: String) -> Result<bool> {
        // Delete the node
        // Note: Asset deletion is handled by the frontend's pending deletion mechanism
        let rows_affected = sqlx::query("DELETE FROM nodes WHERE id = ?")
            .bind(&id)
            .execute(&self.pool)
            .await?
            .rows_affected();

        Ok(rows_affected > 0)
    }

    // use when a document was deleted
    pub async fn delete_node_by_document_id(&self, document_id: String) -> Result<bool> {
        let mut tx = self.pool.begin().await?;

        // Fetch all node contents for this document
        let contents: Vec<String> =
            sqlx::query_scalar("SELECT content FROM nodes WHERE document_id = ?")
                .bind(&document_id)
                .fetch_all(&mut *tx)
                .await?;

        // Delete associated assets (DB record + file on disk) before removing nodes
        for content in &contents {
            for asset_id in extract_asset_ids(content) {
                // Fetch file_path before deletion
                let maybe_path: Option<String> =
                    sqlx::query_scalar("SELECT file_path FROM assets WHERE id = ?")
                        .bind(&asset_id)
                        .fetch_optional(&mut *tx)
                        .await
                        .unwrap_or(None);

                // Delete DB record
                let _ = sqlx::query("DELETE FROM assets WHERE id = ?")
                    .bind(&asset_id)
                    .execute(&mut *tx)
                    .await;

                // Remove the physical file
                if let Some(path) = maybe_path {
                    if !path.is_empty() {
                        if let Err(e) = std::fs::remove_file(&path) {
                            eprintln!("Warning: could not delete asset file '{}': {}", path, e);
                        }
                    }
                }
            }
        }

        // Delete all nodes for this document
        let rows_affected = sqlx::query("DELETE FROM nodes WHERE document_id = ?")
            .bind(&document_id)
            .execute(&mut *tx)
            .await?
            .rows_affected();

        tx.commit().await?;
        Ok(rows_affected > 0)
    }

    pub async fn get_position(&self, id: String) -> Result<String> {
        let position = sqlx::query("SELECT position FROM nodes WHERE id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?
            .get(0);
        Ok(position)
    }

    pub async fn get_checksum(&self, id: String) -> Result<String> {
        let checksum = sqlx::query("SELECT checksum FROM nodes WHERE id = ?")
            .bind(id)
            .fetch_one(&self.pool)
            .await?
            .get(0);
        Ok(checksum)
    }

    pub async fn get_node_by_id(&self, id: String) -> Result<NodeJson> {
        let node = sqlx::query_as::<_, NodeJson>(
            "SELECT id, position, content, full_text, checksum, metadata, document_id, node_type, created_at, updated_at
            FROM nodes 
            WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(node)
    }

    // get all nodes in a specific document
    pub async fn get_nodes_by_document_id(&self, document_id: String) -> Result<Vec<NodeJson>> {
        let nodes = sqlx::query_as::<_, NodeJson>(
            "SELECT id, position, content, full_text, checksum, metadata, document_id, node_type, created_at, updated_at
            FROM nodes 
            WHERE document_id = ?
            ORDER BY position",
        )
        .bind(document_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(nodes)
    }

    pub async fn get_hashes_by_document_id(&self, document_id: String) -> Result<Vec<NodeHash>> {
        let hashes = sqlx::query_as::<_, NodeHash>(
            "SELECT id, checksum
            FROM nodes 
            WHERE document_id = ?"
        )
        .bind(document_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(hashes)
    }

    pub async fn get_document_id(&self, node_id: String) -> Result<String> {
        let document_id = sqlx::query("SELECT document_id FROM nodes WHERE id = ?")
            .bind(node_id)
            .fetch_one(&self.pool)
            .await?
            .get(0);
        Ok(document_id)
    }

    pub async fn get_nodes_by_node_type(&self, node_type: String) -> Result<Vec<NodeJson>> {
        let nodes = sqlx::query_as::<_, NodeJson>(
            "SELECT id, position, content, full_text, checksum, metadata, document_id, node_type, created_at, updated_at
            FROM nodes 
            WHERE node_type = ?
            ORDER BY position",
        )
        .bind(node_type)
        .fetch_all(&self.pool)
        .await?;

        Ok(nodes)
    }

    /// Get the raw metadata JSON string for a node.
    pub async fn get_node_metadata(&self, id: String) -> Result<Option<String>> {
        let metadata = sqlx::query_scalar(
            "SELECT metadata FROM nodes WHERE id = ?",
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await?;

        Ok(metadata)
    }

    /// Set (overwrite) the metadata JSON string for a node.
    pub async fn set_node_metadata(&self, id: String, metadata: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE nodes SET metadata = ? WHERE id = ?",
        )
        .bind(&metadata)
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    /// Remove (set to NULL) the metadata for a node.
    pub async fn remove_node_metadata(&self, id: String) -> Result<bool> {
        let rows_affected = sqlx::query(
            "UPDATE nodes SET metadata = NULL WHERE id = ?",
        )
        .bind(&id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }
}
