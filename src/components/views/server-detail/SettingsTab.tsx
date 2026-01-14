import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JvmSettingsSection } from "./JvmSettingsSection";
import { ServerArgsSection, type ServerArgsSettings, type UsedPort } from "./ServerArgsSection";
import { CommandPreview } from "./CommandPreview";
import { NetworkSection } from "./NetworkSection";
import { AuthSection } from "./AuthSection";
import type { Instance, SystemMetrics } from "@/lib/types";

// Helper to extract port from server_args string
function extractPortFromServerArgs(serverArgs: string | null): number {
  if (!serverArgs) return 5520; // Default port

  const parts = serverArgs.split(/\s+/);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "--bind" && parts[i + 1]) {
      const bind = parts[i + 1];
      const portMatch = bind.match(/:(\d+)$/);
      if (portMatch) {
        return parseInt(portMatch[1]) || 5520;
      }
    }
  }
  return 5520; // Default port
}

interface SettingsFormState {
  name: string;
  java_path: string;
  jvm_args: string;
  server_args: string;
}

interface SettingsTabProps {
  instance: Instance;
  settingsForm: SettingsFormState;
  systemMetrics: SystemMetrics | null;
  allInstances: Instance[];
  isSaving: boolean;
  isRunning: boolean;
  onFormChange: (updates: Partial<SettingsFormState>) => void;
  onSave: () => void;
  onRefreshInstance?: () => void;
}

// Parse JVM args string to structured format
function parseJvmArgs(jvmArgs: string): { minMemoryMb: number; maxMemoryMb: number; otherArgs: string } {
  const parts = jvmArgs.split(/\s+/).filter(Boolean);
  let minMemoryMb = 2048; // 2GB default
  let maxMemoryMb = 4096; // 4GB default
  const otherParts: string[] = [];

  for (const part of parts) {
    const xmsMatch = part.match(/^-Xms(\d+)([GMgm]?)$/);
    const xmxMatch = part.match(/^-Xmx(\d+)([GMgm]?)$/);

    if (xmsMatch) {
      const value = parseInt(xmsMatch[1]);
      const unit = xmsMatch[2].toUpperCase();
      minMemoryMb = unit === "G" ? value * 1024 : value;
    } else if (xmxMatch) {
      const value = parseInt(xmxMatch[1]);
      const unit = xmxMatch[2].toUpperCase();
      maxMemoryMb = unit === "G" ? value * 1024 : value;
    } else {
      otherParts.push(part);
    }
  }

  return { minMemoryMb, maxMemoryMb, otherArgs: otherParts.join(" ") };
}

// Convert structured JVM settings back to string
function buildJvmArgsString(minMb: number, maxMb: number, otherArgs: string): string {
  const parts: string[] = [];

  // Use GB if >= 1GB, otherwise MB
  if (minMb >= 1024 && minMb % 1024 === 0) {
    parts.push(`-Xms${minMb / 1024}G`);
  } else {
    parts.push(`-Xms${minMb}M`);
  }

  if (maxMb >= 1024 && maxMb % 1024 === 0) {
    parts.push(`-Xmx${maxMb / 1024}G`);
  } else {
    parts.push(`-Xmx${maxMb}M`);
  }

  if (otherArgs.trim()) {
    parts.push(otherArgs.trim());
  }

  return parts.join(" ");
}

