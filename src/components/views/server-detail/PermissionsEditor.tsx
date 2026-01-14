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
  Users,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JsonEditor } from "@/components/ui/json-editor";
import type { Permissions, PermissionsResult, JsonWriteResult } from "@/lib/types";

interface PermissionsEditorProps {
  instancePath: string;
  isRunning: boolean;
}

export function PermissionsEditor({ instancePath, isRunning }: PermissionsEditorProps) {
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Add forms
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupPermission, setNewGroupPermission] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // Raw JSON mode
  const [rawMode, setRawMode] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawError, setRawError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<string>("");

  useEffect(() => {
    loadPermissions();
  }, [instancePath]);

  async function loadPermissions() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<PermissionsResult>("get_permissions", { instancePath });

      if (result.success && result.permissions) {
        setPermissions(result.permissions);
        const jsonStr = JSON.stringify(result.permissions, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
      } else {
        setError(result.error || "Failed to load permissions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  async function savePermissions() {
    setSaving(true);
    setError(null);

    try {
      let dataToSave: Permissions;

      if (rawMode) {
        try {
          dataToSave = JSON.parse(rawJson);
        } catch {
          setRawError("Invalid JSON format");
          setSaving(false);
          return;
        }
      } else {
        dataToSave = permissions!;
      }

      const result = await invoke<JsonWriteResult>("save_permissions", {
        instancePath,
        permissions: dataToSave,
      });

      if (result.success) {
        setPermissions(dataToSave);
        const jsonStr = JSON.stringify(dataToSave, null, 2);
        setRawJson(jsonStr);
        setOriginalData(jsonStr);
        setHasChanges(false);
        setRawError(null);
      } else {
        setError(result.error || "Failed to save permissions");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  function handleAddGroup() {
    if (!permissions || !newGroupName.trim()) return;

    if (permissions.groups[newGroupName.trim()]) {
      setError("Group already exists");
      return;
    }

    const updated = {
      ...permissions,
      groups: {
        ...permissions.groups,
        [newGroupName.trim()]: [],
      },
    };
    setPermissions(updated);
    updateChanges(updated);
    setNewGroupName("");
    setError(null);
  }

  function handleRemoveGroup(groupName: string) {
    if (!permissions) return;

    const { [groupName]: _, ...remainingGroups } = permissions.groups;
    const updated = {
      ...permissions,
      groups: remainingGroups,
    };
    setPermissions(updated);
    updateChanges(updated);
    if (selectedGroup === groupName) setSelectedGroup(null);
  }

  function handleAddPermissionToGroup(groupName: string) {
    if (!permissions || !newGroupPermission.trim()) return;

    const currentPerms = permissions.groups[groupName] || [];
    if (currentPerms.includes(newGroupPermission.trim())) {
      setError("Permission already exists in group");
      return;
    }

    const updated = {
      ...permissions,
      groups: {
        ...permissions.groups,
        [groupName]: [...currentPerms, newGroupPermission.trim()],
      },
    };
    setPermissions(updated);
    updateChanges(updated);
    setNewGroupPermission("");
    setError(null);
  }

  function handleRemovePermissionFromGroup(groupName: string, permission: string) {
    if (!permissions) return;

    const updated = {
      ...permissions,
      groups: {
        ...permissions.groups,
        [groupName]: permissions.groups[groupName].filter((p) => p !== permission),
      },
    };
    setPermissions(updated);
    updateChanges(updated);
  }

  function updateChanges(data: Permissions) {
    const jsonStr = JSON.stringify(data, null, 2);
    setRawJson(jsonStr);
    setHasChanges(jsonStr !== originalData);
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
    if (!rawMode && permissions) {
      setRawJson(JSON.stringify(permissions, null, 2));
    } else if (rawMode) {
      try {
        const parsed = JSON.parse(rawJson) as Permissions;
        setPermissions(parsed);
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

  const groupNames = permissions ? Object.keys(permissions.groups) : [];
  const userCount = permissions ? Object.keys(permissions.users).length : 0;

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
          <Button variant="ghost" size="sm" onClick={loadPermissions} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {hasChanges && (
          <Button onClick={savePermissions} disabled={saving || isRunning} size="sm">
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
            <span className="text-sm font-medium text-muted-foreground">permissions.json</span>
          </div>
          <JsonEditor
            value={rawJson}
            onChange={handleRawJsonChange}
            disabled={isRunning}
            minHeight="450px"
          />
          {rawError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {rawError}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Groups */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Groups ({groupNames.length})
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="New group name..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                disabled={isRunning}
                className="text-sm"
              />
              <Button onClick={handleAddGroup} disabled={!newGroupName.trim() || isRunning} size="sm">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-1">
              {groupNames.map((name) => (
                <div
                  key={name}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedGroup === name ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                  }`}
                  onClick={() => setSelectedGroup(selectedGroup === name ? null : name)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {permissions?.groups[name]?.length || 0} perms
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveGroup(name);
                    }}
                    disabled={isRunning || name === "Default" || name === "OP"}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Group Permissions / Users */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              {selectedGroup ? (
                <>
                  <Shield className="h-4 w-4" />
                  {selectedGroup} Permissions
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Users ({userCount})
                </>
              )}
            </h3>
            {selectedGroup ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add permission (e.g., command.kick)..."
                    value={newGroupPermission}
                    onChange={(e) => setNewGroupPermission(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddPermissionToGroup(selectedGroup)}
                    disabled={isRunning}
                    className="text-sm font-mono"
                  />
                  <Button
                    onClick={() => handleAddPermissionToGroup(selectedGroup)}
                    disabled={!newGroupPermission.trim() || isRunning}
                    size="sm"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-1 max-h-48 overflow-auto">
                  {permissions?.groups[selectedGroup]?.map((perm) => (
                    <div
                      key={perm}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <code className="text-xs font-mono">{perm}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePermissionFromGroup(selectedGroup, perm)}
                        disabled={isRunning}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {(!permissions?.groups[selectedGroup] || permissions.groups[selectedGroup].length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No permissions in this group
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(permissions?.users || {}).map(([uuid, data]) => (
                  <div key={uuid} className="p-2 rounded-lg bg-muted/50">
                    <code className="text-xs font-mono block truncate">{uuid}</code>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {data.groups.map((g) => (
                        <Badge key={g} variant="outline" className="text-xs">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {userCount === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No users with custom permissions
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
