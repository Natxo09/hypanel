use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

// ============================================================================
// Types - Generic JSON
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonReadResult {
    pub success: bool,
    pub content: Option<Value>,
    pub raw: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonWriteResult {
    pub success: bool,
    pub error: Option<String>,
}

// ============================================================================
// Types - Whitelist
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Whitelist {
    pub enabled: bool,
    pub list: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistResult {
    pub success: bool,
    pub whitelist: Option<Whitelist>,
    pub error: Option<String>,
}

// ============================================================================
// Types - Bans
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ban {
    pub uuid: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(rename = "bannedAt", skip_serializing_if = "Option::is_none")]
    pub banned_at: Option<String>,
    #[serde(rename = "bannedBy", skip_serializing_if = "Option::is_none")]
    pub banned_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BansResult {
    pub success: bool,
    pub bans: Option<Vec<Ban>>,
    pub error: Option<String>,
}

// ============================================================================
// Types - Permissions
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserPermissions {
    pub groups: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Permissions {
    pub users: HashMap<String, UserPermissions>,
    pub groups: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionsResult {
    pub success: bool,
    pub permissions: Option<Permissions>,
    pub error: Option<String>,
}

// ============================================================================
// Types - Server Config
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfigDefaults {
    #[serde(rename = "World")]
    pub world: String,
    #[serde(rename = "GameMode")]
    pub game_mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(rename = "Version")]
    pub version: i32,
    #[serde(rename = "ServerName")]
    pub server_name: String,
    #[serde(rename = "MOTD")]
    pub motd: String,
    #[serde(rename = "Password")]
    pub password: String,
    #[serde(rename = "MaxPlayers")]
    pub max_players: i32,
    #[serde(rename = "MaxViewRadius")]
    pub max_view_radius: i32,
    #[serde(rename = "LocalCompressionEnabled")]
    pub local_compression_enabled: bool,
    #[serde(rename = "Defaults")]
    pub defaults: ServerConfigDefaults,
    // Store remaining fields as raw JSON for advanced editing
    #[serde(flatten)]
    pub extra: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfigResult {
    pub success: bool,
    pub config: Option<ServerConfig>,
    pub raw: Option<String>,
    pub error: Option<String>,
}

// ============================================================================
// Commands - Generic JSON
// ============================================================================

/// Read any JSON file and return its contents
#[tauri::command]
pub fn read_json_file(file_path: String) -> JsonReadResult {
    let path = Path::new(&file_path);

    if !path.exists() {
        return JsonReadResult {
            success: false,
            content: None,
            raw: None,
            error: Some("File not found".to_string()),
        };
    }

    match fs::read_to_string(path) {
        Ok(content) => {
            match serde_json::from_str::<Value>(&content) {
                Ok(json) => JsonReadResult {
                    success: true,
                    content: Some(json),
                    raw: Some(content),
                    error: None,
                },
                Err(e) => JsonReadResult {
                    success: false,
                    content: None,
                    raw: Some(content),
                    error: Some(format!("Invalid JSON: {}", e)),
                },
            }
        }
        Err(e) => JsonReadResult {
            success: false,
            content: None,
            raw: None,
            error: Some(format!("Failed to read file: {}", e)),
        },
    }
}

/// Write JSON content to a file
#[tauri::command]
pub fn write_json_file(file_path: String, content: Value) -> JsonWriteResult {
    let path = Path::new(&file_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return JsonWriteResult {
                    success: false,
                    error: Some(format!("Failed to create directory: {}", e)),
                };
            }
        }
    }

    // Format JSON with pretty printing
    let formatted = match serde_json::to_string_pretty(&content) {
        Ok(s) => s,
        Err(e) => {
            return JsonWriteResult {
                success: false,
                error: Some(format!("Failed to serialize JSON: {}", e)),
            };
        }
    };

    match fs::write(path, formatted) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write file: {}", e)),
        },
    }
}

/// Write raw JSON string to a file (for raw editor mode)
#[tauri::command]
pub fn write_json_file_raw(file_path: String, content: String) -> JsonWriteResult {
    // Validate that content is valid JSON first
    if let Err(e) = serde_json::from_str::<Value>(&content) {
        return JsonWriteResult {
            success: false,
            error: Some(format!("Invalid JSON: {}", e)),
        };
    }

    let path = Path::new(&file_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return JsonWriteResult {
                    success: false,
                    error: Some(format!("Failed to create directory: {}", e)),
                };
            }
        }
    }

    match fs::write(path, content) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write file: {}", e)),
        },
    }
}

// ============================================================================
// Commands - Whitelist
// ============================================================================

/// Get whitelist from server instance
#[tauri::command]
pub fn get_whitelist(instance_path: String) -> WhitelistResult {
    let path = Path::new(&instance_path).join("Server").join("whitelist.json");

    if !path.exists() {
        // Return default whitelist if file doesn't exist
        return WhitelistResult {
            success: true,
            whitelist: Some(Whitelist {
                enabled: false,
                list: vec![],
            }),
            error: None,
        };
    }

    match fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<Whitelist>(&content) {
                Ok(whitelist) => WhitelistResult {
                    success: true,
                    whitelist: Some(whitelist),
                    error: None,
                },
                Err(e) => WhitelistResult {
                    success: false,
                    whitelist: None,
                    error: Some(format!("Failed to parse whitelist.json: {}", e)),
                },
            }
        }
        Err(e) => WhitelistResult {
            success: false,
            whitelist: None,
            error: Some(format!("Failed to read whitelist.json: {}", e)),
        },
    }
}

