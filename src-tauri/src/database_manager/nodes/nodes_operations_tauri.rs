use crate::database_manager::database::NodeJson;
use crate::database_manager::database::NodeHash;
use crate::database_manager::database_tauri::AppState;
use anyhow::Result;
use tauri::State;

#[tauri::command]
pub async fn get_hashes_by_document_id(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Vec<NodeHash>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_hashes_by_document_id(document_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn new_node(state: State<'_, AppState>, node: NodeJson) -> Result<String, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .new_node(&node)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_node(state: State<'_, AppState>, node: NodeJson) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .update_node(&node)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_node_content(
    state: State<'_, AppState>,
    id: String,
    new_content: String,
    new_full_text: String,
    updated_at: i64,
) -> Result<Option<String>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .update_node_content(id, new_content, new_full_text, updated_at)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_node_position(
    state: State<'_, AppState>,
    id: String,
    new_position: String,
    new_content: String,
    updated_at: i64,
) -> Result<Option<String>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .update_node_position(id, new_position, new_content, updated_at)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_node_document_id(
    state: State<'_, AppState>,
    id: String,
    new_document_id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .update_node_document_id(id, new_document_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_node_type(
    state: State<'_, AppState>,
    id: String,
    node_type: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .update_node_type(id, node_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_node(state: State<'_, AppState>, id: String) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .delete_node(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_node_by_document_id(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .delete_node_by_document_id(document_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_checksum(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_checksum(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_node_by_id(state: State<'_, AppState>, id: String) -> Result<NodeJson, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_node_by_id(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_nodes_by_document_id(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Vec<NodeJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_nodes_by_document_id(document_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_document_id(
    state: State<'_, AppState>,
    node_id: String,
) -> Result<String, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_document_id(node_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_nodes_by_node_type(
    state: State<'_, AppState>,
    node_type: String,
) -> Result<Vec<NodeJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_nodes_by_node_type(node_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compute_hashes_batch(contents: Vec<String>) -> Result<Vec<String>, String> {
    use sha2::{Digest, Sha256};

    let mut hashes = Vec::with_capacity(contents.len());
    for content in contents {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        hashes.push(format!("{:x}", hasher.finalize()));
    }

    Ok(hashes)
}

#[tauri::command]
pub async fn get_node_metadata(
    state: State<'_, AppState>,
    id: String,
) -> Result<Option<String>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .get_node_metadata(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_node_metadata(
    state: State<'_, AppState>,
    id: String,
    metadata: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .set_node_metadata(id, metadata)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_node_metadata(
    state: State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.nodes_operations
        .remove_node_metadata(id)
        .await
        .map_err(|e| e.to_string())
}
