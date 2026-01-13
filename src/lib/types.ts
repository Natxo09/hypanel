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
