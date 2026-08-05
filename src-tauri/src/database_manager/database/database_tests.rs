use crate::database_manager::database::{is_safe_identifier, Database, DocumentsJson, NodeJson};

#[test]
fn safe_identifier_rejects_invalid_names() {
    assert!(is_safe_identifier("documents"));
    assert!(!is_safe_identifier("doc; DROP TABLE documents"));
    assert!(!is_safe_identifier(""));
}

#[tokio::test]
async fn new_database_applies_migrations() {
    let dir = std::env::temp_dir().join(format!(
        "anql_db_new_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("fresh.db");

    let db = Database::new(db_path.to_str().unwrap()).await.unwrap();
    let schema: String = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'",
    )
    .fetch_one(db.pool())
    .await
    .unwrap();

    assert!(schema.to_uppercase().contains("PRIMARY KEY"));
    let _ = std::fs::remove_dir_all(dir);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Insert one asset row directly in the DB.
async fn insert_asset(db: &Database, id: &str) {
    sqlx::query(
        "INSERT INTO assets (id, name, mime_type, file_path, created_at) VALUES (?, 'file', 'image/png', ?, 0)",
    )
    .bind(id)
    .bind(format!("/fake/path/{id}"))
    .execute(db.pool())
    .await
    .unwrap();
}

/// Build a NodeJson whose content references the given asset ids.
fn make_node(id: &str, document_id: &str, asset_ids: &[&str]) -> NodeJson {
    let refs: String = asset_ids
        .iter()
        .map(|a| format!("asset://{a}"))
        .collect::<Vec<_>>()
        .join(" ");
    NodeJson {
        id: Some(id.to_string()),
        position: id.to_string(),
        content: format!("text {refs}"),
        full_text: "text".to_string(),
        document_id: document_id.to_string(),
        node_type: "paragraph".to_string(),
        created_at: 0,
        updated_at: 0,
        checksum: None,
    }
}

/// Helper: create a minimal document.
fn make_doc(id: &str) -> DocumentsJson {
    DocumentsJson {
        id: Some(id.to_string()),
        path: format!("/{id}"),
        workspace_id: "ws".to_string(),
        title: id.to_string(),
        created_at: 0,
        updated_at: 0,
    }
}

// ─── Test: delete_document_with_multiple_nodes ───────────────────────────────

/// `delete_document` must delete the document AND all nodes AND every asset
/// referenced across all nodes, even when there are multiple nodes each with
/// their own assets.
#[tokio::test]
async fn delete_document_with_multiple_nodes() {
    let dir = std::env::temp_dir().join(format!(
        "anql_multi_nodes_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let db = Database::new(dir.join("test.db").to_str().unwrap())
        .await
        .unwrap();

    // Setup: one document, 3 nodes, each node owns its own asset
    db.documents_operations
        .new_document(&make_doc("doc_m"))
        .await
        .unwrap();

    let assets = [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
    ];
    let node_ids = ["node_m1", "node_m2", "node_m3"];

    for (asset_id, node_id) in assets.iter().zip(node_ids.iter()) {
        insert_asset(&db, asset_id).await;
        let node = make_node(node_id, "doc_m", &[asset_id]);
        db.nodes_operations.new_node(&node).await.unwrap();
    }

    // Pre-conditions
    let nodes_before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM nodes WHERE document_id = 'doc_m'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    let assets_before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(nodes_before, 3, "setup: expected 3 nodes");
    assert_eq!(assets_before, 3, "setup: expected 3 assets");

    // Action
    let deleted = db
        .documents_operations
        .delete_document("doc_m".to_string())
        .await
        .unwrap();
    assert!(deleted, "delete_document should return true");

    // The document must be gone
    let doc_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM documents WHERE id = 'doc_m'")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(doc_count, 0, "document must be deleted");

    // All 3 nodes must be gone (cascade via FK)
    let nodes_after: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM nodes WHERE document_id = 'doc_m'")
            .fetch_one(db.pool())
            .await
            .unwrap();
    assert_eq!(nodes_after, 0, "all nodes must be cascade-deleted");

    // All 3 assets must be gone (cleaned up by delete_document logic)
    let assets_after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM assets")
        .fetch_one(db.pool())
        .await
        .unwrap();
    assert_eq!(assets_after, 0, "all assets from all nodes must be deleted");

    let _ = std::fs::remove_dir_all(dir);
}

// ─── Test: check_unauthorized_tables ──────────────────────────────────────────

#[tokio::test]
async fn test_check_unauthorized_tables() {
    let dir = std::env::temp_dir().join(format!(
        "anql_unauthorized_tables_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let db = Database::new(dir.join("test.db").to_str().unwrap())
        .await
        .unwrap();

    // Create an unauthorized table
    sqlx::query("CREATE TABLE malicious_table (id INTEGER PRIMARY KEY)")
        .execute(db.pool())
        .await
        .unwrap();

    let unauthorized = db.check_unauthorized_tables().await.unwrap();
    assert_eq!(unauthorized.len(), 1);
    assert_eq!(unauthorized[0], "malicious_table");

    // Cleanup
    db.cleanup_database(unauthorized).await.unwrap();

    let unauthorized_after = db.check_unauthorized_tables().await.unwrap();
    assert_eq!(unauthorized_after.len(), 0);

    let _ = std::fs::remove_dir_all(dir);
}

// ─── Test: check_orphan_assets ────────────────────────────────────────────────

#[tokio::test]
async fn test_check_orphan_assets() {
    let dir = std::env::temp_dir().join(format!(
        "anql_orphan_assets_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();

    // Create the DB
    let db_path = dir.join("test.db");
    let db = Database::new(db_path.to_str().unwrap()).await.unwrap();

    // Ensure assets dir exists
    std::fs::create_dir_all(&db.assets_dir).unwrap();

    // Valid asset in DB and on disk
    let valid_id = "valid-asset-id";
    insert_asset(&db, valid_id).await;
    std::fs::write(db.assets_dir.join(format!("{}.png", valid_id)), b"valid").unwrap();

    // Orphan asset only on disk
    let orphan_id = "orphan-asset-id";
    let orphan_path = db.assets_dir.join(format!("{}.png", orphan_id));
    std::fs::write(&orphan_path, b"orphan").unwrap();

    let orphans = db
        .check_orphan_assets(db.assets_dir.to_str().unwrap())
        .await
        .unwrap();
    assert_eq!(orphans.len(), 1);
    assert_eq!(orphans[0], orphan_path.to_string_lossy());

    let deleted = db.cleanup_orphan_assets(&orphans).unwrap();
    assert_eq!(deleted, 1);
    assert!(!orphan_path.exists());
    assert!(db.assets_dir.join(format!("{}.png", valid_id)).exists());

    let _ = std::fs::remove_dir_all(dir);
}

// ─── Test: delete_asset ───────────────────────────────────────────────────────

#[tokio::test]
async fn test_delete_asset() {
    use crate::database_manager::database::AssetJson;

    let dir = std::env::temp_dir().join(format!(
        "anql_delete_asset_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();

    let db = Database::new(dir.join("test.db").to_str().unwrap())
        .await
        .unwrap();

    let asset_id = "my-asset-id".to_string();
    let file_path = db.assets_dir.join(format!("{}.png", asset_id));

    // Create asset file on disk
    std::fs::write(&file_path, b"asset_data").unwrap();

    let asset = AssetJson {
        id: asset_id.clone(),
        name: "test.png".to_string(),
        mime_type: Some("image/png".to_string()),
        file_path: file_path.to_string_lossy().to_string(),
        created_at: 1000,
    };

    // Insert into DB
    db.assets_operations.create_asset(&asset).await.unwrap();

    // Check exists
    assert!(file_path.exists());
    let fetched = db
        .assets_operations
        .get_asset(asset_id.clone())
        .await
        .unwrap();
    assert_eq!(fetched.id, asset_id);

    // Delete
    let deleted = db
        .assets_operations
        .delete_asset(asset_id.clone())
        .await
        .unwrap();
    assert!(deleted);

    // Check removed from DB
    assert!(db.assets_operations.get_asset(asset_id).await.is_err());

    // Check file removed
    assert!(!file_path.exists());

    let _ = std::fs::remove_dir_all(dir);
}
