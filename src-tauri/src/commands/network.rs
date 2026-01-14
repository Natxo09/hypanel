use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallInfo {
    pub os: String,
    pub firewall_type: Option<String>,
    pub firewall_enabled: bool,
    pub rule_exists: bool,
    pub rule_name: String,
    pub port: u16,
    pub command_to_add: String,
    pub command_to_remove: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirewallResult {
    pub success: bool,
    pub message: String,
    pub error: Option<String>,
}

/// Get current OS
fn get_os() -> &'static str {
    #[cfg(target_os = "windows")]
    return "windows";
    #[cfg(target_os = "linux")]
    return "linux";
    #[cfg(target_os = "macos")]
    return "macos";
    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    return "unknown";
}

/// Check if Windows firewall is enabled (any profile)
#[cfg(target_os = "windows")]
fn check_windows_firewall_enabled() -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-NetFirewallProfile | Select-Object -ExpandProperty Enabled",
        ])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            // If any profile returns True, firewall is enabled
            stdout.contains("True")
        }
        Err(_) => true, // Assume enabled if we can't check
    }
}

/// Check if Windows firewall rule exists
#[cfg(target_os = "windows")]
fn check_windows_rule_exists(rule_name: &str) -> bool {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "Get-NetFirewallRule -DisplayName '{}' -ErrorAction SilentlyContinue",
                rule_name
            ),
        ])
        .output();

    match output {
        Ok(out) => !out.stdout.is_empty() && out.status.success(),
        Err(_) => false,
    }
}

/// Check if Linux iptables rule exists
#[cfg(target_os = "linux")]
fn check_iptables_rule_exists(port: u16) -> bool {
    let output = Command::new("iptables")
        .args(["-C", "INPUT", "-p", "udp", "--dport", &port.to_string(), "-j", "ACCEPT"])
        .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

/// Check if Linux ufw rule exists
#[cfg(target_os = "linux")]
fn check_ufw_rule_exists(port: u16) -> bool {
    let output = Command::new("ufw")
        .args(["status", "numbered"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            stdout.contains(&format!("{}/udp", port))
        }
        Err(_) => false,
    }
}

/// Detect available firewall on Linux
#[cfg(target_os = "linux")]
fn detect_linux_firewall() -> Option<&'static str> {
    // Check for ufw first (more user-friendly)
    if Command::new("which").arg("ufw").output().map(|o| o.status.success()).unwrap_or(false) {
        // Check if ufw is active
        if let Ok(output) = Command::new("ufw").arg("status").output() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if stdout.contains("Status: active") {
                return Some("ufw");
            }
        }
    }

    // Check for iptables
    if Command::new("which").arg("iptables").output().map(|o| o.status.success()).unwrap_or(false) {
        return Some("iptables");
    }

    None
}

/// Get firewall information for a specific port
#[tauri::command]
pub async fn get_firewall_info(port: u16, server_name: String) -> Result<FirewallInfo, ()> {
    let os = get_os();
    let rule_name = format!("HyPanel - {}", server_name);

    #[cfg(target_os = "windows")]
    {
        let firewall_enabled = check_windows_firewall_enabled();
        let rule_exists = check_windows_rule_exists(&rule_name);

        Ok(FirewallInfo {
            os: os.to_string(),
            firewall_type: Some("Windows Firewall".to_string()),
            firewall_enabled,
            rule_exists,
            rule_name: rule_name.clone(),
            port,
            command_to_add: format!(
                "New-NetFirewallRule -DisplayName \"{}\" -Direction Inbound -Protocol UDP -LocalPort {} -Action Allow",
                rule_name, port
            ),
            command_to_remove: format!(
                "Remove-NetFirewallRule -DisplayName \"{}\"",
                rule_name
            ),
            error: None,
        })
    }

    #[cfg(target_os = "linux")]
    {
        let firewall_type = detect_linux_firewall();

        let (rule_exists, cmd_add, cmd_remove) = match firewall_type {
            Some("ufw") => (
                check_ufw_rule_exists(port),
                format!("sudo ufw allow {}/udp comment '{}'", port, rule_name),
                format!("sudo ufw delete allow {}/udp", port),
            ),
            Some("iptables") => (
                check_iptables_rule_exists(port),
                format!("sudo iptables -A INPUT -p udp --dport {} -j ACCEPT -m comment --comment \"{}\"", port, rule_name),
                format!("sudo iptables -D INPUT -p udp --dport {} -j ACCEPT", port),
            ),
            _ => (false, String::new(), String::new()),
        };

        // For Linux, if we detected a firewall it's likely active
        let firewall_enabled = firewall_type.is_some();

        Ok(FirewallInfo {
            os: os.to_string(),
            firewall_type: firewall_type.map(|s| s.to_string()),
            firewall_enabled,
            rule_exists,
            rule_name,
            port,
            command_to_add: cmd_add,
            command_to_remove: cmd_remove,
            error: if firewall_type.is_none() {
                Some("No supported firewall detected".to_string())
            } else {
                None
            },
        })
    }

    #[cfg(target_os = "macos")]
    {
        // macOS uses pf (packet filter) which is more complex
        // For now, just return info without automatic detection
        Ok(FirewallInfo {
            os: os.to_string(),
            firewall_type: Some("macOS Firewall".to_string()),
            firewall_enabled: true, // Assume enabled, macOS firewall is usually on
            rule_exists: false,
            rule_name,
            port,
            command_to_add: format!(
                "# Add to /etc/pf.conf:\npass in proto udp from any to any port {}",
                port
            ),
            command_to_remove: "# Remove the rule from /etc/pf.conf".to_string(),
            error: Some("macOS firewall requires manual configuration".to_string()),
        })
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Ok(FirewallInfo {
            os: os.to_string(),
            firewall_type: None,
            firewall_enabled: false,
            rule_exists: false,
            rule_name,
            port,
            command_to_add: String::new(),
            command_to_remove: String::new(),
            error: Some("Unsupported operating system".to_string()),
        })
    }
}

