use serde::{Deserialize, Serialize};
use tauri::State;

use crate::database::{self, DbPool, Instance, CreateInstanceInput};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceResult {
    pub success: bool,
    pub instance: Option<Instance>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstancesListResult {
    pub success: bool,
    pub instances: Vec<Instance>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeleteResult {
    pub success: bool,
    pub error: Option<String>,
}

/// Create a new server instance
#[tauri::command]
pub async fn create_server_instance(
    pool: State<'_, DbPool>,
    name: String,
    path: String,
    java_path: Option<String>,
) -> Result<InstanceResult, ()> {
    println!("[create_server_instance] Creating instance: {} at {}", name, path);

    // Check if instance already exists at this path
    match database::get_instance_by_path(&pool, &path).await {
        Ok(Some(_)) => {
            return Ok(InstanceResult {
                success: false,
                instance: None,
                error: Some("An instance already exists at this path".to_string()),
            });
        }
        Err(e) => {
            return Ok(InstanceResult {
                success: false,
                instance: None,
                error: Some(format!("Database error: {}", e)),
            });
        }
        _ => {}
    }

    let input = CreateInstanceInput {
        name,
        path,
        java_path,
    };

    match database::create_instance(&pool, input).await {
        Ok(instance) => {
            println!("[create_server_instance] Instance created: {}", instance.id);
            Ok(InstanceResult {
                success: true,
                instance: Some(instance),
                error: None,
            })
        }
        Err(e) => {
            println!("[create_server_instance] Error: {}", e);
            Ok(InstanceResult {
                success: false,
                instance: None,
                error: Some(format!("Failed to create instance: {}", e)),
            })
        }
    }
}

/// Get all server instances
#[tauri::command]
pub async fn get_server_instances(pool: State<'_, DbPool>) -> Result<InstancesListResult, ()> {
    println!("[get_server_instances] Fetching all instances");

    match database::get_all_instances(&pool).await {
        Ok(instances) => {
            println!("[get_server_instances] Found {} instances", instances.len());
            Ok(InstancesListResult {
                success: true,
                instances,
                error: None,
            })
        }
        Err(e) => {
            println!("[get_server_instances] Error: {}", e);
            Ok(InstancesListResult {
                success: false,
                instances: vec![],
                error: Some(format!("Failed to fetch instances: {}", e)),
            })
        }
    }
}

/// Get a single instance by ID
#[tauri::command]
pub async fn get_server_instance(
    pool: State<'_, DbPool>,
    id: String,
) -> Result<InstanceResult, ()> {
    println!("[get_server_instance] Fetching instance: {}", id);

    match database::get_instance_by_id(&pool, &id).await {
        Ok(instance) => Ok(InstanceResult {
            success: instance.is_some(),
            instance,
            error: None,
        }),
        Err(e) => {
            println!("[get_server_instance] Error: {}", e);
            Ok(InstanceResult {
                success: false,
                instance: None,
                error: Some(format!("Failed to fetch instance: {}", e)),
            })
        }
    }
}

/// Delete a server instance
#[tauri::command]
pub async fn delete_server_instance(
    pool: State<'_, DbPool>,
    id: String,
    delete_files: bool,
) -> Result<DeleteResult, ()> {
    println!("[delete_server_instance] Deleting instance: {}, delete_files: {}", id, delete_files);

    // Get instance first to get the path
    let instance = match database::get_instance_by_id(&pool, &id).await {
        Ok(Some(i)) => i,
        Ok(None) => {
            return Ok(DeleteResult {
                success: false,
                error: Some("Instance not found".to_string()),
            });
        }
        Err(e) => {
            return Ok(DeleteResult {
                success: false,
                error: Some(format!("Database error: {}", e)),
            });
        }
    };

    // Delete files if requested
    if delete_files {
        let path = std::path::Path::new(&instance.path);
        if path.exists() {
            if let Err(e) = std::fs::remove_dir_all(path) {
                println!("[delete_server_instance] Warning: Failed to delete files: {}", e);
                // Continue with DB deletion even if file deletion fails
            } else {
                println!("[delete_server_instance] Files deleted at: {}", instance.path);
            }
        }
    }

    // Delete from database
    match database::delete_instance(&pool, &id).await {
        Ok(true) => {
            println!("[delete_server_instance] Instance deleted from database");
            Ok(DeleteResult {
                success: true,
                error: None,
            })
        }
        Ok(false) => Ok(DeleteResult {
            success: false,
            error: Some("Instance not found in database".to_string()),
        }),
        Err(e) => {
            println!("[delete_server_instance] Error: {}", e);
            Ok(DeleteResult {
                success: false,
                error: Some(format!("Failed to delete instance: {}", e)),
            })
        }
    }
}

/// Update instance configuration
#[tauri::command]
pub async fn update_server_instance(
    pool: State<'_, DbPool>,
    id: String,
    name: Option<String>,
    java_path: Option<String>,
    jvm_args: Option<String>,
    server_args: Option<String>,
) -> Result<InstanceResult, ()> {
    println!("[update_server_instance] Updating instance: {}", id);

    match database::update_instance(&pool, &id, name, java_path, jvm_args, server_args).await {
        Ok(true) => {
            // Fetch the updated instance
            match database::get_instance_by_id(&pool, &id).await {
                Ok(instance) => Ok(InstanceResult {
                    success: true,
                    instance,
                    error: None,
                }),
                Err(e) => Ok(InstanceResult {
                    success: false,
                    instance: None,
                    error: Some(format!("Failed to fetch updated instance: {}", e)),
                }),
            }
        }
        Ok(false) => Ok(InstanceResult {
            success: false,
            instance: None,
            error: Some("Instance not found".to_string()),
        }),
        Err(e) => {
            println!("[update_server_instance] Error: {}", e);
            Ok(InstanceResult {
                success: false,
                instance: None,
                error: Some(format!("Failed to update instance: {}", e)),
            })
        }
    }
}

/// Check if onboarding is completed
#[tauri::command]
pub async fn is_onboarding_complete(pool: State<'_, DbPool>) -> Result<bool, ()> {
    match database::is_onboarding_completed(&pool).await {
        Ok(completed) => Ok(completed),
        Err(_) => Ok(false),
    }
}

/// Mark onboarding as completed
#[tauri::command]
pub async fn complete_onboarding(pool: State<'_, DbPool>) -> Result<bool, ()> {
    match database::set_onboarding_completed(&pool).await {
        Ok(()) => Ok(true),
        Err(_) => Ok(false),
    }
}
