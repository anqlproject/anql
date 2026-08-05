use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use tauri::State;
use uuid::Uuid;
use zip::write::FileOptions;

use crate::database_manager::database::AssetJson;
use crate::database_manager::database_tauri::{get_db, AppState};

#[derive(serde::Serialize)]
pub struct ImportResult {
    pub content: String,
    pub extension: String,
    pub title: String,
}

#[tauri::command]
pub async fn export_to_zip(
    state: State<'_, AppState>,
    destination_path: String,
    content: String,
    extension: String,
    asset_ids: Vec<String>,
) -> Result<(), String> {
    let db = get_db(&state).await?;

    let file =
        File::create(&destination_path).map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // 1. Write the main document file
    let document_filename = format!("document.{}", extension);
    zip.start_file(document_filename, options)
        .map_err(|e| format!("Failed to start document file in zip: {}", e))?;
    zip.write_all(content.as_bytes())
        .map_err(|e| format!("Failed to write document content to zip: {}", e))?;

    // 2. Write assets
    if !asset_ids.is_empty() {
        zip.add_directory("assets", options)
            .map_err(|e| format!("Failed to add assets directory to zip: {}", e))?;

        for asset_id in asset_ids {
            // Fetch asset from DB
            match db.assets_operations.get_asset(asset_id.clone()).await {
                Ok(asset) => {
                    // Read file from disk
                    if let Ok(mut asset_file) = File::open(&asset.file_path) {
                        let mut buffer = Vec::new();
                        if asset_file.read_to_end(&mut buffer).is_ok() {
                            // Extract extension from file_path or mime_type
                            let ext = Path::new(&asset.file_path)
                                .extension()
                                .and_then(|e| e.to_str())
                                .unwrap_or("bin");

                            let asset_filename = format!("assets/{}.{}", asset_id, ext);
                            if zip.start_file(&asset_filename, options).is_ok() {
                                let _ = zip.write_all(&buffer);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!(
                        "Warning: Failed to fetch asset {} for export: {}",
                        asset_id, e
                    );
                }
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finish zip file: {}", e))?;

    Ok(())
}

fn mime_from_ext(ext: &str) -> Option<String> {
    match ext.to_lowercase().as_str() {
        "png" => Some("image/png".to_string()),
        "jpg" | "jpeg" => Some("image/jpeg".to_string()),
        "gif" => Some("image/gif".to_string()),
        "webp" => Some("image/webp".to_string()),
        "svg" => Some("image/svg+xml".to_string()),
        "bmp" => Some("image/bmp".to_string()),
        "tiff" => Some("image/tiff".to_string()),
        "pdf" => Some("application/pdf".to_string()),
        _ => None,
    }
}

#[tauri::command]
pub async fn import_from_zip(
    state: State<'_, AppState>,
    zip_path: String,
) -> Result<ImportResult, String> {
    let db = get_db(&state).await?;

    let file = File::open(&zip_path).map_err(|e| format!("Failed to open zip file: {}", e))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("Failed to read zip archive: {}", e))?;

    let mut document_content = String::new();
    let mut extension = String::new();
    let title = Path::new(&zip_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Imported Document")
        .to_string();

    let mut asset_mappings = HashMap::new(); // old_id -> new_id

    // First pass: find the main document file
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        if file.is_dir() {
            continue;
        }

        let name = file.name().to_string();

        // Ensure it's not in a subfolder and is md or json
        if !name.contains('/') || name.starts_with("./") {
            let clean_name = name.trim_start_matches("./");
            if !clean_name.contains('/') {
                let lower_name = clean_name.to_lowercase();
                if lower_name.ends_with(".md")
                    || lower_name.ends_with(".markdown")
                    || lower_name.ends_with(".json")
                {
                    extension = Path::new(clean_name)
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("md")
                        .to_string();
                    // We don't overwrite the zip file title with "document", if it's named differently we can use it, but usually the zip filename is better for title.
                    file.read_to_string(&mut document_content)
                        .map_err(|e| format!("Failed to read document content: {}", e))?;
                    break;
                }
            }
        }
    }

    if document_content.is_empty() {
        return Err("No .md or .json file found at the root of the archive.".to_string());
    }

    // Second pass: extract assets
    for i in 0..archive.len() {
        let (name, buffer, is_dir) = {
            let mut file = archive.by_index(i).unwrap();
            let mut buffer = Vec::new();
            if !file.is_dir() {
                let _ = file.read_to_end(&mut buffer);
            }
            (file.name().to_string(), buffer, file.is_dir())
        };

        if is_dir {
            continue;
        }

        if name.starts_with("assets/") || name.starts_with("./assets/") {
            if !buffer.is_empty() {
                // Extract old ID from filename
                let path = Path::new(&name);
                if let Some(file_stem) = path.file_stem().and_then(|s| s.to_str()) {
                    let old_id = file_stem.to_string();
                    let new_id = Uuid::new_v4().to_string();

                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("bin");
                    let file_name = format!("{}.{}", new_id, ext);
                    let dest_path = db.assets_operations.assets_dir().join(&file_name);

                    if std::fs::write(&dest_path, &buffer).is_ok() {
                        // Insert into DB
                        let mime_type = mime_from_ext(ext);
                        let asset = AssetJson {
                            id: new_id.clone(),
                            name: format!("{}.{}", old_id, ext), // keep original name if useful
                            mime_type,
                            file_path: dest_path.to_string_lossy().to_string(),
                            created_at: std::time::SystemTime::now()
                                .duration_since(std::time::UNIX_EPOCH)
                                .unwrap()
                                .as_secs() as i64,
                        };

                        if db.assets_operations.create_asset(&asset).await.is_ok() {
                            asset_mappings.insert(old_id, new_id);
                        }
                    }
                }
            }
        }
    }

    // Third step: Replace asset UUIDs in content
    let mut final_content = document_content;
    for (old_id, new_id) in asset_mappings {
        // Regex replace is tricky in Rust without a regex crate, but simple string replacement works if we know the pattern
        // The frontend stores assets as asset://<uuid> or sometimes assets/<uuid>.ext (old format).
        // Let's replace both.

        let asset_protocol_old = format!("asset://{}", old_id);
        let asset_protocol_new = format!("asset://{}", new_id);
        final_content = final_content.replace(&asset_protocol_old, &asset_protocol_new);

        // Also handle old relative paths just in case (e.g. assets/<old_id>.png)
        // Since we don't know the exact string, we can just replace the UUID if it appears.
        // Doing a blind UUID replacement is safe because UUIDs are highly unique.
        final_content = final_content.replace(&old_id, &new_id);
    }

    Ok(ImportResult {
        content: final_content,
        extension,
        title,
    })
}
