import { ArrowUp, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VersionBadgeProps {
  installedVersion: string | null;
  availableVersion: string | null;
  versionUnknown?: boolean;
}

export function VersionBadge({
  installedVersion,
  availableVersion,
  versionUnknown = false,
}: VersionBadgeProps) {
  const displayInstalled = installedVersion || "unknown";
  const displayAvailable = availableVersion || "unknown";

  // Different style for unknown version vs actual update
  if (versionUnknown) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-yellow-500/20 text-yellow-400 cursor-help">
            <HelpCircle className="h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Version unknown - update to verify</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/20 text-blue-400 cursor-help">
          <ArrowUp className="h-3 w-3" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          {displayInstalled} → {displayAvailable}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
