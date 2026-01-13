use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogLine {
    pub line_number: usize,
    pub content: String,
    pub level: Option<String>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogReadResult {
    pub success: bool,
    pub lines: Vec<LogLine>,
    pub total_lines: usize,
    pub file_size: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFilesResult {
    pub success: bool,
    pub files: Vec<LogFile>,
    pub error: Option<String>,
}

// ============================================================================
// Commands
// ============================================================================

/// List log files in the instance's logs directory
#[tauri::command]
pub fn list_log_files(instance_path: String) -> LogFilesResult {
    let logs_dir = Path::new(&instance_path).join("Server").join("logs");

    if !logs_dir.exists() {
        return LogFilesResult {
            success: true,
            files: vec![],
            error: None,
        };
    }

    let mut files = Vec::new();

    match fs::read_dir(&logs_dir) {
        Ok(entries) => {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext == "log" || ext == "txt" {
                            let metadata = fs::metadata(&path).ok();
                            let modified = metadata.as_ref().and_then(|m| {
                                m.modified().ok().map(|t| {
                                    let datetime: chrono::DateTime<chrono::Utc> = t.into();
                                    datetime.to_rfc3339()
                                })
                            });
                            let size = metadata.map(|m| m.len()).unwrap_or(0);

                            files.push(LogFile {
                                name: path.file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default(),
                                path: path.to_string_lossy().to_string(),
                                size,
                                modified,
                            });
                        }
                    }
                }
            }
        }
        Err(e) => {
            return LogFilesResult {
                success: false,
                files: vec![],
                error: Some(format!("Failed to read logs directory: {}", e)),
            };
        }
    }

    // Sort by modification time (newest first)
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    LogFilesResult {
        success: true,
        files,
        error: None,
    }
}

/// Read log file with optional tail (last N lines)
#[tauri::command]
pub fn read_log_file(
    file_path: String,
    tail_lines: Option<usize>,
    offset: Option<usize>,
) -> LogReadResult {
    let path = Path::new(&file_path);

    if !path.exists() {
        return LogReadResult {
            success: false,
            lines: vec![],
            total_lines: 0,
            file_size: 0,
            error: Some("Log file not found".to_string()),
        };
    }

    let file_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    let file = match File::open(&path) {
        Ok(f) => f,
        Err(e) => {
            return LogReadResult {
                success: false,
                lines: vec![],
                total_lines: 0,
                file_size,
                error: Some(format!("Failed to open log file: {}", e)),
            };
        }
    };

    let reader = BufReader::new(file);
    let all_lines: Vec<String> = reader.lines().filter_map(Result::ok).collect();
    let total_lines = all_lines.len();

    // Apply offset and limit
    let start = offset.unwrap_or(0);
    let lines_to_take = tail_lines.unwrap_or(500); // Default to last 500 lines

    let selected_lines: Vec<LogLine> = if start == 0 && tail_lines.is_some() {
        // Tail mode: get last N lines
        all_lines
            .iter()
            .rev()
            .take(lines_to_take)
            .rev()
            .enumerate()
            .map(|(i, line)| {
                let line_num = total_lines - lines_to_take.min(total_lines) + i + 1;
                parse_log_line(line_num, line)
            })
            .collect()
    } else {
        // Offset mode: get lines starting from offset
        all_lines
            .iter()
            .skip(start)
            .take(lines_to_take)
            .enumerate()
            .map(|(i, line)| parse_log_line(start + i + 1, line))
            .collect()
    };

    LogReadResult {
        success: true,
        lines: selected_lines,
        total_lines,
        file_size,
        error: None,
    }
}

/// Read new lines from a log file (for live tailing)
/// Returns lines after the given byte offset
#[tauri::command]
pub fn tail_log_file(
    file_path: String,
    from_byte: u64,
) -> LogReadResult {
    let path = Path::new(&file_path);

    if !path.exists() {
        return LogReadResult {
            success: false,
            lines: vec![],
            total_lines: 0,
            file_size: 0,
            error: Some("Log file not found".to_string()),
        };
    }

    let file_size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    // If file hasn't grown, return empty
    if file_size <= from_byte {
        return LogReadResult {
            success: true,
            lines: vec![],
            total_lines: 0,
            file_size,
            error: None,
        };
    }

    let mut file = match File::open(&path) {
        Ok(f) => f,
        Err(e) => {
            return LogReadResult {
                success: false,
                lines: vec![],
                total_lines: 0,
                file_size,
                error: Some(format!("Failed to open log file: {}", e)),
            };
        }
    };

    // Seek to the position
    if let Err(e) = file.seek(SeekFrom::Start(from_byte)) {
        return LogReadResult {
            success: false,
            lines: vec![],
            total_lines: 0,
            file_size,
            error: Some(format!("Failed to seek in log file: {}", e)),
        };
    }

    let reader = BufReader::new(file);
    let new_lines: Vec<LogLine> = reader
        .lines()
        .filter_map(Result::ok)
        .enumerate()
        .map(|(i, line)| parse_log_line(i + 1, &line))
        .collect();

    let total = new_lines.len();

    LogReadResult {
        success: true,
        lines: new_lines,
        total_lines: total,
        file_size,
        error: None,
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Parse a log line and extract level and timestamp if possible
fn parse_log_line(line_number: usize, content: &str) -> LogLine {
    let level = extract_log_level(content);
    let timestamp = extract_timestamp(content);

    LogLine {
        line_number,
        content: content.to_string(),
        level,
        timestamp,
    }
}

/// Extract log level from line (INFO, WARN, ERROR, DEBUG)
fn extract_log_level(line: &str) -> Option<String> {
    let line_upper = line.to_uppercase();

    if line_upper.contains("[ERROR]") || line_upper.contains(" ERROR ") || line_upper.contains("ERROR:") {
        Some("ERROR".to_string())
    } else if line_upper.contains("[WARN]") || line_upper.contains(" WARN ") || line_upper.contains("WARNING") {
        Some("WARN".to_string())
    } else if line_upper.contains("[INFO]") || line_upper.contains(" INFO ") {
        Some("INFO".to_string())
    } else if line_upper.contains("[DEBUG]") || line_upper.contains(" DEBUG ") {
        Some("DEBUG".to_string())
    } else if line_upper.contains("[TRACE]") || line_upper.contains(" TRACE ") {
        Some("TRACE".to_string())
    } else {
        None
    }
}

/// Extract timestamp from line if present
fn extract_timestamp(line: &str) -> Option<String> {
    // Common patterns: [2024-01-14 12:34:56] or 2024-01-14T12:34:56
    // Simple heuristic: look for date-like pattern at start
    let trimmed = line.trim_start_matches('[');

    // Check for ISO-like timestamp
    if trimmed.len() >= 19 {
        let potential_ts = &trimmed[..19];
        // Check if it looks like a timestamp (starts with digit, contains - and :)
        if potential_ts.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false)
            && potential_ts.contains('-')
            && potential_ts.contains(':')
        {
            return Some(potential_ts.trim_end_matches(']').to_string());
        }
    }

    None
}
