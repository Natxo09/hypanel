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
import type { JavaInfo, SystemPaths, FileSourceType, CopyResult, DownloaderInfo, DownloadProgress, DownloadResult } from "@/lib/types";

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
      setDestinationPath(selected as string);
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

  const canProceedFromStep1 = java?.is_valid;
  const canProceedFromStep2 = selectedSource !== null;
  const canProceedFromStep3 = copyResult?.success || downloadResult?.success || false;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
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
                  <Copy className="w-5 h-5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
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
                  {selectedSource === "launcher" && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>

              {/* Option B: Download with CLI */}
              <button
                onClick={() => setSelectedSource("download")}
                className={`w-full p-4 rounded-lg border text-left transition-colors ${
                  selectedSource === "download"
                    ? "border-primary bg-primary/5"
                    : "hover:border-muted-foreground/50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Download className="w-5 h-5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">Download with hytale-downloader</p>
                      {downloader?.available && (
                        <Badge variant="secondary">CLI Found</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {downloader?.available
                        ? "Download server files using the official CLI tool"
                        : "Download server files (requires hytale-downloader CLI)"}
                    </p>
                    {!downloader?.available && (
                      <Button variant="link" className="h-auto p-0 mt-2" asChild>
                        <a
                          href="https://downloader.hytale.com/hytale-downloader.zip"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Get hytale-downloader
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    )}
                  </div>
                  {selectedSource === "download" && (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                </div>
              </button>
            </CardContent>

            <CardFooter className="flex gap-3">
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
                  : "Choose where to download the server files"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Destination folder selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Destination Folder</label>
                <div className="flex gap-2">
                  <div className="flex-1 p-3 rounded-lg border bg-muted/50 text-sm truncate">
                    {destinationPath || "No folder selected"}
                  </div>
                  <Button variant="outline" onClick={selectDestination}>
                    <FolderOpen className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Copy/Download action */}
              {selectedSource === "launcher" && destinationPath && (
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

              {selectedSource === "download" && destinationPath && (
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
                          <p className="text-xs text-muted-foreground truncate">
                            {downloadProgress.message}
                          </p>
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
                    <div className="p-4 rounded-lg border bg-amber-500/10 border-amber-500/20">
                      <p className="text-sm">
                        <strong>hytale-downloader</strong> CLI not found in PATH.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Install it from the official repository and try again.
                      </p>
                      <Button variant="outline" size="sm" className="mt-3" asChild>
                        <a
                          href="https://downloader.hytale.com/hytale-downloader.zip"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Get hytale-downloader
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
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
                <Button className="flex-1">
                  Finish Setup
                  <ArrowRight className="w-4 h-4 ml-2" />
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
  );
}
