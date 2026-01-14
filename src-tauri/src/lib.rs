mod commands;
mod database;

use std::sync::{Arc, Mutex};
use tauri::Manager;

use commands::{
    check_downloader, check_downloader_update, check_java, check_server_files,
    check_instance_paths, complete_onboarding, copy_server_files, create_instance,
    create_server_instance, delete_server_instance, download_server_files, get_downloader_info,
    get_downloader_version, get_server_instance, get_server_instances, get_system_paths,
    install_downloader_cli, is_onboarding_complete, update_server_instance, validate_server_files,
    update_instance_auth_status,
    // Server management
    start_server, stop_server, get_server_status, get_all_server_statuses, send_server_command,
    get_online_players, ServerState,
    // Logs
    list_log_files, read_log_file, tail_log_file,
    // Metrics
    get_server_metrics, get_all_server_metrics, get_system_metrics, MetricsState,
    // Network
    get_firewall_info, add_firewall_rule, remove_firewall_rule,
    // Version checking
    get_version_settings, set_version_settings, check_all_versions, check_instance_version,
    update_instance_installed_version, dismiss_version_banner, get_dismissed_version,
    start_version_check_background_task,
    // Config files
    read_json_file, write_json_file, write_json_file_raw,
    get_whitelist, save_whitelist,
    get_bans, save_bans,
    get_permissions, save_permissions,
    get_server_config, save_server_config,
    // Worlds
    list_worlds, get_world_config, save_world_config, delete_world, duplicate_world,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // On Windows, disable native decorations to use custom titlebar
            #[cfg(target_os = "windows")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_decorations(false);
                    println!("[app] Windows: Custom titlebar enabled");
                }
            }

            // Initialize updater and process plugins (desktop only)
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
                println!("[app] Updater and process plugins initialized");
            }

            // Initialize server state
            handle.manage(Arc::new(Mutex::new(ServerState::new())));
            println!("[app] Server state initialized");

            // Initialize metrics state (cached sysinfo instance)
            handle.manage(Arc::new(Mutex::new(MetricsState::new())));
            println!("[app] Metrics state initialized");

            tauri::async_runtime::block_on(async move {
                match database::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(pool);
                        println!("[app] Database initialized and managed");
                    }
                    Err(e) => {
                        eprintln!("[app] Failed to initialize database: {}", e);
                    }
                }
            });

            // Start background version check task
            let bg_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_version_check_background_task(bg_handle).await;
            });
            println!("[app] Background version check task started");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System checks
            check_java,
            get_system_paths,
            // File operations
            copy_server_files,
            create_instance,
            validate_server_files,
            check_server_files,
            // Downloader
            check_downloader,
            get_downloader_info,
            get_downloader_version,
            check_downloader_update,
            download_server_files,
            install_downloader_cli,
            // Instance management (database)
            create_server_instance,
            get_server_instances,
            get_server_instance,
            delete_server_instance,
            update_server_instance,
            check_instance_paths,
            update_instance_auth_status,
            // Onboarding
            is_onboarding_complete,
            complete_onboarding,
            // Server management
            start_server,
            stop_server,
            get_server_status,
            get_all_server_statuses,
            send_server_command,
            get_online_players,
            // Logs
            list_log_files,
            read_log_file,
            tail_log_file,
            // Metrics
            get_server_metrics,
            get_all_server_metrics,
            get_system_metrics,
            // Network
            get_firewall_info,
            add_firewall_rule,
            remove_firewall_rule,
            // Version checking
            get_version_settings,
            set_version_settings,
            check_all_versions,
            check_instance_version,
            update_instance_installed_version,
            dismiss_version_banner,
            get_dismissed_version,
            // Config files
            read_json_file,
            write_json_file,
            write_json_file_raw,
            get_whitelist,
            save_whitelist,
            get_bans,
            save_bans,
            get_permissions,
            save_permissions,
            get_server_config,
            save_server_config,
            // Worlds
            list_worlds,
            get_world_config,
            save_world_config,
            delete_world,
            duplicate_world
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
