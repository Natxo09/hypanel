use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use sysinfo::{Pid, System};
use tauri::State;

use super::server::ServerState;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerMetrics {
    pub instance_id: String,
    pub pid: Option<u32>,
    pub cpu_usage: Option<f32>,
    pub memory_mb: Option<f64>,
    pub memory_percent: Option<f32>,
    pub uptime_seconds: Option<u64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub total_memory_mb: f64,
    pub used_memory_mb: f64,
    pub available_memory_mb: f64,
    pub cpu_count: usize,
    pub cpu_usage: f32,
}

// ============================================================================
// Cached System State
// ============================================================================

/// Cached sysinfo::System instance to avoid expensive re-initialization
pub struct MetricsState {
    pub system: System,
}

impl MetricsState {
    pub fn new() -> Self {
        let mut system = System::new_all();
        // Initial refresh to populate data
        system.refresh_all();
        Self { system }
    }
}

// ============================================================================
// Commands
// ============================================================================

/// Get metrics for a specific server instance
#[tauri::command]
pub fn get_server_metrics(
    server_state: State<'_, Arc<Mutex<ServerState>>>,
    metrics_state: State<'_, Arc<Mutex<MetricsState>>>,
    instance_id: String,
) -> ServerMetrics {
    let state_guard = server_state.lock().unwrap();

    match state_guard.processes.get(&instance_id) {
        Some(process_arc) => {
            let process = process_arc.lock().unwrap();
            let pid = process.child.id();

            // Calculate uptime
            let uptime_seconds = {
                let now = chrono::Utc::now();
                let started = process.started_at;
                (now - started).num_seconds().max(0) as u64
            };

            // Get process metrics using cached sysinfo
            let mut metrics = metrics_state.lock().unwrap();
            metrics.system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

            let (cpu_usage, memory_mb, memory_percent) = if let Some(proc) = metrics.system.process(Pid::from_u32(pid)) {
                let cpu = proc.cpu_usage();
                let mem_bytes = proc.memory();
                let mem_mb = mem_bytes as f64 / 1024.0 / 1024.0;

                // Calculate memory percentage
                let total_mem = metrics.system.total_memory();
                let mem_pct = if total_mem > 0 {
                    (mem_bytes as f32 / total_mem as f32) * 100.0
                } else {
                    0.0
                };

                (Some(cpu), Some(mem_mb), Some(mem_pct))
            } else {
                (None, None, None)
            };

            ServerMetrics {
                instance_id,
                pid: Some(pid),
                cpu_usage,
                memory_mb,
                memory_percent,
                uptime_seconds: Some(uptime_seconds),
                status: "running".to_string(),
            }
        }
        None => ServerMetrics {
            instance_id,
            pid: None,
            cpu_usage: None,
            memory_mb: None,
            memory_percent: None,
            uptime_seconds: None,
            status: "stopped".to_string(),
        },
    }
}

/// Get metrics for all running servers
#[tauri::command]
pub fn get_all_server_metrics(
    server_state: State<'_, Arc<Mutex<ServerState>>>,
    metrics_state: State<'_, Arc<Mutex<MetricsState>>>,
) -> Vec<ServerMetrics> {
    let state_guard = server_state.lock().unwrap();

    if state_guard.processes.is_empty() {
        return vec![];
    }

    let mut metrics = metrics_state.lock().unwrap();
    metrics.system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    state_guard
        .processes
        .iter()
        .map(|(id, process_arc)| {
            let process = process_arc.lock().unwrap();
            let pid = process.child.id();

            let uptime_seconds = {
                let now = chrono::Utc::now();
                (now - process.started_at).num_seconds().max(0) as u64
            };

            let (cpu_usage, memory_mb, memory_percent) = if let Some(proc) = metrics.system.process(Pid::from_u32(pid)) {
                let cpu = proc.cpu_usage();
                let mem_bytes = proc.memory();
                let mem_mb = mem_bytes as f64 / 1024.0 / 1024.0;
                let total_mem = metrics.system.total_memory();
                let mem_pct = if total_mem > 0 {
                    (mem_bytes as f32 / total_mem as f32) * 100.0
                } else {
                    0.0
                };
                (Some(cpu), Some(mem_mb), Some(mem_pct))
            } else {
                (None, None, None)
            };

            ServerMetrics {
                instance_id: id.clone(),
                pid: Some(pid),
                cpu_usage,
                memory_mb,
                memory_percent,
                uptime_seconds: Some(uptime_seconds),
                status: "running".to_string(),
            }
        })
        .collect()
}

/// Get system-wide metrics
#[tauri::command]
pub fn get_system_metrics(
    metrics_state: State<'_, Arc<Mutex<MetricsState>>>,
) -> SystemMetrics {
    let mut metrics = metrics_state.lock().unwrap();

    // Only refresh what we need - much faster than refresh_all()
    metrics.system.refresh_memory();
    metrics.system.refresh_cpu_all();

    let total_memory = metrics.system.total_memory();
    let used_memory = metrics.system.used_memory();
    let available_memory = metrics.system.available_memory();
    let cpu_usage = metrics.system.global_cpu_usage();

    SystemMetrics {
        total_memory_mb: total_memory as f64 / 1024.0 / 1024.0,
        used_memory_mb: used_memory as f64 / 1024.0 / 1024.0,
        available_memory_mb: available_memory as f64 / 1024.0 / 1024.0,
        cpu_count: metrics.system.cpus().len(),
        cpu_usage,
    }
}
