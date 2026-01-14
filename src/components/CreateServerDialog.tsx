import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  FolderOpen,
  Download,
  Copy,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  Instance,
  SystemPaths,
  FileSourceType,
  CopyResult,
  DownloaderInfo,
  DownloadProgress,
  DownloadResult,
  InstallCliResult,
  ServerFilesStatus,
  InstanceResult,
} from "@/lib/types";

interface CreateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: Instance[];
  onServerCreated: (instance: Instance) => void;
}

type Step = "folder" | "source" | "progress" | "config";

// Normalize path for comparison (handle Windows/Unix differences)
function normalizePath(path: string): string {
  return path.toLowerCase().replace(/\\/g, "/").replace(/\/+$/, "");
}

// Check if running on macOS (CLI download not supported)
function isMacOS(): boolean {
  return navigator.platform.toLowerCase().includes("mac");
}

// Extract port from server_args
function extractPort(serverArgs: string | null): number {
  if (!serverArgs) return 5520;
  const match = serverArgs.match(/--bind\s+[^:]+:(\d+)/);
  return match ? parseInt(match[1]) : 5520;
}

// Find next available port
function findNextAvailablePort(instances: Instance[], startPort: number = 5520): number {
  const usedPorts = instances.map((i) => extractPort(i.server_args));
  let port = startPort;
  while (usedPorts.includes(port) && port <= 65535) {
    port++;
  }
  return port <= 65535 ? port : 5520;
}

