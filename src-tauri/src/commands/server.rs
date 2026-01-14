use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::path::Path;
use tauri::{AppHandle, Emitter, State};
use chrono::{DateTime, Utc};

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatusInfo {
    pub status: ServerStatus,
    pub instance_id: String,
    pub pid: Option<u32>,
    pub started_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerOutput {
    pub instance_id: String,
    pub line: String,
    pub stream: String, // "stdout" or "stderr"
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartResult {
    pub success: bool,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StopResult {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthEvent {
    pub instance_id: String,
    pub auth_url: String,
    pub code: String,
}

/// Emitted when server needs authentication but hasn't started the flow yet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthNeededEvent {
    pub instance_id: String,
    pub message: String,
}

/// Emitted when authentication is successful
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSuccessEvent {
    pub instance_id: String,
    pub profile_name: Option<String>,
    pub auth_mode: String,  // e.g. "OAUTH_DEVICE"
}

// ============================================================================
// Server State Management
// ============================================================================

pub struct ServerProcess {
    pub child: Child,
    #[allow(dead_code)]
    pub instance_id: String,
    pub started_at: DateTime<Utc>,
    pub stdin_tx: Option<std::sync::mpsc::Sender<String>>,
}

pub struct ServerState {
    pub processes: HashMap<String, Arc<Mutex<ServerProcess>>>,
}

impl ServerState {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }
}

impl Default for ServerState {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Commands
// ============================================================================

/// Start a server instance
#[tauri::command]
pub async fn start_server(
    app: AppHandle,
    state: State<'_, Arc<Mutex<ServerState>>>,
    instance_id: String,
    instance_path: String,
    java_path: Option<String>,
    jvm_args: Option<String>,
    server_args: Option<String>,
) -> Result<StartResult, ()> {
    println!("[start_server] Starting instance: {}", instance_id);

    // Check if already running
    {
        let state_guard = state.lock().unwrap();
        if state_guard.processes.contains_key(&instance_id) {
            return Ok(StartResult {
                success: false,
                pid: None,
                error: Some("Server is already running".to_string()),
            });
        }
    }

    // Emit starting status
    let _ = app.emit("server-status-change", ServerStatusInfo {
        status: ServerStatus::Starting,
        instance_id: instance_id.clone(),
        pid: None,
        started_at: None,
    });

    // Build the command
    let java_exe = java_path.unwrap_or_else(|| "java".to_string());
    let server_dir = Path::new(&instance_path);
    let server_jar = server_dir.join("Server").join("HytaleServer.jar");
    let assets_path = server_dir.join("Assets.zip");

    // Check if server files exist
    if !server_jar.exists() {
        println!("[start_server] Server JAR not found: {:?}", server_jar);
        let _ = app.emit("server-status-change", ServerStatusInfo {
            status: ServerStatus::Stopped,
            instance_id: instance_id.clone(),
            pid: None,
            started_at: None,
        });
        return Ok(StartResult {
            success: false,
            pid: None,
            error: Some(format!("Server JAR not found: {:?}", server_jar)),
        });
    }

    if !assets_path.exists() {
        println!("[start_server] Assets not found: {:?}", assets_path);
        let _ = app.emit("server-status-change", ServerStatusInfo {
            status: ServerStatus::Stopped,
            instance_id: instance_id.clone(),
            pid: None,
            started_at: None,
        });
        return Ok(StartResult {
            success: false,
            pid: None,
            error: Some(format!("Assets.zip not found: {:?}", assets_path)),
        });
    }

    // Build command arguments
    let mut cmd = Command::new(&java_exe);

    // Add JVM arguments if provided
    if let Some(ref jvm) = jvm_args {
        for arg in jvm.split_whitespace() {
            cmd.arg(arg);
        }
    }

    // Check for AOT cache
    let aot_cache = server_dir.join("Server").join("HytaleServer.aot");
    if aot_cache.exists() {
        cmd.arg(format!("-XX:AOTCache={}", aot_cache.display()));
    }

    // Add JAR
    cmd.arg("-jar");
    cmd.arg(&server_jar);

    // Add assets path
    cmd.arg("--assets");
    cmd.arg(&assets_path);

    // Add server arguments if provided
    if let Some(ref srv_args) = server_args {
        for arg in srv_args.split_whitespace() {
            cmd.arg(arg);
        }
    }

    // Set working directory to Server folder
    let server_folder = server_dir.join("Server");
    cmd.current_dir(&server_folder);

    // Configure stdio
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    println!("[start_server] Spawning process in {:?}", server_folder);

    // Spawn the process
    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            println!("[start_server] Failed to spawn: {}", e);
            let _ = app.emit("server-status-change", ServerStatusInfo {
                status: ServerStatus::Stopped,
                instance_id: instance_id.clone(),
                pid: None,
                started_at: None,
            });
            return Ok(StartResult {
                success: false,
                pid: None,
                error: Some(format!("Failed to start server: {}", e)),
            });
        }
    };

    let pid = child.id();
    let started_at = Utc::now();
    println!("[start_server] Process spawned with PID: {}", pid);

    // Create channel for stdin
    let (stdin_tx, stdin_rx) = std::sync::mpsc::channel::<String>();

    // Take stdout and stderr
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let mut stdin = child.stdin.take();

    // Create process wrapper
    let process = Arc::new(Mutex::new(ServerProcess {
        child,
        instance_id: instance_id.clone(),
        started_at,
        stdin_tx: Some(stdin_tx),
    }));

    // Store in state
    {
        let mut state_guard = state.lock().unwrap();
        state_guard.processes.insert(instance_id.clone(), process.clone());
    }

    // Emit running status
    let _ = app.emit("server-status-change", ServerStatusInfo {
        status: ServerStatus::Running,
        instance_id: instance_id.clone(),
        pid: Some(pid),
        started_at: Some(started_at.to_rfc3339()),
    });

    // Spawn thread to handle stdin
    let instance_id_stdin = instance_id.clone();
    std::thread::spawn(move || {
        while let Ok(command) = stdin_rx.recv() {
            if let Some(ref mut stdin_writer) = stdin {
                let cmd_with_newline = if command.ends_with('\n') {
                    command
                } else {
                    format!("{}\n", command)
                };
                if let Err(e) = stdin_writer.write_all(cmd_with_newline.as_bytes()) {
                    println!("[stdin:{}] Write error: {}", instance_id_stdin, e);
                    break;
                }
                if let Err(e) = stdin_writer.flush() {
                    println!("[stdin:{}] Flush error: {}", instance_id_stdin, e);
                    break;
                }
            }
        }
        println!("[stdin:{}] Thread exiting", instance_id_stdin);
    });

    // Spawn thread to read stdout
    let app_stdout = app.clone();
    let instance_id_stdout = instance_id.clone();
    if let Some(stdout) = stdout {
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            // Track auth profile name across lines
            let mut last_profile_name: Option<String> = None;

            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let output = ServerOutput {
                            instance_id: instance_id_stdout.clone(),
                            line: text.clone(),
                            stream: "stdout".to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                        };
                        let _ = app_stdout.emit("server-output", &output);

                        // Check if server needs authentication (before /auth login is executed)
                        if text.contains("No server tokens configured") {
                            let auth_needed = AuthNeededEvent {
                                instance_id: instance_id_stdout.clone(),
                                message: "Server requires authentication. Click 'Start Authentication' to begin.".to_string(),
                            };
                            let _ = app_stdout.emit("server-auth-needed", &auth_needed);
                        }

                        // Check if credentials need persistence
                        if text.contains("Credentials stored in memory only") {
                            let _ = app_stdout.emit("server-auth-needs-persistence", &instance_id_stdout);
                        }

                        // Capture profile name: "Auto-selected profile: Natxo (uuid)"
                        if text.contains("Auto-selected profile:") {
                            if let Some(start) = text.find("Auto-selected profile:") {
                                let after = &text[start + 22..];
                                // Extract name before the parenthesis
                                if let Some(paren_pos) = after.find('(') {
                                    let name = after[..paren_pos].trim().to_string();
                                    last_profile_name = Some(name);
                                }
                            }
                        }

                        // Check for authentication events (after /auth login is executed)
                        if let Some(auth_event) = parse_auth_event(&instance_id_stdout, &text) {
                            let _ = app_stdout.emit("server-auth-required", &auth_event);
                        }

                        // Check for "Authentication successful! Mode: XXX"
                        if text.contains("Authentication successful") {
                            // Extract auth mode
                            let auth_mode = if text.contains("Mode:") {
                                text.split("Mode:").nth(1)
                                    .map(|s| s.trim().to_string())
                                    .unwrap_or_else(|| "OAUTH_DEVICE".to_string())
                            } else {
                                "OAUTH_DEVICE".to_string()
                            };

                            let success_event = AuthSuccessEvent {
                                instance_id: instance_id_stdout.clone(),
                                profile_name: last_profile_name.clone(),
                                auth_mode,
                            };
                            let _ = app_stdout.emit("server-auth-success", &success_event);
                        }
                    }
                    Err(e) => {
                        println!("[stdout:{}] Read error: {}", instance_id_stdout, e);
                        break;
                    }
                }
            }
            println!("[stdout:{}] Thread exiting", instance_id_stdout);
        });
    }

    // Spawn thread to read stderr
    let app_stderr = app.clone();
    let instance_id_stderr = instance_id.clone();
    if let Some(stderr) = stderr {
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(text) => {
                        let output = ServerOutput {
                            instance_id: instance_id_stderr.clone(),
                            line: text,
                            stream: "stderr".to_string(),
                            timestamp: Utc::now().to_rfc3339(),
                        };
                        let _ = app_stderr.emit("server-output", &output);
                    }
                    Err(e) => {
                        println!("[stderr:{}] Read error: {}", instance_id_stderr, e);
                        break;
                    }
                }
            }
            println!("[stderr:{}] Thread exiting", instance_id_stderr);
        });
    }

    // Spawn thread to monitor process exit
    let app_monitor = app.clone();
    let state_monitor = state.inner().clone();
    let instance_id_monitor = instance_id.clone();
    std::thread::spawn(move || {
        // Wait for the process to exit
        loop {
            std::thread::sleep(std::time::Duration::from_millis(500));

            let mut should_cleanup = false;
            {
                let state_guard = state_monitor.lock().unwrap();
                if let Some(process_arc) = state_guard.processes.get(&instance_id_monitor) {
                    let mut process = process_arc.lock().unwrap();
                    match process.child.try_wait() {
                        Ok(Some(status)) => {
                            println!("[monitor:{}] Process exited with: {:?}", instance_id_monitor, status);
                            should_cleanup = true;
                        }
                        Ok(None) => {
                            // Still running
                        }
                        Err(e) => {
                            println!("[monitor:{}] Error checking status: {}", instance_id_monitor, e);
                            should_cleanup = true;
                        }
                    }
                } else {
                    // Process was removed from state (stopped by user)
                    break;
                }
            }

            if should_cleanup {
                // Remove from state
                {
                    let mut state_guard = state_monitor.lock().unwrap();
                    state_guard.processes.remove(&instance_id_monitor);
                }

                // Emit stopped status
                let _ = app_monitor.emit("server-status-change", ServerStatusInfo {
                    status: ServerStatus::Stopped,
                    instance_id: instance_id_monitor.clone(),
                    pid: None,
                    started_at: None,
                });

                let _ = app_monitor.emit("server-exit", &instance_id_monitor);
                break;
            }
        }
        println!("[monitor:{}] Thread exiting", instance_id_monitor);
    });

    Ok(StartResult {
        success: true,
        pid: Some(pid),
        error: None,
    })
}

