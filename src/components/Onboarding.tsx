import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  Download,
  Copy,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { WindowTitlebar } from "@/components/layout/WindowTitlebar";
import type { JavaInfo, SystemPaths, FileSourceType, CopyResult, DownloaderInfo, DownloadProgress, DownloadResult, InstallCliResult, ServerFilesStatus, InstanceResult } from "@/lib/types";

function isMacOS(): boolean {
  return navigator.platform.toLowerCase().includes("mac");
}

function StatusIcon({ ok, loading }: { ok: boolean; loading?: boolean }) {
  if (loading) {
    return <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />;
  }
  if (ok) {
    return <CheckCircle2 className="w-5 h-5 text-green-500" />;
  }
  return <XCircle className="w-5 h-5 text-destructive" />;
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i < current
              ? "bg-primary"
              : i === current
                ? "bg-primary"
                : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Java check
  const [java, setJava] = useState<JavaInfo | null>(null);

  // Step 2: File source
  const [paths, setPaths] = useState<SystemPaths | null>(null);
  const [downloader, setDownloader] = useState<DownloaderInfo | null>(null);
  const [selectedSource, setSelectedSource] = useState<FileSourceType | null>(null);

  // Step 3: Instance setup
  const [destinationPath, setDestinationPath] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);

  // Download state
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

  // CLI installation state
  const [installingCli, setInstallingCli] = useState(false);
  const [cliInstallProgress, setCliInstallProgress] = useState<DownloadProgress | null>(null);

  // Existing server files detection
  const [serverFilesStatus, setServerFilesStatus] = useState<ServerFilesStatus | null>(null);
  const [checkingFiles, setCheckingFiles] = useState(false);

  // Instance name for saving
  const [instanceName, setInstanceName] = useState("My Server");
  const [savingInstance, setSavingInstance] = useState(false);

  // Check system on mount
  useEffect(() => {
    checkSystem();
  }, []);

  async function checkSystem() {
    setLoading(true);
    setError(null);

    try {
      const [javaInfo, pathsInfo, downloaderInfo] = await Promise.all([
        invoke<JavaInfo>("check_java"),
        invoke<SystemPaths>("get_system_paths"),
        invoke<DownloaderInfo>("get_downloader_info"),
      ]);

      setJava(javaInfo);
      setPaths(pathsInfo);
      setDownloader(downloaderInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function selectDestination() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select server instance folder",
    });

    if (selected) {
      const path = selected as string;
      setDestinationPath(path);
      setServerFilesStatus(null);
      setCheckingFiles(true);

      // Check if server files already exist in the selected folder
      try {
        const status = await invoke<ServerFilesStatus>("check_server_files", { path });
        setServerFilesStatus(status);

        // If files already exist, automatically set success state
        if (status.exists) {
          setDownloadResult({
            success: true,
            output_path: path,
            error: null,
          });
          setCopyResult({
            success: true,
            files_copied: 0,
            destination: path,
            error: null,
          });
        }
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

    try {
      const result = await invoke<CopyResult>("copy_server_files", {
        source: paths.hytale_launcher_path,
        destination: destinationPath,
      });
      setCopyResult(result);
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

    // Listen for progress events
    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    try {
      const result = await invoke<DownloadResult>("download_server_files", {
        destination: destinationPath,
      });
      setDownloadResult(result);
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

    // Listen for progress events
    const unlisten = await listen<DownloadProgress>("cli-install-progress", (event) => {
      setCliInstallProgress(event.payload);
    });

    try {
      const result = await invoke<InstallCliResult>("install_downloader_cli");
      if (result.success) {
        // Refresh downloader info after installation
        const downloaderInfo = await invoke<DownloaderInfo>("get_downloader_info");
        setDownloader(downloaderInfo);
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

  async function finishOnboarding() {
    if (!destinationPath || !instanceName.trim()) return;

    setSavingInstance(true);

    try {
      // Save instance to database
      const result = await invoke<InstanceResult>("create_server_instance", {
        name: instanceName.trim(),
        path: destinationPath,
        javaPath: java?.java_path || null,
      });

      if (!result.success) {
        console.error("Failed to create instance:", result.error);
        // Still continue - the files are there, just DB save failed
      }

      // Mark onboarding as complete
      await invoke<boolean>("complete_onboarding");

      // Reload the page to go to main app
      window.location.reload();
    } catch (err) {
      console.error("Error finishing onboarding:", err);
      // Still reload - files are downloaded, that's the important part
      window.location.reload();
    } finally {
      setSavingInstance(false);
    }
  }

  async function skipServerSetup() {
    setSavingInstance(true);
    try {
      // Mark onboarding as complete without creating a server
      await invoke<boolean>("complete_onboarding");
      window.location.reload();
    } catch (err) {
      console.error("Error skipping setup:", err);
      window.location.reload();
    } finally {
      setSavingInstance(false);
    }
  }

  const canProceedFromStep1 = java?.is_valid;
  const canProceedFromStep2 = selectedSource !== null;
  const canProceedFromStep3 = copyResult?.success || downloadResult?.success || serverFilesStatus?.exists || false;

  return (
    <div className="h-screen bg-background flex flex-col">
      <WindowTitlebar />
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">HyPanel</h1>
          <p className="text-muted-foreground">Hytale Server Manager</p>
        </div>

        <StepIndicator current={step} total={3} />

        {/* Step 1: Java Check */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Java Verification</CardTitle>
              <CardDescription>
                Hytale servers require Java 25 or higher
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <StatusIcon ok={java?.is_valid ?? false} loading={loading} />
                  <div className="min-w-0">
                    <p className="font-medium">Java 25+</p>
                    {java && !loading && (
                      <>
                        <p className="text-sm text-muted-foreground">
                          {java.installed
                            ? `${java.version} • ${java.vendor ?? "Unknown vendor"}`
                            : "Not installed"}
                        </p>
                        {java.is_valid && java.java_path && java.java_path !== "java" && (
                          <p className="text-xs text-muted-foreground truncate max-w-[280px]" title={java.java_path}>
                            {java.java_path}
                          </p>
                        )}
                      </>
                    )}
                    {loading && (
                      <p className="text-sm text-muted-foreground">Checking...</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {java?.is_valid && <Badge variant="secondary">Ready</Badge>}
                  {java && !java.is_valid && !loading && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://adoptium.net/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button variant="outline" onClick={checkSystem} disabled={loading} className="flex-1">
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">{loading ? "Checking..." : "Refresh"}</span>
              </Button>
              <Button
                onClick={() => setStep(1)}
                disabled={!canProceedFromStep1}
                className="flex-1"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Choose File Source */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Server Files</CardTitle>
              <CardDescription>
                Choose how to obtain the server files
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Option A: Copy from Launcher */}
              <button
                onClick={() => setSelectedSource("launcher")}
                disabled={!paths?.exists}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  selectedSource === "launcher"
                    ? "border-primary bg-primary/5"
                    : paths?.exists
                      ? "hover:border-muted-foreground/50"
                      : "opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Copy className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Copy from Hytale Launcher</p>
                      {paths?.exists && <Badge variant="secondary">Detected</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {paths?.exists
                        ? "Use server files from your existing Hytale installation"
                        : "Hytale launcher not detected on this system"}
                    </p>
                    {paths?.hytale_launcher_path && (
                      <p className="text-xs text-muted-foreground mt-2 truncate">
                        {paths.hytale_launcher_path}
                      </p>
                    )}
                  </div>
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${selectedSource === "launcher" ? "text-primary" : "text-transparent"}`} />
                </div>
              </button>

              {/* Option B: Download with CLI */}
              <button
                onClick={() => !isMacOS() && setSelectedSource("download")}
                disabled={isMacOS()}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  isMacOS()
                    ? "opacity-50 cursor-not-allowed"
                    : selectedSource === "download"
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Download with hytale-downloader</p>
                      {isMacOS() ? (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                          Not available
                        </Badge>
                      ) : downloader?.available ? (
                        <Badge variant="secondary">CLI Found</Badge>
                      ) : null}
                    </div>
                    {isMacOS() ? (
                      <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-500">
                          The hytale-downloader CLI is not available for macOS.
                          Please use "Copy from Hytale Launcher" or manually copy the server files.
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mt-1">
                          {downloader?.available
                            ? "Download server files using the official CLI tool"
                            : "Download server files (requires hytale-downloader CLI)"}
                        </p>
                        {!downloader?.available && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Will be installed automatically in the next step
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${selectedSource === "download" ? "text-primary" : "text-transparent"}`} />
                </div>
              </button>

              {/* Option C: Import existing server files */}
              <button
                onClick={() => setSelectedSource("existing")}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  selectedSource === "existing"
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <FolderOpen className="w-5 h-5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Import existing server files</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Select a folder that already contains Hytale server files
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use this if you already have the server files from another source
                    </p>
                  </div>
                  <CheckCircle2 className={`w-5 h-5 shrink-0 ${selectedSource === "existing" ? "text-primary" : "text-transparent"}`} />
                </div>
              </button>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedFromStep2}
                  className="flex-1"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={skipServerSetup}
                disabled={savingInstance}
                className="w-full text-muted-foreground"
              >
                {savingInstance ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                Skip for now - I'll create a server later
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Create Instance */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Create Instance</CardTitle>
              <CardDescription>
                {selectedSource === "launcher"
                  ? "Choose where to copy the server files"
                  : selectedSource === "existing"
                    ? "Select the folder containing your server files"
                    : "Choose where to download the server files"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Destination folder selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {selectedSource === "existing" ? "Server Folder" : "Destination Folder"}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 rounded-lg border bg-muted/50 text-sm truncate">
                    {destinationPath || "No folder selected"}
                  </div>
                  <Button variant="outline" onClick={selectDestination} disabled={checkingFiles}>
                    {checkingFiles ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Instance name input */}
              {destinationPath && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Server Name</label>
                  <Input
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder="My Server"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    This name is only used in HyPanel to identify your server
                  </p>
                </div>
              )}

              {/* Server files already exist indicator */}
              {serverFilesStatus?.exists && (
                <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-medium">Server files detected</p>
                      <p className="text-sm text-muted-foreground">
                        {serverFilesStatus.has_server_jar && "HytaleServer.jar found"}
                        {serverFilesStatus.has_server_jar && serverFilesStatus.has_assets && " • "}
                        {serverFilesStatus.has_assets && "Assets.zip found"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Error when "existing" selected but no server files found */}
              {selectedSource === "existing" && destinationPath && serverFilesStatus && !serverFilesStatus.exists && (
                <div className="p-4 rounded-lg border bg-destructive/10 border-destructive/20">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    <div>
                      <p className="font-medium">Server files not found</p>
                      <p className="text-sm text-muted-foreground">
                        The selected folder does not contain valid Hytale server files.
                        Make sure it contains Server/HytaleServer.jar
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Copy/Download action - only show if files don't already exist */}
              {selectedSource === "launcher" && destinationPath && !serverFilesStatus?.exists && (
                <div className="space-y-3">
                  {!copyResult && (
                    <Button
                      onClick={copyFiles}
                      disabled={copying}
                      className="w-full"
                    >
                      {copying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Copying files...
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Server Files
                        </>
                      )}
                    </Button>
                  )}

                  {copyResult && (
                    <div
                      className={`p-4 rounded-lg border ${
                        copyResult.success
                          ? "bg-green-500/10 border-green-500/20"
                          : "bg-destructive/10 border-destructive/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <StatusIcon ok={copyResult.success} />
                        <div>
                          <p className="font-medium">
                            {copyResult.success
                              ? "Files copied successfully!"
                              : "Failed to copy files"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {copyResult.success
                              ? `${copyResult.files_copied} files copied`
                              : copyResult.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedSource === "download" && destinationPath && !serverFilesStatus?.exists && (
                <div className="space-y-3">
                  {downloader?.available ? (
                    <>
                      {/* Version info */}
                      {downloader.game_version && (
                        <div className="p-3 rounded-lg border bg-muted/50 text-sm">
                          <span className="text-muted-foreground">Game version: </span>
                          <span className="font-mono">{downloader.game_version}</span>
                        </div>
                      )}

                      {/* Download button */}
                      {!downloadResult && (
                        <Button
                          onClick={downloadFiles}
                          disabled={downloading}
                          className="w-full"
                        >
                          {downloading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              {downloadProgress?.status === "authenticating"
                                ? "Waiting for authentication..."
                                : "Downloading..."}
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Download Server Files
                            </>
                          )}
                        </Button>
                      )}

                      {/* Progress display */}
                      {downloading && downloadProgress && (
                        <div className="p-4 rounded-lg border bg-muted/50 space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{downloadProgress.status}</span>
                            {downloadProgress.percentage !== null && (
                              <span>{downloadProgress.percentage.toFixed(1)}%</span>
                            )}
                          </div>
                          {downloadProgress.percentage !== null && (
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${downloadProgress.percentage}%` }}
                              />
                            </div>
                          )}
                          {/* Auth URL link */}
                          {downloadProgress.message.startsWith("AUTH_URL:") ? (
                            <div className="space-y-2">
                              <p className="text-sm">Click to authenticate with your Hytale account:</p>
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
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground truncate">
                              {downloadProgress.message}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Result display */}
                      {downloadResult && (
                        <div
                          className={`p-4 rounded-lg border ${
                            downloadResult.success
                              ? "bg-green-500/10 border-green-500/20"
                              : "bg-destructive/10 border-destructive/20"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <StatusIcon ok={downloadResult.success} />
                            <div>
                              <p className="font-medium">
                                {downloadResult.success
                                  ? "Download completed!"
                                  : "Download failed"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {downloadResult.success
                                  ? downloadResult.output_path
                                  : downloadResult.error}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
                      <div>
                        <p className="text-sm font-medium">
                          hytale-downloader CLI required
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Click below to automatically download and install the CLI tool.
                        </p>
                      </div>

                      {/* Install button */}
                      {!cliInstallProgress && (
                        <Button
                          onClick={installCli}
                          disabled={installingCli}
                          className="w-full"
                        >
                          {installingCli ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Installing...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Install hytale-downloader
                            </>
                          )}
                        </Button>
                      )}

                      {/* Installation progress */}
                      {cliInstallProgress && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{cliInstallProgress.status}</span>
                            {cliInstallProgress.percentage !== null && (
                              <span>{cliInstallProgress.percentage.toFixed(1)}%</span>
                            )}
                          </div>
                          {cliInstallProgress.percentage !== null && (
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${cliInstallProgress.percentage}%` }}
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground truncate">
                            {cliInstallProgress.message}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {canProceedFromStep3 && (
                <Button
                  className="flex-1"
                  onClick={finishOnboarding}
                  disabled={savingInstance || !instanceName.trim()}
                >
                  {savingInstance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Finish Setup
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {/* Help text */}
        <p className="text-center text-sm text-muted-foreground">
          {step === 0 && "Make sure you have Java 25+ installed."}
          {step === 1 && "Choose your preferred method to obtain server files."}
          {step === 2 && "Select a folder where your server instance will be created."}
        </p>
        </div>
      </div>
    </div>
  );
}