/// Add firewall rule (requires elevated permissions on Windows)
#[tauri::command]
pub async fn add_firewall_rule(port: u16, server_name: String) -> Result<FirewallResult, ()> {
    let rule_name = format!("HyPanel - {}", server_name);

    #[cfg(target_os = "windows")]
    {
        // Check if rule already exists
        if check_windows_rule_exists(&rule_name) {
            return Ok(FirewallResult {
                success: true,
                message: "Firewall rule already exists".to_string(),
                error: None,
            });
        }

        // Write script to a temp file to avoid argument escaping issues
        let script = format!(
            "$ruleName = '{}'; New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol UDP -LocalPort {} -Action Allow",
            rule_name.replace("'", "''"), port
        );

        let temp_dir = std::env::temp_dir();
        let script_path = temp_dir.join("hypanel_firewall.ps1");

        if let Err(e) = std::fs::write(&script_path, &script) {
            return Ok(FirewallResult {
                success: false,
                message: "Failed to create temporary script".to_string(),
                error: Some(e.to_string()),
            });
        }

        let full_command = format!(
            "Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File \"{}\"' -Verb RunAs -Wait",
            script_path.display()
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &full_command])
            .output();

        // Clean up temp file
        let _ = std::fs::remove_file(&script_path);

        match output {
            Ok(_) => {
                // Give Windows a moment to process
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Verify the rule was created
                if check_windows_rule_exists(&rule_name) {
                    Ok(FirewallResult {
                        success: true,
                        message: format!("Firewall rule created for UDP port {}", port),
                        error: None,
                    })
                } else {
                    Ok(FirewallResult {
                        success: false,
                        message: "Failed to create firewall rule. Try running as administrator.".to_string(),
                        error: None,
                    })
                }
            }
            Err(e) => Ok(FirewallResult {
                success: false,
                message: "Failed to execute PowerShell".to_string(),
                error: Some(e.to_string()),
            }),
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Linux requires sudo, which needs terminal interaction
        // Return the command for the user to run manually
        Ok(FirewallResult {
            success: false,
            message: "Linux firewall requires manual configuration with sudo".to_string(),
            error: Some("Please run the firewall command manually in a terminal with sudo".to_string()),
        })
    }

    #[cfg(target_os = "macos")]
    {
        Ok(FirewallResult {
            success: false,
            message: "macOS firewall requires manual configuration".to_string(),
            error: Some("Please configure the firewall manually".to_string()),
        })
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
    {
        Ok(FirewallResult {
            success: false,
            message: "Unsupported operating system".to_string(),
            error: Some("Cannot configure firewall on this OS".to_string()),
        })
    }
}

/// Remove firewall rule
#[tauri::command]
pub async fn remove_firewall_rule(server_name: String) -> Result<FirewallResult, ()> {
    let rule_name = format!("HyPanel - {}", server_name);

    #[cfg(target_os = "windows")]
    {
        if !check_windows_rule_exists(&rule_name) {
            return Ok(FirewallResult {
                success: true,
                message: "Firewall rule does not exist".to_string(),
                error: None,
            });
        }

        let script = format!("Remove-NetFirewallRule -DisplayName '{}'", rule_name);

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("Start-Process powershell -ArgumentList '-NoProfile -Command {}' -Verb RunAs -Wait", script),
            ])
            .output();

        match output {
            Ok(_) => {
                std::thread::sleep(std::time::Duration::from_millis(500));

                if !check_windows_rule_exists(&rule_name) {
                    Ok(FirewallResult {
                        success: true,
                        message: format!("Firewall rule '{}' removed successfully", rule_name),
                        error: None,
                    })
                } else {
                    Ok(FirewallResult {
                        success: false,
                        message: "Failed to remove firewall rule".to_string(),
                        error: None,
                    })
                }
            }
            Err(e) => Ok(FirewallResult {
                success: false,
                message: "Failed to execute PowerShell".to_string(),
                error: Some(e.to_string()),
            }),
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(FirewallResult {
            success: false,
            message: "Manual removal required".to_string(),
            error: Some("Please remove the firewall rule manually".to_string()),
        })
    }
}
