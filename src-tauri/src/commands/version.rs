use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use crate::database::{self, DbPool};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionSettings {
    pub check_on_startup: bool,
    pub check_periodic: bool,
    pub check_on_server_start: bool,
}

impl Default for VersionSettings {
    fn default() -> Self {
        Self {
            check_on_startup: true,
            check_periodic: false,
            check_on_server_start: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionCheckResult {
    pub instance_id: String,
    pub instance_name: String,
    pub installed_version: Option<String>,
    pub available_version: Option<String>,
    pub update_available: bool,
    pub version_unknown: bool,  // True if installed_version is None
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

/// Find hytale-downloader path
fn find_downloader(app: &AppHandle) -> Option<String> {
    let exe_name = get_downloader_executable();

    // Check app data directory
    if let Ok(app_dir) = app.path().app_data_dir() {
        let cli_path = app_dir.join(exe_name);
        if cli_path.exists() {
            return Some(cli_path.to_string_lossy().to_string());
        }
    }

    // Check PATH
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

/// Get the available game version using hytale-downloader -print-version
async fn get_available_version(app: &AppHandle) -> Option<String> {
    let downloader_path = find_downloader(app)?;

    tokio::task::spawn_blocking(move || {
        Command::new(&downloader_path)
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
    })
    .await
    .ok()
    .flatten()
}

/// Get version checking settings
#[tauri::command]
pub async fn get_version_settings(app: AppHandle) -> VersionSettings {
    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => return VersionSettings::default(),
    };

    let check_on_startup = database::get_setting(&pool, "version_check_on_startup")
        .await
        .ok()
        .flatten()
        .map(|v| v == "true")
        .unwrap_or(true);

    let check_periodic = database::get_setting(&pool, "version_check_periodic")
        .await
        .ok()
        .flatten()
        .map(|v| v == "true")
        .unwrap_or(false);

    let check_on_server_start = database::get_setting(&pool, "version_check_on_server_start")
        .await
        .ok()
        .flatten()
        .map(|v| v == "true")
        .unwrap_or(true);

    VersionSettings {
        check_on_startup,
        check_periodic,
        check_on_server_start,
    }
}

/// Set version checking settings
#[tauri::command]
pub async fn set_version_settings(app: AppHandle, settings: VersionSettings) -> bool {
    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => return false,
    };

    let r1 = database::set_setting(
        &pool,
        "version_check_on_startup",
        if settings.check_on_startup { "true" } else { "false" },
    )
    .await;

    let r2 = database::set_setting(
        &pool,
        "version_check_periodic",
        if settings.check_periodic { "true" } else { "false" },
    )
    .await;

    let r3 = database::set_setting(
        &pool,
        "version_check_on_server_start",
        if settings.check_on_server_start { "true" } else { "false" },
    )
    .await;

    r1.is_ok() && r2.is_ok() && r3.is_ok()
}

/// Check all instances for version updates
#[tauri::command]
pub async fn check_all_versions(app: AppHandle) -> Vec<VersionCheckResult> {
    println!("[version] Checking all versions...");

    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => {
            println!("[version] ERROR: Database not available");
            return vec![];
        }
    };

    // Get available version from hytale-downloader
    let available_version = get_available_version(&app).await;
    println!("[version] Available version: {:?}", available_version);

    // Get all instances
    let instances = match database::get_all_instances(&pool).await {
        Ok(i) => i,
        Err(e) => {
            println!("[version] ERROR: Failed to get instances: {}", e);
            return vec![];
        }
    };

    let mut results = Vec::new();

    for instance in instances {
        let version_unknown = instance.installed_version.is_none();
        let update_available = match (&instance.installed_version, &available_version) {
            (Some(installed), Some(available)) => installed != available,
            _ => false, // Only mark as update available when both versions are known
        };

        results.push(VersionCheckResult {
            instance_id: instance.id,
            instance_name: instance.name,
            installed_version: instance.installed_version,
            available_version: available_version.clone(),
            update_available,
            version_unknown,
        });
    }

    println!("[version] Check complete, {} results", results.len());
    results
}

/// Check a specific instance for version updates
#[tauri::command]
pub async fn check_instance_version(app: AppHandle, instance_id: String) -> Option<VersionCheckResult> {
    println!("[version] Checking version for instance: {}", instance_id);

    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => return None,
    };

    let instance = match database::get_instance_by_id(&pool, &instance_id).await {
        Ok(Some(i)) => i,
        _ => return None,
    };

    let available_version = get_available_version(&app).await;

    let version_unknown = instance.installed_version.is_none();
    let update_available = match (&instance.installed_version, &available_version) {
        (Some(installed), Some(available)) => installed != available,
        _ => false,
    };

    Some(VersionCheckResult {
        instance_id: instance.id,
        instance_name: instance.name,
        installed_version: instance.installed_version,
        available_version,
        update_available,
        version_unknown,
    })
}

/// Update the installed version for an instance (called after download)
#[tauri::command]
pub async fn update_instance_installed_version(
    app: AppHandle,
    instance_id: String,
    version: String,
) -> bool {
    println!("[version] Updating installed version for {}: {}", instance_id, version);

    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => return false,
    };

