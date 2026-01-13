use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct JavaInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub major_version: Option<u32>,
    pub vendor: Option<String>,
    pub is_valid: bool,
    pub java_path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemPaths {
    pub hytale_launcher_path: Option<String>,
    pub server_path: Option<String>,
    pub assets_path: Option<String>,
    pub exists: bool,
}

/// Detects Java installation and validates it's Java 25+
/// First checks PATH, then scans common installation directories
#[tauri::command]
pub async fn check_java() -> JavaInfo {
    println!("[check_java] Starting Java check...");

    // Run the blocking operations in a separate thread
    let result = tokio::task::spawn_blocking(|| {
        println!("[check_java] Checking default java in PATH...");

        // First, try the default java in PATH
        if let Some(info) = check_java_executable("java") {
            println!("[check_java] Found java in PATH, version: {:?}, valid: {}", info.version, info.is_valid);
            if info.is_valid {
                return info;
            }
        }

        println!("[check_java] Scanning for Java 25+ installations...");

        // If default java is not 25+, scan for Java 25+ installations
        if let Some(info) = find_java_25_installation() {
            println!("[check_java] Found Java 25+ at: {:?}", info.java_path);
            return info;
        }

        // Fall back to reporting whatever java is in PATH (even if < 25)
        if let Some(info) = check_java_executable("java") {
            println!("[check_java] Falling back to PATH java");
            return info;
        }

        println!("[check_java] No Java found");

        // No Java found at all
        JavaInfo {
            installed: false,
            version: None,
            major_version: None,
            vendor: None,
            is_valid: false,
            java_path: None,
            error: Some("Java not found. Please install Java 25 or higher.".to_string()),
        }
    }).await;

    match result {
        Ok(info) => {
            println!("[check_java] Done. Valid: {}", info.is_valid);
            info
        }
        Err(e) => {
            println!("[check_java] Error: {}", e);
            JavaInfo {
                installed: false,
                version: None,
                major_version: None,
                vendor: None,
                is_valid: false,
                java_path: None,
                error: Some(format!("Failed to check Java: {}", e)),
            }
        }
    }
}

/// Check a specific java executable and return its info
fn check_java_executable(java_path: &str) -> Option<JavaInfo> {
    let output = Command::new(java_path)
        .arg("--version")
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    // Java prints version to stdout or stderr depending on version
    let version_output = if stdout.is_empty() {
        stderr.to_string()
    } else {
        stdout.to_string()
    };

    if version_output.is_empty() {
        return None;
    }

    let lines: Vec<&str> = version_output.lines().collect();
    let first_line = lines.first().unwrap_or(&"");

    let version = extract_version(first_line);
    let major_version = version
        .as_ref()
        .and_then(|v| v.split('.').next().and_then(|s| s.parse::<u32>().ok()));

    let vendor = lines.get(1).map(|line| extract_vendor(line));

    let is_valid = major_version.map(|v| v >= 25).unwrap_or(false);

    Some(JavaInfo {
        installed: true,
        version,
        major_version,
        vendor,
        is_valid,
        java_path: Some(java_path.to_string()),
        error: if !is_valid {
            Some(format!(
                "Java 25 or higher is required. Found version: {}",
                major_version.unwrap_or(0)
            ))
        } else {
            None
        },
    })
}

/// Extract vendor name from java version output
fn extract_vendor(line: &str) -> String {
    if line.contains("Temurin") {
        "Eclipse Temurin (Adoptium)".to_string()
    } else if line.contains("Oracle") {
        "Oracle".to_string()
    } else if line.contains("GraalVM") {
        "GraalVM".to_string()
    } else if line.contains("Amazon") || line.contains("Corretto") {
        "Amazon Corretto".to_string()
    } else if line.contains("Azul") || line.contains("Zulu") {
        "Azul Zulu".to_string()
    } else if line.contains("OpenJDK") {
        "OpenJDK".to_string()
    } else {
        line.to_string()
    }
}

/// Scan common Java installation directories for Java 25+
fn find_java_25_installation() -> Option<JavaInfo> {
    let candidates = get_java_installation_paths();

    for candidate in candidates {
        if candidate.exists() {
            let java_exe = if cfg!(target_os = "windows") {
                candidate.join("bin").join("java.exe")
            } else {
                candidate.join("bin").join("java")
            };

            if java_exe.exists() {
                if let Some(info) = check_java_executable(java_exe.to_str()?) {
                    if info.is_valid {
                        return Some(JavaInfo {
                            java_path: Some(java_exe.to_string_lossy().to_string()),
                            ..info
                        });
                    }
                }
            }
        }
    }

    None
}