// Parse server args string to structured format
function parseServerArgs(serverArgs: string): ServerArgsSettings {
  const defaults: ServerArgsSettings = {
    assetsPath: "",
    bindIp: "0.0.0.0",
    bindPort: "5520",
    authMode: "authenticated",
    backupEnabled: false,
    backupDir: "",
    backupFrequency: 30,
    allowOp: false,
    acceptEarlyPlugins: false,
    disableSentry: false,
  };

  if (!serverArgs.trim()) return defaults;

  const parts = serverArgs.split(/\s+/);
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];

    switch (part) {
      case "--assets":
        if (parts[i + 1]) {
          defaults.assetsPath = parts[++i];
        }
        break;
      case "--bind":
        if (parts[i + 1]) {
          const bind = parts[++i];
          const [ip, port] = bind.split(":");
          defaults.bindIp = ip || "0.0.0.0";
          defaults.bindPort = port || "5520";
        }
        break;
      case "--auth-mode":
        if (parts[i + 1]) {
          const mode = parts[++i];
          if (mode === "offline" || mode === "authenticated") {
            defaults.authMode = mode;
          }
        }
        break;
      case "--backup":
        defaults.backupEnabled = true;
        break;
      case "--backup-dir":
        if (parts[i + 1]) {
          defaults.backupDir = parts[++i];
        }
        break;
      case "--backup-frequency":
        if (parts[i + 1]) {
          defaults.backupFrequency = parseInt(parts[++i]) || 30;
        }
        break;
      case "--allow-op":
        defaults.allowOp = true;
        break;
      case "--accept-early-plugins":
        defaults.acceptEarlyPlugins = true;
        break;
      case "--disable-sentry":
        defaults.disableSentry = true;
        break;
    }
    i++;
  }

  return defaults;
}

// Convert structured server settings back to string
function buildServerArgsString(settings: ServerArgsSettings): string {
  const parts: string[] = [];

  // Assets path (only if custom)
  if (settings.assetsPath.trim()) {
    parts.push("--assets", settings.assetsPath);
  }

  // Bind address (only if not default)
  if (settings.bindIp !== "0.0.0.0" || settings.bindPort !== "5520") {
    parts.push("--bind", `${settings.bindIp}:${settings.bindPort}`);
  }

  // Auth mode (only if offline)
  if (settings.authMode === "offline") {
    parts.push("--auth-mode", "offline");
  }

  // Backup settings
  if (settings.backupEnabled) {
    parts.push("--backup");
    if (settings.backupDir.trim()) {
      parts.push("--backup-dir", settings.backupDir);
    }
    if (settings.backupFrequency !== 30) {
      parts.push("--backup-frequency", settings.backupFrequency.toString());
    }
  }

  // Boolean flags
  if (settings.allowOp) parts.push("--allow-op");
  if (settings.acceptEarlyPlugins) parts.push("--accept-early-plugins");
  if (settings.disableSentry) parts.push("--disable-sentry");

  return parts.join(" ");
}

