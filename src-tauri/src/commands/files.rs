use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize)]
pub struct CopyResult {
    pub success: bool,
    pub files_copied: u32,
    pub destination: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloaderStatus {
    pub available: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

/// Copies server files from Hytale launcher to destination folder
#[tauri::command]
pub fn copy_server_files(source: String, destination: String) -> CopyResult {
    let source_path = Path::new(&source);
    let dest_path = Path::new(&destination);

    // Validate source exists
    if !source_path.exists() {
        return CopyResult {
            success: false,
            files_copied: 0,
            destination,
            error: Some("Source path does not exist".to_string()),
        };
    }

    // Create destination if it doesn't exist
    if let Err(e) = fs::create_dir_all(dest_path) {
        return CopyResult {
            success: false,
            files_copied: 0,
            destination,
            error: Some(format!("Failed to create destination directory: {}", e)),
        };
    }

    let mut files_copied = 0;

    // Copy Server directory
    let server_src = source_path.join("Server");
    let server_dest = dest_path.join("Server");
    if server_src.exists() {
        match copy_dir_recursive(&server_src, &server_dest) {
            Ok(count) => files_copied += count,
            Err(e) => {
                return CopyResult {
                    success: false,
                    files_copied,
                    destination,
                    error: Some(format!("Failed to copy Server directory: {}", e)),
                };
            }
        }
    }

    // Copy Assets.zip
    let assets_src = source_path.join("Assets.zip");
    let assets_dest = dest_path.join("Assets.zip");
    if assets_src.exists() {
        if let Err(e) = fs::copy(&assets_src, &assets_dest) {
            return CopyResult {
                success: false,
                files_copied,
                destination,
                error: Some(format!("Failed to copy Assets.zip: {}", e)),
            };
        }
        files_copied += 1;
    }

    CopyResult {
        success: true,
        files_copied,
        destination,
        error: None,
    }
}

/// Recursively copies a directory
fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<u32, std::io::Error> {
    let mut count = 0;
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if file_type.is_dir() {
            count += copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            fs::copy(&src_path, &dest_path)?;
            count += 1;
        }
    }

    Ok(count)
}

/// Checks if hytale-downloader CLI is available in PATH
#[tauri::command]
pub fn check_downloader() -> DownloaderStatus {
    // Try to find hytale-downloader in PATH
    let output = if cfg!(target_os = "windows") {
        std::process::Command::new("where")
            .arg("hytale-downloader")
            .output()
    } else {
        std::process::Command::new("which")
            .arg("hytale-downloader")
            .output()
    };

    match output {
        Ok(output) => {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_string();

                DownloaderStatus {
                    available: !path.is_empty(),
                    path: if path.is_empty() { None } else { Some(path) },
                    error: None,
                }
            } else {
                DownloaderStatus {
                    available: false,
                    path: None,
                    error: None,
                }
            }
        }
        Err(e) => DownloaderStatus {
            available: false,
            path: None,
            error: Some(format!("Failed to check for downloader: {}", e)),
        },
    }
}

/// Creates a new server instance directory structure
#[tauri::command]
pub fn create_instance(path: String, name: String) -> Result<String, String> {
    let instance_path = Path::new(&path).join(&name);

    // Create instance directory
    fs::create_dir_all(&instance_path)
        .map_err(|e| format!("Failed to create instance directory: {}", e))?;

    // Create subdirectories
    let dirs = ["universe", "mods", "logs"];
    for dir in dirs {
        fs::create_dir_all(instance_path.join(dir))
            .map_err(|e| format!("Failed to create {} directory: {}", dir, e))?;
    }

    Ok(instance_path.to_string_lossy().to_string())
}

/// Validates that a path contains valid server files
#[tauri::command]
pub fn validate_server_files(path: String) -> bool {
    let base = Path::new(&path);
    let server_exists = base.join("Server").exists();
    let assets_exists = base.join("Assets.zip").exists();

    server_exists && assets_exists
}
