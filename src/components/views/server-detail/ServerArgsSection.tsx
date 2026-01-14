import { Info, AlertTriangle, FolderOpen } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { open } from "@tauri-apps/plugin-dialog";

export interface ServerArgsSettings {
  assetsPath: string;
  bindIp: string;
  bindPort: string;
  authMode: "authenticated" | "offline";
  backupEnabled: boolean;
  backupDir: string;
  backupFrequency: number;
  allowOp: boolean;
  acceptEarlyPlugins: boolean;
  disableSentry: boolean;
}

export interface UsedPort {
  port: number;
  serverName: string;
  instanceId: string;
}

interface ServerArgsSectionProps {
  settings: ServerArgsSettings;
  instancePath: string;
  usedPorts?: UsedPort[];
  onChange: (settings: ServerArgsSettings) => void;
}

interface SettingRowProps {
  label: string;
  tooltip: string;
  children: React.ReactNode;
  warning?: string;
}

function SettingRow({ label, tooltip, children, warning }: SettingRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {children}
      {warning && (
        <p className="text-xs text-yellow-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {warning}
        </p>
      )}
    </div>
  );
}

interface SwitchRowProps {
  label: string;
  tooltip: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  warning?: string;
  disabled?: boolean;
}

function SwitchRow({
  label,
  tooltip,
  checked,
  onCheckedChange,
  warning,
  disabled,
}: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Label className="text-sm">{label}</Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
              {warning && (
                <p className="text-yellow-500 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {warning}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function ServerArgsSection({
  settings,
  instancePath,
  usedPorts = [],
  onChange,
}: ServerArgsSectionProps) {
  const updateSetting = <K extends keyof ServerArgsSettings>(
    key: K,
    value: ServerArgsSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const handleSelectBackupDir = async () => {
    const selected = await open({
      directory: true,
      defaultPath: instancePath,
      title: "Select Backup Directory",
    });
    if (selected) {
      updateSetting("backupDir", selected);
    }
  };

  // Check for port conflicts
  const currentPort = parseInt(settings.bindPort) || 5520;
  const portConflict = usedPorts.find((p) => p.port === currentPort);

  // Find next available port
  const findNextAvailablePort = (): number => {
    const usedPortNumbers = usedPorts.map((p) => p.port);
    let nextPort = currentPort + 1;
    while (usedPortNumbers.includes(nextPort) && nextPort <= 65535) {
      nextPort++;
    }
    return nextPort <= 65535 ? nextPort : 5520;
  };

  const handleUseNextPort = () => {
    const nextPort = findNextAvailablePort();
    updateSetting("bindPort", nextPort.toString());
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">Server Arguments</h4>

      {/* Network Settings */}
      <div className="rounded-md border p-3 space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Network
        </h5>

        <SettingRow
          label="Bind Address"
          tooltip="IP address and port the server listens on. Use 0.0.0.0 to accept connections from any IP."
        >
          <div className="flex gap-2">
            <Input
              value={settings.bindIp}
              onChange={(e) => updateSetting("bindIp", e.target.value)}
              placeholder="0.0.0.0"
              className="font-mono text-sm flex-1"
            />
            <span className="flex items-center text-muted-foreground">:</span>
            <Input
              value={settings.bindPort}
              onChange={(e) => updateSetting("bindPort", e.target.value)}
              placeholder="5520"
              className={`font-mono text-sm w-24 ${portConflict ? "border-yellow-500 focus-visible:ring-yellow-500" : ""}`}
              type="number"
              min={1}
              max={65535}
            />
          </div>
          {portConflict && (
            <div className="flex items-center justify-between mt-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Port {currentPort} is already used by "{portConflict.serverName}"
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseNextPort}
                className="h-6 text-xs border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
              >
                Use {findNextAvailablePort()}
              </Button>
            </div>
          )}
          {usedPorts.length > 0 && !portConflict && (
            <p className="text-xs text-muted-foreground mt-1">
              Ports in use by other servers: {usedPorts.map((p) => p.port).join(", ")}
            </p>
          )}
        </SettingRow>

        <SettingRow
          label="Authentication Mode"
          tooltip="'Authenticated' requires players to have a valid Hytale account. 'Offline' allows anyone to join (useful for local testing)."
        >
          <Select
            value={settings.authMode}
            onValueChange={(value) =>
              updateSetting("authMode", value as "authenticated" | "offline")
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="authenticated">
                Authenticated (Recommended)
              </SelectItem>
              <SelectItem value="offline">
                Offline (Local testing only)
              </SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      {/* Backup Settings */}
      <div className="rounded-md border p-3 space-y-3">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Backups
        </h5>

        <SwitchRow
          label="Enable Automatic Backups"
          tooltip="Periodically save a backup of your world data."
          checked={settings.backupEnabled}
          onCheckedChange={(checked) => updateSetting("backupEnabled", checked)}
        />

        {settings.backupEnabled && (
          <>
            <SettingRow
              label="Backup Directory"
              tooltip="Where backup files will be stored."
            >
              <div className="flex gap-2">
                <Input
                  value={settings.backupDir}
                  onChange={(e) => updateSetting("backupDir", e.target.value)}
                  placeholder="./backups"
                  className="font-mono text-sm flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSelectBackupDir}
                  title="Browse..."
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </SettingRow>

            <SettingRow
              label="Backup Frequency (minutes)"
              tooltip="How often backups are created. Default is 30 minutes."
            >
              <Input
                type="number"
                value={settings.backupFrequency}
                onChange={(e) =>
                  updateSetting("backupFrequency", parseInt(e.target.value) || 30)
                }
                min={5}
                max={1440}
                className="font-mono text-sm w-32"
              />
            </SettingRow>
          </>
        )}
      </div>

      {/* Advanced Settings */}
      <div className="rounded-md border p-3 space-y-1">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Advanced
        </h5>

        <SwitchRow
          label="Allow Operators"
          tooltip="Enable the operator (admin) system for player permissions."
          checked={settings.allowOp}
          onCheckedChange={(checked) => updateSetting("allowOp", checked)}
        />

        <SwitchRow
          label="Accept Early Plugins"
          tooltip="Load experimental 'early' plugins that run before the server fully starts."
          checked={settings.acceptEarlyPlugins}
          onCheckedChange={(checked) => updateSetting("acceptEarlyPlugins", checked)}
          warning="May cause instability. Only enable if required by a plugin."
        />

        <SwitchRow
          label="Disable Crash Reporting"
          tooltip="Stop sending crash reports to Hytale. Recommended during plugin development."
          checked={settings.disableSentry}
          onCheckedChange={(checked) => updateSetting("disableSentry", checked)}
        />
      </div>

      {/* Assets Path (usually not changed) */}
      <div className="rounded-md border border-dashed p-3 space-y-3 opacity-75">
        <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Paths (Advanced)
        </h5>

        <SettingRow
          label="Assets Path"
          tooltip="Path to Assets.zip. Usually doesn't need to be changed."
        >
          <Input
            value={settings.assetsPath}
            onChange={(e) => updateSetting("assetsPath", e.target.value)}
            placeholder="../Assets.zip (default)"
            className="font-mono text-sm"
          />
        </SettingRow>
      </div>
    </div>
  );
}