/// Stop a server instance
#[tauri::command]
pub async fn stop_server(
    app: AppHandle,
    state: State<'_, Arc<Mutex<ServerState>>>,
    instance_id: String,
) -> Result<StopResult, ()> {
    println!("[stop_server] Stopping instance: {}", instance_id);

    // Get the process
    let process_arc = {
        let state_guard = state.lock().unwrap();
        match state_guard.processes.get(&instance_id) {
            Some(p) => p.clone(),
            None => {
                return Ok(StopResult {
                    success: false,
                    error: Some("Server is not running".to_string()),
                });
            }
        }
    };

    // Emit stopping status
    let _ = app.emit("server-status-change", ServerStatusInfo {
        status: ServerStatus::Stopping,
        instance_id: instance_id.clone(),
        pid: None,
        started_at: None,
    });

    // Try graceful shutdown first
    let pid = {
        let process = process_arc.lock().unwrap();
        process.child.id()
    };

    println!("[stop_server] Attempting graceful shutdown of PID: {}", pid);

    // Platform-specific termination
    #[cfg(unix)]
    {
        use std::process::Command;
        // Send SIGTERM
        let _ = Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output();
    }

    #[cfg(windows)]
    {
        use std::process::Command;
        // Use taskkill without /F first for graceful shutdown
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string()])
            .output();
    }

    // Wait for process to exit (with timeout)
    let timeout_secs = 10;
    let start = std::time::Instant::now();

    loop {
        if start.elapsed().as_secs() >= timeout_secs {
            println!("[stop_server] Timeout reached, forcing kill");

            // Force kill
            #[cfg(unix)]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }

            #[cfg(windows)]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/PID", &pid.to_string()])
                    .output();
            }

            break;
        }

        {
            let mut process = process_arc.lock().unwrap();
            match process.child.try_wait() {
                Ok(Some(_)) => {
                    println!("[stop_server] Process exited gracefully");
                    break;
                }
                Ok(None) => {
                    // Still running, continue waiting
                }
                Err(e) => {
                    println!("[stop_server] Error checking status: {}", e);
                    break;
                }
            }
        }

        std::thread::sleep(std::time::Duration::from_millis(200));
    }

    // Remove from state
    {
        let mut state_guard = state.lock().unwrap();
        state_guard.processes.remove(&instance_id);
    }

    // Emit stopped status
    let _ = app.emit("server-status-change", ServerStatusInfo {
        status: ServerStatus::Stopped,
        instance_id: instance_id.clone(),
        pid: None,
        started_at: None,
    });

    println!("[stop_server] Server stopped successfully");

    Ok(StopResult {
        success: true,
        error: None,
    })
}

