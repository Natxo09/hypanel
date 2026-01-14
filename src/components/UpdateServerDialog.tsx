import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpCircle,
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
import type { Instance, DownloadProgress } from "@/lib/types";

interface UpdateServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instance: Instance | null;
  availableVersion: string | null;
  versionUnknown?: boolean;
  onUpdated: (instanceId: string, newVersion: string) => void;
}

type UpdateStep = "confirm" | "progress" | "done";

export function UpdateServerDialog({
  open,
  onOpenChange,
  instance,
  availableVersion,
  versionUnknown = false,
  onUpdated,
}: UpdateServerDialogProps) {
  const [step, setStep] = useState<UpdateStep>("confirm");
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("confirm");
      setDownloading(false);
      setDownloadProgress(null);
      setError(null);
    }
  }, [open]);

  async function startUpdate() {
    if (!instance) return;

    setStep("progress");
    setDownloading(true);
    setError(null);

    const unlisten = await listen<DownloadProgress>("download-progress", (event) => {
      setDownloadProgress(event.payload);
    });

    try {
      const result = await invoke<{ success: boolean; error?: string | null }>("download_server_files", {
        destination: instance.path,
      });

      if (result.success && availableVersion) {
        // Update the installed version in the database
        await invoke("update_instance_installed_version", {
          instanceId: instance.id,
          version: availableVersion,
        });
        onUpdated(instance.id, availableVersion);
        setStep("done");
      } else {
        setError(result.error || "Update failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDownloading(false);
      unlisten();
    }
  }

  function handleClose() {
    if (!downloading) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className={`w-5 h-5 ${versionUnknown ? "text-yellow-400" : "text-blue-400"}`} />
            {versionUnknown ? "Verify & Update Server" : "Update Server"}
          </DialogTitle>
          <DialogDescription>
            {step === "confirm" && (versionUnknown
              ? `Verify and update "${instance?.name}" to the latest version`
              : `Update "${instance?.name}" to the latest version`)}
            {step === "progress" && "Downloading server files..."}
            {step === "done" && "Update completed successfully"}
          </DialogDescription>
        </DialogHeader>

        {/* Confirm step */}
        {step === "confirm" && (
          <div className="py-4 space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Server</span>
                <span className="text-sm font-medium">{instance?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current version</span>
                <span className={`text-sm font-mono ${versionUnknown ? "text-yellow-400" : ""}`}>
                  {instance?.installed_version || "unknown"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Latest version</span>
                <span className="text-sm font-mono text-blue-400">
                  {availableVersion || "unknown"}
                </span>
              </div>
            </div>

            {versionUnknown && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <ArrowUpCircle className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-200">
                  <p className="font-medium">Version unknown</p>
                  <p className="text-xs text-blue-300/70 mt-0.5">
                    This will download the latest version and register it for future updates.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-sm text-yellow-200">
                <p className="font-medium">Make sure the server is stopped</p>
                <p className="text-xs text-yellow-300/70 mt-0.5">
                  Server files will be overwritten during the update.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress step */}
        {step === "progress" && (
          <div className="py-6 space-y-4">
            {downloading && !error && (
              <>
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

                {/* Progress bar */}
                <div className="space-y-2">
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
                      {downloadProgress?.message && !downloadProgress.message.startsWith("AUTH_URL:")
                        ? downloadProgress.message.substring(0, 50) + (downloadProgress.message.length > 50 ? "..." : "")
                        : downloadProgress?.status || "Initializing..."}
                    </span>
                    {downloadProgress?.percentage != null && (
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
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20">
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Update failed</p>
                    <p className="text-muted-foreground mt-0.5">{error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Done step */}
        {step === "done" && (
          <div className="py-6">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-medium">Update completed!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {instance?.name} is now running version {availableVersion}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "confirm" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={startUpdate}>
                Update Server
              </Button>
            </>
          )}

          {step === "progress" && error && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={startUpdate}>
                Retry
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
