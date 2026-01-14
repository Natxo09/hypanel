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
export type FileSourceType = "launcher" | "download" | "existing";

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
  // Version tracking
  installed_version: string | null;  // e.g. "0.1.0"
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

// Player tracking types
export interface OnlinePlayer {
  name: string;
  uuid: string;
  joined_at: string;
}

export interface PlayerJoinEvent {
  instance_id: string;
  player: OnlinePlayer;
}

export interface PlayerLeaveEvent {
  instance_id: string;
  player_name: string;
  uuid: string;
}

export interface OnlinePlayersResponse {
  instance_id: string;
  players: OnlinePlayer[];
  count: number;
}

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

// Version checking types
export interface VersionSettings {
  check_on_startup: boolean;
  check_periodic: boolean;
  check_on_server_start: boolean;
}

export interface VersionCheckResult {
  instance_id: string;
  instance_name: string;
  installed_version: string | null;
  available_version: string | null;
  update_available: boolean;
  version_unknown: boolean;
}

export interface VersionUpdateEvent {
  results: VersionCheckResult[];
  available_version: string;
}

// ============================================================================
// Config Files Types
// ============================================================================

// Generic JSON result
export interface JsonReadResult {
  success: boolean;
  content: unknown | null;
  raw: string | null;
  error: string | null;
}

export interface JsonWriteResult {
  success: boolean;
  error: string | null;
}

// Whitelist
export interface Whitelist {
  enabled: boolean;
  list: string[];
}

export interface WhitelistResult {
  success: boolean;
  whitelist: Whitelist | null;
  error: string | null;
}

// Bans
export interface Ban {
  uuid: string;
  name?: string;
  reason?: string;
  bannedAt?: string;
  bannedBy?: string;
}

export interface BansResult {
  success: boolean;
  bans: Ban[] | null;
  error: string | null;
}

// Permissions
export interface UserPermissions {
  groups: string[];
}

export interface Permissions {
  users: Record<string, UserPermissions>;
  groups: Record<string, string[]>;
}

export interface PermissionsResult {
  success: boolean;
  permissions: Permissions | null;
  error: string | null;
}

// Server Config
export interface ServerConfigDefaults {
  World: string;
  GameMode: string;
}

export interface ServerConfig {
  Version: number;
  ServerName: string;
  MOTD: string;
  Password: string;
  MaxPlayers: number;
  MaxViewRadius: number;
  LocalCompressionEnabled: boolean;
  Defaults: ServerConfigDefaults;
  // Extra fields stored as raw JSON
  [key: string]: unknown;
}

export interface ServerConfigResult {
  success: boolean;
  config: ServerConfig | null;
  raw: string | null;
  error: string | null;
}

// ============================================================================
// Worlds Types
// ============================================================================

export interface WorldInfo {
  name: string;
  path: string;
  uuid: string | null;
  seed: number | null;
  world_gen_type: string | null;
  world_gen_name: string | null;
  is_ticking: boolean | null;
  is_pvp_enabled: boolean | null;
}

export interface WorldsListResult {
  success: boolean;
  worlds: WorldInfo[];
  error: string | null;
}

export interface WorldUUID {
  $binary: string;
  $type: string;
}

export interface WorldGenConfig {
  Type: string;
  Name: string;
}

export interface WorldConfig {
  Version: number;
  UUID: WorldUUID;
  Seed: number;
  WorldGen: WorldGenConfig;
  // Boolean toggles
  IsTicking: boolean;
  IsBlockTicking: boolean;
  IsPvpEnabled: boolean;
  IsFallDamageEnabled: boolean;
  IsGameTimePaused: boolean;
  IsSpawningNPC: boolean;
  IsSpawnMarkersEnabled: boolean;
  IsAllNPCFrozen: boolean;
  IsSavingPlayers: boolean;
  IsSavingChunks: boolean;
  IsUnloadingChunks: boolean;
  IsObjectiveMarkersEnabled: boolean;
  IsCompassUpdating: boolean;
  DeleteOnUniverseStart: boolean;
  DeleteOnRemove: boolean;
  // String fields
  GameplayConfig: string;
  GameTime?: string;
  // Extra fields
  [key: string]: unknown;
}

export interface WorldConfigResult {
  success: boolean;
  config: WorldConfig | null;
  raw: string | null;
  error: string | null;
}
