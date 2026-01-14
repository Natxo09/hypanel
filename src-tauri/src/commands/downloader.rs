use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter, Manager};
use zip::ZipArchive;

const DOWNLOADER_URL: &str = "https://downloader.hytale.com/hytale-downloader.zip";

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallCliResult {
    pub success: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerFilesStatus {
    pub exists: bool,
    pub has_server_jar: bool,
    pub has_assets: bool,
    pub server_path: Option<String>,
}

/// Get the hytale-downloader executable name based on OS
fn get_downloader_executable() -> &'static str {
    if cfg!(target_os = "windows") {
        "hytale-downloader-windows-amd64.exe"
    } else if cfg!(target_os = "macos") {
        "hytale-downloader-darwin-amd64"
    } else {
        "hytale-downloader-linux-amd64"
    }
}

/// Get the app's data directory for storing the CLI
fn get_cli_directory(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok()
}

/// Find hytale-downloader in app directory or PATH
fn find_downloader_with_app(app: Option<&AppHandle>) -> Option<String> {
    let exe_name = get_downloader_executable();

    // First check app data directory if app handle is provided
    if let Some(app) = app {
        if let Some(app_dir) = get_cli_directory(app) {
            let cli_path = app_dir.join(exe_name);
            if cli_path.exists() {
                return Some(cli_path.to_string_lossy().to_string());
            }
        }
    }

    // Then check PATH
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };

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
/// This only checks if the executable exists, doesn't run any commands
#[tauri::command]
pub fn get_downloader_info(app: AppHandle) -> DownloaderInfo {
    let path = find_downloader_with_app(Some(&app));

    if path.is_none() {
        return DownloaderInfo {
            available: false,
            cli_version: None,
            game_version: None,
            path: None,
            error: None,
        };
    }

    // Just return that it's available, don't execute commands here
    // to avoid blocking the UI
    DownloaderInfo {
        available: true,
        cli_version: None,
        game_version: None,
        path,
        error: None,
    }
}

/// Get CLI and game version (call this separately, it runs commands)
#[tauri::command]
pub async fn get_downloader_version(app: AppHandle) -> DownloaderInfo {
    let path = match find_downloader_with_app(Some(&app)) {
        Some(p) => p,
        None => {
            return DownloaderInfo {
                available: false,
                cli_version: None,
                game_version: None,
                path: None,
                error: None,
            };
        }
    };

    // Run version commands in async context
    let downloader_path = path.clone();

    let cli_version = tokio::task::spawn_blocking({
        let dp = downloader_path.clone();
        move || {
            Command::new(&dp)
                .arg("-version")
                .output()
                .ok()
                .and_then(|output| {
                    if output.status.success() {
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
                    } else {
                        None
                    }
                })
        }
    }).await.ok().flatten();

    let game_version = tokio::task::spawn_blocking({
        let dp = downloader_path.clone();
        move || {
            Command::new(&dp)
                .arg("-print-version")
                .output()
                .ok()
                .and_then(|output| {
                    if output.status.success() {
                        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
                    } else {
                        None
                    }
                })
        }
    }).await.ok().flatten();

    DownloaderInfo {
        available: true,
        cli_version,
        game_version,
        path: Some(path),
        error: None,
    }
}

