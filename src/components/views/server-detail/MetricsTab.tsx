import { Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ServerMetrics } from "@/lib/types";

interface MetricsTabProps {
  isRunning: boolean;
  metrics: ServerMetrics | null;
  uptime: string;
}

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function MetricsTab({ isRunning, metrics, uptime }: MetricsTabProps) {
  if (!isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Activity className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Server is not running</p>
        <p className="text-xs">Start the server to see metrics</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Activity className="h-4 w-4" />
          <span className="text-xs font-medium">CPU Usage</span>
        </div>
        <p className="text-2xl font-semibold">
          {metrics.cpu_usage !== null ? `${Math.round(metrics.cpu_usage)}%` : "-"}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Activity className="h-4 w-4" />
          <span className="text-xs font-medium">Memory</span>
        </div>
        <p className="text-2xl font-semibold">
          {metrics.memory_mb !== null ? formatMemory(metrics.memory_mb) : "-"}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Activity className="h-4 w-4" />
          <span className="text-xs font-medium">Uptime</span>
        </div>
        <p className="text-2xl font-semibold">{uptime}</p>
      </div>
    </div>
  );
}
