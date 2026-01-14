import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  RefreshCw,
  CheckCircle,
  ArrowUpCircle,
  HelpCircle,
  Download,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Instance, VersionCheckResult, DownloadProgress } from "@/lib/types";

interface UpdatesSectionProps {
  instance: Instance;
  isRunning: boolean;
  onVersionUpdated: (newVersion: string) => void;
}

type UpdateStep = "idle" | "checking" | "downloading" | "done" | "error";

export function UpdatesSection({
  instance,
  isRunning,
  onVersionUpdated,
}: UpdatesSectionProps) {
  const [step, setStep] = useState<UpdateStep>("idle");
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckVersion() {
    setStep("checking");
    setError(null);
    setVersionInfo(null);

    try {
      const result = await invoke<VersionCheckResult | null>("check_instance_version", {
        instanceId: instance.id,
      });

      if (result) {
        setVersionInfo(result);
      }
      setStep("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check version");
      setStep("error");
    }
  }

  async function handleUpdate() {
    if (!versionInfo?.available_version) return;

    setStep("downloading");
    setDownloadProgress(null);
    setError(null);

    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    try {
      const result = await invoke<{ success: boolean; error?: string | null }>(
        "download_server_files",
        { destination: instance.path }
      );

      if (result.success && versionInfo.available_version) {
        await invoke("update_instance_installed_version", {
          instanceId: instance.id,
          version: versionInfo.available_version,
        });
        onVersionUpdated(versionInfo.available_version);
        setVersionInfo((prev) =>
          prev
            ? {
                ...prev,
                installed_version: versionInfo.available_version,
                update_available: false,
                version_unknown: false,
              }
            : null
        );
        setStep("done");
      } else {
        setError(result.error || "Update failed");
        setStep("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      setStep("error");
    } finally {
      unlisten();
    }
  }

  const showUpdateButton =
    versionInfo && (versionInfo.update_available || versionInfo.version_unknown);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Server Version</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheckVersion}
          disabled={step === "checking" || step === "downloading"}
        >
          {step === "checking" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Check for updates
            </>
          )}
        </Button>
      </div>

      {/* Current version info */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Installed version</span>
          <span className="font-mono">
            {instance.installed_version || (
              <span className="text-yellow-400 flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5" />
                unknown
              </span>
            )}
          </span>
        </div>
        {versionInfo?.available_version && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Latest version</span>
            <span className="font-mono text-blue-400">
              {versionInfo.available_version}
            </span>
          </div>
        )}
      </div>

      {/* Status messages */}
      {step === "idle" && versionInfo && !showUpdateButton && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm text-green-200">Server is up to date</span>
        </div>
      )}

      {step === "done" && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm text-green-200">
            Update completed successfully
          </span>
        </div>
      )}

      {step === "error" && error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Update available / Version unknown */}
      {showUpdateButton && step !== "downloading" && step !== "done" && (
        <div
          className={`p-3 rounded-lg border ${
            versionInfo.version_unknown
              ? "bg-yellow-500/10 border-yellow-500/20"
              : "bg-blue-500/10 border-blue-500/20"
          }`}
        >
          <div className="flex items-start gap-2">
            {versionInfo.version_unknown ? (
              <HelpCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
            ) : (
              <ArrowUpCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <p
                className={`text-sm font-medium ${
                  versionInfo.version_unknown ? "text-yellow-200" : "text-blue-200"
                }`}
              >
                {versionInfo.version_unknown
                  ? "Version unknown"
                  : "Update available"}
              </p>
              <p
                className={`text-xs mt-0.5 ${
                  versionInfo.version_unknown
                    ? "text-yellow-300/70"
                    : "text-blue-300/70"
                }`}
              >
                {versionInfo.version_unknown
                  ? "Download latest version to register the installed version"
                  : `${versionInfo.installed_version} → ${versionInfo.available_version}`}
              </p>
            </div>
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
              <span className="text-xs text-yellow-300">
                Stop the server before updating
              </span>
            </div>
          )}

          <Button
            className="w-full mt-3"
            size="sm"
            onClick={handleUpdate}
            disabled={isRunning}
          >
            <Download className="h-3.5 w-3.5" />
            {versionInfo.version_unknown ? "Download & Verify" : "Update Server"}
          </Button>
        </div>
      )}

      {/* Download progress */}
      {step === "downloading" && (
        <div className="p-3 rounded-lg border bg-muted/30 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {downloadProgress?.status === "authenticating"
                ? "Waiting for authentication..."
                : downloadProgress?.status === "extracting"
                  ? "Extracting files..."
                  : "Downloading..."}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              {downloadProgress?.percentage != null ? (
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${downloadProgress.percentage}%` }}
                />
              ) : (
                <div className="h-full bg-primary/60 animate-pulse w-full" />
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {downloadProgress?.message &&
                !downloadProgress.message.startsWith("AUTH_URL:")
                  ? downloadProgress.message.substring(0, 40) +
                    (downloadProgress.message.length > 40 ? "..." : "")
                  : ""}
              </span>
              {downloadProgress?.percentage != null && (
                <span>{downloadProgress.percentage.toFixed(0)}%</span>
              )}
            </div>
          </div>

          {/* Auth URL */}
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
    </div>
  );
}
