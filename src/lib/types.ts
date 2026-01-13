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

export interface CopyProgress {
  current: number;
  total: number;
  current_file: string;
  done: boolean;
  error: string | null;
}

export interface DownloadProgress {
  stage: "authenticating" | "downloading" | "extracting" | "done" | "error";
  progress: number;
  message: string;
  error: string | null;
}
