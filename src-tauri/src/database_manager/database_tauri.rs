use crate::database_manager::database::Database;
use anyhow::Result;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;

pub struct AppState {
    pub db: RwLock<Option<Arc<Database>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            db: RwLock::new(None),
        }
    }
}

pub async fn get_db(state: &AppState) -> Result<Arc<Database>, String> {
    state
        .db
        .read()
        .await
        .clone()
        .ok_or_else(|| "Database not initialized".to_string())
}

#[tauri::command]
pub async fn init_db(state: State<'_, AppState>, db_path: String) -> Result<(), String> {
    let db = Database::new(&db_path).await.map_err(|e| e.to_string())?;

    *state.db.write().await = Some(Arc::new(db));
    Ok(())
}

#[tauri::command]
pub async fn check_unauthorized_tables(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let db = get_db(&state).await?;

    db.check_unauthorized_tables()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn cleanup_database(
    state: State<'_, AppState>,
    unauthorized_tables: Vec<String>,
) -> Result<(), String> {
    let db = get_db(&state).await?;

    db.cleanup_database(unauthorized_tables)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Scan the assets directory and return file paths whose ID is not in the assets table.
#[tauri::command]
pub async fn check_orphan_assets(state: State<'_, AppState>, assets_path: String) -> Result<Vec<String>, String> {
    let db = get_db(&state).await?;

    db.check_orphan_assets(&assets_path)
        .await
        .map_err(|e| e.to_string())
}

/// Delete orphan asset files from disk.
#[tauri::command]
pub async fn cleanup_orphan_assets(
    state: State<'_, AppState>,
    orphan_paths: Vec<String>,
) -> Result<usize, String> {
    let db = get_db(&state).await?;

    db.cleanup_orphan_assets(&orphan_paths)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn quick_check_db(state: State<'_, AppState>) -> Result<(), String> {
    let db = get_db(&state).await?;
    db.quick_check().await.map_err(|e| e.to_string())
}
