import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Server,
  Plus,
  Layers,
  Activity,
  Power,
  Cpu,
  MemoryStick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Area, AreaChart, XAxis } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { Instance, SystemMetrics, ServerMetrics } from "@/lib/types";

interface HomeViewProps {
  instances: Instance[];
  serverStatuses: Map<string, string>;
  onSelectInstance: (instance: Instance) => void;
  onAddInstance: () => void;
  onViewAllServers: () => void;
}

interface MetricDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

export function HomeView({
  instances,
  serverStatuses,
  onSelectInstance,
  onAddInstance,
  onViewAllServers,
}: HomeViewProps) {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricDataPoint[]>([]);
  const [serverMetrics, setServerMetrics] = useState<ServerMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Count running/stopped
  const runningCount = Array.from(serverStatuses.values()).filter(
    (s) => s === "running"
  ).length;
  const stoppedCount = instances.length - runningCount;

  // Fetch system metrics periodically
  useEffect(() => {
    let isFirstLoad = true;

    async function fetchMetrics() {
      try {
        const [sysMetrics, srvMetrics] = await Promise.all([
          invoke<SystemMetrics>("get_system_metrics"),
          invoke<ServerMetrics[]>("get_all_server_metrics"),
        ]);

        setSystemMetrics(sysMetrics);
        setServerMetrics(srvMetrics);

        // Mark loading complete after first successful fetch
        if (isFirstLoad) {
          setIsLoading(false);
          isFirstLoad = false;
        }

        // Add to history (keep last 20 points)
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        setMetricsHistory((prev) => {
          const newHistory = [
            ...prev,
            {
              time: timeStr,
              cpu: Math.round(sysMetrics.cpu_usage * 10) / 10,
              memory: Math.round(
                (sysMetrics.used_memory_mb / sysMetrics.total_memory_mb) * 1000
              ) / 10,
            },
          ];
          return newHistory.slice(-20);
        });
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
        setIsLoading(false);
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  // Get status for instance
  function getInstanceStatus(instanceId: string): string {
    return serverStatuses.get(instanceId) || "stopped";
  }

  // Format bytes
  function formatMemory(mb: number): string {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${Math.round(mb)} MB`;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Dashboard">
        <Button onClick={onAddInstance}>
          <Plus className="h-4 w-4 mr-2" />
          Add Server
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* System Metrics */}
        <div className="grid gap-3 md:grid-cols-2">
          {isLoading ? (
            <>
              <MetricChartSkeleton />
              <MetricChartSkeleton />
            </>
          ) : (
            <>
              {/* CPU Chart */}
              <MetricChart
                icon={<Cpu className="h-3.5 w-3.5" />}
                label="CPU"
                value={systemMetrics ? `${Math.round(systemMetrics.cpu_usage)}%` : "-"}
                subtitle={systemMetrics ? `${systemMetrics.cpu_count} cores` : undefined}
                data={metricsHistory}
                dataKey="cpu"
                color="#3b82f6"
              />

              {/* Memory Chart */}
              <MetricChart
                icon={<MemoryStick className="h-3.5 w-3.5" />}
                label="Memory"
                value={
                  systemMetrics
                    ? `${Math.round((systemMetrics.used_memory_mb / systemMetrics.total_memory_mb) * 100)}%`
                    : "-"
                }
                subtitle={
                  systemMetrics
                    ? `${formatMemory(systemMetrics.used_memory_mb)} / ${formatMemory(systemMetrics.total_memory_mb)}`
                    : undefined
                }
                data={metricsHistory}
                dataKey="memory"
                color="#22c55e"
              />
            </>
          )}
        </div>

        {/* Server Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-semibold">{instances.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10">
                  <Activity className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Running</p>
                  <p className="text-xl font-semibold text-green-500">{runningCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                  <Power className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stopped</p>
                  <p className="text-xl font-semibold">{stoppedCount}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Running Servers Metrics */}
        {serverMetrics.length > 0 && (
          <div>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Running Servers</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {serverMetrics.map((metrics) => {
                const instance = instances.find(
                  (i) => i.id === metrics.instance_id
                );
                if (!instance) return null;

                return (
                  <div
                    key={metrics.instance_id}
                    className="cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                    onClick={() => onSelectInstance(instance)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium truncate">{instance.name}</p>
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">CPU </span>
                        <span className="font-medium">
                          {metrics.cpu_usage !== null ? `${Math.round(metrics.cpu_usage)}%` : "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">RAM </span>
                        <span className="font-medium">
                          {metrics.memory_mb !== null ? formatMemory(metrics.memory_mb) : "-"}
                        </span>
                      </div>
                      <div className="ml-auto text-muted-foreground">
                        {metrics.uptime_seconds !== null ? formatUptime(metrics.uptime_seconds) : "-"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent/All Servers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {serverMetrics.length > 0 ? "All Servers" : "Servers"}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={onViewAllServers}
            >
              View all
            </Button>
          </div>

          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 py-12">
              <Server className="h-10 w-10 mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium mb-1">No servers yet</p>
              <p className="text-xs text-muted-foreground mb-3">
                Create your first server to get started
              </p>
              <Button size="sm" onClick={onAddInstance}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Server
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {instances.slice(0, 6).map((instance) => {
                const status = getInstanceStatus(instance.id);
                const isRunning = status === "running";

                return (
                  <div
                    key={instance.id}
                    className="cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
                    onClick={() => onSelectInstance(instance)}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                          isRunning ? "bg-green-500/10" : "bg-muted"
                        }`}
                      >
                        <Server
                          className={`h-4 w-4 ${
                            isRunning ? "text-green-500" : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{instance.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {instance.path}
                        </p>
                      </div>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isRunning ? "bg-green-500" : "bg-muted-foreground/30"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact metric chart component
interface MetricChartProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  data: MetricDataPoint[];
  dataKey: "cpu" | "memory";
  color: string;
}

function MetricChart({ icon, label, value, subtitle, data, dataKey, color }: MetricChartProps) {
  const chartConfig = {
    [dataKey]: {
      label: label,
      color: color,
    },
  } satisfies ChartConfig;

  return (
    <div className="rounded-lg border bg-card p-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-lg font-semibold" style={{ color }}>
            {value}
          </span>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <ChartContainer
        config={chartConfig}
        className="h-28 w-full pointer-events-none [&_.recharts-surface]:outline-none"
      >
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.3} />
              <stop offset="95%" stopColor={`var(--color-${dataKey})`} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            tick={{ fontSize: 9 }}
            interval="preserveStartEnd"
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={`var(--color-${dataKey})`}
            fill={`url(#gradient-${dataKey})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

// Skeleton for metric chart
function MetricChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="text-right">
          <Skeleton className="h-5 w-10 ml-auto" />
          <Skeleton className="h-2.5 w-16 mt-1" />
        </div>
      </div>
      <Skeleton className="h-28 w-full rounded" />
    </div>
  );
}

// Skeleton for stat card
function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div>
        <Skeleton className="h-3 w-12 mb-1" />
        <Skeleton className="h-6 w-8" />
      </div>
    </div>
  );
}

// Helper to format uptime
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
