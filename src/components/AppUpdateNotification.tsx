import { useUpdater } from "@/hooks/useUpdater";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export function AppUpdateNotification() {
  const {
    available,
    downloading,
    progress,
    update,
    error,
    dismissed,
    checking,
    downloadAndInstall,
    checkForUpdates,
    dismiss,
  } = useUpdater(true);

  // Don't show if dismissed, not available, or no update info
  if (dismissed || !available || !update) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm">Update Available</h4>
            {!downloading && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 -mr-1 -mt-1"
                onClick={dismiss}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Version {update.version} is ready to install
          </p>

          {error && (
            <div className="mt-2 text-xs text-destructive">
              {error}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-xs"
                onClick={checkForUpdates}
                disabled={checking}
              >
                Retry
              </Button>
            </div>
          )}

          {downloading ? (
            <div className="mt-3">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {progress < 100 ? `Downloading... ${progress}%` : "Installing..."}
              </p>
            </div>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={downloadAndInstall}>
                <Download className="size-3 mr-1.5" />
                Install Now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={dismiss}
              >
                Later
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
