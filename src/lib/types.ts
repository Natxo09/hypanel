export interface JavaInfo {
  installed: boolean;
  version: string | null;
  major_version: number | null;
  vendor: string | null;
  is_valid: boolean;
  java_path: string | null;
  error: string | null;
}

export interface SystemPaths {
  hytale_launcher_path: string | null;
  server_path: string | null;
  assets_path: string | null;
  exists: boolean;
}

export interface SystemStatus {
  java: JavaInfo | null;
  paths: SystemPaths | null;
  loading: boolean;
  error: string | null;
}

// Onboarding flow types
export type FileSourceType = "launcher" | "download";

export interface OnboardingState {
  step: number;
  javaValid: boolean;
  fileSource: FileSourceType | null;
  destinationPath: string | null;
  launcherAvailable: boolean;
}

export interface CopyResult {
  success: boolean;
  files_copied: number;
  destination: string;
  error: string | null;
}

export interface CopyProgress {
  current: number;
  total: number;
  current_file: string;
  done: boolean;
  error: string | null;
}

export interface DownloadProgress {
  status: string;
  percentage: number | null;
  message: string;
}

export interface DownloaderInfo {
  available: boolean;
  cli_version: string | null;
  game_version: string | null;
  path: string | null;
  error: string | null;
}

export interface DownloadResult {
  success: boolean;
  output_path: string | null;
  error: string | null;
}

export interface InstallCliResult {
  success: boolean;
  path: string | null;
  error: string | null;
}

export interface ServerFilesStatus {
  exists: boolean;
  has_server_jar: boolean;
  has_assets: boolean;
  server_path: string | null;
}

// Instance types (database)
export interface Instance {
  id: string;
  name: string;
  path: string;
  java_path: string | null;
  jvm_args: string | null;
  server_args: string | null;
  created_at: string;
  updated_at: string;
  // Auth fields
  auth_status: string | null;        // unknown, authenticated, unauthenticated, offline
  auth_persistence: string | null;   // memory, encrypted
  auth_profile_name: string | null;  // e.g. "Natxo"
}

export interface InstanceResult {
  success: boolean;
  instance: Instance | null;
  error: string | null;
}

export interface InstancesListResult {
  success: boolean;
  instances: Instance[];
  error: string | null;
}

export interface DeleteResult {
  success: boolean;
  error: string | null;
}

// Server management types
export type ServerStatus = "stopped" | "starting" | "running" | "stopping";

export interface ServerStatusInfo {
  status: ServerStatus;
  instance_id: string;
  pid: number | null;
  started_at: string | null;
}

export interface ServerOutput {
  instance_id: string;
  line: string;
  stream: "stdout" | "stderr";
  timestamp: string;
}

export interface StartResult {
  success: boolean;
  pid: number | null;
  error: string | null;
}

export interface StopResult {
  success: boolean;
  error: string | null;
}

export interface AuthEvent {
  instance_id: string;
  auth_url: string;
  code: string;
}

export interface AuthNeededEvent {
  instance_id: string;
  message: string;
}

export interface AuthSuccessEvent {
  instance_id: string;
  profile_name: string | null;
  auth_mode: string;  // e.g. "OAUTH_DEVICE"
}

// Auth state for UI
export type AuthStatus = "none" | "needs_auth" | "awaiting_code" | "authenticated";

// Metrics types
export interface ServerMetrics {
  instance_id: string;
  pid: number | null;
  cpu_usage: number | null;
  memory_mb: number | null;
  memory_percent: number | null;
  uptime_seconds: number | null;
  status: string;
}

export interface SystemMetrics {
  total_memory_mb: number;
  used_memory_mb: number;
  available_memory_mb: number;
  cpu_count: number;
  cpu_usage: number;
}

// Logs types
export interface LogFile {
  name: string;
  path: string;
  size: number;
  modified: string | null;
}

export interface LogLine {
  line_number: number;
  content: string;
  level: string | null;
  timestamp: string | null;
}

export interface LogReadResult {
  success: boolean;
  lines: LogLine[];
  total_lines: number;
  file_size: number;
  error: string | null;
}

export interface LogFilesResult {
  success: boolean;
  files: LogFile[];
  error: string | null;
}
