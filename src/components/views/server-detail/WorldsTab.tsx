import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Loader2,
  Globe,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Copy,
  Trash2,
  Settings2,
  Swords,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorldConfigEditor } from "./WorldConfigEditor";
import type { Instance, ServerStatus, WorldInfo, WorldsListResult, JsonWriteResult } from "@/lib/types";

interface WorldsTabProps {
  instance: Instance;
  serverStatus: ServerStatus;
}

export function WorldsTab({ instance, serverStatus }: WorldsTabProps) {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<WorldInfo | null>(null);

  // Duplicate dialog
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [worldToDuplicate, setWorldToDuplicate] = useState<WorldInfo | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [worldToDelete, setWorldToDelete] = useState<WorldInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isRunning = serverStatus === "running";

  useEffect(() => {
    loadWorlds();
  }, [instance.path]);

  async function loadWorlds() {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<WorldsListResult>("list_worlds", {
        instancePath: instance.path,
      });

      if (result.success) {
        setWorlds(result.worlds);
      } else {
        setError(result.error || "Failed to load worlds");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load worlds");
    } finally {
      setLoading(false);
    }
  }

  async function handleDuplicate() {
    if (!worldToDuplicate || !duplicateName.trim()) return;

    setDuplicating(true);
    try {
      const result = await invoke<JsonWriteResult>("duplicate_world", {
        worldPath: worldToDuplicate.path,
        newName: duplicateName.trim(),
      });

      if (result.success) {
        setDuplicateDialogOpen(false);
        setWorldToDuplicate(null);
        setDuplicateName("");
        await loadWorlds();
      } else {
        setError(result.error || "Failed to duplicate world");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate world");
    } finally {
      setDuplicating(false);
    }
  }

  async function handleDelete() {
    if (!worldToDelete) return;

    setDeleting(true);
    try {
      const result = await invoke<JsonWriteResult>("delete_world", {
        worldPath: worldToDelete.path,
      });

      if (result.success) {
        setDeleteDialogOpen(false);
        setWorldToDelete(null);
        if (selectedWorld?.path === worldToDelete.path) {
          setSelectedWorld(null);
        }
        await loadWorlds();
      } else {
        setError(result.error || "Failed to delete world");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete world");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If a world is selected, show the config editor
  if (selectedWorld) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedWorld(null)}>
            Back to Worlds
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{selectedWorld.name}</span>
        </div>

        {isRunning && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-500">
              Server is running. Changes may be overwritten when the server saves.
            </p>
          </div>
        )}

        <WorldConfigEditor worldPath={selectedWorld.path} isRunning={isRunning} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Worlds ({worlds.length})</span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadWorlds} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Warning when running */}
      {isRunning && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
          <p className="text-sm text-yellow-500">
            Server is running. Stop the server before making world changes.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Worlds Grid */}
      {worlds.length === 0 ? (
        <div className="rounded-lg border bg-card p-8">
          <p className="text-sm text-muted-foreground text-center">
            No worlds found. Start the server to create the default world.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {worlds.map((world) => (
            <div key={world.path} className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">{world.name}</h3>
                <div className="flex items-center gap-1">
                  {world.is_ticking && (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  )}
                  {world.is_pvp_enabled && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Swords className="h-2.5 w-2.5" />
                      PvP
                    </Badge>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="block text-foreground font-medium">Type</span>
                    {world.world_gen_type || "Unknown"} / {world.world_gen_name || "Default"}
                  </div>
                  <div>
                    <span className="block text-foreground font-medium">Seed</span>
                    <code className="font-mono">{world.seed?.toString() || "Unknown"}</code>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setSelectedWorld(world)}
                  >
                    <Settings2 className="h-3 w-3" />
                    Configure
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWorldToDuplicate(world);
                      setDuplicateName(`${world.name}_copy`);
                      setDuplicateDialogOpen(true);
                    }}
                    disabled={isRunning}
                    title="Duplicate"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setWorldToDelete(world);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={isRunning || world.name === "default"}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate World</DialogTitle>
            <DialogDescription>
              Create a copy of "{worldToDuplicate?.name}" with a new name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duplicate-name">New World Name</Label>
              <Input
                id="duplicate-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter new world name..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={!duplicateName.trim() || duplicating}>
              {duplicating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Duplicating...
                </>
              ) : (
                "Duplicate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete World</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{worldToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete World"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