    match database::update_instance_version(&pool, &instance_id, &version).await {
        Ok(success) => {
            println!("[version] Update result: {}", success);
            success
        }
        Err(e) => {
            println!("[version] ERROR: Failed to update version: {}", e);
            false
        }
    }
}

/// Dismiss the version update banner for a specific version
#[tauri::command]
pub async fn dismiss_version_banner(app: AppHandle, version: String) -> bool {
    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => return false,
    };

    database::set_setting(&pool, "dismissed_version", &version)
        .await
        .is_ok()
}

/// Get the dismissed version (if any)
#[tauri::command]
pub async fn get_dismissed_version(app: AppHandle) -> Option<String> {
    let pool = match app.try_state::<DbPool>() {
        Some(p) => p.inner().clone(),
        None => return None,
    };

    database::get_setting(&pool, "dismissed_version")
        .await
        .ok()
        .flatten()
}

/// Event payload for version updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionUpdateEvent {
    pub results: Vec<VersionCheckResult>,
    pub available_version: String,
}

/// Background task to periodically check for version updates
pub async fn start_version_check_background_task(app: AppHandle) {
    println!("[version] Starting background version check task");

    loop {
        // Wait 30 minutes between checks
        tokio::time::sleep(Duration::from_secs(30 * 60)).await;

        // Check if periodic checking is enabled
        let pool = match app.try_state::<DbPool>() {
            Some(p) => p.inner().clone(),
            None => continue,
        };

        let periodic_enabled = database::get_setting(&pool, "version_check_periodic")
            .await
            .ok()
            .flatten()
            .map(|v| v == "true")
            .unwrap_or(false);

        if !periodic_enabled {
            println!("[version] Periodic check disabled, skipping");
            continue;
        }

        println!("[version] Running periodic version check...");

        // Get available version
        let available_version = match get_available_version(&app).await {
            Some(v) => v,
            None => {
                println!("[version] Could not get available version");
                continue;
            }
        };

        // Check if this version was dismissed
        let dismissed = database::get_setting(&pool, "dismissed_version")
            .await
            .ok()
            .flatten();

        if dismissed.as_ref() == Some(&available_version) {
            println!("[version] Version {} was dismissed, skipping notification", available_version);
            continue;
        }

        // Get all instances and check for updates
        let instances = match database::get_all_instances(&pool).await {
            Ok(i) => i,
            Err(_) => continue,
        };

        let mut outdated_results = Vec::new();

        for instance in instances {
            let version_unknown = instance.installed_version.is_none();
            let update_available = match &instance.installed_version {
                Some(installed) => installed != &available_version,
                None => false, // Don't mark as update_available if version is unknown
            };

            // Include both outdated and unknown versions in notification
            if update_available || version_unknown {
                outdated_results.push(VersionCheckResult {
                    instance_id: instance.id,
                    instance_name: instance.name,
                    installed_version: instance.installed_version,
                    available_version: Some(available_version.clone()),
                    update_available,
                    version_unknown,
                });
            }
        }

        if !outdated_results.is_empty() {
            println!("[version] Found {} outdated instances, emitting event", outdated_results.len());
            let _ = app.emit(
                "version-update-available",
                VersionUpdateEvent {
                    results: outdated_results,
                    available_version,
                },
            );
        }
    }
}
