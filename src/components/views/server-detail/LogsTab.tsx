import { FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LogLine } from "@/components/ui/log-line";
import type { LogFile, LogReadResult } from "@/lib/types";

interface LogsTabProps {
  logFiles: LogFile[];
  selectedLog: string | null;
  logContent: LogReadResult | null;
  isLoading: boolean;
  onSelectLog: (path: string) => void;
  onRefresh: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function LogsTab({
  logFiles,
  selectedLog,
  logContent,
  isLoading,
  onSelectLog,
  onRefresh,
}: LogsTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (logFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No log files found</p>
        <p className="text-xs">Start the server to generate logs</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <select
          value={selectedLog || ""}
          onChange={(e) => onSelectLog(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          {logFiles.map((file) => (
            <option key={file.path} value={file.path}>
              {file.name} ({formatFileSize(file.size)})
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 rounded-lg bg-zinc-950 p-3 font-mono text-xs overflow-auto selectable">
        {logContent?.lines.map((line) => (
          <LogLine
            key={line.line_number}
            line={line.content}
            showTimestamp={true}
          />
        ))}
      </div>
    </>
  );
}