/// Save whitelist to server instance
#[tauri::command]
pub fn save_whitelist(instance_path: String, whitelist: Whitelist) -> JsonWriteResult {
    let path = Path::new(&instance_path).join("Server").join("whitelist.json");

    let formatted = match serde_json::to_string_pretty(&whitelist) {
        Ok(s) => s,
        Err(e) => {
            return JsonWriteResult {
                success: false,
                error: Some(format!("Failed to serialize whitelist: {}", e)),
            };
        }
    };

    match fs::write(path, formatted) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write whitelist.json: {}", e)),
        },
    }
}

// ============================================================================
// Commands - Bans
// ============================================================================

/// Get bans from server instance
#[tauri::command]
pub fn get_bans(instance_path: String) -> BansResult {
    let path = Path::new(&instance_path).join("Server").join("bans.json");

    if !path.exists() {
        // Return empty bans list if file doesn't exist
        return BansResult {
            success: true,
            bans: Some(vec![]),
            error: None,
        };
    }

    match fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<Vec<Ban>>(&content) {
                Ok(bans) => BansResult {
                    success: true,
                    bans: Some(bans),
                    error: None,
                },
                Err(e) => BansResult {
                    success: false,
                    bans: None,
                    error: Some(format!("Failed to parse bans.json: {}", e)),
                },
            }
        }
        Err(e) => BansResult {
            success: false,
            bans: None,
            error: Some(format!("Failed to read bans.json: {}", e)),
        },
    }
}

/// Save bans to server instance
#[tauri::command]
pub fn save_bans(instance_path: String, bans: Vec<Ban>) -> JsonWriteResult {
    let path = Path::new(&instance_path).join("Server").join("bans.json");

    let formatted = match serde_json::to_string_pretty(&bans) {
        Ok(s) => s,
        Err(e) => {
            return JsonWriteResult {
                success: false,
                error: Some(format!("Failed to serialize bans: {}", e)),
            };
        }
    };

    match fs::write(path, formatted) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write bans.json: {}", e)),
        },
    }
}

// ============================================================================
// Commands - Permissions
// ============================================================================

/// Get permissions from server instance
#[tauri::command]
pub fn get_permissions(instance_path: String) -> PermissionsResult {
    let path = Path::new(&instance_path).join("Server").join("permissions.json");

    if !path.exists() {
        // Return default permissions if file doesn't exist
        let mut groups = HashMap::new();
        groups.insert("Default".to_string(), vec![]);
        groups.insert("OP".to_string(), vec!["*".to_string()]);

        return PermissionsResult {
            success: true,
            permissions: Some(Permissions {
                users: HashMap::new(),
                groups,
            }),
            error: None,
        };
    }

    match fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<Permissions>(&content) {
                Ok(permissions) => PermissionsResult {
                    success: true,
                    permissions: Some(permissions),
                    error: None,
                },
                Err(e) => PermissionsResult {
                    success: false,
                    permissions: None,
                    error: Some(format!("Failed to parse permissions.json: {}", e)),
                },
            }
        }
        Err(e) => PermissionsResult {
            success: false,
            permissions: None,
            error: Some(format!("Failed to read permissions.json: {}", e)),
        },
    }
}

/// Save permissions to server instance
#[tauri::command]
pub fn save_permissions(instance_path: String, permissions: Permissions) -> JsonWriteResult {
    let path = Path::new(&instance_path).join("Server").join("permissions.json");

    let formatted = match serde_json::to_string_pretty(&permissions) {
        Ok(s) => s,
        Err(e) => {
            return JsonWriteResult {
                success: false,
                error: Some(format!("Failed to serialize permissions: {}", e)),
            };
        }
    };

    match fs::write(path, formatted) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write permissions.json: {}", e)),
        },
    }
}

// ============================================================================
// Commands - Server Config
// ============================================================================

/// Get server config from instance
#[tauri::command]
pub fn get_server_config(instance_path: String) -> ServerConfigResult {
    let path = Path::new(&instance_path).join("Server").join("config.json");

    if !path.exists() {
        return ServerConfigResult {
            success: false,
            config: None,
            raw: None,
            error: Some("config.json not found".to_string()),
        };
    }

    match fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<ServerConfig>(&content) {
                Ok(config) => ServerConfigResult {
                    success: true,
                    config: Some(config),
                    raw: Some(content),
                    error: None,
                },
                Err(e) => ServerConfigResult {
                    success: false,
                    config: None,
                    raw: Some(content),
                    error: Some(format!("Failed to parse config.json: {}", e)),
                },
            }
        }
        Err(e) => ServerConfigResult {
            success: false,
            config: None,
            raw: None,
            error: Some(format!("Failed to read config.json: {}", e)),
        },
    }
}

/// Save server config to instance
#[tauri::command]
pub fn save_server_config(instance_path: String, config: ServerConfig) -> JsonWriteResult {
    let path = Path::new(&instance_path).join("Server").join("config.json");

    let formatted = match serde_json::to_string_pretty(&config) {
        Ok(s) => s,
        Err(e) => {
            return JsonWriteResult {
                success: false,
                error: Some(format!("Failed to serialize config: {}", e)),
            };
        }
    };

    match fs::write(path, formatted) {
        Ok(()) => JsonWriteResult {
            success: true,
            error: None,
        },
        Err(e) => JsonWriteResult {
            success: false,
            error: Some(format!("Failed to write config.json: {}", e)),
        },
    }
}
