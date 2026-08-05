// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

pub mod database_manager;
pub mod file_manager;

use database_manager::nodes::nodes_operations_tauri::{
    compute_hashes_batch, delete_node, delete_node_by_document_id, get_checksum, get_document_id,
    get_hashes_by_document_id, get_node_by_id, get_nodes_by_document_id, get_nodes_by_node_type,
    new_node, update_node, update_node_content, update_node_document_id, update_node_position,
    update_node_type,
};

use database_manager::documents::documents_operations_tauri::{
    delete_document, get_document_by_id, get_documents_by_path, get_documents_by_workspace_id,
    new_document, update_document, update_document_path, update_document_timestamp,
    update_document_title, update_document_workspace_id,
};

use database_manager::search::search_operations_tauri::{
    fuzzy_search_nodes, fuzzy_search_nodes_with_snippets, search_nodes_fts,
    search_nodes_fts_with_snippets, similarity_search_nodes, verify_and_recreate_indexes,
};

use database_manager::recent_documents::recent_documents_tauri::{
    add_recent_document, clear_recent_documents, get_recent_document, get_recent_documents,
    remove_recent_document, update_last_focused_node,
};

use database_manager::assets::assets_operations_tauri::{
    add_pending_asset_deletion, cleanup_old_pending_deletions, cleanup_unused_assets,
    clear_pending_asset_deletions, create_asset, delete_asset, get_asset,
    get_pending_asset_deletions, get_unused_assets, remove_pending_asset_deletion,
};

use database_manager::database_tauri::{
    AppState, check_orphan_assets, check_unauthorized_tables, cleanup_database,
    cleanup_orphan_assets, init_db, quick_check_db,
};

use file_manager::archive::{export_to_zip, import_from_zip};
use file_manager::file::{open_file_dialog, read_file, write_file};

#[tauri::command]
fn greet(name: &str) -> String {
    return format!("Hello, {}! You've been greeted from Rust!", name);
}

#[tauri::command]
fn is_debug_mode() -> bool {
    tauri::is_dev()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // 🛠️ ESSENTIAL ADDITIONS FOR TAURI V2: Initialization of plugins required by the v2 ecosystem
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_clipboard_x::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            greet,
            is_debug_mode,
            write_file,
            read_file,
            open_file_dialog,
            export_to_zip,
            import_from_zip,
            init_db,
            cleanup_database,
            check_unauthorized_tables,
            check_orphan_assets,
            cleanup_orphan_assets,
            quick_check_db,
            new_node,
            update_node,
            update_node_content,
            update_node_position,
            update_node_document_id,
            update_node_type,
            delete_node,
            delete_node_by_document_id,
            get_checksum,
            get_node_by_id,
            get_nodes_by_document_id,
            get_hashes_by_document_id,
            get_document_id,
            get_nodes_by_node_type,
            compute_hashes_batch,
            new_document,
            update_document,
            update_document_path,
            update_document_timestamp,
            update_document_title,
            update_document_workspace_id,
            delete_document,
            get_documents_by_path,
            get_documents_by_workspace_id,
            get_document_by_id,
            search_nodes_fts,
            search_nodes_fts_with_snippets,
            fuzzy_search_nodes,
            fuzzy_search_nodes_with_snippets,
            similarity_search_nodes,
            verify_and_recreate_indexes,
            add_recent_document,
            get_recent_documents,
            remove_recent_document,
            clear_recent_documents,
            update_last_focused_node,
            get_recent_document,
            create_asset,
            get_asset,
            delete_asset,
            add_pending_asset_deletion,
            remove_pending_asset_deletion,
            get_pending_asset_deletions,
            clear_pending_asset_deletions,
            cleanup_old_pending_deletions,
            cleanup_unused_assets,
            get_unused_assets
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
