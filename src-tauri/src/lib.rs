mod commands;

use commands::{
    check_downloader, check_downloader_update, check_java, check_server_files, copy_server_files,
    create_instance, download_server_files, get_downloader_info, get_downloader_version,
    get_system_paths, install_downloader_cli, validate_server_files,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            check_java,
            get_system_paths,
            copy_server_files,
            check_downloader,
            create_instance,
            validate_server_files,
            get_downloader_info,
            get_downloader_version,
            check_downloader_update,
            download_server_files,
            install_downloader_cli,
            check_server_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
