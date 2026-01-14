import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Loader2,
  Save,
  Code,
  LayoutList,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/ui/json-editor";
import type { WorldConfig, WorldConfigResult, JsonWriteResult } from "@/lib/types";

interface WorldConfigEditorProps {
  worldPath: string;
  isRunning: boolean;
}

interface ToggleField {
  key: keyof WorldConfig;
  label: string;
  description: string;
}

const TOGGLE_FIELDS: ToggleField[] = [
  { key: "IsTicking", label: "World Ticking", description: "World is actively running" },
  { key: "IsBlockTicking", label: "Block Ticking", description: "Blocks update and tick" },
  { key: "IsPvpEnabled", label: "PvP Enabled", description: "Players can damage each other" },
  { key: "IsFallDamageEnabled", label: "Fall Damage", description: "Players take fall damage" },
  { key: "IsGameTimePaused", label: "Time Paused", description: "Game time is frozen" },
  { key: "IsSpawningNPC", label: "NPC Spawning", description: "NPCs spawn naturally" },
  { key: "IsSpawnMarkersEnabled", label: "Spawn Markers", description: "Spawn markers are active" },
  { key: "IsAllNPCFrozen", label: "NPCs Frozen", description: "All NPCs are frozen" },
  { key: "IsSavingPlayers", label: "Save Players", description: "Player data is saved" },
  { key: "IsSavingChunks", label: "Save Chunks", description: "Chunk data is saved" },
  { key: "IsUnloadingChunks", label: "Unload Chunks", description: "Chunks are unloaded when not needed" },
  { key: "IsObjectiveMarkersEnabled", label: "Objective Markers", description: "Objective markers are shown" },
  { key: "IsCompassUpdating", label: "Compass Updates", description: "Compass updates position" },
  { key: "DeleteOnUniverseStart", label: "Delete on Start", description: "World deleted when universe starts" },
  { key: "DeleteOnRemove", label: "Delete on Remove", description: "World deleted when removed" },
];

export function WorldConfigEditor({ worldPath, isRunning }: WorldConfigEditorProps) {
  const [config, setConfig] = useState<WorldConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Raw JSON mode
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawError, setRawError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<string>("");

  useEffect(() => {
    loadConfig();
  }, [worldPath]);

  async function loadConfig() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<WorldConfigResult>("get_world_config", { worldPath });

      if (result.success && result.config) {
        setConfig(result.config);
        const jsonStr = result.raw || JSON.stringify(result.config, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
      } else {
        setError(result.error || "Failed to load world config");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load world config");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    setSaving(true);
    setError(null);

    try {
      if (rawMode) {
        // Parse and save raw JSON
        let parsed: WorldConfig;
        try {
          parsed = JSON.parse(rawJson);
        } catch {
          setRawError("Invalid JSON format");
          setSaving(false);
          return;
        }

        const result = await invoke<JsonWriteResult>("save_world_config", {
          worldPath,
          config: parsed,
        });

        if (result.success) {
          setConfig(parsed);
          setOriginalData(rawJson);
          setHasChanges(false);
          setRawError(null);
        } else {
          setError(result.error || "Failed to save config");
        }
      } else {
        const result = await invoke<JsonWriteResult>("save_world_config", {
          worldPath,
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

  function updateToggle(key: keyof WorldConfig, value: boolean) {
    if (!config) return;
    const updated = { ...config, [key]: value };
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
        const parsed = JSON.parse(rawJson) as WorldConfig;
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">config.json</span>
          </div>
          <JsonEditor
            value={rawJson}
            onChange={handleRawJsonChange}
            disabled={isRunning}
            minHeight="500px"
          />
          {rawError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {rawError}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* World Info (Read-only) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">World Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Seed</Label>
                  <Input
                    value={config?.Seed?.toString() || ""}
                    readOnly
                    className="font-mono text-sm bg-muted/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">WorldGen Type</Label>
                  <Input
                    value={config?.WorldGen?.Type || ""}
                    readOnly
                    className="text-sm bg-muted/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">WorldGen Name</Label>
                  <Input
                    value={config?.WorldGen?.Name || ""}
                    readOnly
                    className="text-sm bg-muted/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gameplay Config */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Gameplay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Gameplay Config Preset</Label>
                <Input
                  value={config?.GameplayConfig || "Default"}
                  onChange={(e) => {
                    if (!config) return;
                    const updated = { ...config, GameplayConfig: e.target.value };
                    setConfig(updated);
                    setRawJson(JSON.stringify(updated, null, 2));
                    setHasChanges(true);
                  }}
                  disabled={isRunning}
                  className="text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Toggle Settings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">World Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {TOGGLE_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div>
                      <Label className="text-sm">{field.label}</Label>
                      <p className="text-xs text-muted-foreground">{field.description}</p>
                    </div>
                    <Switch
                      checked={(config?.[field.key] as boolean) ?? false}
                      onCheckedChange={(checked) => updateToggle(field.key, checked)}
                      disabled={isRunning}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
