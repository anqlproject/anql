use crate::database_manager::database::SearchResult;
use crate::database_manager::database_tauri::AppState;
use anyhow::Result;
use tauri::State;

#[tauri::command]
pub async fn search_nodes_fts(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.search_operations
        .search_nodes_fts(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_nodes_fts_with_snippets(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<(SearchResult, String)>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.search_operations
        .search_nodes_fts_with_snippets(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fuzzy_search_nodes(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<(SearchResult, f64)>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.search_operations
        .fuzzy_search_nodes(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fuzzy_search_nodes_with_snippets(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<(SearchResult, String, f64)>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.search_operations
        .fuzzy_search_nodes_with_snippets(&query)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn similarity_search_nodes(
    state: State<'_, AppState>,
    query: String,
    threshold: f64,
) -> Result<Vec<(SearchResult, f64)>, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.search_operations
        .similarity_search_nodes(&query, threshold)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_and_recreate_indexes(state: State<'_, AppState>) -> Result<bool, String> {
    let db = crate::database_manager::database_tauri::get_db(&state).await?;

    db.search_operations
        .verify_and_recreate_indexes()
        .await
        .map_err(|e| e.to_string())
}