/// Download and install the hytale-downloader CLI
#[tauri::command]
pub async fn install_downloader_cli(app: AppHandle) -> InstallCliResult {
    println!("[CLI Install] Starting installation...");

    // Get app data directory
    let app_dir = match get_cli_directory(&app) {
        Some(dir) => {
            println!("[CLI Install] App directory: {:?}", dir);
            dir
        }
        None => {
            println!("[CLI Install] ERROR: Could not determine app data directory");
            return InstallCliResult {
                success: false,
                path: None,
                error: Some("Could not determine app data directory".to_string()),
            };
        }
    };

    // Create directory if it doesn't exist
    if let Err(e) = fs::create_dir_all(&app_dir) {
        println!("[CLI Install] ERROR: Failed to create directory: {}", e);
        return InstallCliResult {
            success: false,
            path: None,
            error: Some(format!("Failed to create directory: {}", e)),
        };
    }

    let zip_path = app_dir.join("hytale-downloader.zip");
    println!("[CLI Install] Will download to: {:?}", zip_path);

    // Emit progress
    let _ = app.emit(
        "cli-install-progress",
        DownloadProgress {
            status: "downloading".to_string(),
            percentage: Some(0.0),
            message: "Downloading hytale-downloader...".to_string(),
        },
    );

    println!("[CLI Install] Creating HTTP client...");

    // Download the ZIP file
    let client = reqwest::Client::new();

    println!("[CLI Install] Sending request to: {}", DOWNLOADER_URL);
    let response = match client.get(DOWNLOADER_URL).send().await {
        Ok(r) => {
            println!("[CLI Install] Got response: {}", r.status());
            r
        }
        Err(e) => {
            println!("[CLI Install] ERROR: Failed to download: {}", e);
            return InstallCliResult {
                success: false,
                path: None,
                error: Some(format!("Failed to download: {}", e)),
            };
        }
    };

    if !response.status().is_success() {
        println!("[CLI Install] ERROR: Bad status: {}", response.status());
        return InstallCliResult {
            success: false,
            path: None,
            error: Some(format!("Download failed with status: {}", response.status())),
        };
    }

    let total_size = response.content_length().unwrap_or(0);
    println!("[CLI Install] Total size: {} bytes", total_size);
    let mut downloaded: u64 = 0;

    // Create file and download with progress
    let mut file = match File::create(&zip_path) {
        Ok(f) => {
            println!("[CLI Install] Created zip file");
            f
        }
        Err(e) => {
            println!("[CLI Install] ERROR: Failed to create file: {}", e);
            return InstallCliResult {
                success: false,
                path: None,
                error: Some(format!("Failed to create file: {}", e)),
            };
        }
    };

    println!("[CLI Install] Starting download stream...");
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = match chunk {
            Ok(c) => c,
            Err(e) => {
                println!("[CLI Install] ERROR: Download error: {}", e);
                return InstallCliResult {
                    success: false,
                    path: None,
                    error: Some(format!("Download error: {}", e)),
                };
            }
        };

        if let Err(e) = file.write_all(&chunk) {
            println!("[CLI Install] ERROR: Failed to write file: {}", e);
            return InstallCliResult {
                success: false,
                path: None,
                error: Some(format!("Failed to write file: {}", e)),
            };
        }

        downloaded += chunk.len() as u64;
        let percentage = if total_size > 0 {
            (downloaded as f32 / total_size as f32) * 100.0
        } else {
            0.0
        };

        // Only emit every 10%
        if (percentage as u32) % 10 == 0 {
            let _ = app.emit(
                "cli-install-progress",
                DownloadProgress {
                    status: "downloading".to_string(),
                    percentage: Some(percentage),
                    message: format!(
                        "Downloading... {:.1} MB / {:.1} MB",
                        downloaded as f64 / 1_000_000.0,
                        total_size as f64 / 1_000_000.0
                    ),
                },
            );
        }
    }

    println!("[CLI Install] Download complete, {} bytes", downloaded);
    drop(file);

    // Emit extracting status
    let _ = app.emit(
        "cli-install-progress",
        DownloadProgress {
            status: "extracting".to_string(),
            percentage: Some(100.0),
            message: "Extracting files...".to_string(),
        },
    );

    println!("[CLI Install] Opening zip file for extraction...");

    // Extract the ZIP file
    let zip_file = match File::open(&zip_path) {
        Ok(f) => f,
        Err(e) => {
            println!("[CLI Install] ERROR: Failed to open zip: {}", e);
            return InstallCliResult {
                success: false,
                path: None,
                error: Some(format!("Failed to open zip: {}", e)),
            };
        }
    };

    let mut archive = match ZipArchive::new(zip_file) {
        Ok(a) => {
            println!("[CLI Install] Zip archive has {} files", a.len());
            a
        }
        Err(e) => {
            println!("[CLI Install] ERROR: Failed to read zip: {}", e);
            return InstallCliResult {
                success: false,
                path: None,
                error: Some(format!("Failed to read zip: {}", e)),
            };
        }
    };

    // Extract all files
    println!("[CLI Install] Extracting files...");
    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                println!("[CLI Install] ERROR: Failed to read zip entry {}: {}", i, e);
                return InstallCliResult {
                    success: false,
                    path: None,
                    error: Some(format!("Failed to read zip entry: {}", e)),
                };
            }
        };

        let outpath = match file.enclosed_name() {
            Some(path) => app_dir.join(path),
            None => continue,
        };

        println!("[CLI Install] Extracting: {:?}", outpath);

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = match File::create(&outpath) {
                Ok(f) => f,
                Err(e) => {
                    println!("[CLI Install] ERROR: Failed to create file {:?}: {}", outpath, e);
                    return InstallCliResult {
                        success: false,
                        path: None,
                        error: Some(format!("Failed to create file: {}", e)),
                    };
                }
            };
            if let Err(e) = std::io::copy(&mut file, &mut outfile) {
                println!("[CLI Install] ERROR: Failed to extract file: {}", e);
                return InstallCliResult {
                    success: false,
                    path: None,
                    error: Some(format!("Failed to extract file: {}", e)),
                };
            }

            // Set executable permissions on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = outfile.metadata() {
                    let mut perms = metadata.permissions();
                    perms.set_mode(0o755);
                    fs::set_permissions(&outpath, perms).ok();
                }
            }
        }
    }

    println!("[CLI Install] Extraction complete, cleaning up zip...");

    // Clean up zip file
    fs::remove_file(&zip_path).ok();

    // Verify the executable exists
    let exe_name = get_downloader_executable();
    let exe_path = app_dir.join(exe_name);

    println!("[CLI Install] Looking for executable: {:?}", exe_path);

    if exe_path.exists() {
        println!("[CLI Install] SUCCESS! Executable found at: {:?}", exe_path);
        let _ = app.emit(
            "cli-install-progress",
            DownloadProgress {
                status: "completed".to_string(),
                percentage: Some(100.0),
                message: "Installation complete!".to_string(),
            },
        );

        InstallCliResult {
            success: true,
            path: Some(exe_path.to_string_lossy().to_string()),
            error: None,
        }
    } else {
        println!("[CLI Install] ERROR: Executable not found: {}", exe_name);
        // List what files ARE in the directory
        if let Ok(entries) = fs::read_dir(&app_dir) {
            println!("[CLI Install] Files in app_dir:");
            for entry in entries.flatten() {
                println!("[CLI Install]   - {:?}", entry.path());
            }
        }

        InstallCliResult {
            success: false,
            path: None,
            error: Some(format!("Executable not found after extraction: {}", exe_name)),
        }
    }
}

