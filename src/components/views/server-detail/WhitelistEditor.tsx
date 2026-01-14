import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Loader2,
  Plus,
  Trash2,
  Save,
  Code,
  LayoutList,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Whitelist, WhitelistResult, JsonWriteResult } from "@/lib/types";

interface WhitelistEditorProps {
  instancePath: string;
  isRunning: boolean;
}

export function WhitelistEditor({ instancePath, isRunning }: WhitelistEditorProps) {
  const [whitelist, setWhitelist] = useState<Whitelist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUuid, setNewUuid] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Raw JSON mode
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawError, setRawError] = useState<string | null>(null);

  // Original data for change detection
  const [originalData, setOriginalData] = useState<string>("");

  useEffect(() => {
    loadWhitelist();
  }, [instancePath]);

  async function loadWhitelist() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<WhitelistResult>("get_whitelist", {
        instancePath,
      });

      if (result.success && result.whitelist) {
        setWhitelist(result.whitelist);
        const jsonStr = JSON.stringify(result.whitelist, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
      } else {
        setError(result.error || "Failed to load whitelist");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load whitelist");
    } finally {
      setLoading(false);
    }
  }

  async function saveWhitelist() {
    if (!whitelist) return;

    setSaving(true);
    setError(null);

    try {
      let dataToSave: Whitelist;

      if (rawMode) {
        // Parse raw JSON
        try {
          dataToSave = JSON.parse(rawJson);
        } catch {
          setRawError("Invalid JSON format");
          setSaving(false);
          return;
        }
      } else {
        dataToSave = whitelist;
      }

      const result = await invoke<JsonWriteResult>("save_whitelist", {
        instancePath,
        whitelist: dataToSave,
      });

      if (result.success) {
        setWhitelist(dataToSave);
        const jsonStr = JSON.stringify(dataToSave, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
        setRawError(null);
      } else {
        setError(result.error || "Failed to save whitelist");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save whitelist");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleEnabled(enabled: boolean) {
    if (!whitelist) return;
    const updated = { ...whitelist, enabled };
    setWhitelist(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setHasChanges(JSON.stringify(updated, null, 2) !== originalData);
  }

  function handleAddUuid() {
    if (!whitelist || !newUuid.trim()) return;

    // Basic UUID validation (accepts with or without dashes)
    const uuid = newUuid.trim();
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

    if (!uuidRegex.test(uuid)) {
      setError("Invalid UUID format");
      return;
    }

    // Normalize UUID (add dashes if missing)
    const normalizedUuid = uuid.includes("-")
      ? uuid
      : `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`;

    if (whitelist.list.includes(normalizedUuid)) {
      setError("UUID already in whitelist");
      return;
    }

    const updated = {
      ...whitelist,
      list: [...whitelist.list, normalizedUuid],
    };
    setWhitelist(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setHasChanges(JSON.stringify(updated, null, 2) !== originalData);
    setNewUuid("");
    setError(null);
  }

  function handleRemoveUuid(uuid: string) {
    if (!whitelist) return;

    const updated = {
      ...whitelist,
      list: whitelist.list.filter((u) => u !== uuid),
    };
    setWhitelist(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setHasChanges(JSON.stringify(updated, null, 2) !== originalData);
  }

  function handleRawJsonChange(value: string) {
    setRawJson(value);
    setRawError(null);

    // Try to parse to validate
    try {
      JSON.parse(value);
      setHasChanges(value !== originalData);
    } catch {
      setRawError("Invalid JSON");
      setHasChanges(true);
    }
  }

  function handleModeToggle() {
    if (!rawMode && whitelist) {
      // Switching to raw mode - update raw JSON from current whitelist
      setRawJson(JSON.stringify(whitelist, null, 2));
    } else if (rawMode) {
      // Switching to form mode - try to parse raw JSON
      try {
        const parsed = JSON.parse(rawJson) as Whitelist;
        setWhitelist(parsed);
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
      {/* Header with mode toggle and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleModeToggle}
            className="gap-1.5"
          >
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
          <Button
            variant="ghost"
            size="sm"
            onClick={loadWhitelist}
            disabled={loading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {hasChanges && (
          <Button onClick={saveWhitelist} disabled={saving || isRunning} size="sm">
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

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {rawMode ? (
        /* Raw JSON Editor */
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">whitelist.json</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={rawJson}
              onChange={(e) => handleRawJsonChange(e.target.value)}
              className="w-full h-64 p-3 font-mono text-sm bg-muted/50 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
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
        /* Form View */
        <div className="space-y-4">
          {/* Enable toggle */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="whitelist-enabled" className="text-sm font-medium">
                    Whitelist Enabled
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Only players in the whitelist can join the server
                  </p>
                </div>
                <Switch
                  id="whitelist-enabled"
                  checked={whitelist?.enabled ?? false}
                  onCheckedChange={handleToggleEnabled}
                  disabled={isRunning}
                />
              </div>
            </CardContent>
          </Card>

          {/* Add player */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Add Player</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter player UUID..."
                  value={newUuid}
                  onChange={(e) => setNewUuid(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddUuid()}
                  className="font-mono text-sm"
                  disabled={isRunning}
                />
                <Button
                  onClick={handleAddUuid}
                  disabled={!newUuid.trim() || isRunning}
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Whitelist entries */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Whitelisted Players ({whitelist?.list.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {whitelist?.list.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No players in whitelist
                </p>
              ) : (
                <div className="space-y-2">
                  {whitelist?.list.map((uuid) => (
                    <div
                      key={uuid}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <code className="text-sm font-mono">{uuid}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUuid(uuid)}
                        disabled={isRunning}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
