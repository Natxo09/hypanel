import { Info, X, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpdateBannerProps {
  latestVersion: string;
  outdatedCount: number;
  onDismiss: () => void;
  onViewDetails?: () => void;
}

export function UpdateBanner({
  latestVersion,
  outdatedCount,
  onDismiss,
  onViewDetails,
}: UpdateBannerProps) {
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 text-blue-400">
        <ArrowUpCircle className="h-5 w-5" />
        <Info className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-blue-100">
          <span className="font-medium">Update available:</span>{" "}
          Version {latestVersion} is now available.{" "}
          {outdatedCount > 0 && (
            <span className="text-blue-300">
              {outdatedCount} server{outdatedCount !== 1 ? "s" : ""} can be updated.
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onViewDetails && (
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-300 hover:text-blue-100 hover:bg-blue-500/20"
            onClick={onViewDetails}
          >
            View
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-blue-400 hover:text-blue-100 hover:bg-blue-500/20"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