export function CreateServerDialog({
  open,
  onOpenChange,
  instances,
  onServerCreated,
}: CreateServerDialogProps) {
  const [step, setStep] = useState<Step>("folder");

  // System info
  const [paths, setPaths] = useState<SystemPaths | null>(null);
  const [downloader, setDownloader] = useState<DownloaderInfo | null>(null);

  // Folder selection
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [serverFilesStatus, setServerFilesStatus] = useState<ServerFilesStatus | null>(null);
  const [checkingFiles, setCheckingFiles] = useState(false);

  // Source selection
  const [selectedSource, setSelectedSource] = useState<FileSourceType | null>(null);

  // Copy state
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);

  // Download state
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

  // CLI installation state
  const [installingCli, setInstallingCli] = useState(false);
  const [cliInstallProgress, setCliInstallProgress] = useState<DownloadProgress | null>(null);

  // Config
  const [instanceName, setInstanceName] = useState("My Server");
  const [instancePort, setInstancePort] = useState("5520");
  const [savingInstance, setSavingInstance] = useState(false);

  // Track downloaded version to save with instance
  const [downloadedVersion, setDownloadedVersion] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("folder");
      setDestinationPath(null);
      setServerFilesStatus(null);
      setSelectedSource(null);
      setCopyResult(null);
      setDownloadResult(null);
      setDownloadProgress(null);
      setCliInstallProgress(null);
      setInstanceName("My Server");
      setInstancePort(findNextAvailablePort(instances).toString());
      setDownloadedVersion(null);
      loadSystemInfo();
    }
  }, [open, instances]);

  async function loadSystemInfo() {
    try {
      const [pathsInfo, downloaderInfo] = await Promise.all([
        invoke<SystemPaths>("get_system_paths"),
        invoke<DownloaderInfo>("get_downloader_info"),
      ]);
      setPaths(pathsInfo);
      setDownloader(downloaderInfo);
    } catch (err) {
      console.error("Failed to load system info:", err);
    }
  }

  async function selectFolder() {
    const selected = await openFolderDialog({
      directory: true,
      multiple: false,
      title: "Select server folder",
    });

    if (selected) {
      const path = selected as string;
      setDestinationPath(path);
      setServerFilesStatus(null);
      setCheckingFiles(true);

      try {
        const status = await invoke<ServerFilesStatus>("check_server_files", { path });
        setServerFilesStatus(status);
        // Don't auto-advance - let user review detection and click Next
      } catch (err) {
        console.error("Failed to check server files:", err);
      } finally {
        setCheckingFiles(false);
      }
    }
  }

  async function copyFiles() {
    if (!paths?.hytale_launcher_path || !destinationPath) return;

    setCopying(true);
    setCopyResult(null);
    setStep("progress");

    try {
      const result = await invoke<CopyResult>("copy_server_files", {
        source: paths.hytale_launcher_path,
        destination: destinationPath,
      });
      setCopyResult(result);
      if (result.success) {
        setStep("config");
      }
    } catch (err) {
      setCopyResult({
        success: false,
        files_copied: 0,
        destination: destinationPath,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCopying(false);
    }
  }

  async function downloadFiles() {
    if (!destinationPath) return;

    setDownloading(true);
    setDownloadProgress(null);
    setDownloadResult(null);
    setStep("progress");

    // Get the version we're about to download
    try {
      const versionInfo = await invoke<DownloaderInfo>("get_downloader_version");
      if (versionInfo.game_version) {
        setDownloadedVersion(versionInfo.game_version);
      }
    } catch (err) {
      console.warn("Could not get game version:", err);
    }

    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    try {
      const result = await invoke<DownloadResult>("download_server_files", {
        destination: destinationPath,
      });
      setDownloadResult(result);
      if (result.success) {
        setStep("config");
      }
    } catch (err) {
      setDownloadResult({
        success: false,
        output_path: null,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setDownloading(false);
      unlisten();
    }
  }

  async function installCli() {
    setInstallingCli(true);
    setCliInstallProgress(null);

    const unlisten = await listen<DownloadProgress>("cli-install-progress", (event) => {
      setCliInstallProgress(event.payload);
    });

    try {
      const result = await invoke<InstallCliResult>("install_downloader_cli");
      if (result.success) {
        const downloaderInfo = await invoke<DownloaderInfo>("get_downloader_info");
        setDownloader(downloaderInfo);
        setCliInstallProgress(null);
      }
    } catch (err) {
      setCliInstallProgress({
        status: "error",
        percentage: null,
        message: err instanceof Error ? err.message : "Installation failed",
      });
    } finally {
      setInstallingCli(false);
      unlisten();
    }
  }

  async function createInstance() {
    if (!destinationPath || !instanceName.trim()) return;

    setSavingInstance(true);

    try {
      // Build server_args with port if not default
      const port = parseInt(instancePort) || 5520;
      const serverArgs = port !== 5520 ? `--bind 0.0.0.0:${port}` : "";

      const result = await invoke<InstanceResult>("create_server_instance", {
        name: instanceName.trim(),
        path: destinationPath,
        javaPath: null,
      });

      if (result.success && result.instance) {
        // Update server_args if we have a custom port
        if (serverArgs) {
          await invoke("update_server_instance", {
            id: result.instance.id,
            serverArgs,
          });
          result.instance.server_args = serverArgs;
        }

        // If we downloaded files, save the version
        if (downloadedVersion) {
          await invoke("update_instance_installed_version", {
            instanceId: result.instance.id,
            version: downloadedVersion,
          });
          result.instance.installed_version = downloadedVersion;
        }

        onServerCreated(result.instance);
        onOpenChange(false);
      } else {
        console.error("Failed to create instance:", result.error);
      }
    } catch (err) {
      console.error("Error creating instance:", err);
    } finally {
      setSavingInstance(false);
    }
  }

  // Check if this folder is already registered as a server
  const existingServer = destinationPath
    ? instances.find((i) => normalizePath(i.path) === normalizePath(destinationPath))
    : null;

  // Check for port conflicts
  const portNumber = parseInt(instancePort) || 5520;
  const portConflict = instances.find((i) => extractPort(i.server_args) === portNumber);
  const suggestedPort = findNextAvailablePort(instances, portNumber + 1);

  const canProceedFromFolder = destinationPath !== null && !existingServer;
  const canProceedFromSource = selectedSource !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            Create New Server
          </DialogTitle>
          <DialogDescription>
            {step === "folder" && "Select a folder for your new server instance"}
            {step === "source" && "Choose how to obtain the server files"}
            {step === "progress" && "Setting up server files..."}
            {step === "config" && "Configure your new server"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Folder Selection */}
        {step === "folder" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Server Folder</Label>
              <div className="flex gap-2">
                <div className="flex-1 p-3 rounded-lg border bg-muted/50 text-sm truncate font-mono">
                  {destinationPath || "No folder selected"}
                </div>
                <Button variant="outline" onClick={selectFolder} disabled={checkingFiles}>
                  {checkingFiles ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderOpen className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Server already registered in HyPanel */}
            {existingServer && (
              <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Server already exists!</p>
                    <p className="text-muted-foreground">
                      This folder is registered as "{existingServer.name}"
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Server files detected (but not registered) */}
            {serverFilesStatus?.exists && !existingServer && (
              <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Server files detected!</p>
                    <p className="text-muted-foreground">
                      {serverFilesStatus.has_server_jar && "HytaleServer.jar"}
                      {serverFilesStatus.has_server_jar && serverFilesStatus.has_assets && " + "}
                      {serverFilesStatus.has_assets && "Assets.zip"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* No server files - will need to get them */}
            {destinationPath && !checkingFiles && !serverFilesStatus?.exists && !existingServer && (
              <div className="p-3 rounded-lg border bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  No server files found in this folder. You'll need to copy or download them in the next step.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Source Selection */}
        {step === "source" && (
          <div className="space-y-3 py-4">
            {/* Copy from Launcher */}
            <button
              onClick={() => setSelectedSource("launcher")}
              disabled={!paths?.exists}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                selectedSource === "launcher"
                  ? "border-primary bg-primary/5"
                  : paths?.exists
                    ? "hover:border-muted-foreground/50"
                    : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-3">
                <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Copy from Hytale Launcher</p>
                    {paths?.exists && <Badge variant="secondary" className="text-xs">Detected</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {paths?.exists ? "Use files from your Hytale installation" : "Launcher not found"}
                  </p>
                </div>
                {selectedSource === "launcher" && (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
              </div>
            </button>

            {/* Download with CLI - Not available on macOS */}
            <button
              onClick={() => !isMacOS() && setSelectedSource("download")}
              disabled={isMacOS()}
              className={`w-full p-3 rounded-lg border text-left transition-colors ${
                isMacOS()
                  ? "opacity-50 cursor-not-allowed"
                  : selectedSource === "download"
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Download from Hytale</p>
                    {isMacOS() ? (
                      <Badge variant="destructive" className="text-xs">Not available</Badge>
                    ) : (
                      downloader?.available && <Badge variant="secondary" className="text-xs">CLI Ready</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isMacOS()
                      ? "Not available on macOS"
                      : downloader?.available
                        ? "Download using hytale-downloader"
                        : "Will install CLI automatically"}
                  </p>
                </div>
                {selectedSource === "download" && !isMacOS() && (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
              </div>
            </button>

            {/* macOS warning */}
            {isMacOS() && (
              <div className="p-3 rounded-lg border bg-yellow-500/10 border-yellow-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-500">
                    The hytale-downloader CLI is not available for macOS. Please copy files from your Hytale Launcher installation instead.
                  </p>
                </div>
              </div>
            )}

            {/* CLI not available - install prompt (only shown when not on macOS) */}
            {selectedSource === "download" && !downloader?.available && !isMacOS() && (
              <div className="p-3 rounded-lg border bg-muted/50 space-y-2">
                <p className="text-sm">hytale-downloader CLI is required</p>
                <Button
                  onClick={installCli}
                  disabled={installingCli}
                  size="sm"
                  className="w-full"
                >
                  {installingCli ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Installing... {cliInstallProgress?.percentage?.toFixed(0)}%
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Install CLI
                    </>
                  )}
                </Button>
                {cliInstallProgress?.status === "error" && (
                  <p className="text-xs text-destructive">{cliInstallProgress.message}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Progress */}
        {step === "progress" && (
          <div className="py-6 space-y-4">
            {/* Copying */}
            {copying && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm">Copying server files...</p>
              </div>
            )}

            {/* Copy result - error */}
            {copyResult && !copyResult.success && (
              <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Copy failed</p>
                    <p className="text-muted-foreground">{copyResult.error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Downloading */}
            {downloading && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    {downloadProgress?.status === "authenticating"
                      ? "Waiting for authentication..."
                      : downloadProgress?.status === "extracting"
                        ? "Extracting server files..."
                        : "Downloading server files..."}
                  </p>
                </div>

                {/* Progress bar - show indeterminate if no percentage */}
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    {downloadProgress && downloadProgress.percentage !== null && downloadProgress.percentage !== undefined ? (
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${downloadProgress.percentage}%` }}
                      />
                    ) : (
                      <div className="h-full bg-primary/60 animate-pulse w-full" />
                    )}
                  </div>

                  {/* Show percentage or status message */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {downloadProgress?.message && !downloadProgress.message.startsWith("AUTH_URL:")
                        ? downloadProgress.message.substring(0, 50) + (downloadProgress.message.length > 50 ? "..." : "")
                        : downloadProgress?.status || "Initializing..."}
                    </span>
                    {downloadProgress && downloadProgress.percentage !== null && downloadProgress.percentage !== undefined && (
                      <span>{downloadProgress.percentage.toFixed(0)}%</span>
                    )}
                  </div>
                </div>

                {/* Auth URL button */}
                {downloadProgress?.message.startsWith("AUTH_URL:") && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a
                      href={downloadProgress.message.replace("AUTH_URL:", "")}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Authentication Page
                      <ExternalLink className="w-3 h-3 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            )}

            {/* Download result - error */}
            {downloadResult && !downloadResult.success && (
              <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Download failed</p>
                    <p className="text-muted-foreground">{downloadResult.error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Configuration */}
        {step === "config" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Server Name</Label>
              <Input
                id="server-name"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="My Server"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-port">Port</Label>
              <Input
                id="server-port"
                type="number"
                value={instancePort}
                onChange={(e) => setInstancePort(e.target.value)}
                min={1}
                max={65535}
                className={`font-mono ${portConflict ? "border-yellow-500" : ""}`}
              />
              {portConflict && (
                <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Port used by "{portConflict.name}"
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setInstancePort(suggestedPort.toString())}
                    className="h-6 text-xs border-yellow-500/50 text-yellow-500"
                  >
                    Use {suggestedPort}
                  </Button>
                </div>
              )}
              {!portConflict && instances.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ports in use: {instances.map((i) => extractPort(i.server_args)).join(", ")}
                </p>
              )}
            </div>

            <div className="p-3 rounded-lg border bg-muted/50 space-y-1">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-mono truncate" title={destinationPath || ""}>
                {destinationPath}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "folder" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (serverFilesStatus?.exists) {
                    setStep("config");
                  } else {
                    setStep("source");
                  }
                }}
                disabled={!canProceedFromFolder}
              >
                {serverFilesStatus?.exists ? "Configure" : "Next"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {step === "source" && (
            <>
              <Button variant="outline" onClick={() => setStep("folder")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (selectedSource === "launcher") {
                    copyFiles();
                  } else if (selectedSource === "download" && downloader?.available) {
                    downloadFiles();
                  }
                }}
                disabled={!canProceedFromSource || (selectedSource === "download" && !downloader?.available)}
              >
                {selectedSource === "launcher" ? "Copy Files" : "Download"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}

          {step === "progress" && (
            <>
              {(copyResult?.success === false || downloadResult?.success === false) && (
                <Button variant="outline" onClick={() => setStep("source")}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              )}
            </>
          )}

          {step === "config" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (serverFilesStatus?.exists) {
                    setStep("folder");
                  } else {
                    setStep("source");
                  }
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={createInstance}
                disabled={savingInstance || !instanceName.trim() || !!portConflict}
              >
                {savingInstance ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Server
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
