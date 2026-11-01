use crate::database_manager::database_tauri::AppState;
use crate::database_manager::references::references_operations::ReferenceJson;

#[tauri::command]
pub async fn new_reference(
    state: tauri::State<'_, AppState>,
    reference: ReferenceJson,
) -> Result<String, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;
    db.references_operations
        .new_reference(&reference)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_reference(
    state: tauri::State<'_, AppState>,
    reference: ReferenceJson,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;
    db.references_operations
        .update_reference(&reference)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_reference(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;
    db.references_operations
        .delete_reference(id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_references(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<ReferenceJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;
    db.references_operations
        .get_all_references()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_reference_by_name(
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<Option<ReferenceJson>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;
    db.references_operations
        .get_reference_by_name(name)
        .await
        .map_err(|e| e.to_string())
}