/// Get list of common Java installation directories to scan
fn get_java_installation_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // Common Windows installation paths
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let program_files_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());

        // Scan for Java 25+ in various locations
        for base in [&program_files, &program_files_x86] {
            let base_path = PathBuf::from(base);

            // Eclipse Adoptium / Temurin
            let adoptium_path = base_path.join("Eclipse Adoptium");
            if adoptium_path.exists() {
                if let Ok(entries) = std::fs::read_dir(&adoptium_path) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.starts_with("jdk-25") || name.starts_with("jdk-26") || name.starts_with("jdk-27") {
                            paths.push(entry.path());
                        }
                    }
                }
            }

            // Oracle Java
            let java_path = base_path.join("Java");
            if java_path.exists() {
                if let Ok(entries) = std::fs::read_dir(&java_path) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.starts_with("jdk-25") || name.starts_with("jdk-26") || name.starts_with("jdk-27") {
                            paths.push(entry.path());
                        }
                    }
                }
            }

            // Azul Zulu
            let zulu_path = base_path.join("Zulu");
            if zulu_path.exists() {
                if let Ok(entries) = std::fs::read_dir(&zulu_path) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.contains("25") || name.contains("26") || name.contains("27") {
                            paths.push(entry.path());
                        }
                    }
                }
            }

            // Amazon Corretto
            let corretto_path = base_path.join("Amazon Corretto");
            if corretto_path.exists() {
                if let Ok(entries) = std::fs::read_dir(&corretto_path) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.starts_with("jdk25") || name.starts_with("jdk26") || name.starts_with("jdk27") {
                            paths.push(entry.path());
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Common Linux paths
        let linux_paths = [
            "/usr/lib/jvm",
            "/opt/java",
            "/opt/jdk",
        ];

        for base in linux_paths {
            let base_path = PathBuf::from(base);
            if base_path.exists() {
                if let Ok(entries) = std::fs::read_dir(&base_path) {
                    for entry in entries.flatten() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.contains("25") || name.contains("26") || name.contains("27") {
                            paths.push(entry.path());
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // macOS Java installations
        let jvm_path = PathBuf::from("/Library/Java/JavaVirtualMachines");
        if jvm_path.exists() {
            if let Ok(entries) = std::fs::read_dir(&jvm_path) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.contains("25") || name.contains("26") || name.contains("27") {
                        // macOS JVMs have Contents/Home structure
                        paths.push(entry.path().join("Contents").join("Home"));
                    }
                }
            }
        }
    }

    paths
}

/// Extracts version number from java --version output
fn extract_version(line: &str) -> Option<String> {
    // Match patterns like "openjdk 25.0.1" or "java 25.0.1"
    let parts: Vec<&str> = line.split_whitespace().collect();
    for (i, part) in parts.iter().enumerate() {
        if *part == "openjdk" || *part == "java" {
            if let Some(version) = parts.get(i + 1) {
                // Check if it looks like a version number
                if version.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                    return Some(version.to_string());
                }
            }
        }
    }

    // Fallback: find first thing that looks like a version
    for part in parts {
        if part.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
           && part.contains('.') {
            return Some(part.to_string());
        }
    }

    None
}

/// Detects Hytale installation paths based on the operating system
#[tauri::command]
pub fn get_system_paths() -> SystemPaths {
    let launcher_path = get_hytale_launcher_path();

    if let Some(ref base_path) = launcher_path {
        let base = std::path::Path::new(base_path);
        let server_path = base.join("Server");
        let assets_path = base.join("Assets.zip");

        let server_exists = server_path.exists();
        let assets_exists = assets_path.exists();

        SystemPaths {
            hytale_launcher_path: launcher_path,
            server_path: if server_exists { Some(server_path.to_string_lossy().to_string()) } else { None },
            assets_path: if assets_exists { Some(assets_path.to_string_lossy().to_string()) } else { None },
            exists: server_exists && assets_exists,
        }
    } else {
        SystemPaths {
            hytale_launcher_path: None,
            server_path: None,
            assets_path: None,
            exists: false,
        }
    }
}

/// Gets the Hytale launcher installation path based on OS
fn get_hytale_launcher_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let path = std::path::Path::new(&appdata)
                .join("Hytale")
                .join("install")
                .join("release")
                .join("package")
                .join("game")
                .join("latest");

            if path.exists() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Try XDG_DATA_HOME first, then fall back to ~/.local/share
        let data_home = std::env::var("XDG_DATA_HOME")
            .unwrap_or_else(|_| {
                std::env::var("HOME")
                    .map(|h| format!("{}/.local/share", h))
                    .unwrap_or_default()
            });

        if !data_home.is_empty() {
            let path = std::path::Path::new(&data_home)
                .join("Hytale")
                .join("install")
                .join("release")
                .join("package")
                .join("game")
                .join("latest");

            if path.exists() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let path = std::path::Path::new(&home)
                .join("Library")
                .join("Application Support")
                .join("Hytale")
                .join("install")
                .join("release")
                .join("package")
                .join("game")
                .join("latest");

            if path.exists() {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }

    None
}
