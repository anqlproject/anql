use anyhow::{Ok, Result};
use sqlx::Row;
use serde::{Deserialize, Serialize};

#[derive(sqlx::FromRow, Serialize, Deserialize, Debug, Clone)]
pub struct ReferenceJson {
    pub id: Option<String>,
    pub name: String,
    pub ref_type: String,   // 'text' | 'image'
    pub value: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct ReferencesOperations {
    pool: sqlx::SqlitePool,
}

impl ReferencesOperations {
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn new_reference(&self, reference: &ReferenceJson) -> Result<String> {
        let id = sqlx::query(
            r#"INSERT INTO "references" (id, name, ref_type, value, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               RETURNING id"#,
        )
        .bind(&reference.id)
        .bind(&reference.name)
        .bind(&reference.ref_type)
        .bind(&reference.value)
        .bind(&reference.created_at)
        .bind(&reference.updated_at)
        .fetch_one(&self.pool)
        .await?
        .get(0);

        Ok(id)
    }

    pub async fn update_reference(&self, reference: &ReferenceJson) -> Result<bool> {
        let rows_affected = sqlx::query(
            r#"UPDATE "references" SET name = ?, ref_type = ?, value = ?, updated_at = ?
               WHERE id = ?"#,
        )
        .bind(&reference.name)
        .bind(&reference.ref_type)
        .bind(&reference.value)
        .bind(&reference.updated_at)
        .bind(&reference.id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn delete_reference(&self, id: String) -> Result<bool> {
        let rows_affected = sqlx::query(r#"DELETE FROM "references" WHERE id = ?"#)
            .bind(&id)
            .execute(&self.pool)
            .await?
            .rows_affected();

        Ok(rows_affected > 0)
    }

    pub async fn get_all_references(&self) -> Result<Vec<ReferenceJson>> {
        let refs = sqlx::query_as::<_, ReferenceJson>(
            r#"SELECT id, name, ref_type, value, created_at, updated_at
               FROM "references"
               ORDER BY name ASC"#,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(refs)
    }

    pub async fn get_reference_by_name(&self, name: String) -> Result<Option<ReferenceJson>> {
        let r = sqlx::query_as::<_, ReferenceJson>(
            r#"SELECT id, name, ref_type, value, created_at, updated_at
               FROM "references"
               WHERE name = ?"#,
        )
        .bind(&name)
        .fetch_optional(&self.pool)
        .await?;

        Ok(r)
    }
}
