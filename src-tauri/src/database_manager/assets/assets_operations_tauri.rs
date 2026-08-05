use base64::{Engine as _, engine::general_purpose};
use crate::database_manager::database::AssetJson;
use crate::database_manager::database_tauri::AppState;

/// Helper: derive the MIME-based extension.
fn ext_from_mime(mime_type: Option<&str>) -> &'static str {
    match mime_type {
        Some("image/png")              => "png",
        Some("image/jpeg")             => "jpg",
        Some("image/gif")              => "gif",
        Some("image/webp")             => "webp",
        Some("image/svg+xml")          => "svg",
        Some("image/bmp")              => "bmp",
        Some("image/tiff")             => "tiff",
        Some("application/pdf")        => "pdf",
        _                              => "bin",
    }
}

/// Write an asset to disk and store its metadata in the DB.
///
/// Called from the frontend when inserting an image or PDF.
/// `base64_data` contains the base64 string of the file to be decoded in Rust.
#[tauri::command]
pub async fn create_asset(
    state: tauri::State<'_, AppState>,
    id: String,
    name: String,
    mime_type: Option<String>,
    base64_data: String,
) -> Result<(), String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    let data = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64 data: {}", e))?;

    // Build the destination path: <assets_dir>/<id>.<ext>
    let ext = ext_from_mime(mime_type.as_deref());
    let file_name = format!("{}.{}", id, ext);
    let file_path = db.assets_operations.assets_dir().join(&file_name);

    // Write bytes to disk
    std::fs::write(&file_path, &data)
        .map_err(|e| format!("Failed to write asset file '{}': {}", file_path.display(), e))?;

    let asset = AssetJson {
        id,
        name,
        mime_type,
        file_path: file_path.to_string_lossy().to_string(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64,
    };

    db.assets_operations
        .create_asset(&asset)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Return the asset metadata (including `file_path`) for the given UUID.
///
/// The frontend uses `convertFileSrc(file_path)` to build a displayable URL.
#[tauri::command]
pub async fn get_asset(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<AssetJson, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .get_asset(id)
        .await
        .map_err(|e| e.to_string())
}

/// Delete the asset record from the DB and remove the file from disk.
#[tauri::command]
pub async fn delete_asset(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .delete_asset(id)
        .await
        .map_err(|e| e.to_string())
}

/// Add an asset to pending deletion for a specific document.
#[tauri::command]
pub async fn add_pending_asset_deletion(
    state: tauri::State<'_, AppState>,
    asset_id: String,
    document_id: String,
) -> Result<(), String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .add_pending_deletion(asset_id, document_id)
        .await
        .map_err(|e| e.to_string())
}

/// Remove an asset from pending deletion for a specific document.
#[tauri::command]
pub async fn remove_pending_asset_deletion(
    state: tauri::State<'_, AppState>,
    asset_id: String,
    document_id: String,
) -> Result<(), String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .remove_pending_deletion(asset_id, document_id)
        .await
        .map_err(|e| e.to_string())
}

/// Get all pending deletions for a specific document.
#[tauri::command]
pub async fn get_pending_asset_deletions(
    state: tauri::State<'_, AppState>,
    document_id: String,
) -> Result<Vec<String>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .get_pending_deletions_by_document(document_id)
        .await
        .map_err(|e| e.to_string())
}

/// Clear all pending deletions for a specific document.
#[tauri::command]
pub async fn clear_pending_asset_deletions(
    state: tauri::State<'_, AppState>,
    document_id: String,
) -> Result<(), String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .clear_pending_deletions_by_document(document_id)
        .await
        .map_err(|e| e.to_string())
}

/// Delete all pending deletions older than a given timestamp.
#[tauri::command]
pub async fn cleanup_old_pending_deletions(
    state: tauri::State<'_, AppState>,
    older_than_secs: i64,
) -> Result<u64, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .cleanup_old_pending_deletions(older_than_secs)
        .await
        .map_err(|e| e.to_string())
}

/// Clean up assets that are no longer referenced in any node's content.
#[tauri::command]
pub async fn cleanup_unused_assets(
    state: tauri::State<'_, AppState>,
) -> Result<u64, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .cleanup_unused_assets()
        .await
        .map_err(|e| e.to_string())
}

/// Get a list of assets that are no longer referenced in any node's content.
#[tauri::command]
pub async fn get_unused_assets(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::database_manager::database::AssetJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.assets_operations
        .get_unused_assets()
        .await
        .map_err(|e| e.to_string())
}
