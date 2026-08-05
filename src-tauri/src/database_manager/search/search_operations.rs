use crate::database_manager::database::SearchResult;
use anyhow::Result;
use sqlx::{Pool, Row, Sqlite};

pub struct SearchOperations {
    pool: Pool<Sqlite>,
}

impl SearchOperations {
    pub fn new(pool: Pool<Sqlite>) -> Self {
        Self { pool }
    }

    pub async fn search_nodes_fts(&self, query: &str) -> Result<Vec<SearchResult>> {
        let results = sqlx::query(
            r#"
            SELECT b.id as node_id, b.document_id
            FROM nodes b
            JOIN nodes_fts fts ON b.id = fts.id
            WHERE nodes_fts MATCH ?
            ORDER BY rank
            "#,
        )
        .bind(query)
        .fetch_all(&self.pool)
        .await?;

        let mut search_results = Vec::new();
        for row in results {
            let result = SearchResult {
                node_id: row.get("node_id"),
                document_id: row.get("document_id"),
            };
            search_results.push(result);
        }

        Ok(search_results)
    }

    // Recherche FTS avec highlighting
    pub async fn search_nodes_fts_with_snippets(
        &self,
        query: &str,
    ) -> Result<Vec<(SearchResult, String)>> {
        let results = sqlx::query(
            r#"
            SELECT  b.id as node_id,
                    b.document_id,
                    snippet(nodes_fts, 1, '<mark>', '</mark>', '...', 32) as snippet
            FROM nodes b
            JOIN nodes_fts fts ON b.id = fts.id
            WHERE nodes_fts MATCH ?
            ORDER BY rank
            "#,
        )
        .bind(query)
        .fetch_all(&self.pool)
        .await?;

        let mut results_with_snippets = Vec::new();
        for row in results {
            let node = SearchResult {
                node_id: row.get("node_id"),
                document_id: row.get("document_id"),
            };
            let snippet: String = row.get("snippet");
            results_with_snippets.push((node, snippet));
        }

        Ok(results_with_snippets)
    }

    // Fuzzy search with term expansion and similarity
    pub async fn fuzzy_search_nodes(&self, query: &str) -> Result<Vec<(SearchResult, f64)>> {
        // Split query into words and create variations
        let terms: Vec<&str> = query.split_whitespace().collect();
        let mut fuzzy_queries = Vec::new();

        for term in terms {
            // Basic cleanup to avoid FTS5 syntax errors (quote escaping)
            let safe_term = term.replace("\"", "\"\"");
            if safe_term.is_empty() {
                continue;
            }

            if safe_term.len() > 2 {
                // Add original term (quoted to avoid FTS5 keyword issues like OR, AND)
                fuzzy_queries.push(format!("\"{}\"", safe_term));

                // Add variations with truncation (term*)
                fuzzy_queries.push(format!("\"{}\"*", safe_term));

                // Add variations with missing characters
                if safe_term.len() > 3 {
                    fuzzy_queries.push(format!("\"{}\"*", &safe_term[..safe_term.len() - 1]));
                }
                if safe_term.len() > 4 {
                    fuzzy_queries.push(format!("\"{}\"*", &safe_term[..safe_term.len() - 2]));
                }
            } else {
                // For short words (1 or 2 letters), just search as prefix
                fuzzy_queries.push(format!("\"{}\"*", safe_term));
            }
        }

        // Build OR query with all variations
        let search_query = fuzzy_queries.join(" OR ");

        // Avoid crashing FTS5 with empty query
        if search_query.trim().is_empty() {
            return Ok(Vec::new());
        }

        let results = sqlx::query(
            r#"
            SELECT b.id as node_id, 
                   b.document_id,
                   rank,
                   length(b.full_text) as text_length,
                   count(*) as match_count
            FROM nodes b
            JOIN nodes_fts fts ON b.id = fts.id
            WHERE nodes_fts MATCH ?
            GROUP BY b.id, b.document_id, rank, text_length
            ORDER BY rank DESC, match_count DESC
            "#,
        )
        .bind(&search_query)
        .fetch_all(&self.pool)
        .await?;

        let mut fuzzy_results = Vec::new();
        for row in results {
            let result = SearchResult {
                node_id: row.get("node_id"),
                document_id: row.get("document_id"),
            };

            // Calculer un score de similarité basé sur le rank et la pertinence
            let rank: f64 = row.get("rank");
            let text_length: i64 = row.get("text_length");
            let match_count: i64 = row.get("match_count");

            // Score ajusté : plus le rank est élevé, meilleure est la correspondance
            let similarity_score = (rank * 0.7) + ((match_count as f64 / text_length as f64) * 0.3);

            fuzzy_results.push((result, similarity_score));
        }

        Ok(fuzzy_results)
    }

