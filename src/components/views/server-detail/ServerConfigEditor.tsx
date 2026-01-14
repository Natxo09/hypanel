import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Loader2,
  Save,
  Code,
  LayoutList,
  RefreshCw,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ServerConfig, ServerConfigResult, JsonWriteResult } from "@/lib/types";

interface ServerConfigEditorProps {
  instancePath: string;
  isRunning: boolean;
}

export function ServerConfigEditor({ instancePath, isRunning }: ServerConfigEditorProps) {
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Raw JSON mode
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawError, setRawError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<string>("");

  useEffect(() => {
    loadConfig();
  }, [instancePath]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<ServerConfigResult>("get_server_config", { instancePath });

      if (result.success && result.config) {
        setConfig(result.config);
        const jsonStr = result.raw || JSON.stringify(result.config, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
      } else {
        setError(result.error || "Failed to load server config");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load server config");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setError(null);

    try {
      if (rawMode) {
        // Save raw JSON
        const result = await invoke<JsonWriteResult>("write_json_file_raw", {
          filePath: `${instancePath}/config.json`,
          content: rawJson,
        });

        if (result.success) {
          setOriginalData(rawJson);
          setHasChanges(false);
          setRawError(null);
          // Reload to get parsed config
          await loadConfig();
        } else {
          setError(result.error || "Failed to save config");
        }
      } else {
        const result = await invoke<JsonWriteResult>("save_server_config", {
          instancePath,
          config,
        });

        if (result.success) {
          const jsonStr = JSON.stringify(config, null, 2);
          setRawJson(jsonStr);
          setOriginalData(jsonStr);
          setHasChanges(false);
        } else {
          setError(result.error || "Failed to save config");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  function updateConfig(updates: Partial<ServerConfig>) {
    if (!config) return;
    const updated = { ...config, ...updates };
    setConfig(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setHasChanges(true);
  }

  function updateDefaults(updates: Partial<ServerConfig["Defaults"]>) {
    if (!config) return;
    const updated = {
      ...config,
      Defaults: { ...config.Defaults, ...updates },
    };
    setConfig(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setHasChanges(true);
  }

  function handleRawJsonChange(value: string) {
    setRawJson(value);
    setRawError(null);
    try {
      JSON.parse(value);
      setHasChanges(value !== originalData);
    } catch {
      setRawError("Invalid JSON");
      setHasChanges(true);
    }
  }

  function handleModeToggle() {
    if (!rawMode && config) {
      setRawJson(JSON.stringify(config, null, 2));
    } else if (rawMode) {
      try {
        const parsed = JSON.parse(rawJson) as ServerConfig;
        setConfig(parsed);
        setRawError(null);
      } catch {
        setRawError("Cannot switch: Invalid JSON format");
        return;
      }
    }
    setRawMode(!rawMode);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleModeToggle} className="gap-1.5">
            {rawMode ? (
              <>
                <LayoutList className="h-3.5 w-3.5" />
                Form View
              </>
            ) : (
              <>
                <Code className="h-3.5 w-3.5" />
                Raw JSON
              </>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={loadConfig} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {hasChanges && (
          <Button onClick={saveConfig} disabled={saving || isRunning} size="sm">
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {rawMode ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">config.json</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={rawJson}
              onChange={(e) => handleRawJsonChange(e.target.value)}
              className="w-full h-96 p-3 font-mono text-sm bg-muted/50 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              spellCheck={false}
            />
            {rawError && (
              <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {rawError}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Basic Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Basic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="server-name">Server Name</Label>
                  <Input
                    id="server-name"
                    value={config?.ServerName || ""}
                    onChange={(e) => updateConfig({ ServerName: e.target.value })}
                    disabled={isRunning}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motd">MOTD</Label>
                  <Input
                    id="motd"
                    value={config?.MOTD || ""}
                    onChange={(e) => updateConfig({ MOTD: e.target.value })}
                    placeholder="Message of the day..."
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-players">Max Players</Label>
                  <Input
                    id="max-players"
                    type="number"
                    value={config?.MaxPlayers || 100}
                    onChange={(e) => updateConfig({ MaxPlayers: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={1000}
                    disabled={isRunning}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-view-radius">Max View Radius</Label>
                  <Input
                    id="max-view-radius"
                    type="number"
                    value={config?.MaxViewRadius || 32}
                    onChange={(e) => updateConfig({ MaxViewRadius: parseInt(e.target.value) || 32 })}
                    min={1}
                    max={64}
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Server Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={config?.Password || ""}
                  onChange={(e) => updateConfig({ Password: e.target.value })}
                  placeholder="Leave empty for no password"
                  disabled={isRunning}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Local Compression</Label>
                  <p className="text-xs text-muted-foreground">Enable local network compression</p>
                </div>
                <Switch
                  checked={config?.LocalCompressionEnabled ?? false}
                  onCheckedChange={(checked) => updateConfig({ LocalCompressionEnabled: checked })}
                  disabled={isRunning}
                />
              </div>
            </CardContent>
          </Card>

          {/* Defaults */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default-world">Default World</Label>
                  <Input
                    id="default-world"
                    value={config?.Defaults?.World || "default"}
                    onChange={(e) => updateDefaults({ World: e.target.value })}
                    disabled={isRunning}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-gamemode">Default Game Mode</Label>
                  <Select
                    value={config?.Defaults?.GameMode || "Adventure"}
                    onValueChange={(value) => updateDefaults({ GameMode: value })}
                    disabled={isRunning}
                  >
                    <SelectTrigger id="default-gamemode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Adventure">Adventure</SelectItem>
                      <SelectItem value="Creative">Creative</SelectItem>
                      <SelectItem value="Survival">Survival</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Settings (Collapsible) */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Advanced Settings</CardTitle>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Advanced configuration options. Use Raw JSON mode for full control over all settings.
                  </p>
                  <div className="p-3 rounded-lg bg-muted/50 font-mono text-xs max-h-48 overflow-auto">
                    <pre>{JSON.stringify(config, null, 2)}</pre>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}
    </div>
  );
}
