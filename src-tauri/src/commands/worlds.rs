use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

use super::config::JsonWriteResult;

// ============================================================================
// Types - World Info
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldInfo {
    pub name: String,
    pub path: String,
    pub uuid: Option<String>,
    pub seed: Option<i64>,
    pub world_gen_type: Option<String>,
    pub world_gen_name: Option<String>,
    pub is_ticking: Option<bool>,
    pub is_pvp_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldsListResult {
    pub success: bool,
    pub worlds: Vec<WorldInfo>,
    pub error: Option<String>,
}

// ============================================================================
// Types - World Config
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldUUID {
    #[serde(rename = "$binary")]
    pub binary: String,
    #[serde(rename = "$type")]
    pub type_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldGenConfig {
    #[serde(rename = "Type")]
    pub gen_type: String,
    #[serde(rename = "Name")]
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldConfig {
    #[serde(rename = "Version")]
    pub version: i32,
    #[serde(rename = "UUID")]
    pub uuid: WorldUUID,
    #[serde(rename = "Seed")]
    pub seed: i64,
    #[serde(rename = "WorldGen")]
    pub world_gen: WorldGenConfig,

    // Boolean toggles (editable)
    #[serde(rename = "IsTicking")]
    pub is_ticking: bool,
    #[serde(rename = "IsBlockTicking")]
    pub is_block_ticking: bool,
    #[serde(rename = "IsPvpEnabled")]
    pub is_pvp_enabled: bool,
    #[serde(rename = "IsFallDamageEnabled")]
    pub is_fall_damage_enabled: bool,
    #[serde(rename = "IsGameTimePaused")]
    pub is_game_time_paused: bool,
    #[serde(rename = "IsSpawningNPC")]
    pub is_spawning_npc: bool,
    #[serde(rename = "IsSpawnMarkersEnabled")]
    pub is_spawn_markers_enabled: bool,
    #[serde(rename = "IsAllNPCFrozen")]
    pub is_all_npc_frozen: bool,
    #[serde(rename = "IsSavingPlayers")]
    pub is_saving_players: bool,
    #[serde(rename = "IsSavingChunks")]
    pub is_saving_chunks: bool,
    #[serde(rename = "IsUnloadingChunks")]
    pub is_unloading_chunks: bool,
    #[serde(rename = "IsObjectiveMarkersEnabled")]
    pub is_objective_markers_enabled: bool,
    #[serde(rename = "IsCompassUpdating")]
    pub is_compass_updating: bool,
    #[serde(rename = "DeleteOnUniverseStart")]
    pub delete_on_universe_start: bool,
    #[serde(rename = "DeleteOnRemove")]
    pub delete_on_remove: bool,

    // String fields
    #[serde(rename = "GameplayConfig")]
    pub gameplay_config: String,
    #[serde(rename = "GameTime", skip_serializing_if = "Option::is_none")]
    pub game_time: Option<String>,

    // Store remaining fields as raw JSON
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldConfigResult {
    pub success: bool,
    pub config: Option<WorldConfig>,
    pub raw: Option<String>,
    pub error: Option<String>,
}

// ============================================================================
// Commands - List Worlds
// ============================================================================

/// List all worlds in the server's universe directory
#[tauri::command]
pub fn list_worlds(instance_path: String) -> WorldsListResult {
    let worlds_dir = Path::new(&instance_path).join("Server").join("universe").join("worlds");

    if !worlds_dir.exists() {
        return WorldsListResult {
            success: true,
            worlds: vec![],
            error: None,
        };
    }

    let mut worlds = Vec::new();

    match fs::read_dir(&worlds_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let config_path = path.join("config.json");
                    let world_name = path.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let mut world_info = WorldInfo {
                        name: world_name,
                        path: path.to_string_lossy().to_string(),
                        uuid: None,
                        seed: None,
                        world_gen_type: None,
                        world_gen_name: None,
                        is_ticking: None,
                        is_pvp_enabled: None,
                    };

                    // Try to read config.json to get more info
                    if config_path.exists() {
                        if let Ok(content) = fs::read_to_string(&config_path) {
                            if let Ok(config) = serde_json::from_str::<WorldConfig>(&content) {
                                world_info.uuid = Some(config.uuid.binary.clone());
                                world_info.seed = Some(config.seed);
                                world_info.world_gen_type = Some(config.world_gen.gen_type.clone());
                                world_info.world_gen_name = Some(config.world_gen.name.clone());
                                world_info.is_ticking = Some(config.is_ticking);
                                world_info.is_pvp_enabled = Some(config.is_pvp_enabled);
                            }
                        }
                    }

                    worlds.push(world_info);
                }
            }
        }
        Err(e) => {
            return WorldsListResult {
                success: false,
                worlds: vec![],
                error: Some(format!("Failed to read worlds directory: {}", e)),
            };
        }
    }

    // Sort by name
    worlds.sort_by(|a, b| a.name.cmp(&b.name));

    WorldsListResult {
        success: true,
        worlds,
        error: None,
    }
}

// ============================================================================
// Commands - World Config
// ============================================================================

/// Get world config from a specific world directory
#[tauri::command]
pub fn get_world_config(world_path: String) -> WorldConfigResult {
    let config_path = Path::new(&world_path).join("config.json");

    if !config_path.exists() {
        return WorldConfigResult {
            success: false,
            config: None,
            raw: None,
            error: Some("World config.json not found".to_string()),
        };
    }

    match fs::read_to_string(&config_path) {
        Ok(content) => {
            match serde_json::from_str::<WorldConfig>(&content) {
                Ok(config) => WorldConfigResult {
                    success: true,
                    config: Some(config),
                    raw: Some(content),
                    error: None,
                },
                Err(e) => WorldConfigResult {
                    success: false,
                    config: None,
                    raw: Some(content),
                    error: Some(format!("Failed to parse world config.json: {}", e)),
                },
            }
        }
        Err(e) => WorldConfigResult {
            success: false,
            config: None,
            raw: None,
            error: Some(format!("Failed to read world config.json: {}", e)),
        },
    }
}

/// Save world config to a specific world directory
#[tauri::command]
pub fn save_world_config(world_path: String, config: WorldConfig) -> JsonWriteResult {
    let config_path = Path::new(&world_path).join("config.json");

    let formatted = match serde_json::to_string_pretty(&config) {
        Ok(s) => s,
        Err(e) => {
            return JsonWriteResult {
                success: false,
                error: Some(format!("Failed to serialize world config: {}", e)),
            };
        }
    };

    match fs::write(config_path, formatted) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write world config.json: {}", e)),
        },
    }
}

