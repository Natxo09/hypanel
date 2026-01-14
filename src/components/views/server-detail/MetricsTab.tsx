import { Activity, Cpu, MemoryStick, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, XAxis } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";
import type { ServerMetrics } from "@/lib/types";

export interface MetricDataPoint {
  time: string;
  cpu: number;
  memory: number;
}

interface MetricsTabProps {
  isRunning: boolean;
  metrics: ServerMetrics | null;
  metricsHistory: MetricDataPoint[];
  uptime: string;
}

function formatMemory(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export function MetricsTab({ isRunning, metrics, metricsHistory, uptime }: MetricsTabProps) {
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
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <MetricChartSkeleton />
          <MetricChartSkeleton />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Charts */}
      <div className="grid gap-3 md:grid-cols-2">
        <MetricChart
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="CPU"
          value={metrics.cpu_usage !== null ? `${Math.round(metrics.cpu_usage)}%` : "-"}
          data={metricsHistory}
          dataKey="cpu"
          color="#3b82f6"
        />
        <MetricChart
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          label="Memory"
          value={metrics.memory_mb !== null ? formatMemory(metrics.memory_mb) : "-"}
          data={metricsHistory}
          dataKey="memory"
          color="#22c55e"
          formatValue={(val) => formatMemory(val)}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={<Cpu className="h-4 w-4" />}
          label="CPU Usage"
          value={metrics.cpu_usage !== null ? `${Math.round(metrics.cpu_usage)}%` : "-"}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          icon={<MemoryStick className="h-4 w-4" />}
          label="Memory"
          value={metrics.memory_mb !== null ? formatMemory(metrics.memory_mb) : "-"}
          subtitle={metrics.memory_percent !== null ? `${Math.round(metrics.memory_percent)}% of system` : undefined}
          color="text-green-500"
          bgColor="bg-green-500/10"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Uptime"
          value={uptime}
          subtitle={metrics.pid !== null ? `PID: ${metrics.pid}` : undefined}
          color="text-purple-500"
          bgColor="bg-purple-500/10"
        />
      </div>
    </div>
  );
}

// Chart component
interface MetricChartProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  data: MetricDataPoint[];
  dataKey: "cpu" | "memory";
  color: string;
  formatValue?: (val: number) => string;
}

function MetricChart({ icon, label, value, data, dataKey, color }: MetricChartProps) {
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
        <span className="text-lg font-semibold" style={{ color }}>
          {value}
        </span>
      </div>
      <ChartContainer
        config={chartConfig}
        className="h-32 w-full pointer-events-none [&_.recharts-surface]:outline-none"
      >
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id={`gradient-server-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
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
            fill={`url(#gradient-server-${dataKey})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

// Stat card component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon, label, value, subtitle, color, bgColor }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

// Skeleton for chart
function MetricChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-32 w-full rounded" />
    </div>
  );
}
