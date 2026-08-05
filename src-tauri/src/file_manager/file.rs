use rfd::FileDialog;
use std::{fs, path::PathBuf};

#[tauri::command]
pub async fn write_file(path: String, contents: String) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    // Create parent directory if it doesn't exist
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Write file
    fs::write(&path, contents).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_file_dialog() -> String {
    let dir = PathBuf::from("/");
    let file_dialog_res = FileDialog::new().set_directory(dir).pick_file();

    if let Some(file_handle) = file_dialog_res {
        let path = Some(file_handle.to_str().unwrap().to_string());
        return path.unwrap();
    } else {
        return "".to_string();
    }
}

#[tauri::command]
pub fn read_file(path: String) -> String {
    return fs::read_to_string(PathBuf::from(path)).unwrap();
}
