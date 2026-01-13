use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloaderInfo {
    pub available: bool,
    pub cli_version: Option<String>,
    pub game_version: Option<String>,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub status: String,
    pub percentage: Option<f32>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadResult {
    pub success: bool,
    pub output_path: Option<String>,
    pub error: Option<String>,
}

/// Get the hytale-downloader executable name based on OS
fn get_downloader_executable() -> &'static str {
    if cfg!(target_os = "windows") {
        "hytale-downloader.exe"
    } else {
        "hytale-downloader"
    }
}

/// Find hytale-downloader in PATH or common locations
fn find_downloader() -> Option<String> {
    let exe_name = get_downloader_executable();

    // Try PATH first
    let which_cmd = if cfg!(target_os = "windows") { "where" } else { "which" };
    if let Ok(output) = Command::new(which_cmd).arg(exe_name).output() {
        if output.status.success() {
            if let Some(path) = String::from_utf8_lossy(&output.stdout).lines().next() {
                let path = path.trim().to_string();
                if !path.is_empty() {
                    return Some(path);
                }
            }
        }
    }

    None
}

/// Get detailed information about the hytale-downloader CLI
#[tauri::command]
pub fn get_downloader_info() -> DownloaderInfo {
    let path = find_downloader();

    if path.is_none() {
        return DownloaderInfo {
            available: false,
            cli_version: None,
            game_version: None,
            path: None,
            error: Some("hytale-downloader not found in PATH".to_string()),
        };
    }

    let downloader_path = path.clone().unwrap();

    // Get CLI version
    let cli_version = Command::new(&downloader_path)
        .arg("-version")
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        });

    // Get game version (without downloading)
    let game_version = Command::new(&downloader_path)
        .arg("-print-version")
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
            } else {
                None
            }
        });

    DownloaderInfo {
        available: true,
        cli_version,
        game_version,
        path,
        error: None,
    }
}

/// Check for hytale-downloader updates
#[tauri::command]
pub fn check_downloader_update() -> Result<String, String> {
    let path = find_downloader().ok_or("hytale-downloader not found")?;

    let output = Command::new(&path)
        .arg("-check-update")
        .output()
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Download server files using hytale-downloader CLI
/// Emits progress events to the frontend
#[tauri::command]
pub async fn download_server_files(
    app: AppHandle,
    destination: String,
    patchline: Option<String>,
) -> DownloadResult {
    let path = match find_downloader() {
        Some(p) => p,
        None => {
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some("hytale-downloader not found in PATH".to_string()),
            };
        }
    };

    // Build command arguments
    let mut args = vec![
        "-download-path".to_string(),
        destination.clone(),
    ];

    if let Some(pl) = patchline {
        args.push("-patchline".to_string());
        args.push(pl);
    }

    // Emit starting event
    let _ = app.emit("download-progress", DownloadProgress {
        status: "starting".to_string(),
        percentage: Some(0.0),
        message: "Initializing download...".to_string(),
    });

    // Start the download process
    let mut child = match Command::new(&path)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit("download-progress", DownloadProgress {
                status: "error".to_string(),
                percentage: None,
                message: format!("Failed to start download: {}", e),
            });
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some(format!("Failed to start downloader: {}", e)),
            };
        }
    };

    // Read stdout for progress
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let app_clone = app.clone();

        for line in reader.lines().map_while(Result::ok) {
            // Parse progress from output
            let progress = parse_download_progress(&line);
            let _ = app_clone.emit("download-progress", progress);
        }
    }

    // Wait for process to complete
    match child.wait() {
        Ok(status) => {
            if status.success() {
                let _ = app.emit("download-progress", DownloadProgress {
                    status: "completed".to_string(),
                    percentage: Some(100.0),
                    message: "Download completed successfully!".to_string(),
                });
                DownloadResult {
                    success: true,
                    output_path: Some(destination),
                    error: None,
                }
            } else {
                let error_msg = format!("Download failed with exit code: {:?}", status.code());
                let _ = app.emit("download-progress", DownloadProgress {
                    status: "error".to_string(),
                    percentage: None,
                    message: error_msg.clone(),
                });
                DownloadResult {
                    success: false,
                    output_path: None,
                    error: Some(error_msg),
                }
            }
        }
        Err(e) => {
            let error_msg = format!("Failed to wait for download: {}", e);
            let _ = app.emit("download-progress", DownloadProgress {
                status: "error".to_string(),
                percentage: None,
                message: error_msg.clone(),
            });
            DownloadResult {
                success: false,
                output_path: None,
                error: Some(error_msg),
            }
        }
    }
}

/// Parse download progress from CLI output
fn parse_download_progress(line: &str) -> DownloadProgress {
    let line_lower = line.to_lowercase();

    // Try to extract percentage if present
    let percentage = if let Some(pct_idx) = line.find('%') {
        // Look backwards for the number
        let before = &line[..pct_idx];
        before
            .chars()
            .rev()
            .take_while(|c| c.is_ascii_digit() || *c == '.')
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>()
            .parse::<f32>()
            .ok()
    } else {
        None
    };

    // Determine status based on content
    let status = if line_lower.contains("error") || line_lower.contains("failed") {
        "error"
    } else if line_lower.contains("complete") || line_lower.contains("done") {
        "completed"
    } else if line_lower.contains("download") || percentage.is_some() {
        "downloading"
    } else if line_lower.contains("auth") {
        "authenticating"
    } else {
        "progress"
    };

    DownloadProgress {
        status: status.to_string(),
        percentage,
        message: line.to_string(),
    }
}
