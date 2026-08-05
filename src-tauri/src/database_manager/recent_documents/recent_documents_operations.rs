use anyhow::{Ok, Result};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(sqlx::FromRow, serde::Deserialize, serde::Serialize)]
pub struct RecentDocumentJson {
    pub id: String,
    pub opened_at: i64,
    pub last_focused_node_id: String,
}

pub struct RecentDocumentsOperations {
    pool: sqlx::SqlitePool,
}

impl RecentDocumentsOperations {
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { pool }
    }

    fn current_timestamp() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64
    }

    pub async fn add_recent_document(
        &self,
        id: String,
        last_focused_node_id: String,
    ) -> Result<()> {
        let mut tx = self.pool.begin().await?;
        let timestamp = Self::current_timestamp();

        let existing = sqlx::query("SELECT id FROM recent_documents WHERE id = ?")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?;

        if existing.is_some() {
            sqlx::query(
                "UPDATE recent_documents SET opened_at = ?, last_focused_node_id = ? WHERE id = ?",
            )
            .bind(timestamp)
            .bind(&last_focused_node_id)
            .bind(&id)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                "INSERT INTO recent_documents (id, opened_at, last_focused_node_id) VALUES (?, ?, ?)",
            )
            .bind(&id)
            .bind(timestamp)
            .bind(&last_focused_node_id)
            .execute(&mut *tx)
            .await?;

            let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recent_documents")
                .fetch_one(&mut *tx)
                .await?;

            if count > 1000 {
                let to_delete = count - 1000;
                sqlx::query(
                    "DELETE FROM recent_documents 
                     WHERE id IN (
                         SELECT id FROM recent_documents 
                         ORDER BY opened_at ASC 
                         LIMIT ?
                     )",
                )
                .bind(to_delete)
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn get_recent_documents(
        &self,
        limit: Option<i64>,
    ) -> Result<Vec<RecentDocumentJson>> {
        let limit = limit.unwrap_or(20);
        let documents = sqlx::query_as::<_, RecentDocumentJson>(
            "SELECT id, opened_at, last_focused_node_id 
             FROM recent_documents 
             ORDER BY opened_at DESC 
             LIMIT ?",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(documents)
    }

    pub async fn remove_recent_document(&self, id: String) -> Result<bool> {
        let rows_affected = sqlx::query("DELETE FROM recent_documents WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?
            .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn clear_recent_documents(&self) -> Result<()> {
        sqlx::query("DELETE FROM recent_documents")
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn update_last_focused_node(&self, id: String, node_id: String) -> Result<bool> {
        let rows_affected =
            sqlx::query("UPDATE recent_documents SET last_focused_node_id = ? WHERE id = ?")
                .bind(&node_id)
                .bind(&id)
                .execute(&self.pool)
                .await?
                .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn get_recent_document(&self, id: String) -> Result<Option<RecentDocumentJson>> {
        let document = sqlx::query_as::<_, RecentDocumentJson>(
            "SELECT id, opened_at, last_focused_node_id 
             FROM recent_documents 
             WHERE id = ?",
        )
        .bind(&id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(document)
    }
}