    // Recherche floue avec snippets et scoring
    pub async fn fuzzy_search_nodes_with_snippets(
        &self,
        query: &str,
    ) -> Result<Vec<(SearchResult, String, f64)>> {
        let fuzzy_results = self.fuzzy_search_nodes(query).await?;
        let mut results_with_snippets = Vec::new();

        for (result, score) in fuzzy_results {
            // Get snippet for this result
            let snippet_results = sqlx::query(
                r#"
                SELECT snippet(nodes_fts, 1, '<mark>', '</mark>', '...', 64) as snippet
                FROM nodes b
                JOIN nodes_fts fts ON b.id = fts.id
                WHERE b.id = ? AND b.document_id = ?
                LIMIT 1
                "#,
            )
            .bind(&result.node_id)
            .bind(&result.document_id)
            .fetch_all(&self.pool)
            .await?;

            let snippet: String = snippet_results
                .first()
                .ok_or_else(|| {
                    anyhow::anyhow!(
                        "No snippet found for node_id: {}, document_id: {}",
                        result.node_id,
                        result.document_id
                    )
                })?
                .get("snippet");
            results_with_snippets.push((result, snippet, score));
        }

        Ok(results_with_snippets)
    }

    // Recherche par similarité Levenshtein (approche simplifiée avec SQL)
    pub async fn similarity_search_nodes(
        &self,
        query: &str,
        threshold: f64,
    ) -> Result<Vec<(SearchResult, f64)>> {
        let results = sqlx::query(
            r#"
            SELECT b.id as node_id, 
                   b.document_id,
                   CASE 
                       WHEN b.full_text = ? THEN 1.0
                       WHEN b.full_text LIKE ? THEN 0.8
                       WHEN b.full_text LIKE ? THEN 0.6
                       ELSE 0.0
                   END as similarity_score
            FROM nodes b
            WHERE (b.full_text = ? OR b.full_text LIKE ? OR b.full_text LIKE ?)
                   AND similarity_score >= ?
            ORDER BY similarity_score DESC, length(b.full_text) ASC
            "#,
        )
        .bind(query) // Exact match
        .bind(format!("{}%", query)) // Starts with
        .bind(format!("%{}%", query)) // Contains
        .bind(query)
        .bind(format!("{}%", query))
        .bind(format!("%{}%", query))
        .bind(threshold)
        .fetch_all(&self.pool)
        .await?;

        let mut similarity_results = Vec::new();
        for row in results {
            let result = SearchResult {
                node_id: row.get("node_id"),
                document_id: row.get("document_id"),
            };
            let score: f64 = row.get("similarity_score");
            similarity_results.push((result, score));
        }

        Ok(similarity_results)
    }

    /// Check if FTS indexes are corrupted or missing and recreate if necessary
    pub async fn verify_and_recreate_indexes(&self) -> Result<bool> {
        let mut indexes_recreated = false;

        // Check if FTS table exists
        let fts_table_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='nodes_fts')",
        )
        .fetch_one(&self.pool)
        .await?;

        if !fts_table_exists {
            // Recreate FTS table
            sqlx::query(
                r#"
                CREATE VIRTUAL TABLE nodes_fts USING fts5(
                    id UNINDEXED,
                    full_text
                )
                "#,
            )
            .execute(&self.pool)
            .await?;
            indexes_recreated = true;
        }

        // Check if triggers exist
        let insert_trigger_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='nodes_fts_insert')"
        )
        .fetch_one(&self.pool)
        .await?;

        if !insert_trigger_exists {
            sqlx::query(
                r#"
                CREATE TRIGGER nodes_fts_insert AFTER INSERT ON nodes BEGIN
                    INSERT INTO nodes_fts(id, full_text) VALUES (new.id, new.full_text);
                END
                "#,
            )
            .execute(&self.pool)
            .await?;
            indexes_recreated = true;
        }

        let update_trigger_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='nodes_fts_update')"
        )
        .fetch_one(&self.pool)
        .await?;

        if !update_trigger_exists {
            sqlx::query(
                r#"
                CREATE TRIGGER nodes_fts_update AFTER UPDATE ON nodes BEGIN
                    UPDATE nodes_fts SET full_text = new.full_text WHERE id = new.id;
                END
                "#,
            )
            .execute(&self.pool)
            .await?;
            indexes_recreated = true;
        }

        let delete_trigger_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='trigger' AND name='nodes_fts_delete')"
        )
        .fetch_one(&self.pool)
        .await?;

        if !delete_trigger_exists {
            sqlx::query(
                r#"
                CREATE TRIGGER nodes_fts_delete AFTER DELETE ON nodes BEGIN
                    DELETE FROM nodes_fts WHERE id = old.id;
                END
                "#,
            )
            .execute(&self.pool)
            .await?;
            indexes_recreated = true;
        }

        // Check FTS data integrity
        let nodes_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM nodes")
            .fetch_one(&self.pool)
            .await?;

        let fts_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM nodes_fts")
            .fetch_one(&self.pool)
            .await?;

        // If counts don't match, rebuild FTS index
        if nodes_count != fts_count {
            sqlx::query("DELETE FROM nodes_fts")
                .execute(&self.pool)
                .await?;

            sqlx::query(
                r#"
                INSERT INTO nodes_fts(id, full_text)
                SELECT id, full_text FROM nodes
                "#,
            )
            .execute(&self.pool)
            .await?;
            indexes_recreated = true;
        }

        // Check index on documents.title
        let documents_index_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_documents_title')"
        )
        .fetch_one(&self.pool)
        .await?;

        if !documents_index_exists {
            sqlx::query("CREATE INDEX idx_documents_title ON documents(title)")
                .execute(&self.pool)
                .await?;
            indexes_recreated = true;
        }

        Ok(indexes_recreated)
    }
}