/// Get the status of a server instance
#[tauri::command]
pub fn get_server_status(
    state: State<'_, Arc<Mutex<ServerState>>>,
    instance_id: String,
) -> ServerStatusInfo {
    let state_guard = state.lock().unwrap();

    match state_guard.processes.get(&instance_id) {
        Some(process_arc) => {
            let process = process_arc.lock().unwrap();
            ServerStatusInfo {
                status: ServerStatus::Running,
                instance_id,
                pid: Some(process.child.id()),
                started_at: Some(process.started_at.to_rfc3339()),
            }
        }
        None => ServerStatusInfo {
            status: ServerStatus::Stopped,
            instance_id,
            pid: None,
            started_at: None,
        },
    }
}

/// Get status of all servers
#[tauri::command]
pub fn get_all_server_statuses(
    state: State<'_, Arc<Mutex<ServerState>>>,
) -> Vec<ServerStatusInfo> {
    let state_guard = state.lock().unwrap();

    state_guard.processes.iter().map(|(id, process_arc)| {
        let process = process_arc.lock().unwrap();
        ServerStatusInfo {
            status: ServerStatus::Running,
            instance_id: id.clone(),
            pid: Some(process.child.id()),
            started_at: Some(process.started_at.to_rfc3339()),
        }
    }).collect()
}