export function SettingsTab({
  instance,
  settingsForm,
  systemMetrics,
  allInstances,
  isSaving,
  isRunning,
  onFormChange,
  onSave,
  onRefreshInstance,
}: SettingsTabProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate ports used by OTHER instances (not this one)
  const usedPorts: UsedPort[] = useMemo(() => {
    return allInstances
      .filter((inst) => inst.id !== instance.id)
      .map((inst) => ({
        port: extractPortFromServerArgs(inst.server_args),
        serverName: inst.name,
        instanceId: inst.id,
      }));
  }, [allInstances, instance.id]);

  // Parse current form values to structured format
  const parsedJvm = useMemo(
    () => parseJvmArgs(settingsForm.jvm_args),
    [settingsForm.jvm_args]
  );

  const parsedServerArgs = useMemo(
    () => parseServerArgs(settingsForm.server_args),
    [settingsForm.server_args]
  );

  // Local state for structured settings
  const [jvmSettings, setJvmSettings] = useState({
    minMemoryMb: parsedJvm.minMemoryMb,
    maxMemoryMb: parsedJvm.maxMemoryMb,
  });

  const [serverArgsSettings, setServerArgsSettings] = useState<ServerArgsSettings>(parsedServerArgs);

  // Sync local state when form changes externally
  useEffect(() => {
    const parsed = parseJvmArgs(settingsForm.jvm_args);
    setJvmSettings({
      minMemoryMb: parsed.minMemoryMb,
      maxMemoryMb: parsed.maxMemoryMb,
    });
  }, [settingsForm.jvm_args]);

  useEffect(() => {
    setServerArgsSettings(parseServerArgs(settingsForm.server_args));
  }, [settingsForm.server_args]);

  // Update form when structured settings change
  const handleJvmChange = (newSettings: typeof jvmSettings) => {
    setJvmSettings(newSettings);
    const newJvmArgs = buildJvmArgsString(
      newSettings.minMemoryMb,
      newSettings.maxMemoryMb,
      parsedJvm.otherArgs
    );
    onFormChange({ jvm_args: newJvmArgs });
  };

  const handleServerArgsChange = (newSettings: ServerArgsSettings) => {
    setServerArgsSettings(newSettings);
    onFormChange({ server_args: buildServerArgsString(newSettings) });
  };

  return (
    <div className="max-w-2xl space-y-4">
      {/* Basic Settings */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <h3 className="text-sm font-medium">General</h3>

        <div className="space-y-2">
          <Label htmlFor="name">Server Name</Label>
          <Input
            id="name"
            value={settingsForm.name}
            onChange={(e) => onFormChange({ name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="java_path">Java Path</Label>
          <Input
            id="java_path"
            value={settingsForm.java_path}
            onChange={(e) => onFormChange({ java_path: e.target.value })}
            placeholder="java (uses system default)"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Path to Java 25+ executable. Leave empty to use system default.
          </p>
        </div>
      </div>

      {/* JVM Memory Settings */}
      <div className="rounded-lg border bg-card p-4">
        <JvmSettingsSection
          settings={jvmSettings}
          systemMetrics={systemMetrics}
          onChange={handleJvmChange}
        />
      </div>

      {/* Server Arguments */}
      <div className="rounded-lg border bg-card p-4">
        <ServerArgsSection
          settings={serverArgsSettings}
          instancePath={instance.path}
          usedPorts={usedPorts}
          onChange={handleServerArgsChange}
        />
      </div>

      {/* Authentication */}
      <div className="rounded-lg border bg-card p-4">
        <AuthSection
          instance={instance}
          isRunning={isRunning}
          onRefresh={onRefreshInstance}
        />
      </div>

      {/* Network / Firewall */}
      <div className="rounded-lg border bg-card p-4">
        <NetworkSection
          serverName={settingsForm.name || instance.name}
          port={parseInt(serverArgsSettings.bindPort) || 5520}
        />
      </div>

      {/* Command Preview */}
      <div className="rounded-lg border bg-card p-4">
        <CommandPreview
          javaPath={settingsForm.java_path}
          jvmArgs={settingsForm.jvm_args}
          serverArgs={settingsForm.server_args}
        />
      </div>

      {/* Advanced / Raw Mode */}
      <div className="rounded-lg border border-dashed p-4 space-y-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          Advanced Mode (Raw Arguments)
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="jvm_args_raw">JVM Arguments (Raw)</Label>
              <Input
                id="jvm_args_raw"
                value={settingsForm.jvm_args}
                onChange={(e) => onFormChange({ jvm_args: e.target.value })}
                placeholder="-Xmx4G -Xms2G"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server_args_raw">Server Arguments (Raw)</Label>
              <Input
                id="server_args_raw"
                value={settingsForm.server_args}
                onChange={(e) => onFormChange({ server_args: e.target.value })}
                placeholder="--bind 0.0.0.0:5520"
                className="font-mono text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save Changes
      </Button>

      {/* Server Info */}
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <h3 className="text-sm font-medium">Server Info</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Instance ID</dt>
            <dd className="font-mono text-xs">{instance.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Path</dt>
            <dd className="font-mono text-xs truncate max-w-[300px]" title={instance.path}>
              {instance.path}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-xs">
              {instance.created_at
                ? new Date(instance.created_at).toLocaleDateString()
                : "-"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
