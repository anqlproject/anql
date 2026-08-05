use crate::database_manager::database_tauri::AppState;
use crate::database_manager::recent_documents::RecentDocumentJson;
use anyhow::Result;

#[tauri::command]
pub async fn add_recent_document(
    state: tauri::State<'_, AppState>,
    id: String,
    last_focused_node_id: String,
) -> Result<(), String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.recent_documents_operations
        .add_recent_document(id, last_focused_node_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_documents(
    state: tauri::State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<RecentDocumentJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.recent_documents_operations
        .get_recent_documents(limit)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_recent_document(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.recent_documents_operations
        .remove_recent_document(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_recent_documents(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.recent_documents_operations
        .clear_recent_documents()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_last_focused_node(
    state: tauri::State<'_, AppState>,
    id: String,
    node_id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.recent_documents_operations
        .update_last_focused_node(id, node_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_recent_document(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<RecentDocumentJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.recent_documents_operations
        .get_recent_document(id)
        .await
        .map_err(|e| e.to_string())
}