/// Check for hytale-downloader updates
#[tauri::command]
pub fn check_downloader_update(app: AppHandle) -> Result<String, String> {
    let path = find_downloader_with_app(Some(&app)).ok_or("hytale-downloader not found")?;

    let output = Command::new(&path)
        .arg("-check-update")
        .output()
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Download server files using hytale-downloader CLI
#[tauri::command]
pub async fn download_server_files(
    app: AppHandle,
    destination: String,
    patchline: Option<String>,
) -> DownloadResult {
    println!("[download_server_files] Starting download to: {}", destination);

    let path = match find_downloader_with_app(Some(&app)) {
        Some(p) => {
            println!("[download_server_files] Using CLI at: {}", p);
            p
        }
        None => {
            println!("[download_server_files] ERROR: CLI not found");
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some("hytale-downloader not installed. Please install it first.".to_string()),
            };
        }
    };

    // Create destination directory if it doesn't exist
    let dest_path = std::path::Path::new(&destination);
    if !dest_path.exists() {
        if let Err(e) = std::fs::create_dir_all(dest_path) {
            println!("[download_server_files] ERROR: Failed to create destination directory: {}", e);
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some(format!("Failed to create destination directory: {}", e)),
            };
        }
        println!("[download_server_files] Created destination directory: {}", destination);
    }

    // Download the zip INSIDE the destination folder (not next to it)
    let zip_path = dest_path.join("server_download.zip").to_string_lossy().to_string();

    // Build command arguments
    let mut args = vec!["-download-path".to_string(), zip_path.clone()];

    if let Some(ref pl) = patchline {
        args.push("-patchline".to_string());
        args.push(pl.clone());
    }

    println!("[download_server_files] Command: {} {:?}", path, args);

    // Emit starting event
    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            status: "starting".to_string(),
            percentage: Some(0.0),
            message: "Initializing download...".to_string(),
        },
    );

    // Start the download process
    // Set current_dir to the CLI's directory so credentials and temp files stay there
    let cli_path = std::path::Path::new(&path);
    let cli_dir = cli_path.parent().unwrap_or(std::path::Path::new("."));

    println!("[download_server_files] Setting working directory to CLI folder: {:?}", cli_dir);

    let mut child = match Command::new(&path)
        .args(&args)
        .current_dir(cli_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => {
            println!("[download_server_files] Process spawned successfully");
            c
        }
        Err(e) => {
            println!("[download_server_files] ERROR: Failed to spawn: {}", e);
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    status: "error".to_string(),
                    percentage: None,
                    message: format!("Failed to start download: {}", e),
                },
            );
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
            println!("[download_server_files] STDOUT: {}", line);
            let progress = parse_download_progress(&line);
            let _ = app_clone.emit("download-progress", progress);
        }
    }

    // Also read stderr
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines().map_while(Result::ok) {
            println!("[download_server_files] STDERR: {}", line);
        }
    }

    // Wait for process to complete
    println!("[download_server_files] Waiting for process to complete...");
    let status = match child.wait() {
        Ok(s) => s,
        Err(e) => {
            let error_msg = format!("Failed to wait for download: {}", e);
            println!("[download_server_files] ERROR: {}", error_msg);
            let _ = app.emit(
                "download-progress",
                DownloadProgress {
                    status: "error".to_string(),
                    percentage: None,
                    message: error_msg.clone(),
                },
            );
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some(error_msg),
            };
        }
    };

    println!("[download_server_files] Process exited with: {:?}", status);

    if !status.success() {
        let error_msg = format!("Download failed with exit code: {:?}", status.code());
        println!("[download_server_files] ERROR: {}", error_msg);
        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                status: "error".to_string(),
                percentage: None,
                message: error_msg.clone(),
            },
        );
        return DownloadResult {
            success: false,
            output_path: None,
            error: Some(error_msg),
        };
    }

    // Check if zip file exists
    let zip_path_buf = std::path::Path::new(&zip_path);
    if !zip_path_buf.exists() {
        let error_msg = format!("Downloaded file not found: {}", zip_path);
        println!("[download_server_files] ERROR: {}", error_msg);
        return DownloadResult {
            success: false,
            output_path: None,
            error: Some(error_msg),
        };
    }

    println!("[download_server_files] Zip file downloaded: {}", zip_path);

    // Emit extracting status
    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            status: "extracting".to_string(),
            percentage: Some(100.0),
            message: "Extracting server files...".to_string(),
        },
    );

    // Create destination directory
    let dest_path = std::path::Path::new(&destination);
    if let Err(e) = fs::create_dir_all(dest_path) {
        let error_msg = format!("Failed to create destination directory: {}", e);
        println!("[download_server_files] ERROR: {}", error_msg);
        return DownloadResult {
            success: false,
            output_path: None,
            error: Some(error_msg),
        };
    }

    // Extract the zip file
    println!("[download_server_files] Extracting zip to: {}", destination);
    let zip_file = match File::open(&zip_path) {
        Ok(f) => f,
        Err(e) => {
            let error_msg = format!("Failed to open zip file: {}", e);
            println!("[download_server_files] ERROR: {}", error_msg);
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some(error_msg),
            };
        }
    };

    let mut archive = match ZipArchive::new(zip_file) {
        Ok(a) => {
            println!("[download_server_files] Zip has {} files", a.len());
            a
        }
        Err(e) => {
            let error_msg = format!("Failed to read zip file: {}", e);
            println!("[download_server_files] ERROR: {}", error_msg);
            return DownloadResult {
                success: false,
                output_path: None,
                error: Some(error_msg),
            };
        }
    };

    // Extract all files
    for i in 0..archive.len() {
        let mut file = match archive.by_index(i) {
            Ok(f) => f,
            Err(e) => {
                println!("[download_server_files] WARNING: Failed to read zip entry {}: {}", i, e);
                continue;
            }
        };

        let outpath = match file.enclosed_name() {
            Some(path) => dest_path.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).ok();
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut outfile = match File::create(&outpath) {
                Ok(f) => f,
                Err(e) => {
                    println!("[download_server_files] WARNING: Failed to create {:?}: {}", outpath, e);
                    continue;
                }
            };
            if let Err(e) = std::io::copy(&mut file, &mut outfile) {
                println!("[download_server_files] WARNING: Failed to extract {:?}: {}", outpath, e);
            }
        }
    }

    // Clean up zip file
    println!("[download_server_files] Cleaning up zip file...");
    if let Err(e) = fs::remove_file(&zip_path) {
        println!("[download_server_files] WARNING: Failed to delete zip: {}", e);
    }

    // List files in destination
    println!("[download_server_files] Files in destination:");
    if let Ok(entries) = fs::read_dir(&destination) {
        for entry in entries.flatten() {
            println!("[download_server_files]   - {:?}", entry.path());
        }
    }

    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            status: "completed".to_string(),
            percentage: Some(100.0),
            message: "Download and extraction completed!".to_string(),
        },
    );

    DownloadResult {
        success: true,
        output_path: Some(destination),
        error: None,
    }
}