/// Send a command to the server's stdin
#[tauri::command]
pub fn send_server_command(
    state: State<'_, Arc<Mutex<ServerState>>>,
    instance_id: String,
    command: String,
) -> Result<bool, ()> {
    println!("[send_command:{}] Sending: {}", instance_id, command);

    let state_guard = state.lock().unwrap();

    match state_guard.processes.get(&instance_id) {
        Some(process_arc) => {
            let process = process_arc.lock().unwrap();
            if let Some(ref tx) = process.stdin_tx {
                match tx.send(command) {
                    Ok(_) => Ok(true),
                    Err(e) => {
                        println!("[send_command:{}] Error: {}", instance_id, e);
                        Ok(false)
                    }
                }
            } else {
                println!("[send_command:{}] No stdin channel", instance_id);
                Ok(false)
            }
        }
        None => {
            println!("[send_command:{}] Server not running", instance_id);
            Ok(false)
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Strip ANSI escape codes from a string
fn strip_ansi_codes(s: &str) -> String {
    // Simple regex-free ANSI stripper for escape sequences like \x1b[...m
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Skip until we hit 'm' (end of ANSI color code)
            while let Some(&next) = chars.peek() {
                chars.next();
                if next == 'm' {
                    break;
                }
            }
        } else {
            result.push(c);
        }
    }
    result
}

/// Parse authentication event from server output
fn parse_auth_event(instance_id: &str, line: &str) -> Option<AuthEvent> {
    // Strip ANSI codes first (Hytale server uses colors)
    let clean_line = strip_ansi_codes(line);

    // Look for the auth URL pattern with user_code in query string
    // Example: "Or visit: https://oauth.accounts.hytale.com/oauth2/device/verify?user_code=MNkHJhwD"
    if clean_line.contains("user_code=") && clean_line.contains("https://") {
        if let Some(url_start) = clean_line.find("https://") {
            let url_part = &clean_line[url_start..];
            let url_end = url_part.find(|c: char| c.is_whitespace()).unwrap_or(url_part.len());
            let auth_url = url_part[..url_end].to_string();

            // Extract code from URL
            if let Some(code_start) = auth_url.find("user_code=") {
                let code = auth_url[code_start + 10..].to_string();
                return Some(AuthEvent {
                    instance_id: instance_id.to_string(),
                    auth_url,
                    code,
                });
            }
        }
    }

    // Also check for "Enter code: XXXX" pattern (backup method)
    if clean_line.contains("Enter code:") {
        if let Some(code_start) = clean_line.find("Enter code:") {
            let after_code = &clean_line[code_start + 11..];
            let code = after_code.trim().split_whitespace().next()?;
            // Use the correct OAuth URL
            let auth_url = format!("https://oauth.accounts.hytale.com/oauth2/device/verify?user_code={}", code);
            return Some(AuthEvent {
                instance_id: instance_id.to_string(),
                auth_url,
                code: code.to_string(),
            });
        }
    }

    None
}
