use crate::database_manager::database::DocumentsJson;
use crate::database_manager::database_tauri::AppState;
use anyhow::Result;

// remember to call `.manage(MyState::default())`
#[tauri::command]
pub async fn new_document(
    state: tauri::State<'_, AppState>,
    document: DocumentsJson,
) -> Result<String, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .new_document(&document)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_document(
    state: tauri::State<'_, AppState>,
    document: DocumentsJson,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .update_document(&document)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_document_path(
    state: tauri::State<'_, AppState>,
    id: String,
    path: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .update_document_path(id, path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_document_title(
    state: tauri::State<'_, AppState>,
    id: String,
    title: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .update_document_title(id, title)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_document_workspace_id(
    state: tauri::State<'_, AppState>,
    document_id: String,
    workspace_id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .update_document_workspace_id(document_id, workspace_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_document_timestamp(
    state: tauri::State<'_, AppState>,
    id: String,
    updated_at: i64,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .update_document_timestamp(id, updated_at)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_document(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .delete_document(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_documents_by_path(
    state: tauri::State<'_, AppState>,
    path: String,
) -> Result<Vec<DocumentsJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .get_documents_by_path(path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_documents_by_workspace_id(
    state: tauri::State<'_, AppState>,
    workspace_id: String,
) -> Result<Vec<DocumentsJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .get_documents_by_workspace_id(workspace_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_document_by_id(
    state: tauri::State<'_, AppState>,
    document_id: String,
) -> Result<DocumentsJson, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .get_document_by_id(document_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_document_metadata(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .get_document_metadata(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_document_metadata(
    state: tauri::State<'_, AppState>,
    id: String,
    metadata: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .set_document_metadata(id, metadata)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_document_metadata(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.documents_operations
        .remove_document_metadata(id)
        .await
        .map_err(|e| e.to_string())
}
