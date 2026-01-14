import { Info, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SystemMetrics } from "@/lib/types";

interface JvmSettings {
  minMemoryMb: number;
  maxMemoryMb: number;
}

interface JvmSettingsSectionProps {
  settings: JvmSettings;
  systemMetrics: SystemMetrics | null;
  onChange: (settings: JvmSettings) => void;
}

const PRESETS = [
  { label: "Low", minGb: 1, maxGb: 2, description: "For testing or low player count" },
  { label: "Medium", minGb: 2, maxGb: 4, description: "Recommended for most servers" },
  { label: "High", minGb: 4, maxGb: 8, description: "For large worlds or many players" },
] as const;

function formatMemory(mb: number): string {
  if (mb >= 1024) {
    const gb = mb / 1024;
    return gb % 1 === 0 ? `${gb}GB` : `${gb.toFixed(1)}GB`;
  }
  return `${mb}MB`;
}

function mbToGb(mb: number): number {
  return mb / 1024;
}

function gbToMb(gb: number): number {
  return gb * 1024;
}

export function JvmSettingsSection({
  settings,
  systemMetrics,
  onChange,
}: JvmSettingsSectionProps) {
  const totalSystemMemoryGb = systemMetrics ? mbToGb(systemMetrics.total_memory_mb) : 16;
  const maxSliderValue = Math.floor(totalSystemMemoryGb * 0.9); // Max 90% of system RAM

  const minMemoryGb = mbToGb(settings.minMemoryMb);
  const maxMemoryGb = mbToGb(settings.maxMemoryMb);

  // Calculate warning threshold (75% of system RAM)
  const warningThreshold = totalSystemMemoryGb * 0.75;
  const showWarning = maxMemoryGb > warningThreshold;

  // Calculate memory bar percentages
  const usedBySystemPercent = systemMetrics
    ? ((systemMetrics.used_memory_mb - settings.maxMemoryMb) / systemMetrics.total_memory_mb) * 100
    : 0;
  const allocatedPercent = systemMetrics
    ? (settings.maxMemoryMb / systemMetrics.total_memory_mb) * 100
    : 0;

  const handleMinMemoryChange = (value: number[]) => {
    const newMin = gbToMb(value[0]);
    onChange({
      ...settings,
      minMemoryMb: newMin,
      maxMemoryMb: Math.max(newMin, settings.maxMemoryMb),
    });
  };

  const handleMaxMemoryChange = (value: number[]) => {
    const newMax = gbToMb(value[0]);
    onChange({
      ...settings,
      minMemoryMb: Math.min(settings.minMemoryMb, newMax),
      maxMemoryMb: newMax,
    });
  };

  const applyPreset = (preset: typeof PRESETS[number]) => {
    onChange({
      minMemoryMb: gbToMb(preset.minGb),
      maxMemoryMb: gbToMb(preset.maxGb),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Memory Configuration</h4>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Configure how much RAM the server can use. Higher values allow
                  for larger view distances and more players, but leave enough
                  for your system.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {systemMetrics && (
          <span className="text-xs text-muted-foreground">
            System: {formatMemory(systemMetrics.total_memory_mb)} total,{" "}
            {formatMemory(systemMetrics.available_memory_mb)} available
          </span>
        )}
      </div>

      {/* Memory visualization bar */}
      {systemMetrics && (
        <div className="space-y-1">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-zinc-500 transition-all"
              style={{ width: `${Math.max(0, usedBySystemPercent)}%` }}
              title="Used by system"
            />
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${allocatedPercent}%` }}
              title="Allocated to server"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-500 mr-1" />
              System
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-primary mr-1" />
              Server: {formatMemory(settings.maxMemoryMb)}
            </span>
          </div>
        </div>
      )}

      {/* Quick presets */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick Presets</Label>
        <div className="flex gap-2">
          {PRESETS.map((preset) => (
            <TooltipProvider key={preset.label}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      settings.minMemoryMb === gbToMb(preset.minGb) &&
                      settings.maxMemoryMb === gbToMb(preset.maxGb)
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    disabled={preset.maxGb > maxSliderValue}
                  >
                    {preset.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{preset.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {preset.minGb}GB - {preset.maxGb}GB
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Memory sliders */}
      <div className="grid gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="min-memory">Initial Memory (-Xms)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Memory allocated at startup. Set equal to max for best performance.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
              {formatMemory(settings.minMemoryMb)}
            </span>
          </div>
          <Slider
            id="min-memory"
            value={[minMemoryGb]}
            min={0.5}
            max={maxSliderValue}
            step={0.5}
            onValueChange={handleMinMemoryChange}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="max-memory">Maximum Memory (-Xmx)</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Maximum memory the server can use. Higher = larger worlds possible.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
              {formatMemory(settings.maxMemoryMb)}
            </span>
          </div>
          <Slider
            id="max-memory"
            value={[maxMemoryGb]}
            min={0.5}
            max={maxSliderValue}
            step={0.5}
            onValueChange={handleMaxMemoryChange}
          />
        </div>
      </div>

      {/* Warning */}
      {showWarning && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">High memory allocation</p>
            <p className="text-yellow-500/80 text-xs mt-0.5">
              Allocating more than 75% of system RAM may cause performance issues.
              Consider leaving at least {formatMemory(gbToMb(totalSystemMemoryGb * 0.25))} for your system.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