// ============================================================================
// Commands - World Management
// ============================================================================

/// Delete a world directory
#[tauri::command]
pub fn delete_world(world_path: String) -> JsonWriteResult {
    let path = Path::new(&world_path);

    if !path.exists() {
        return JsonWriteResult {
            success: false,
            error: Some("World directory not found".to_string()),
        };
    }

    match fs::remove_dir_all(path) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to delete world: {}", e)),
        },
    }
}

/// Duplicate a world to a new directory
#[tauri::command]
pub fn duplicate_world(world_path: String, new_name: String) -> JsonWriteResult {
    let source_path = Path::new(&world_path);

    if !source_path.exists() {
        return JsonWriteResult {
            success: false,
            error: Some("Source world not found".to_string()),
        };
    }

    let parent = match source_path.parent() {
        Some(p) => p,
        None => {
            return JsonWriteResult {
                success: false,
                error: Some("Could not determine parent directory".to_string()),
            };
        }
    };

    let dest_path = parent.join(&new_name);

    if dest_path.exists() {
        return JsonWriteResult {
            success: false,
            error: Some(format!("World '{}' already exists", new_name)),
        };
    }

    // Copy directory recursively
    match copy_dir_all(source_path, &dest_path) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => {
            // Try to clean up partial copy
            let _ = fs::remove_dir_all(&dest_path);
            JsonWriteResult {
                success: false,
                error: Some(format!("Failed to duplicate world: {}", e)),
            }
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Recursively copy a directory
fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)?;
        }
    }

    Ok(())
}
