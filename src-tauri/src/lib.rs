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
    // Server management
    start_server, stop_server, get_server_status, get_all_server_statuses, send_server_command,
    ServerState,
    // Logs
    list_log_files, read_log_file, tail_log_file,
    // Metrics
    get_server_metrics, get_all_server_metrics, get_system_metrics, MetricsState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();

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
            // Onboarding
            is_onboarding_complete,
            complete_onboarding,
            // Server management
            start_server,
            stop_server,
            get_server_status,
            get_all_server_statuses,
            send_server_command,
            // Logs
            list_log_files,
            read_log_file,
            tail_log_file,
            // Metrics
            get_server_metrics,
            get_all_server_metrics,
            get_system_metrics
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