/// Parse download progress from CLI output
fn parse_download_progress(line: &str) -> DownloadProgress {
    let line_lower = line.to_lowercase();

    // Check for authorization code pattern
    // The CLI outputs something like "Authorization code: XXXX" or "code: XXXX"
    if let Some(code) = extract_auth_code(line) {
        let auth_url = format!("https://accounts.hytale.com/device?user_code={}", code);
        return DownloadProgress {
            status: "authenticating".to_string(),
            percentage: None,
            message: format!("AUTH_URL:{}", auth_url),
        };
    }

    // Try to extract percentage if present
    let percentage = if let Some(pct_idx) = line.find('%') {
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
    } else if line_lower.contains("auth") || line_lower.contains("waiting") {
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

/// Extract authorization code from CLI output
fn extract_auth_code(line: &str) -> Option<String> {
    // Look for patterns like "code: XXXX" or "Authorization code: XXXX"
    let line_lower = line.to_lowercase();

    if line_lower.contains("code:") || line_lower.contains("code :") {
        // Find the code after "code:"
        if let Some(idx) = line_lower.find("code") {
            let after_code = &line[idx..];
            // Skip "code:" or "code :"
            let code_start = after_code.find(':').map(|i| i + 1)?;
            let code_part = after_code[code_start..].trim();
            // Take the first word (the code)
            let code = code_part.split_whitespace().next()?;
            if !code.is_empty() && code.len() >= 4 {
                return Some(code.to_string());
            }
        }
    }

    None
}

/// Check if server files already exist in a directory
#[tauri::command]
pub fn check_server_files(path: String) -> ServerFilesStatus {
    println!("[check_server_files] Checking path: {}", path);

    let base_path = std::path::Path::new(&path);

    if !base_path.exists() {
        println!("[check_server_files] Path does not exist");
        return ServerFilesStatus {
            exists: false,
            has_server_jar: false,
            has_assets: false,
            server_path: None,
        };
    }

    // Check for Server/HytaleServer.jar
    let server_jar = base_path.join("Server").join("HytaleServer.jar");
    let has_server_jar = server_jar.exists();
    println!("[check_server_files] HytaleServer.jar exists: {}", has_server_jar);

    // Check for Assets.zip
    let assets_zip = base_path.join("Assets.zip");
    let has_assets = assets_zip.exists();
    println!("[check_server_files] Assets.zip exists: {}", has_assets);

    let exists = has_server_jar; // Server jar is the main indicator

    ServerFilesStatus {
        exists,
        has_server_jar,
        has_assets,
        server_path: if has_server_jar { Some(server_jar.to_string_lossy().to_string()) } else { None },
    }
}
