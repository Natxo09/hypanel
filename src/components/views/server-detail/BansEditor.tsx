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
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Ban, BansResult, JsonWriteResult } from "@/lib/types";

interface BansEditorProps {
  instancePath: string;
  isRunning: boolean;
}

export function BansEditor({ instancePath, isRunning }: BansEditorProps) {
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Add ban form
  const [newUuid, setNewUuid] = useState("");
  const [newReason, setNewReason] = useState("");

  // Raw JSON mode
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawError, setRawError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<string>("");

  useEffect(() => {
    loadBans();
  }, [instancePath]);

  async function loadBans() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<BansResult>("get_bans", { instancePath });

      if (result.success && result.bans) {
        setBans(result.bans);
        const jsonStr = JSON.stringify(result.bans, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
      } else {
        setError(result.error || "Failed to load bans");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bans");
    } finally {
      setLoading(false);
    }
  }

  async function saveBans() {
    setSaving(true);
    setError(null);

    try {
      let dataToSave: Ban[];

      if (rawMode) {
        try {
          dataToSave = JSON.parse(rawJson);
        } catch {
          setRawError("Invalid JSON format");
          setSaving(false);
          return;
        }
      } else {
        dataToSave = bans;
      }

      const result = await invoke<JsonWriteResult>("save_bans", {
        instancePath,
        bans: dataToSave,
      });

      if (result.success) {
        setBans(dataToSave);
        const jsonStr = JSON.stringify(dataToSave, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
        setRawError(null);
      } else {
        setError(result.error || "Failed to save bans");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bans");
    } finally {
      setSaving(false);
    }
  }

  function handleAddBan() {
    if (!newUuid.trim()) return;

    const uuid = newUuid.trim();
    if (bans.some((b) => b.uuid === uuid)) {
      setError("Player already banned");
      return;
    }

    const newBan: Ban = {
      uuid,
      reason: newReason.trim() || undefined,
      bannedAt: new Date().toISOString(),
    };

    const updated = [...bans, newBan];
    setBans(updated);
    setRawJson(JSON.stringify(updated, null, 2));
    setHasChanges(true);
    setNewUuid("");
    setNewReason("");
    setError(null);
  }

  function handleRemoveBan(uuid: string) {
    const updated = bans.filter((b) => b.uuid !== uuid);
    setBans(updated);
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
    if (!rawMode) {
      setRawJson(JSON.stringify(bans, null, 2));
    } else {
      try {
        const parsed = JSON.parse(rawJson) as Ban[];
        setBans(parsed);
        setRawError(null);
      } catch {
        setRawError("Cannot switch: Invalid JSON format");
        return;
      }
    }
    setRawMode(!rawMode);
  }

  const filteredBans = bans.filter((ban) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ban.uuid.toLowerCase().includes(query) ||
      ban.name?.toLowerCase().includes(query) ||
      ban.reason?.toLowerCase().includes(query)
    );
  });

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
          <Button variant="ghost" size="sm" onClick={loadBans} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {hasChanges && (
          <Button onClick={saveBans} disabled={saving || isRunning} size="sm">
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
            <CardTitle className="text-sm font-medium">bans.json</CardTitle>
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
        <div className="space-y-4">
          {/* Add ban form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Ban Player</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Player UUID..."
                value={newUuid}
                onChange={(e) => setNewUuid(e.target.value)}
                className="font-mono text-sm"
                disabled={isRunning}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Reason (optional)..."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  disabled={isRunning}
                />
                <Button onClick={handleAddBan} disabled={!newUuid.trim() || isRunning} size="sm">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Ban
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search and list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Banned Players ({bans.length})
                </CardTitle>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredBans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {bans.length === 0 ? "No banned players" : "No results found"}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredBans.map((ban) => (
                    <div
                      key={ban.uuid}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="min-w-0 flex-1">
                        <code className="text-sm font-mono block truncate">{ban.uuid}</code>
                        {ban.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Reason: {ban.reason}
                          </p>
                        )}
                        {ban.bannedAt && (
                          <p className="text-xs text-muted-foreground">
                            {new Date(ban.bannedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveBan(ban.uuid)}
                        disabled={isRunning}
                        className="h-7 px-2 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Unban
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
